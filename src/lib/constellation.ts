import { type ConstellationRecord, REACTION_SOURCE, LIKE_SOURCE } from '$lib/schema';

export async function getBacklinks(
  subject: string,
  source?: string,
  limit: number = 100
): Promise<ConstellationRecord[]> {
  const allRecords: ConstellationRecord[] = [];
  let cursor: string | undefined;

  try {
    do {
      const params = new URLSearchParams();
      params.set('subject', subject);
      params.set('limit', limit.toString());
      if (source) params.set('source', source);
      if (cursor) params.set('cursor', cursor);

      const url = `https://constellation.microcosm.blue/xrpc/blue.microcosm.links.getBacklinks?${params.toString()}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();

        // Handle varied response formats (records, frames, links)
        const batch = (data.records || data.frames || data.links || []) as ConstellationRecord[];
        allRecords.push(...batch);

        cursor = data.cursor;
      } else {
        console.warn(`[Constellation] Fetch failed: ${res.status}`, await res.text());
        break;
      }
    } while (cursor);
  } catch (e) {
    console.error('[Constellation] Network error', e);
  }

  return allRecords;
}

/**
 * Fetch app.bsky.feed.like backlinks for a Bluesky post.
 * Returns the total like count (from Constellation's `total`) and the DIDs of
 * likers from the first page (enough to show a few avatars / dedupe).
 * Single request (no full pagination) to keep What's hot aggregation cheap.
 */
export async function getPostLikes(
  postUri: string,
  limit: number = 100
): Promise<{ count: number; dids: string[] }> {
  try {
    const params = new URLSearchParams();
    params.set('subject', postUri);
    params.set('source', LIKE_SOURCE);
    params.set('limit', limit.toString());

    const url = `https://constellation.microcosm.blue/xrpc/blue.microcosm.links.getBacklinks?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[Constellation] getPostLikes failed: ${res.status}`);
      return { count: 0, dids: [] };
    }

    const data = await res.json();
    const records = (data.records || data.frames || data.links || []) as ConstellationRecord[];
    const dids = Array.from(new Set(records.map((r) => r.did)));
    const count = typeof data.total === 'number' ? data.total : dids.length;
    return { count, dids };
  } catch (e) {
    console.error('[Constellation] getPostLikes network error', e);
    return { count: 0, dids: [] };
  }
}
