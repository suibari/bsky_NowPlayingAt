// Global play-count stats stored in KV under the `stats` key.
//
// Populated by the poller (bsky_nowplayingat_server), which periodically scans
// every registered user's full PDS history and pushes the aggregate here via
// PUT /api/cache. `totalPlays` is the all-time count across all history records
// (including historical ones, bucketed by each record's postedAt/createdAt);
// `daily` holds per-day counts for the last 30 days.
export interface PlayStats {
  totalPlays: number;
  daily: Record<string, number>;
  updatedAt: number;
}
