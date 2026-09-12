import { publicAgent, getPdsEndpoint } from './atproto.js';
import { getBacklinks } from './constellation.js';
import { getHiddenFromFeedDids } from './db.js';
import { Agent } from '@atproto/api';
import { NSID_HISTORY, NSID_CONFIG, NSID_REACTION, NSID_PLAYLIST } from './schema.js';
import type { ReactionRecord, ConstellationRecord, PlaylistRecord } from './schema.js';
import { recommendSongKey, normalizeArtist } from './normalize.js';

// --- PLAYLISTS ---

export async function getPlaylist(did: string, rkey: string) {
  const pds = await getPdsEndpoint(did);
  if (!pds) throw new Error("PDS not found");

  const pdsAgent = new Agent({ service: pds });
  const res = await pdsAgent.com.atproto.repo.getRecord({
    repo: did,
    collection: NSID_PLAYLIST,
    rkey: rkey
  });
  return res.data;
}

// --- GLOBAL TIMELINE ---

const HUB_DID = 'did:plc:uixgxpiqf4i63p6rgpu7ytmx';
const HUB_REF = `at://${HUB_DID}/app.bsky.actor.profile/self`;

// Process slow per-user PDS fetches in batches so callers can render progressively.
const TIMELINE_BATCH_SIZE = 25;

// Workaround: legacy auto-created favorites have no isDefault flag.
// Until backfill exists, treat the oldest empty "お気に入り" playlist per user as default.
function isLegacyDefaultFavorites(record: PlaylistRecord, isOldestForAuthor: boolean): boolean {
  if (record.isDefault === true) return true;
  if (record.isDefault === false) return false;
  if (record.name !== 'お気に入り') return false;
  if (!Array.isArray(record.tracks) || record.tracks.length > 0) return false;
  return isOldestForAuthor;
}

/**
 * Build the global "Discover" timeline.
 */
export async function getGlobalTimeline() {
  const backlinks = await getBacklinks(HUB_REF, `${NSID_CONFIG}:hubRef`);
  const hiddenDids = new Set(await getHiddenFromFeedDids().catch(() => [] as string[]));
  const userDids = Array.from(new Set(backlinks.map(b => b.did))).filter(did => !hiddenDids.has(did));

  if (userDids.length === 0) {
    return [];
  }

  const timelineItems: any[] = [];
  let profilesMap = new Map<string, any>();

  try {
    const chunks = [];
    for (let i = 0; i < userDids.length; i += 25) chunks.push(userDids.slice(i, i + 25));
    for (const chunk of chunks) {
      const pRes = await publicAgent.app.bsky.actor.getProfiles({ actors: chunk });
      pRes.data.profiles.forEach((p: any) => profilesMap.set(p.did, p));
    }
  } catch (e) {
    console.error('Failed to fetch timeline profiles', e);
  }

  const fetchedPlaylists = new Map<string, any>();
  const sorted = () =>
    [...timelineItems].sort((a, b) => new Date(b.indexedAt).getTime() - new Date(a.indexedAt).getTime());

  const batches: string[][] = [];
  for (let i = 0; i < userDids.length; i += TIMELINE_BATCH_SIZE) {
    batches.push(userDids.slice(i, i + TIMELINE_BATCH_SIZE));
  }

  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi];
    const batchItems: any[] = [];

    await Promise.all(batch.map(async (did) => {
      const profile = profilesMap.get(did);
      const pds = await getPdsEndpoint(did);
      if (!pds) return;

      const pdsAgent = new Agent({ service: pds });

      const fetchCollection = async (collection: string, typeName: string) => {
        try {
          const res = await pdsAgent.com.atproto.repo.listRecords({ repo: did, collection, limit: 5 });
          const oldestPlaylistTs = collection === NSID_PLAYLIST
            ? res.data.records.reduce<number>((minTs, r: any) => {
              const ts = new Date(r.value?.createdAt ?? 0).getTime();
              if (isNaN(ts)) return minTs;
              return minTs === Number.POSITIVE_INFINITY ? ts : Math.min(minTs, ts);
            }, Number.POSITIVE_INFINITY)
            : Number.POSITIVE_INFINITY;

          res.data.records.forEach((r: any) => {
            if (collection === NSID_PLAYLIST) {
              const playlist = r.value as PlaylistRecord;
              const ts = new Date(playlist?.createdAt ?? 0).getTime();
              const isOldestForAuthor = !isNaN(ts) && oldestPlaylistTs !== Number.POSITIVE_INFINITY && ts === oldestPlaylistTs;
              if (isLegacyDefaultFavorites(playlist, isOldestForAuthor)) {
                return;
              }
            }

            batchItems.push({
              type: typeName,
              author: profile || { did, handle: 'unknown' },
              record: r.value,
              uri: r.uri,
              cid: r.cid,
              indexedAt: r.value.postedAt || r.value.createdAt
            });
          });
        } catch (e) { console.warn(`Failed fetch ${collection} for ${did}`, e); }
      };

      await Promise.all([
        fetchCollection(NSID_HISTORY, 'history'),
        fetchCollection(NSID_REACTION, 'reaction'),
        fetchCollection(NSID_PLAYLIST, 'playlist')
      ]);
    }));

    // Hydrate playlist reactions for this batch
    const playlistsToFetch = new Map<string, { did: string, rkey: string }>();
    batchItems.forEach(item => {
      if (item.type === 'reaction' && item.record.kind === 'playlist' && item.record.playlist?.uri) {
        const uri = item.record.playlist.uri;
        if (!fetchedPlaylists.has(uri) && !playlistsToFetch.has(uri)) {
          try {
            const parts = uri.split('/');
            const rkey = parts.pop();
            parts.pop();
            const did = parts.pop();
            if (did && rkey) playlistsToFetch.set(uri, { did, rkey });
          } catch { /* ignore */ }
        }
      }
    });

    await Promise.all(Array.from(playlistsToFetch.entries()).map(async ([uri, { did, rkey }]) => {
      try {
        const data = await getPlaylist(did, rkey);
        if (data?.value) fetchedPlaylists.set(uri, data.value);
      } catch { /* ignore */ }
    }));

    batchItems.forEach(item => {
      if (item.type === 'reaction' && item.record.kind === 'playlist' && item.record.playlist?.uri) {
        const fetched = fetchedPlaylists.get(item.record.playlist.uri);
        if (fetched) item.record.playlist.record = fetched;
      }
    });

    timelineItems.push(...batchItems);
  }

  return sorted();
}

// --- GLOBAL SCAN: PLAY STATS / ARTIST INDEX / PER-USER STATS ---

const STATS_BATCH_SIZE = 25;
const STATS_DAILY_RETENTION_DAYS = 30;
const STATS_MAX_PAGES_PER_USER = 100; // safety cap: 100 pages * 100 = 10k records/user

// List caps. Deliberately larger than what the UI shows: the client merges its
// own PDS delta (records newer than `rkey`) into these lists, and a delta can
// only reorder entries it can see. Keeping runners-up means the true top 5
// songs / top 10 artist tags survive the merge.
const ARTIST_TOP_TRACKS = 6;
const ARTIST_TOP_LISTENERS = 20;
const USER_TOP_SONGS = 12;   // report tab shows 5
const USER_TOP_ARTISTS = 30; // profile shows 10 tags

// The artist index is split across this many KV entries so a single artist page
// only ever parses a quarter of it. Four shards at the 30-minute cadence is 192
// writes/day, which together with snapshot/stats/user_stats stays well inside
// the 1000 writes/day KV limit.
const ARTIST_INDEX_SHARDS = 4;

// Trim a payload if it would ever outgrow a comfortable KV value.
const INDEX_SIZE_BUDGET = 2 * 1024 * 1024;

/**
 * Which shard an artist key lives in. FNV-1a over the key: cheap, stable, and
 * mirrored byte for byte in the web app (src/lib/server/artists.ts) — both sides
 * must agree or lookups miss.
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
 * Keep only what a track card renders. Full history records carry genres,
 * comments, timestamps and resolved streaming links, none of which the artist
 * page shows — and `links` alone is two long URLs per record. Cards resolve
 * streaming links through Odesli on demand anyway.
 */
function trimTrackRecord(v: any) {
  return {
    track: v.track,
    artist: v.artist,
    album: v.album || undefined,
    img: v.img || undefined,
    imgBlob: v.imgBlob || undefined,
    trackUri: v.trackUri || undefined,
    postUri: v.postUri || undefined,
    provider: v.provider || undefined,
  };
}

/** Cross-user artist aggregate. DIDs are interned into `dids` and referenced by index. */
export interface ArtistIndex {
  dids: string[];
  artists: Record<string, {
    n: string;                  // display name, casing of the most recent play
    p: number;                  // total plays across every user
    l: [number, number][];      // [didIndex, plays], desc — feed-hidden users excluded
    t: {                        // representative tracks, plays desc
      k: string;                // songKey
      c: number;                // plays
      d: number;                // didIndex of the representative record's owner
      r: any;                   // trimmed representative (most recent) record
    }[];
  }>;
  shard: number;
  updatedAt: number;
}

/** Per-user aggregate: everything the profile page derives from a full history scan. */
export interface UserStatsIndex {
  users: Record<string, {
    total: number;
    rkey: string;               // watermark: newest history rkey counted here
    hourlyUtc: number[];        // 24 slots, bucketed by UTC hour
    genreFreq: Record<string, number>;
    songs: { k: string; c: number; r: any }[];
    artists: { k: string; n: string; c: number }[];
  }>;
  updatedAt: number;
}

export interface ScanResult {
  stats: { totalPlays: number; daily: Record<string, number>; updatedAt: number };
  /** One entry per shard, in shard order. */
  artists: ArtistIndex[];
  users: UserStatsIndex;
}

// JST (UTC+9) calendar day so day boundaries match the app's primary audience.
function dayKeyJST(iso?: string): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return null;
  return new Date(t + 9 * 60 * 60 * 1000).toISOString().slice(0, 10); // YYYY-MM-DD
}

// ISO 8601 sorts lexicographically, so a plain string compare is chronological.
function isNewer(a?: string, b?: string): boolean {
  return (a || '') > (b || '');
}

type ArtistAcc = {
  n: string;
  nameAt: string;
  p: number;
  listeners: Map<string, number>;
  tracks: Map<string, { c: number; r: any; did: string; at: string }>;
};

type UserAcc = {
  total: number;
  rkey: string;
  hourlyUtc: number[];
  genreFreq: Record<string, number>;
  songs: Map<string, { c: number; r: any; at: string }>;
  artists: Map<string, { n: string; c: number; at: string }>;
};

/**
 * Walk every registered user's full PDS history once and derive three payloads:
 * the global play counter, the cross-user artist index, and a per-user aggregate
 * that lets the profile page skip its own full scan.
 *
 * All three are pure derivations of PDS records — throwing them away and
 * rebuilding costs nothing but one scan, which is why they live in KV and not
 * in a database of record.
 */
export async function scanAllHistory(): Promise<ScanResult> {
  const backlinks = await getBacklinks(HUB_REF, `${NSID_CONFIG}:hubRef`);
  const userDids = Array.from(new Set(backlinks.map(b => b.did)));
  // Feed-hidden users still count towards play totals and representative tracks;
  // they are only left out of the artist page's listener list.
  const hiddenDids = new Set(await getHiddenFromFeedDids().catch(() => [] as string[]));

  let totalPlays = 0;
  const daily: Record<string, number> = {};
  const dailyCutoff = Date.now() - STATS_DAILY_RETENTION_DAYS * 24 * 60 * 60 * 1000;

  const artistAcc = new Map<string, ArtistAcc>();
  const userAcc = new Map<string, UserAcc>();

  const batches: string[][] = [];
  for (let i = 0; i < userDids.length; i += STATS_BATCH_SIZE) {
    batches.push(userDids.slice(i, i + STATS_BATCH_SIZE));
  }

  for (const batch of batches) {
    await Promise.all(batch.map(async (did) => {
      const pds = await getPdsEndpoint(did);
      if (!pds) return;
      const pdsAgent = new Agent({ service: pds });

      const u: UserAcc = {
        total: 0,
        rkey: '',
        hourlyUtc: new Array(24).fill(0),
        genreFreq: {},
        songs: new Map(),
        artists: new Map(),
      };

      let cursor: string | undefined;
      let pages = 0;
      do {
        let res;
        try {
          res = await pdsAgent.com.atproto.repo.listRecords({
            repo: did,
            collection: NSID_HISTORY,
            limit: 100,
            cursor,
          });
        } catch (e) {
          console.warn(`[scan] listRecords failed for ${did}`, e);
          break;
        }
        for (const r of res.data.records as any[]) {
          const v = r.value ?? {};
          const iso: string = v.postedAt || v.createdAt || '';
          const ts = iso ? new Date(iso).getTime() : NaN;

          totalPlays++;
          if (!isNaN(ts) && ts >= dailyCutoff) {
            const key = dayKeyJST(iso);
            if (key) daily[key] = (daily[key] ?? 0) + 1;
          }

          // --- per-user ---
          u.total++;
          // TIDs sort lexicographically in creation order, so max() is the newest.
          const rkey = String(r.uri || '').split('/').pop() || '';
          if (rkey > u.rkey) u.rkey = rkey;
          if (!isNaN(ts)) u.hourlyUtc[new Date(ts).getUTCHours()]++;

          const genres: string[] = Array.isArray(v.genres) ? v.genres : (v.genre ? [v.genre] : []);
          for (const g of genres) {
            const gk = String(g).trim().toLowerCase();
            if (gk) u.genreFreq[gk] = (u.genreFreq[gk] ?? 0) + 1;
          }

          const sk = songKey(v.artist, v.track, v.trackUri);
          if (sk) {
            const song = u.songs.get(sk);
            if (song) {
              song.c++;
              // The representative is always the latest play, so the card's
              // artwork and its postUri come from the same, newest record.
              if (isNewer(iso, song.at)) { song.r = v; song.at = iso; }
            } else {
              u.songs.set(sk, { c: 1, r: v, at: iso });
            }
          }

          const ak = normalizeArtist(v.artist);
          if (!ak) continue;

          const mine = u.artists.get(ak);
          if (mine) {
            mine.c++;
            if (isNewer(iso, mine.at)) { mine.n = v.artist; mine.at = iso; }
          } else {
            u.artists.set(ak, { n: v.artist, c: 1, at: iso });
          }

          // --- cross-user artist index ---
          let a = artistAcc.get(ak);
          if (!a) {
            a = { n: v.artist, nameAt: iso, p: 0, listeners: new Map(), tracks: new Map() };
            artistAcc.set(ak, a);
          }
          a.p++;
          if (isNewer(iso, a.nameAt)) { a.n = v.artist; a.nameAt = iso; }
          if (!hiddenDids.has(did)) {
            a.listeners.set(did, (a.listeners.get(did) ?? 0) + 1);
          }
          if (sk) {
            const track = a.tracks.get(sk);
            if (track) {
              track.c++;
              if (isNewer(iso, track.at)) {
                track.r = trimTrackRecord(v);
                track.did = did;
                track.at = iso;
              }
            } else {
              a.tracks.set(sk, { c: 1, r: trimTrackRecord(v), did, at: iso });
            }
          }
        }
        cursor = res.data.cursor;
        pages++;
      } while (cursor && pages < STATS_MAX_PAGES_PER_USER);

      if (u.total > 0) userAcc.set(did, u);
    }));
  }

  const updatedAt = Date.now();
  return {
    stats: { totalPlays, daily, updatedAt },
    artists: buildArtistIndex(artistAcc, updatedAt),
    users: buildUserStatsIndex(userAcc, updatedAt),
  };
}

function buildArtistIndex(acc: Map<string, ArtistAcc>, updatedAt: number): ArtistIndex[] {
  // Each shard interns its own DIDs so it stays self-contained: one KV read is
  // all an artist page needs. DIDs repeat across thousands of artists while only
  // a few dozen exist, so interning is where most of the payload size goes away.
  const shards: ArtistIndex[] = Array.from({ length: ARTIST_INDEX_SHARDS }, (_, shard) => ({
    dids: [],
    artists: {},
    shard,
    updatedAt,
  }));
  const didIndex = shards.map(() => new Map<string, number>());
  const intern = (shard: number, did: string): number => {
    let i = didIndex[shard].get(did);
    if (i === undefined) {
      i = shards[shard].dids.length;
      shards[shard].dids.push(did);
      didIndex[shard].set(did, i);
    }
    return i;
  };

  for (const [key, a] of acc) {
    const shard = artistShard(key);
    shards[shard].artists[key] = {
      n: a.n,
      p: a.p,
      l: [...a.listeners.entries()]
        .sort(([, x], [, y]) => y - x)
        .slice(0, ARTIST_TOP_LISTENERS)
        .map(([did, c]) => [intern(shard, did), c] as [number, number]),
      t: [...a.tracks.entries()]
        .sort(([, x], [, y]) => y.c - x.c)
        .slice(0, ARTIST_TOP_TRACKS)
        .map(([k, t]) => ({ k, c: t.c, d: intern(shard, t.did), r: t.r })),
    };
  }

  for (const index of shards) {
    trimToBudget(
      index,
      `artists_${index.shard}`,
      () => Object.entries(index.artists).sort(([, x], [, y]) => x.p - y.p),
      ([key]) => { index.artists[key].t = []; index.artists[key].l = []; },
    );
  }
  return shards;
}

function buildUserStatsIndex(acc: Map<string, UserAcc>, updatedAt: number): UserStatsIndex {
  const users: UserStatsIndex['users'] = {};
  for (const [did, u] of acc) {
    users[did] = {
      total: u.total,
      rkey: u.rkey,
      hourlyUtc: u.hourlyUtc,
      genreFreq: u.genreFreq,
      songs: [...u.songs.entries()]
        .sort(([, x], [, y]) => y.c - x.c)
        .slice(0, USER_TOP_SONGS)
        .map(([k, s]) => ({ k, c: s.c, r: s.r })),
      artists: [...u.artists.entries()]
        .sort(([, x], [, y]) => y.c - x.c)
        .slice(0, USER_TOP_ARTISTS)
        .map(([k, a]) => ({ k, n: a.n, c: a.c })),
    };
  }

  const index: UserStatsIndex = { users, updatedAt };
  trimToBudget(
    index,
    'user_stats',
    () => Object.entries(index.users).sort(([, x], [, y]) => x.total - y.total),
    ([did]) => { index.users[did].songs = []; },
  );
  return index;
}

/** Drop detail from the smallest entries until the payload fits INDEX_SIZE_BUDGET. */
function trimToBudget<T>(
  payload: unknown,
  label: string,
  candidates: () => T[],
  strip: (entry: T) => void,
): void {
  if (JSON.stringify(payload).length <= INDEX_SIZE_BUDGET) return;
  const ordered = candidates();
  // Strip in chunks so the check costs at most ~20 serialisations, not one per entry.
  const chunk = Math.max(1, Math.ceil(ordered.length / 20));
  let stripped = 0;
  for (let i = 0; i < ordered.length; i += chunk) {
    for (let j = i; j < Math.min(i + chunk, ordered.length); j++) {
      strip(ordered[j]);
      stripped++;
    }
    if (JSON.stringify(payload).length <= INDEX_SIZE_BUDGET) break;
  }
  console.warn(`[scan] ${label} exceeded ${INDEX_SIZE_BUDGET} bytes; stripped detail from ${stripped} entries`);
}

// --- HOT CONTENT ---

export function songKey(artist?: string, track?: string, fallback?: string): string {
  const a = (artist || '').trim().toLowerCase();
  const t = (track || '').trim().toLowerCase();
  if (a || t) return `song:${a}::${t}`;
  return fallback || '';
}

const HOT_RANK_MS = 3 * 24 * 60 * 60 * 1000;    // 曲・ユーザーランキング集計期間（3日）
const HOT_HISTORY_MS = 7 * 24 * 60 * 60 * 1000; // 推薦プロファイル・タイムラインスキャン期間（7日）
const TRENDING_WINDOW_MS = 24 * 60 * 60 * 1000;
const TRENDING_MIN = 3;                          
const HOT_BATCH_SIZE = 25;

type HotStat = {
  count: number;
  record: any;
  authors: any[];
  reactions: Record<string, any[]>;
  recent24: number;     
};

async function getPostLikesDetailed(
  postUri: string,
  limit = 100
): Promise<{ count: number; recent24: number; likers: any[] }> {
  try {
    const res = await publicAgent.app.bsky.feed.getLikes({ uri: postUri, limit });
    const likes = res.data.likes || [];
    const cutoff = Date.now() - TRENDING_WINDOW_MS;
    let recent24 = 0;
    const likers = likes.map((l: any) => {
      if (new Date(l.createdAt).getTime() >= cutoff) recent24++;
      return l.actor;
    });
    return { count: likes.length, recent24, likers };
  } catch (e) {
    console.error('[bsky] getLikes failed for', postUri, e);
    return { count: 0, recent24: 0, likers: [] };
  }
}

export async function getHotContent() {
  const backlinks = await getBacklinks(HUB_REF, `${NSID_CONFIG}:hubRef`);
  const uniqueDids = new Set(backlinks.map(b => b.did));

  const userDids = Array.from(uniqueDids);
  if (userDids.length === 0) {
    return { tracks: [], playlists: [], users: [], userProfiles: {} as Record<string, { songKeys: string[], genreFreq: Record<string, number>, artistFreq: Record<string, number> }>, timeline: [] };
  }

  const profilesMap = new Map<string, any>();
  const songPosts = new Map<string, { postUris: Set<string>, meta: any }>();
  const playlistPosts = new Map<string, { postUris: Set<string>, meta: any, author: any }>();

  const trackStats = new Map<string, HotStat>();
  const playlistStats = new Map<string, HotStat>();
  const userStats = new Map<string, { profile: any, count: number, recent24: number }>();
  const playlistCache = new Map<string, any>();
  const timelineItems: any[] = [];

  // Per-user listening profile for the recommendation score (Jaccard + genre).
  // Built from the 7-day history scan below (HOT_HISTORY_MS, no extra PDS fetches);
  // rankings use the shorter HOT_RANK_MS window. genreFreq tolerates both the
  // current `genres: string[]` and legacy Phase-1 `genre: string` records.
  const userProfiles = new Map<string, { songKeys: Set<string>, genreFreq: Record<string, number>, artistFreq: Record<string, number> }>();
  const profileFor = (did: string) => {
    let p = userProfiles.get(did);
    if (!p) { p = { songKeys: new Set(), genreFreq: {}, artistFreq: {} }; userProfiles.set(did, p); }
    return p;
  };

  try {
    const chunks = [];
    for (let i = 0; i < userDids.length; i += 25) chunks.push(userDids.slice(i, i + 25));
    for (const chunk of chunks) {
      const pRes = await publicAgent.app.bsky.actor.getProfiles({ actors: chunk });
      pRes.data.profiles.forEach((p: any) => profilesMap.set(p.did, p));
    }
  } catch (e) { console.error('Failed to fetch profiles for hot content', e); }

  const addReaction = (r: any) => {
    const ts = new Date(r.createdAt || 0).getTime();
    if (ts < Date.now() - HOT_RANK_MS) return;

    let stat: HotStat | undefined;
    if (r.kind === 'playlist' && r.playlist?.uri) {
      const key = r.playlist.uri;
      if (!playlistStats.has(key)) playlistStats.set(key, { count: 0, record: r, authors: [], reactions: {}, recent24: 0 });
      stat = playlistStats.get(key)!;
    } else if (r.kind === 'track' || !r.kind) {
      const key = songKey(r.artist, r.track, r.subjectUri);
      if (key) {
        if (!trackStats.has(key)) trackStats.set(key, { count: 0, record: { ...r, trackUri: r.trackUri ?? r.subjectUri }, authors: [], reactions: {}, recent24: 0 });
        stat = trackStats.get(key)!;
      }
    }
    if (stat) {
      stat.count++;
      if (!stat.authors.find((a: any) => a.did === r.author.did)) stat.authors.push(r.author);
      const emoji = r.emoji || '👍';
      if (!stat.reactions[emoji]) stat.reactions[emoji] = [];
      stat.reactions[emoji].push({ did: r.author.did, handle: r.author.handle, avatar: r.author.avatar, displayName: r.author.displayName, reactionUri: r.uri });
      if (ts >= Date.now() - TRENDING_WINDOW_MS) stat.recent24++;
    }
  };

  const buildResult = async () => {
    const tracks = Array.from(trackStats.values())
      .filter(s => s.count > 0)
      .sort((a, b) => b.count - a.count)
      .map(s => ({
        ...s.record,
        reactionCount: s.count,
        recentReactors: s.authors.slice(0, 5),
        reactionGroups: Object.entries(s.reactions).map(([emoji, users]) => ({ emoji, users })),
        trending: s.recent24 >= TRENDING_MIN,
      }));

    const playlistsRanked = Array.from(playlistStats.values())
      .filter(s => s.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    const playlists: any[] = [];
    for (const item of playlistsRanked) {
      const uri = item.record.playlist?.uri;
      if (!uri) continue;
      let value = playlistCache.get(uri);
      if (value === undefined) {
        try {
          const parts = uri.split('/');
          const rkey = parts.pop();
          parts.pop();
          const did = parts.pop();
          if (did && rkey) {
            const data = await getPlaylist(did, rkey);
            value = data?.value ?? null;
          } else value = null;
        } catch { value = null; }
        playlistCache.set(uri, value);
      }
      if (!value) continue;
      playlists.push({
        playlist: value,
        author: item.record.playlist.author,
        reactionCount: item.count,
        recentReactors: item.authors.slice(0, 5),
        uri,
        reactionGroups: Object.entries(item.reactions).map(([emoji, users]) => ({ emoji, users })),
        trending: item.recent24 >= TRENDING_MIN,
      });
    }

    const users = Array.from(userStats.values())
      .filter(u => u.count > 0)
      .sort((a, b) => b.count - a.count)
      .map(u => ({
        did: u.profile?.did,
        handle: u.profile?.handle,
        displayName: u.profile?.displayName,
        avatar: u.profile?.avatar,
        historyCount: u.count,
        trending: u.recent24 >= TRENDING_MIN,
      }))
      .filter(u => u.did);

    const profiles: Record<string, { songKeys: string[], genreFreq: Record<string, number>, artistFreq: Record<string, number> }> = {};
    for (const [did, p] of userProfiles) {
      if (p.songKeys.size === 0) continue;
      profiles[did] = { songKeys: Array.from(p.songKeys), genreFreq: p.genreFreq, artistFreq: p.artistFreq };
    }

    // Hydrate playlist reactions for timeline (reuse playlistCache already populated above)
    const extraPlaylistUris = new Map<string, { did: string; rkey: string }>();
    for (const item of timelineItems) {
      if (item.type === 'reaction' && item.record.kind === 'playlist' && item.record.playlist?.uri) {
        const uri = item.record.playlist.uri;
        if (!playlistCache.has(uri) && !extraPlaylistUris.has(uri)) {
          try {
            const parts = uri.split('/');
            const rkey = parts.pop();
            parts.pop();
            const did = parts.pop();
            if (did && rkey) extraPlaylistUris.set(uri, { did, rkey });
          } catch { /* ignore */ }
        }
      }
    }
    await Promise.all(Array.from(extraPlaylistUris.entries()).map(async ([uri, { did, rkey }]) => {
      try {
        const data = await getPlaylist(did, rkey);
        if (data?.value) playlistCache.set(uri, data.value);
      } catch { /* ignore */ }
    }));
    for (const item of timelineItems) {
      if (item.type === 'reaction' && item.record.kind === 'playlist' && item.record.playlist?.uri) {
        const cached = playlistCache.get(item.record.playlist.uri);
        if (cached) item.record.playlist.record = cached;
      }
    }

    const timeline = [...timelineItems].sort(
      (a, b) => new Date(b.indexedAt).getTime() - new Date(a.indexedAt).getTime()
    );

    return { tracks, playlists, users, userProfiles: profiles, timeline };
  };

  const batches: string[][] = [];
  for (let i = 0; i < userDids.length; i += HOT_BATCH_SIZE) batches.push(userDids.slice(i, i + HOT_BATCH_SIZE));

  for (const batch of batches) {
    await Promise.all(batch.map(async (did) => {
      const pds = await getPdsEndpoint(did);
      if (!pds) return;

      const pdsAgent = new Agent({ service: pds });
      try {
        let cursor: string | undefined = undefined;
        let keepFetching = true;
        while (keepFetching) {
          const res = await pdsAgent.com.atproto.repo.listRecords({ repo: did, collection: NSID_REACTION, limit: 100, cursor });
          if (res.data.records.length === 0) break;
          for (const r of res.data.records) {
            const v = (r.value as any) || {};
            const ts = new Date(v.createdAt || 0).getTime();
            if (ts < Date.now() - HOT_RANK_MS) {
              keepFetching = false;
              continue;
            }
            addReaction({ ...v, author: profilesMap.get(did) || { did, handle: 'unknown' }, uri: r.uri });
            timelineItems.push({
              type: 'reaction',
              author: profilesMap.get(did) || { did, handle: 'unknown' },
              record: v,
              uri: r.uri,
              cid: r.cid,
              indexedAt: v.createdAt,
            });
          }
          cursor = res.data.cursor;
          if (!cursor) keepFetching = false;
        }
      } catch { /* ignore */ }

      try {
        const us = userStats.get(did) || { profile: profilesMap.get(did) || { did, handle: 'unknown' }, count: 0, recent24: 0 };
        let cursor: string | undefined = undefined;
        let keepFetching = true;
        
        while (keepFetching) {
          const hRes = await pdsAgent.com.atproto.repo.listRecords({ repo: did, collection: NSID_HISTORY, limit: 100, cursor });
          if (hRes.data.records.length === 0) break;
          
          for (const r of hRes.data.records) {
            const v = (r.value as any) || {};
            const ts = new Date(v.postedAt || v.createdAt || 0).getTime();
            if (ts < Date.now() - HOT_HISTORY_MS) {
              keepFetching = false;
              continue;
            }
            if (ts >= Date.now() - HOT_RANK_MS) us.count++;
            if (ts >= Date.now() - TRENDING_WINDOW_MS) us.recent24++;

            // Recommendation profile: every history record in the window (posted or not).
            const rk = recommendSongKey(v.artist, v.track);
            if (rk) {
              const prof = profileFor(did);
              prof.songKeys.add(rk);
              const gs: string[] = Array.isArray(v.genres) ? v.genres : (v.genre ? [v.genre] : []);
              for (const g of gs) {
                const gk = String(g).trim().toLowerCase();
                if (gk) prof.genreFreq[gk] = (prof.genreFreq[gk] || 0) + 1;
              }
              const ak = normalizeArtist(v.artist);
              if (ak) prof.artistFreq[ak] = (prof.artistFreq[ak] || 0) + 1;
            }

            timelineItems.push({
              type: 'history',
              author: profilesMap.get(did) || { did, handle: 'unknown' },
              record: v,
              uri: r.uri,
              cid: r.cid,
              indexedAt: v.postedAt || v.createdAt,
            });

            if (!v.postUri) continue;
            const key = songKey(v.artist, v.track, v.trackUri);
            if (!key) continue;
            if (!songPosts.has(key)) songPosts.set(key, { postUris: new Set(), meta: v });
            songPosts.get(key)!.postUris.add(v.postUri);
          }

          cursor = hRes.data.cursor;
          if (!cursor) keepFetching = false;
        }
        
        if (us.count > 0) userStats.set(did, us);
      } catch { /* ignore */ }

      // Playlists: collect postUris for like aggregation
      try {
        let cursor: string | undefined = undefined;
        let keepFetching = true;
        let oldestPlaylistTs = Number.POSITIVE_INFINITY;
        let oldestPlaylistUri: string | null = null;

        // Workaround pass: find the oldest playlist in the scanned window for this author.
        try {
          const firstPage = await pdsAgent.com.atproto.repo.listRecords({ repo: did, collection: NSID_PLAYLIST, limit: 100 });
          for (const r of firstPage.data.records) {
            const v = (r.value as any) || {};
            const ts = new Date(v.createdAt || 0).getTime();
            if (!isNaN(ts) && ts < oldestPlaylistTs) {
              oldestPlaylistTs = ts;
              oldestPlaylistUri = r.uri;
            }
          }
        } catch { /* ignore */ }

        while (keepFetching) {
          const pRes = await pdsAgent.com.atproto.repo.listRecords({ repo: did, collection: NSID_PLAYLIST, limit: 100, cursor });
          if (pRes.data.records.length === 0) break;
          
          for (const r of pRes.data.records) {
            const v = ((r.value as any) || {}) as PlaylistRecord;
            const tsP = new Date(v.createdAt || 0).getTime();
            const isOldestForAuthor = oldestPlaylistUri ? r.uri === oldestPlaylistUri : false;
            if (isLegacyDefaultFavorites(v, isOldestForAuthor)) {
              continue;
            }
            if (tsP >= Date.now() - HOT_HISTORY_MS) {
              timelineItems.push({
                type: 'playlist',
                author: profilesMap.get(did) || { did, handle: 'unknown' },
                record: v,
                uri: r.uri,
                cid: r.cid,
                indexedAt: v.createdAt,
              });
            }
            if (!v.postUri) continue;
            const uri = r.uri;
            if (!playlistPosts.has(uri)) playlistPosts.set(uri, { postUris: new Set(), meta: v, author: profilesMap.get(did) || { did, handle: 'unknown' } });
            playlistPosts.get(uri)!.postUris.add(v.postUri);
          }
          
          cursor = pRes.data.cursor;
          if (!cursor) keepFetching = false;
        }
      } catch { /* ignore */ }
    }));
  }

  const MAX_POSTS_PER_SONG = 5;     
  const LIKE_QUERY_BUDGET = 150;    
  const HEART = '❤️';

  const songEntries = Array.from(songPosts.entries()).sort((a, b) => {
    const ca = trackStats.get(a[0])?.count ?? 0;
    const cb = trackStats.get(b[0])?.count ?? 0;
    return cb - ca;
  });

  let budget = LIKE_QUERY_BUDGET;
  const budgetedSongs: [string, string[]][] = [];
  for (const [key, { postUris }] of songEntries) {
    if (budget <= 0) break;
    const uris = Array.from(postUris).slice(0, MAX_POSTS_PER_SONG);
    if (uris.length === 0) continue;
    budget -= uris.length;
    budgetedSongs.push([key, uris]);
  }

  const likeResults = new Map<string, { likeCount: number, recent24: number, likers: any[] }>();
  for (let i = 0; i < budgetedSongs.length; i += 25) {
    const chunk = budgetedSongs.slice(i, i + 25);
    await Promise.all(chunk.map(async ([key, uris]) => {
      const results = await Promise.all(uris.map((u) => getPostLikesDetailed(u)));
      const likersByDid = new Map<string, any>();
      let likeCount = 0;
      let recent24 = 0; 
      results.forEach((res) => {
        likeCount += res.count;
        recent24 += res.recent24;
        res.likers.forEach((a: any) => { if (a?.did && !likersByDid.has(a.did)) likersByDid.set(a.did, a); });
      });
      if (likeCount === 0) return;
      likeResults.set(key, { likeCount, recent24, likers: Array.from(likersByDid.values()) });
    }));
  }

  likeResults.forEach(({ likeCount, recent24, likers }, key) => {
    let stat = trackStats.get(key);
    if (!stat) {
      const meta = songPosts.get(key)?.meta || {};
      stat = {
        count: 0,
        record: {
          track: meta.track,
          artist: meta.artist,
          album: meta.album,
          img: meta.img,
          imgBlob: meta.imgBlob,
          trackUri: meta.trackUri,
          links: meta.links,
          provider: meta.provider,
          subjectUri: meta.trackUri,
        },
        authors: [],
        reactions: {},
        recent24: 0,
      };
      trackStats.set(key, stat);
    }
    stat.count += likeCount;
    stat.recent24 += recent24; 
    if (!stat.reactions[HEART]) stat.reactions[HEART] = [];
    likers.forEach((a) => {
      if (!stat!.reactions[HEART].find((u: any) => u.did === a.did)) {
        stat!.reactions[HEART].push({ did: a.did, handle: a.handle, avatar: a.avatar, displayName: a.displayName, reactionUri: undefined });
      }
      if (!stat!.authors.find((x: any) => x.did === a.did)) stat!.authors.push(a);
    });
  });

  // --- Aggregate Bluesky post likes for Playlists ---
  const budgetedPlaylists: [string, string[]][] = [];
  for (const [uri, { postUris }] of playlistPosts.entries()) {
    if (budget <= 0) break;
    const uris = Array.from(postUris).slice(0, MAX_POSTS_PER_SONG);
    if (uris.length === 0) continue;
    budget -= uris.length;
    budgetedPlaylists.push([uri, uris]);
  }

  const playlistLikeResults = new Map<string, { likeCount: number, recent24: number, likers: any[], author: any }>();
  for (let i = 0; i < budgetedPlaylists.length; i += 25) {
    const chunk = budgetedPlaylists.slice(i, i + 25);
    await Promise.all(chunk.map(async ([uri, uris]) => {
      const results = await Promise.all(uris.map((u) => getPostLikesDetailed(u)));
      const likersByDid = new Map<string, any>();
      let likeCount = 0;
      let recent24 = 0;
      results.forEach((res) => {
        likeCount += res.count;
        recent24 += res.recent24;
        res.likers.forEach((a: any) => { if (a?.did && !likersByDid.has(a.did)) likersByDid.set(a.did, a); });
      });
      if (likeCount === 0) return;
      const author = playlistPosts.get(uri)!.author;
      playlistLikeResults.set(uri, { likeCount, recent24, likers: Array.from(likersByDid.values()), author });
    }));
  }

  playlistLikeResults.forEach(({ likeCount, recent24, likers, author }, uri) => {
    let stat = playlistStats.get(uri);
    if (!stat) {
      const meta = playlistPosts.get(uri)?.meta || {};
      stat = {
        count: 0,
        record: {
          kind: 'playlist',
          playlist: {
            uri,
            title: meta.name,
            author,
            record: meta,
          },
          author,
        },
        authors: [],
        reactions: {},
        recent24: 0,
      };
      playlistStats.set(uri, stat);
    }
    stat.count += likeCount;
    stat.recent24 += recent24;
    if (!stat.reactions[HEART]) stat.reactions[HEART] = [];
    likers.forEach((a) => {
      if (!stat!.reactions[HEART].find((u: any) => u.did === a.did)) {
        stat!.reactions[HEART].push({ did: a.did, handle: a.handle, avatar: a.avatar, displayName: a.displayName, reactionUri: undefined });
      }
      if (!stat!.authors.find((x: any) => x.did === a.did)) stat!.authors.push(a);
    });
  });

  return await buildResult();
}
