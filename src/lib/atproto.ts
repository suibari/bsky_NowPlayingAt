import { Agent as AtpAgent } from '@atproto/api';

export const publicAgent = new AtpAgent({ service: 'https://public.api.bsky.app' });

// Start OAuth flow: calls server-side route which returns the Bluesky authorize URL
export async function signIn(handle: string) {
  const res = await fetch(`/api/auth/login?handle=${encodeURIComponent(handle)}`);
  if (!res.ok) throw new Error('Failed to start OAuth flow');
  const { url } = await res.json();
  window.location.href = url;
}

export async function signOut() {
  await fetch('/api/auth/logout', { method: 'POST' });
}

// Helper: Resolve PDS endpoint from DID document
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
    console.error('Failed to resolve DID document', e);
  }
  return null;
}
