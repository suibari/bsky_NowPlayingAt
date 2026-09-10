import { Agent as AtpAgent } from '@atproto/api';

export const publicAgent = new AtpAgent({ service: 'https://public.api.bsky.app' });

// Start OAuth flow: calls server-side route which returns the Bluesky authorize URL
export async function signIn(handle: string) {
  const res = await fetch(`/api/auth/login?handle=${encodeURIComponent(handle)}`);
  if (!res.ok) throw new Error('Failed to start OAuth flow');
  const { url } = await res.json();
  window.location.href = url;
}

// Bluesky のアカウントを持っていない人向けのサインアップ導線。
// ハンドルの代わりに entryway を渡し、prompt=create で認可サーバーの
// アカウント作成画面から始める。作成が終わるとそのまま同意画面に進むので、
// 戻ってきた時点でサインイン済みになる。
export const DEFAULT_ENTRYWAY = 'https://bsky.social';

export async function signUp(entryway: string = DEFAULT_ENTRYWAY) {
  const res = await fetch(
    `/api/auth/login?handle=${encodeURIComponent(entryway)}&prompt=create`
  );
  if (!res.ok) throw new Error('Failed to start OAuth signup flow');
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
