// Use base OAuthClient instead of NodeOAuthClient to avoid undici / node:dns
// which are incompatible with Cloudflare Workers.
import { OAuthClient } from '@atproto/oauth-client';
import { JoseKey } from '@atproto/jwk-jose';
import { AtprotoDohHandleResolver } from '@atproto-labs/handle-resolver';
import {
  setOAuthState, getOAuthState, delOAuthState,
  setOAuthSession, getOAuthSession, delOAuthSession,
} from './db';

const PROD_ORIGIN = 'https://nowplayingat.suibari.com';
const SCOPE = 'atproto blob:*/* repo:com.suibari.nowplayingat.config repo:com.suibari.nowplayingat.history repo:com.suibari.nowplayingat.playlist repo:com.suibari.nowplayingat.reaction repo:app.bsky.feed.post?action=create';

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
      const dpopKey = await JoseKey.fromJWK(dpopJwk);
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
  createKey: (algs: string[]) => JoseKey.generate(algs),
  getRandomValues: (n: number): Uint8Array => {
    const bytes = new Uint8Array(n);
    crypto.getRandomValues(bytes);
    return bytes;
  },
  digest: async (bytes: Uint8Array, algorithm: { name: string }): Promise<Uint8Array> => {
    const ab = await crypto.subtle.digest(algorithm.name, bytes as unknown as BufferSource);
    return new Uint8Array(ab);
  },
};

// CF Workers doesn't support redirect: 'error' in fetch options.
// @atproto-labs/did-resolver and @atproto-labs/handle-resolver use it as a
// security measure to prevent redirect following. Convert to 'manual' and
// throw manually if a 3xx is returned, preserving the same semantics.
function cfFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const redirect = input instanceof Request ? input.redirect : init?.redirect;
  if (redirect === 'error') {
    const req = new Request(input as RequestInfo, { redirect: 'manual' });
    return globalThis.fetch(req).then((res) => {
      if (res.status >= 300 && res.status < 400) {
        throw new TypeError('redirect is not allowed');
      }
      return res;
    });
  }
  return globalThis.fetch(input as RequestInfo, init);
}

// DoH handle resolver — no node:dns dependency.
// Using Google DoH (/resolve = JSON format) to avoid any potential CF Workers
// self-loop when calling cloudflare-dns.com from within Cloudflare.
const handleResolver = new AtprotoDohHandleResolver({
  dohEndpoint: 'https://dns.google/resolve',
  fetch: cfFetch,
});

function makeClient(clientMetadata: Record<string, unknown>): OAuthClient {
  return new OAuthClient({
    fetch: cfFetch,
    handleResolver,
    runtimeImplementation,
    stateStore,
    sessionStore,
    clientMetadata,
    responseMode: 'query',
  } as any);
}

export function createOAuthClient(origin: string): OAuthClient {
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
  const redirectUri = `${origin}/oauth/callback`;
  return makeClient({
    client_id: `${PROD_ORIGIN}/client-metadata.json`,
    client_name: 'なうぷれあっと',
    client_uri: PROD_ORIGIN,
    redirect_uris: [redirectUri],
    scope: SCOPE,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
    application_type: 'web',
    dpop_bound_access_tokens: true,
  });
}
