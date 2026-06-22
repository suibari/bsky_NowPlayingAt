// Use base OAuthClient instead of NodeOAuthClient to avoid undici / node:dns
// which are incompatible with Cloudflare Workers.
import { OAuthClient } from '@atproto/oauth-client';
import { error as svelteKitError } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { JoseKey } from '@atproto/jwk-jose';
import { AtprotoDohHandleResolver } from '@atproto-labs/handle-resolver';
import {
  setOAuthState, getOAuthState, delOAuthState,
  setOAuthSession, getOAuthSession, delOAuthSession,
  tryAcquireLock, releaseLock,
} from './db';
import { clearDidCookie } from './session';

// CF Workers rejects `redirect: 'error'` in the Request constructor even though
// @atproto-labs/* use it everywhere as SSRF protection. Patch globalThis.Request
// via Proxy: convert 'error' → 'manual' at construction time. With 'manual',
// CF Workers returns an opaque redirect on 3xx (status 0, ok: false), which
// fetchOkProcessor then rejects — same security semantics, no redirects followed.
// This runs before any request handler fires (module initialisation time).
{
  const _R = globalThis.Request;
  globalThis.Request = new Proxy(_R, {
    construct(Target, [input, init]: [RequestInfo | URL, RequestInit?]) {
      if (!init) return new Target(input);
      // CF Workers doesn't support `redirect: 'error'` or the `cache` field
      // (even when set to undefined). Strip both before hitting the constructor.
      const { redirect, cache: _cache, ...rest } = init as any;
      return new Target(input, {
        ...rest,
        ...(redirect === 'error' ? { redirect: 'manual' } : redirect != null ? { redirect } : {}),
      });
    },
  }) as unknown as typeof Request;
}

const PROD_ORIGIN = 'https://nowplayingat.suibari.com';
const SCOPE = 'atproto blob:*/* repo:com.suibari.nowplayingat.config repo:com.suibari.nowplayingat.history repo:com.suibari.nowplayingat.playlist repo:com.suibari.nowplayingat.reaction repo:app.bsky.feed.post?action=create';

// CF Workers can generate secp256k1 keys but cannot import them back for ECDSA
// signing (SubtleCrypto only supports P-256/P-384/P-521). Sessions that contain
// a secp256k1 DPoP key are permanently unusable in CF Workers.
const SECP256K1_DELETED = 'secp256k1-key-unsupported-in-cf-workers';

// DPoP key store: serialise/deserialise the ephemeral DPoP key alongside the session.
// Mirrors NodeOAuthClient's toDpopKeyStore but uses JoseKey which works in CF Workers.
function toDpopKeyStore(store: {
  set(key: string, val: unknown): Promise<void>;
  get(key: string): Promise<unknown>;
  del(key: string): Promise<void>;
}) {
  return {
    async set(sub: string, { dpopKey, ...data }: any) {
      const dpopJwk = dpopKey.privateJwk;
      if (!dpopJwk) throw new Error('Private DPoP JWK is missing.');
      await store.set(sub, { ...data, dpopJwk });
    },
    async get(sub: string) {
      const result: any = await store.get(sub);
      if (!result) return undefined;
      const { dpopJwk, ...data } = result;
      if (dpopJwk?.kty === 'EC' && dpopJwk?.crv === 'secp256k1') {
        await store.del(sub).catch(() => {});
        throw new Error(SECP256K1_DELETED);
      }
      const dpopKey = await JoseKey.fromJWK(dpopJwk);
      // Sessions whose row was last written by a public-client flow (a localhost
      // dev login against a shared session store, or a pre-confidential-migration
      // login) persist authMethod {method:'none'}. The library refreshes using the
      // STORED authMethod, so under the now-confidential client it sends no
      // client_assertion and the AS rejects with
      // `invalid_request: ... required a "client_assertion"`. Replacing 'none' with
      // the 'legacy' sentinel makes the library re-negotiate against the CURRENT
      // client metadata (oauth-server-factory.fromIssuer): in production that
      // resolves to private_key_jwt and the refresh authenticates correctly (then
      // persists the upgraded authMethod); in local dev it resolves back to 'none'.
      if ((data as any).authMethod?.method === 'none') {
        (data as any).authMethod = 'legacy';
      }
      return { ...data, dpopKey };
    },
    del: (sub: string) => store.del(sub),
  };
}

const stateStore = toDpopKeyStore({
  set: (key, val) => setOAuthState(key, val),
  get: (key)      => getOAuthState(key),
  del: (key)      => delOAuthState(key),
});

const sessionStore = toDpopKeyStore({
  set: (sub, val) => setOAuthSession(sub, val),
  get: (sub)      => getOAuthSession(sub),
  del: (sub)      => delOAuthSession(sub),
});

// JoseKey.generate forces extractable:true so the private key can be serialized
// to PostgREST across CF Workers requests. WebcryptoKey generates non-extractable
// keys by default in CF Workers, making them impossible to persist.
const runtimeImplementation = {
  createKey: (algs: string[]) => {
    // CF Workers cannot sign with secp256k1 (ES256K) even though it can generate
    // the key. Always drop ES256K so the client picks a curve SubtleCrypto can
    // actually use for signing (e.g. P-256), in both dev and production.
    const safeAlgs = algs.filter(a => a !== 'ES256K');
    return JoseKey.generate(safeAlgs.length ? safeAlgs : ['ES256']);
  },
  getRandomValues: (n: number): Uint8Array => {
    const bytes = new Uint8Array(n);
    crypto.getRandomValues(bytes);
    return bytes;
  },
  digest: async (bytes: Uint8Array, algorithm: { name: string }): Promise<Uint8Array> => {
    // @atproto/oauth-client 0.5.x passes 'sha256'; CF Workers needs 'SHA-256'.
    const name = algorithm.name.toUpperCase().replace(/^SHA(\d)/, 'SHA-$1');
    const ab = await crypto.subtle.digest(name, bytes as unknown as BufferSource);
    return new Uint8Array(ab);
  },
  // Distributed lock so token refresh is serialised PER USER across Cloudflare
  // Workers isolates. Without this, runtime.usingLock falls back to an in-isolate
  // lock that can't see refreshes happening in another isolate, so the poller and
  // a browser session can refresh the same user concurrently — consuming each
  // other's single-use refresh token (`invalid_grant`) and killing the session.
  // Providing requestLock also makes hasImplementationLock=true, which disables
  // the library's weaker "wait 1s and re-read store" fallback (no longer needed).
  // The lock is best-effort: if the DB is unreachable we proceed without it rather
  // than break refresh entirely. The lease TTL covers a crashed/aborted holder.
  requestLock: async <T>(name: string, fn: () => T | PromiseLike<T>): Promise<T> => {
    const LOCK_TTL_MS = 30_000;   // lease length; matches the client's 30s refresh timeout
    const RETRY_MS = 200;
    const MAX_WAIT_MS = 15_000;   // give up waiting and proceed best-effort after this
    const owner = crypto.randomUUID();
    const deadline = Date.now() + MAX_WAIT_MS;
    let held = false;
    while (Date.now() < deadline) {
      try {
        held = await tryAcquireLock(name, owner, LOCK_TTL_MS);
      } catch (e) {
        // Lock infra hiccup must not break authentication.
        console.warn('[oauth-lock] acquire failed, proceeding without lock:', e);
        return await fn();
      }
      if (held) break;
      await new Promise((r) => setTimeout(r, RETRY_MS));
    }
    if (!held) console.warn('[oauth-lock] timed out acquiring', name, '— proceeding best-effort');
    try {
      return await fn();
    } finally {
      if (held) await releaseLock(name, owner).catch(() => {});
    }
  },
};

// Explicitly construct a Request so the globalThis.Request Proxy above fires,
// converting redirect:'error' → redirect:'manual' for CF Workers compatibility.
// Callers like WellKnownHandleResolver pass redirect:'error' in init directly to
// fetch() (not via new Request()), bypassing the proxy — which causes CF Workers
// to throw a TypeError and silently swallows the handle resolution result.
function cfFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const req = init != null || !(input instanceof Request)
    ? new Request(input as RequestInfo, init)
    : input;
  return globalThis.fetch(req);
}

// DoH handle resolver — no node:dns dependency.
// Using Google DoH (/resolve = JSON format) to avoid any potential CF Workers
// self-loop when calling cloudflare-dns.com from within Cloudflare.
const handleResolver = new AtprotoDohHandleResolver({
  dohEndpoint: 'https://dns.google/resolve',
  fetch: cfFetch,
});

// Confidential client signing key (private JWK in env). Used for `private_key_jwt`
// client authentication at the token endpoint. The matching PUBLIC key is published
// in static/client-metadata.json under `jwks` (same `kid`). Loaded once and cached.
// NOTE: $env/dynamic/private must be read inside a request scope on CF Workers, so
// this is lazily resolved on first createOAuthClient() call rather than at module init.
let clientKeyPromise: Promise<JoseKey> | undefined;
function getClientKey(): Promise<JoseKey> {
  if (!clientKeyPromise) {
    const raw = env.OAUTH_PRIVATE_KEY_JWK;
    if (!raw) throw new Error('OAUTH_PRIVATE_KEY_JWK is not set');
    clientKeyPromise = JoseKey.fromJWK(JSON.parse(raw)).catch((err) => {
      // Reset so a later request can retry instead of caching a rejected promise.
      clientKeyPromise = undefined;
      throw err;
    });
  }
  return clientKeyPromise;
}

function makeClient(
  clientMetadata: Record<string, unknown>,
  keyset?: Iterable<JoseKey>,
): OAuthClient {
  return new OAuthClient({
    fetch: cfFetch,
    handleResolver,
    runtimeImplementation,
    stateStore,
    sessionStore,
    clientMetadata,
    keyset,
    responseMode: 'query',
  } as any);
}

// Wraps restore() to handle session errors that require re-authentication.
// Pass `event` so that broken sessions also clear the browser `did` cookie,
// forcing a clean sign-out without the user having to click sign-out manually.
export async function restoreOAuthSession(client: OAuthClient, sub: string, event: RequestEvent) {
  // The library deletes a session (and dispatches a 'deleted' event) when its
  // refresh token is revoked/expired/invalid — i.e. the session is permanently
  // dead and the user must re-authenticate. Listen for that, scoped to this sub,
  // so we can sign the user out cleanly regardless of the underlying error
  // message (TokenRefreshError messages vary and the classes aren't exported).
  let sessionDeleted = false;
  const onDeleted = (e: any) => { if (e?.detail?.sub === sub) sessionDeleted = true; };
  (client as any).addEventListener?.('deleted', onDeleted);
  try {
    return await client.restore(sub);
  } catch (err) {
    // Dead session — clear the stale `did` cookie so the user is signed out and
    // only needs to sign in again. Covers:
    //   - the 'deleted' event fired during restore (delete succeeded), and
    //   - AggregateError 'Error while deleting stored value' (refresh failed AND
    //     the cleanup delete threw, so no 'deleted' event was dispatched), and
    //   - secp256k1 keys unusable in CF Workers.
    const isDeadSession =
      sessionDeleted ||
      (err instanceof AggregateError && err.message === 'Error while deleting stored value') ||
      (err instanceof Error && err.message === SECP256K1_DELETED);
    if (isDeadSession) {
      clearDidCookie(event);
      throw svelteKitError(401, 'Session expired. Please log in again.');
    }
    if (
      err instanceof Error &&
      err.message === 'Key does not match any alg supported by the server'
    ) {
      // Transient alg mismatch (e.g. stale metadata cache). Preserve the session.
      console.error('[oauth] DPoP alg mismatch for', sub, '— may be transient');
      throw svelteKitError(503, 'Authentication temporarily unavailable. Please try again.');
    }
    // Safety net for the confidential-client auth mismatch: the AS rejects the
    // refresh with `invalid_request` because the request carried no (or an
    // unusable) client_assertion. This is an OAuthResponseError, which the library
    // does NOT treat as invalid_grant, so it neither deletes the session nor retries
    // — leaving it to recur as HTTP 500 forever. (The primary fix above upgrades
    // 'none' sessions so this shouldn't trigger; if it still does, the session can't
    // be refreshed and a clean re-login is the only resolution.) Delete the stale
    // row ourselves and sign the user out cleanly.
    const isClientAuthError =
      !!err && typeof err === 'object' &&
      (err as any).error === 'invalid_request' &&
      /client_assertion|private_key_jwt/.test(
        (err as any).errorDescription ?? (err as any).message ?? '',
      );
    if (isClientAuthError) {
      console.error('[oauth] client auth rejected on refresh for', sub, '— deleting session');
      await delOAuthSession(sub).catch(() => {});
      clearDidCookie(event);
      throw svelteKitError(401, 'Session expired. Please log in again.');
    }
    throw err;
  } finally {
    (client as any).removeEventListener?.('deleted', onDeleted);
  }
}

export async function createOAuthClient(origin: string): Promise<OAuthClient> {
  // Only http: origins (localhost / 127.0.0.1) are local dev.
  // https: origins — including Cloudflare Pages Preview — use the production client.
  const isLocal = new URL(origin).protocol === 'http:';

  if (isLocal) {
    // ATProto loopback client:
    //   - client_id MUST start with "http://localhost" (exact string, per ATProto spec)
    //   - redirect_uri MUST use 127.0.0.1, NOT "localhost" (per RFC 8252 / library validation)
    const port = new URL(origin).port || '5173';
    const redirectUri = `http://127.0.0.1:${port}/oauth/callback`;
    return makeClient({
      client_id: `http://localhost?redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(SCOPE)}`,
      redirect_uris: [redirectUri],
      scope: SCOPE,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      application_type: 'web',
      dpop_bound_access_tokens: true,
    });
  }

  // For production AND Preview (any https: origin), use the production client_id.
  // The redirect_uri uses the actual request origin so Preview callbacks work,
  // but it must also be listed in /client-metadata.json on PROD_ORIGIN.
  //
  // Confidential client: authenticate at the token endpoint with `private_key_jwt`
  // using the signing key from env. This raises the session lifetime from the
  // public-client cap (2 weeks) to effectively unlimited (refresh tokens up to
  // 180 days), fixing the ~1-day session death seen in auto-post. The `jwks` is
  // omitted here — validateClientMetadata derives it from the keyset, and the
  // public keys are also published in static/client-metadata.json for the PDS.
  const clientKey = await getClientKey();
  const redirectUri = `${origin}/oauth/callback`;
  return makeClient({
    client_id: `${PROD_ORIGIN}/client-metadata.json`,
    client_name: 'なうぷれあっと',
    client_uri: PROD_ORIGIN,
    redirect_uris: [redirectUri],
    scope: SCOPE,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'private_key_jwt',
    token_endpoint_auth_signing_alg: 'ES256',
    application_type: 'web',
    dpop_bound_access_tokens: true,
  }, [clientKey]);
}
