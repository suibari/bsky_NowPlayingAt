// Cross-user artist index stored in KV under the `artists` key.
//
// Built by the poller (bsky_nowplayingat_server, scanAllHistory) from the same
// full PDS sweep that produces `stats`. Nothing here is a source of truth: every
// field is a pure derivation of history records living in users' own PDSs, and
// the whole entry is rebuilt from scratch every 30 minutes.
//
// The index is split across ARTIST_INDEX_SHARDS KV entries (`artists_0` …) so a
// single artist page only parses a fraction of it. Each shard interns its own
// DIDs into `dids` and references them by index; `/api/artists` unwraps that
// before responding, so clients never see the indices.
import type { HistoryRecord } from '$lib/schema';

export const ARTIST_INDEX_SHARDS = 4;

/**
 * Which shard an artist key lives in. FNV-1a over the key — mirrored byte for
 * byte from the poller's `artistShard` (bsky_nowplayingat_server/src/bsky.ts).
 * Both sides must agree or every lookup misses.
 */
export function artistShard(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % ARTIST_INDEX_SHARDS;
}

/**
 * A representative play, trimmed to what a track card renders. Genres, comments,
 * timestamps and resolved streaming links are dropped by the poller: cards look
 * streaming links up through Odesli on demand, and the rest is never shown here.
 */
export type ArtistTrackRecord = Pick<HistoryRecord, 'track' | 'artist'> &
  Partial<Pick<HistoryRecord, 'album' | 'img' | 'imgBlob' | 'trackUri' | 'postUri' | 'provider'>>;

export interface ArtistIndexTrack {
  k: string;   // songKey
  c: number;   // plays across every user
  d: number;   // didIndex of the representative record's owner
  r: ArtistTrackRecord;
}

export interface ArtistIndexEntry {
  n: string;               // display name, casing of the most recent play
  p: number;               // total plays across every user
  l: [number, number][];   // [didIndex, plays], desc — feed-hidden users excluded
  t: ArtistIndexTrack[];   // representative tracks, plays desc
}

export interface ArtistIndex {
  dids: string[];
  artists: Record<string, ArtistIndexEntry>;
  shard: number;
  updatedAt: number;
}

// --- response shape (indices resolved) ---

export interface ArtistListener {
  did: string;
  plays: number;
}

export interface ArtistTrack {
  key: string;
  plays: number;
  did: string;          // owner of the representative record, for artwork resolution
  record: ArtistTrackRecord;
}

export interface ArtistResponse {
  key: string;
  name: string;
  plays: number;
  listeners: ArtistListener[];
  tracks: ArtistTrack[];
  updatedAt: number;
}
