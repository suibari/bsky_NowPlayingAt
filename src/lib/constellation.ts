import { type ConstellationRecord, REACTION_SOURCE } from '$lib/schema';

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
