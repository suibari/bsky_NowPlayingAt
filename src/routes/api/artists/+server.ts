import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { artistShard, type ArtistIndex, type ArtistResponse } from '$lib/server/artists';

// Public endpoint: one artist's cross-user aggregate.
//
// `key` is the normalized artist key (normalizeArtistStr / the poller's
// normalizeArtist). It travels as a query parameter rather than a route segment
// because artist names may contain slashes.
//
// The index is sharded across several KV entries, so this reads only the shard
// the key hashes to and hands back just the requested artist. `Cache-Control`
// keeps repeat views on the edge instead of re-parsing a shard every request.
export const GET: RequestHandler = async (event) => {
  const key = event.url.searchParams.get('key');
  if (!key) return json({ data: null }, { status: 400 });

  if (!event.platform?.env?.CACHE) {
    return json({ data: null, stale: true }, { status: 200 });
  }

  try {
    const shardKey = `artists_${artistShard(key)}`;
    const index = (await event.platform.env.CACHE.get(shardKey, 'json')) as ArtistIndex | null;
    const entry = index?.artists?.[key];
    if (!index || !entry) {
      return json({ data: null, stale: !index }, { status: 200 });
    }

    // Resolve the interned did indices so callers only ever see real DIDs.
    const didAt = (i: number) => index.dids[i] ?? '';
    const data: ArtistResponse = {
      key,
      name: entry.n,
      plays: entry.p,
      listeners: entry.l
        .map(([didIndex, plays]) => ({ did: didAt(didIndex), plays }))
        .filter((l) => l.did),
      tracks: entry.t.map((t) => ({
        key: t.k,
        plays: t.c,
        did: didAt(t.d),
        record: t.r,
      })),
      updatedAt: index.updatedAt,
    };

    return json(
      { data, updatedAt: index.updatedAt, stale: false },
      { headers: { 'Cache-Control': 'public, max-age=300' } },
    );
  } catch (e) {
    console.error('Failed to get artists cache', e);
    return json({ data: null, stale: true }, { status: 200 });
  }
};
