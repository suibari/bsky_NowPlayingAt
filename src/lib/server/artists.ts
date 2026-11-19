// Cross-user artist index stored in KV under the `artists` key.
//
// Built by the poller (server/src/bsky.ts, scanAllHistory) from the same
// full PDS sweep that produces `stats`. Nothing here is a source of truth: every
// field is a pure derivation of history records living in users' own PDSs, and
// the whole entry is rebuilt from scratch every hour.
//
// The index is split across ARTIST_INDEX_SHARDS KV entries (`artists_0` …) so a
// single artist page only parses a fraction of it. Each shard interns its own
// DIDs into `dids` and references them by index; `/api/artists` unwraps that
// before responding, so clients never see the indices.
import type { HistoryRecord } from '$lib/schema';
import type {
  ArtistIndex as SharedArtistIndex,
  ArtistIndexEntry as SharedArtistIndexEntry,
  ArtistIndexTrack as SharedArtistIndexTrack,
} from '$shared/kvTypes';

export { ARTIST_INDEX_SHARDS, artistShard } from '$shared/keys';

/**
 * A representative play, trimmed to what a track card renders. Genres, comments,
 * timestamps and saved streaming links are dropped by the poller: the play button
 * falls back to a Spotify search, and the rest is never shown here.
 */
export type ArtistTrackRecord = Pick<HistoryRecord, 'track' | 'artist'> &
  Partial<Pick<HistoryRecord, 'album' | 'img' | 'imgBlob' | 'trackUri' | 'postUri' | 'provider'>>;

export type ArtistIndexTrack = SharedArtistIndexTrack<ArtistTrackRecord>;
export type ArtistIndexEntry = SharedArtistIndexEntry<ArtistTrackRecord>;
export type ArtistIndex = SharedArtistIndex<ArtistTrackRecord>;

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
