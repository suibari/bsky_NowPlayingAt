// PostgREST access for nowplayingat schema tables (behind Cloudflare Access)
import { env } from '$env/dynamic/private';

const cfHeaders = () => ({
  'CF-Access-Client-Id': env.CF_CLIENT_ID,
  'CF-Access-Client-Secret': env.CF_CLIENT_SECRET,
});

// PostgREST multi-schema: GET uses Accept-Profile, writes use Content-Profile
const readHeaders = () => ({
  ...cfHeaders(),
  'Accept-Profile': 'nowplayingat',
});

const writeHeaders = () => ({
  ...cfHeaders(),
  'Content-Type': 'application/json',
  'Content-Profile': 'nowplayingat',
});

async function pgFetch(url: string, init: RequestInit): Promise<Response> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`PostgREST ${init.method ?? 'GET'} ${url} → ${res.status}: ${body}`);
  }
  return res;
}

// --- stateStore (oauth_states) ---

export async function setOAuthState(key: string, state: unknown): Promise<void> {
  await pgFetch(`${env.POSTGREST_URL}/oauth_states`, {
    method: 'POST',
    headers: { ...writeHeaders(), 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify({ key, state }),
  });
}

export async function getOAuthState(key: string): Promise<unknown> {
  const res = await pgFetch(
    `${env.POSTGREST_URL}/oauth_states?key=eq.${encodeURIComponent(key)}`,
    { headers: readHeaders() }
  );
  const rows: any[] = await res.json();
  return rows[0]?.state ?? undefined;
}

export async function delOAuthState(key: string): Promise<void> {
  await pgFetch(
    `${env.POSTGREST_URL}/oauth_states?key=eq.${encodeURIComponent(key)}`,
    { method: 'DELETE', headers: writeHeaders() }
  );
}

// --- sessionStore (oauth_sessions) ---

export async function setOAuthSession(sub: string, session: unknown): Promise<void> {
  await pgFetch(`${env.POSTGREST_URL}/oauth_sessions`, {
    method: 'POST',
    headers: { ...writeHeaders(), 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify({ sub, session }),
  });
}

export async function getOAuthSession(sub: string): Promise<unknown> {
  const res = await pgFetch(
    `${env.POSTGREST_URL}/oauth_sessions?sub=eq.${encodeURIComponent(sub)}`,
    { headers: readHeaders() }
  );
  const rows: any[] = await res.json();
  return rows[0]?.session ?? undefined;
}

export async function delOAuthSession(sub: string): Promise<void> {
  await pgFetch(
    `${env.POSTGREST_URL}/oauth_sessions?sub=eq.${encodeURIComponent(sub)}`,
    { method: 'DELETE', headers: writeHeaders() }
  );
}

// --- sessions (user settings for auto Now Playing) ---

export interface UserSession {
  did: string;
  bsky_handle: string;
  lastfm_username: string | null;
  last_scrobble_key: string | null;
  enabled: boolean;
  custom_text: string | null;
  attach_image: boolean;
  post_probability: number;
}

export async function upsertSession(data: {
  did: string;
  bsky_handle: string;
  lastfm_username: string;
  enabled: boolean;
  custom_text?: string | null;
  attach_image?: boolean;
  post_probability?: number;
}, onConflict: 'merge' | 'ignore' = 'merge'): Promise<void> {
  await pgFetch(`${env.POSTGREST_URL}/sessions`, {
    method: 'POST',
    headers: {
      ...writeHeaders(),
      'Prefer': onConflict === 'ignore'
        ? 'resolution=ignore-duplicates'
        : 'resolution=merge-duplicates',
    },
    body: JSON.stringify(data),
  });
}

export async function getSession(did: string): Promise<UserSession | null> {
  const res = await pgFetch(
    `${env.POSTGREST_URL}/sessions?did=eq.${encodeURIComponent(did)}`,
    { headers: readHeaders() }
  );
  const rows: UserSession[] = await res.json();
  return rows[0] ?? null;
}

export async function getAllEnabledUsers(): Promise<UserSession[]> {
  const res = await pgFetch(
    `${env.POSTGREST_URL}/sessions?enabled=eq.true`,
    { headers: readHeaders() }
  );
  return res.json();
}

export async function updateLastScrobble(did: string, key: string): Promise<void> {
  await pgFetch(
    `${env.POSTGREST_URL}/sessions?did=eq.${encodeURIComponent(did)}`,
    {
      method: 'PATCH',
      headers: writeHeaders(),
      body: JSON.stringify({ last_scrobble_key: key, last_scrobble_ts: new Date().toISOString() }),
    }
  );
}
