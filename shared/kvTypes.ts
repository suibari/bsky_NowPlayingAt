// Shapes of the KV entries the poller writes through PUT /api/cache and the
// web app reads back. `R` is the representative history record; the poller
// fills it from raw PDS records, the web app narrows it to its own schema.

export interface ArtistIndexTrack<R = unknown> {
  k: string;   // songKey
  c: number;   // plays across every user
  d: number;   // didIndex of the representative record's owner
  r: R;        // trimmed representative (most recent) record
}

export interface ArtistIndexEntry<R = unknown> {
  n: string;               // display name, casing of the most recent play
  p: number;               // total plays across every user
  l: [number, number][];   // [didIndex, plays], desc — feed-hidden users excluded
  t: ArtistIndexTrack<R>[]; // representative tracks, plays desc
}

/** One shard of the cross-user artist index (`artists_N`). DIDs are interned into `dids`. */
export interface ArtistIndex<R = unknown> {
  dids: string[];
  artists: Record<string, ArtistIndexEntry<R>>;
  shard: number;
  updatedAt: number;
}

export interface UserStatsSong<R = unknown> {
  k: string;   // songKey
  c: number;   // plays
  r: R;        // representative (most recent) play
}

export interface UserStatsArtist {
  k: string;   // normalized artist key
  n: string;   // display name, casing of the most recent play
  c: number;   // plays
}

export interface UserStatsEntry<R = unknown> {
  total: number;
  // Watermark: the newest history rkey counted into this entry. listRecords
  // returns rkeys (TIDs) newest-first, so the client only has to read until it
  // reaches this one to have everything the scan missed.
  rkey: string;
  hourlyUtc: number[];  // 24 slots, bucketed by UTC hour so any viewer can rotate it
  genreFreq: Record<string, number>;
  songs: UserStatsSong<R>[];
  artists: UserStatsArtist[];
}

/** Per-user all-time aggregate (`user_stats`). */
export interface UserStatsIndex<R = unknown> {
  users: Record<string, UserStatsEntry<R>>;
  updatedAt: number;
}
