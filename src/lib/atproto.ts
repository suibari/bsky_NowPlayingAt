import { BrowserOAuthClient } from '@atproto/oauth-client-browser';
import { Agent as AtpAgent } from '@atproto/api';

export const publicAgent = new AtpAgent({ service: 'https://public.api.bsky.app' });

export let client: BrowserOAuthClient | null = null;

// Must match client-metadata.json
const SCOPE = 'atproto blob:*/* repo:com.suibari.nowplayingat.config repo:com.suibari.nowplayingat.history repo:com.suibari.nowplayingat.playlist repo:com.suibari.nowplayingat.reaction repo:app.bsky.feed.post?action=create';

export function getClient() {
  if (typeof window === 'undefined') return null;
  if (client) return client;

  const enc = encodeURIComponent;
  const origin = window.location.origin;
  // Simple detection for dev/local
  const isLocal = origin.includes('localhost') || origin.includes('127.0.0.1');

  // Note: Adjust specific logic if you have preview URLs
  let client_id = `${origin}/client-metadata.json`;
  const redirect_uri = `${origin}/`;

  if (isLocal) {
    // Special loopback client ID for local development
    // Note: The SCOPE here must match the metadata scope
    client_id = `http://localhost?redirect_uri=${enc(redirect_uri)}&scope=${enc(SCOPE)}`;
  }

  client = new BrowserOAuthClient({
    handleResolver: 'https://bsky.social',
    clientMetadata: {
      // Fallback or explicit override if needed, but usually fetched from client_id URL in prod
      // In local loopback, we rely on the loopback client logic
      client_id,
      client_name: 'なうぷれあっと',
      client_uri: origin,
      redirect_uris: [redirect_uri],
      scope: SCOPE,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      application_type: 'web',
      dpop_bound_access_tokens: true
    }
  });
  return client;
}

export async function signIn(handle: string) {
  const c = getClient();
  if (!c) return;
  await c.signIn(handle, {
    state: 'undefined',
    prompt: 'login'
  });
}

export async function signOut(did: string) {
  const c = getClient();
  if (!c) return;
  try {
    await c.revoke(did);
  } catch (e) {
    console.warn("Revoke failed", e);
  }
  // Clean up any local storage if you manually set items
}

// Helper: Resolve PDS endpoint
export async function getPdsEndpoint(did: string): Promise<string | null> {
  try {
    if (did.startsWith('did:plc:')) {
      const res = await fetch(`https://plc.directory/${did}`);
      const doc = await res.json();
      const service = doc.service?.find((s: any) => s.type === 'AtprotoPersonalDataServer');
      return service?.serviceEndpoint || null;
    } else if (did.startsWith('did:web:')) {
      const domain = did.slice(8);
      const res = await fetch(`https://${domain}/.well-known/did.json`);
      const doc = await res.json();
      const service = doc.service?.find((s: any) => s.type === 'AtprotoPersonalDataServer');
      return service?.serviceEndpoint || null;
    }
  } catch (e) {
    console.error("Failed to resolve DID document", e);
  }
  return null;
}
