// Keys shared by the poller (server/) and the web app (src/).
//
// The poller builds KV entries keyed by these values and the web app looks
// them up with the same functions, so both sides must agree byte for byte.
// Keep this file dependency-free: it is imported from Node (tsx) and from the
// Cloudflare Worker bundle alike.

/**
 * Normalized artist key: NFKC, Discogs disambiguation stripped
 * ("Nirvana (2)" / "米津玄師*"), whitespace collapsed, lowercased.
 */
export function normalizeArtist(raw?: string): string {
  if (!raw) return '';
  let s = raw.normalize('NFKC');
  s = s.replace(/\s*\(\d+\)\s*$/, '').replace(/\*+\s*$/, '');
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Per-song key used by the hot ranking, artist index and user stats. */
export function songKey(artist?: string, track?: string, fallback?: string): string {
  const a = (artist || '').trim().toLowerCase();
  const t = (track || '').trim().toLowerCase();
  if (a || t) return `song:${a}::${t}`;
  return fallback || '';
}

/** Number of KV entries (`artists_0` …) the artist index is split across. */
export const ARTIST_INDEX_SHARDS = 4;

/** Which shard an artist key lives in. FNV-1a over the normalized key. */
export function artistShard(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % ARTIST_INDEX_SHARDS;
}
