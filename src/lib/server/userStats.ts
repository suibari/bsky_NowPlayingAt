// Per-user listening aggregate stored in KV under the `user_stats` key.
//
// Built by the poller (server/src/bsky.ts, scanAllHistory) from the same
// full PDS sweep that produces `stats`. It exists so the profile page can paint
// real all-time numbers immediately instead of paging through a whole repo
// first; the client then merges anything newer than `rkey` straight from the PDS.
//
// Like every other KV entry here this is a disposable derivation — the records
// in each user's PDS remain the only source of truth.
import type { HistoryRecord } from '$lib/schema';
import type {
  UserStatsEntry as SharedUserStatsEntry,
  UserStatsIndex as SharedUserStatsIndex,
  UserStatsSong as SharedUserStatsSong,
} from '$shared/kvTypes';

export type { UserStatsArtist } from '$shared/kvTypes';
export type UserStatsSong = SharedUserStatsSong<HistoryRecord>;
export type UserStatsEntry = SharedUserStatsEntry<HistoryRecord>;
export type UserStatsIndex = SharedUserStatsIndex<HistoryRecord>;

export interface UserStatsResponse extends UserStatsEntry {
  did: string;
  updatedAt: number;
  // Artists for which this user has the highest all-time play count across all
  // registered users (ties included), ordered by this user's count.
  titleArtists: { key: string; count: number }[];
}
