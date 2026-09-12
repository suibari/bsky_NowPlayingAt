import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { UserStatsIndex, UserStatsResponse } from '$lib/server/userStats';

// Public endpoint: one user's all-time listening aggregate.
//
// The profile page paints from this instantly, then merges anything newer than
// `rkey` from the user's PDS. A miss (DID absent, or the index not built yet)
// returns null so the caller falls back to its own full history scan.
export const GET: RequestHandler = async (event) => {
  const did = event.url.searchParams.get('did');
  if (!did) return json({ data: null }, { status: 400 });

  if (!event.platform?.env?.CACHE) {
    return json({ data: null, stale: true }, { status: 200 });
  }

  try {
    const index = (await event.platform.env.CACHE.get('user_stats', 'json')) as UserStatsIndex | null;
    const entry = index?.users?.[did];
    if (!index || !entry) {
      return json({ data: null, stale: !index }, { status: 200 });
    }

    const data: UserStatsResponse = { ...entry, did, updatedAt: index.updatedAt };
    return json(
      { data, updatedAt: index.updatedAt, stale: false },
      { headers: { 'Cache-Control': 'public, max-age=300' } },
    );
  } catch (e) {
    console.error('Failed to get user_stats cache', e);
    return json({ data: null, stale: true }, { status: 200 });
  }
};
