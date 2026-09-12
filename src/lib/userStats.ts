// Client side of the per-user listening aggregate.
//
// The poller sweeps every registered user's PDS every 30 minutes and leaves the
// result in KV (see `src/lib/server/userStats.ts`). Reading that is instant,
// where paging through a whole repo is not — but it is up to 30 minutes behind.
// So the profile page paints the cached aggregate, then folds in only the
// records created after the cache's watermark, read straight from the PDS.
//
// The PDS stays the source of truth; the cache is just a head start.
import type { HistoryRecord } from '$lib/schema';
import type { Track } from '$lib/music';
import type { UserStatsEntry, UserStatsResponse } from '$lib/server/userStats';
import { getHistory, songKey } from '$lib/bsky';
import { resolveArtworkUrl } from '$lib/artwork';
import { normalizeArtistStr } from '$lib/recommendation';

export type { UserStatsEntry, UserStatsResponse };

export type HistoryItem = { uri: string; cid: string; value: HistoryRecord };
export type HistoryPage = { records: HistoryItem[]; cursor?: string };

// Stop paging the delta after this many pages. 50 records per page, so this only
// ever matters if a user logged 500+ plays since the last sweep.
const DELTA_MAX_PAGES = 10;

export function rkeyOf(uri: string): string {
  return uri.split('/').pop() ?? '';
}

export async function fetchUserStats(did: string): Promise<UserStatsResponse | null> {
  try {
    const res = await fetch(`/api/user-stats?did=${encodeURIComponent(did)}`);
    if (!res.ok) return null;
    const { data } = await res.json();
    return data ?? null;
  } catch (e) {
    console.warn('Failed to fetch cached user stats', e);
    return null;
  }
}

/**
 * History records created after `watermark`, newest first.
 *
 * rkeys are TIDs, so they sort in creation order and listRecords returns them
 * newest-first: reading until the first rkey at or below the watermark is enough.
 * Pass `seed` when the caller has already fetched the first page (the profile
 * page does, for its history list) so the delta costs no extra request at all.
 */
export async function fetchHistoryDelta(
  did: string,
  watermark: string,
  seed?: HistoryPage,
): Promise<HistoryRecord[]> {
  const delta: HistoryRecord[] = [];
  let page = seed ?? (await getHistory(did));
  let pages = 0;

  for (;;) {
    let reachedWatermark = false;
    for (const r of page.records) {
      if (rkeyOf(r.uri) <= watermark) {
        reachedWatermark = true;
        break;
      }
      delta.push(r.value);
    }
    pages++;
    if (reachedWatermark || !page.cursor || pages >= DELTA_MAX_PAGES) break;
    page = await getHistory(did, page.cursor);
  }

  return delta;
}

/**
 * Fold newer records into a cached aggregate. `delta` must be newest-first, so
 * the first record seen for a song or artist carries the freshest display data.
 *
 * The cached lists hold more entries than the UI shows, which is what keeps this
 * honest: a handful of new plays cannot promote something into the visible top
 * N from outside the cached runners-up.
 */
export function mergeDelta(cached: UserStatsEntry, delta: HistoryRecord[]): UserStatsEntry {
  if (delta.length === 0) return cached;

  const merged: UserStatsEntry = {
    ...cached,
    hourlyUtc: [...cached.hourlyUtc],
    genreFreq: { ...cached.genreFreq },
    songs: cached.songs.map((s) => ({ ...s })),
    artists: cached.artists.map((a) => ({ ...a })),
  };

  const songAt = new Map(merged.songs.map((s, i) => [s.k, i]));
  const artistAt = new Map(merged.artists.map((a, i) => [a.k, i]));
  const freshSongs = new Set<string>();
  const freshArtists = new Set<string>();

  for (const val of delta) {
    merged.total++;

    const ts = val.postedAt ? new Date(val.postedAt).getTime() : NaN;
    if (!isNaN(ts)) merged.hourlyUtc[new Date(ts).getUTCHours()]++;

    const genres = Array.isArray(val.genres) ? val.genres : [];
    for (const g of genres) {
      const gk = String(g).trim().toLowerCase();
      if (gk) merged.genreFreq[gk] = (merged.genreFreq[gk] ?? 0) + 1;
    }

    const sk = songKey(val.artist, val.track, val.trackUri);
    if (sk) {
      const i = songAt.get(sk);
      if (i === undefined) {
        songAt.set(sk, merged.songs.length);
        merged.songs.push({ k: sk, c: 1, r: val });
        freshSongs.add(sk);
      } else {
        merged.songs[i].c++;
        // Newest-first, so only the first delta hit is the new representative.
        if (!freshSongs.has(sk)) {
          merged.songs[i].r = val;
          freshSongs.add(sk);
        }
      }
    }

    const ak = normalizeArtistStr(val.artist || '');
    if (!ak) continue;
    const j = artistAt.get(ak);
    if (j === undefined) {
      artistAt.set(ak, merged.artists.length);
      merged.artists.push({ k: ak, n: val.artist, c: 1 });
      freshArtists.add(ak);
    } else {
      merged.artists[j].c++;
      if (!freshArtists.has(ak)) {
        merged.artists[j].n = val.artist;
        freshArtists.add(ak);
      }
    }
  }

  merged.songs.sort((a, b) => b.c - a.c);
  merged.artists.sort((a, b) => b.c - a.c || a.n.localeCompare(b.n));
  return merged;
}

// The artist index stores representative plays trimmed to display fields, so the
// mapper below accepts anything with at least a title and an artist.
export type TrackLikeRecord = Pick<HistoryRecord, 'track' | 'artist'> &
  Partial<Omit<HistoryRecord, 'track' | 'artist'>>;

/** A history record as the shape TrackCard renders. */
export function historyRecordToTrack(val: TrackLikeRecord, did?: string): Track {
  return {
    id: val.trackUri ?? '',
    // @ts-ignore – provider is a loose string on history records
    provider: val.provider || 'itunes',
    title: val.track,
    artist: val.artist,
    album: val.album ?? '',
    artworkUrl: resolveArtworkUrl(val.imgBlob, val.img, did),
    trackUri: val.trackUri ?? '',
    spotifyUrl: val.links?.spotify,
    youtubeMusicUrl: val.links?.youtube,
    comment: val.comment,
  };
}

export interface ReportAggregate {
  total: number;
  top5: { track: Track; count: number; postUri?: string }[];
  hourly: number[];
  genreFreq: Record<string, number>;
  artistDisplay: Map<string, string>;
}

/**
 * Turn an aggregate into what the report tab renders.
 *
 * Hours are stored bucketed by UTC so any viewer can read them; rotating by the
 * local offset here reproduces the old `new Date(postedAt).getHours()` behaviour.
 * Zones on a half-hour offset round to the nearest hour.
 */
export function toReportAggregate(entry: UserStatsEntry, did?: string): ReportAggregate {
  const offset = Math.round(-new Date().getTimezoneOffset() / 60);
  const hourly = new Array(24).fill(0);
  for (let h = 0; h < 24; h++) {
    hourly[(h + offset + 48) % 24] += entry.hourlyUtc[h] ?? 0;
  }

  return {
    total: entry.total,
    top5: entry.songs.slice(0, 5).map((s) => ({
      track: historyRecordToTrack(s.r, did),
      count: s.c,
      postUri: s.r.postUri,
    })),
    hourly,
    genreFreq: entry.genreFreq,
    artistDisplay: new Map(entry.artists.map((a) => [a.k, a.n])),
  };
}

/** Most-played artists, for the hashtag pills under a profile handle. */
export function toArtistTags(
  entry: UserStatsEntry,
  limit: number,
): { key: string; name: string; count: number }[] {
  return entry.artists.slice(0, limit).map((a) => ({ key: a.k, name: a.n, count: a.c }));
}
