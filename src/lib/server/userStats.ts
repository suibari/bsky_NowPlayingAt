// Per-user listening aggregate stored in KV under the `user_stats` key.
//
// Built by the poller (bsky_nowplayingat_server, scanAllHistory) from the same
// full PDS sweep that produces `stats`. It exists so the profile page can paint
// real all-time numbers immediately instead of paging through a whole repo
// first; the client then merges anything newer than `rkey` straight from the PDS.
//
// Like every other KV entry here this is a disposable derivation — the records
// in each user's PDS remain the only source of truth.
import type { HistoryRecord } from '$lib/schema';

export interface UserStatsSong {
  k: string;         // songKey
  c: number;         // plays
  r: HistoryRecord;  // representative (most recent) play
}

export interface UserStatsArtist {
  k: string;   // normalized artist key
  n: string;   // display name, casing of the most recent play
  c: number;   // plays
}

export interface UserStatsEntry {
  total: number;
  // Watermark: the newest history rkey counted into this entry. listRecords
  // returns rkeys (TIDs) newest-first, so the client only has to read until it
  // reaches this one to have everything the scan missed.
  rkey: string;
  hourlyUtc: number[];  // 24 slots, bucketed by UTC hour so any viewer can rotate it
  genreFreq: Record<string, number>;
  songs: UserStatsSong[];
  artists: UserStatsArtist[];
}

export interface UserStatsIndex {
  users: Record<string, UserStatsEntry>;
  updatedAt: number;
}

export interface UserStatsResponse extends UserStatsEntry {
  did: string;
  updatedAt: number;
}
