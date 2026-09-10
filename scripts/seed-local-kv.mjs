// Seed the LOCAL KV namespace with a snapshot of production data.
//
// `vite dev` gets its CACHE binding from miniflare (.wrangler/state), which is a
// separate, empty namespace — not the production KV. Everything on the top page
// (みんなのなうぷれ / なうぷれライブ / なうぷれスタッツ) is served from that KV by the
// poller, so a fresh local KV renders every tab empty.
//
// This pulls the same data from production's PUBLIC read endpoints and writes it
// into the local KV through PUT /api/cache. Read-only against production.
//
// Usage:  npm run dev          # in another terminal
//         node scripts/seed-local-kv.mjs [http://127.0.0.1:5173]
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const LOCAL = process.argv[2] ?? 'http://127.0.0.1:5173';
const PROD = 'https://nowplayingat.suibari.com';

// Read NOWPLAYINGAT_SHARED_SECRET from .env (PUT /api/cache requires it).
let secret = process.env.NOWPLAYINGAT_SHARED_SECRET;
if (!secret) {
  try {
    for (const line of readFileSync(resolve(process.cwd(), '.env'), 'utf-8').split('\n')) {
      const [key, ...rest] = line.split('=');
      if (key?.trim() === 'NOWPLAYINGAT_SHARED_SECRET') secret = rest.join('=').trim();
    }
  } catch {
    // fall through to the error below
  }
}
if (!secret) {
  console.error('NOWPLAYINGAT_SHARED_SECRET is not set (env or .env)');
  process.exit(1);
}

async function getProd(path) {
  const res = await fetch(`${PROD}${path}`);
  if (!res.ok) throw new Error(`GET ${PROD}${path} → ${res.status}`);
  return res.json();
}

async function put(key, data) {
  const res = await fetch(`${LOCAL}/api/cache`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
    body: JSON.stringify({ key, data }),
  });
  if (!res.ok) throw new Error(`PUT ${key} → ${res.status}: ${await res.text()}`);
}

const [hot, timeline, userProfiles, stats] = await Promise.all([
  getProd('/api/hot'),
  getProd('/api/timeline'),
  getProd('/api/user-profiles'),
  getProd('/api/stats'),
]);

// The poller stores hot/timeline/user_profiles as one `snapshot` entry.
await put('snapshot', {
  hot: hot.data,
  timeline: timeline.data,
  user_profiles: userProfiles.data,
});

// GET /api/stats flattens `daily` into an array; the KV entry keys it by date.
await put('stats', {
  totalPlays: stats.totalPlays ?? 0,
  daily: Object.fromEntries((stats.daily ?? []).map(({ date, count }) => [date, count])),
  updatedAt: Date.now(),
});

console.log(
  `seeded ${LOCAL}: hot=${hot.data ? 'ok' : 'null'}`,
  `timeline=${timeline.data?.length ?? 0} items`,
  `user_profiles=${Object.keys(userProfiles.data ?? {}).length} users`,
  `totalPlays=${stats.totalPlays ?? 0}`,
);
