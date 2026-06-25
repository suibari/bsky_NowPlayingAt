import { get } from 'svelte/store';
import { userProfile } from '$lib/stores';
import { publicAgent, getPdsEndpoint } from '$lib/atproto';
import { getBacklinks } from '$lib/constellation';
import type { Track as MusicTrack } from '$lib/music';
import { type HistoryRecord, type PlaylistRecord, type ReactionRecord, type Track as SchemaTrack, type ConstellationRecord } from '$lib/schema';
import { Agent } from '@atproto/api';

export const NSID_HISTORY = 'com.suibari.nowplayingat.history';
export const NSID_CONFIG = 'com.suibari.nowplayingat.config';
export const NSID_REACTION = 'com.suibari.nowplayingat.reaction';
export const NSID_PLAYLIST = 'com.suibari.nowplayingat.playlist';

// --- HISTORY ---

export async function createHistoryRecord(track: MusicTrack, imgBlob?: string, postUri?: string) {
  const res = await fetch('/api/history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...track, imgBlob, postUri }),
  });
  if (!res.ok) throw new Error('Failed to create history record');
  return res.json();
}

export async function getHistory(did: string, cursor?: string): Promise<{
  records: { uri: string, cid: string, value: HistoryRecord }[];
  cursor?: string;
}> {
  const pds = await getPdsEndpoint(did);
  if (!pds) return { records: [] };

  const pdsAgent = new Agent({ service: pds });
  const res = await pdsAgent.com.atproto.repo.listRecords({
    repo: did,
    collection: NSID_HISTORY,
    limit: 50,
    cursor,
  });
  return {
    records: res.data.records as unknown as { uri: string, cid: string, value: HistoryRecord }[],
    cursor: res.data.cursor,
  };
}

export async function deleteHistoryRecord(rkey: string) {
  const res = await fetch('/api/history', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rkey }),
  });
  if (!res.ok) throw new Error('Failed to delete history record');
  return res.json();
}

// --- REACTIONS ---

export async function deleteReactionRecord(rkey: string) {
  const res = await fetch('/api/reaction', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rkey }),
  });
  if (!res.ok) throw new Error('Failed to delete reaction');
  return res.json();
}

export async function getMyRecentReaction(subjectUri: string): Promise<{ uri: string; value: ReactionRecord } | null> {
  const res = await fetch(`/api/reaction?subjectUri=${encodeURIComponent(subjectUri)}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data;
}

export async function createReactionRecord(opts: {
  subjectUri: string;
  emoji: string;
  track?: MusicTrack;
  playlist?: { record: any; author: { did: string; handle: string; avatar?: string; displayName?: string } }
}) {
  const res = await fetch('/api/reaction', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  if (!res.ok) throw new Error('Failed to create reaction');
  return res.json();
}

// --- PLAYLISTS ---

export async function createPlaylist(name: string) {
  const res = await fetch('/api/playlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, tracks: [] }),
  });
  if (!res.ok) throw new Error('Failed to create playlist');
  return res.json();
}

export async function getPlaylists(did: string): Promise<{ uri: string, cid: string, value: PlaylistRecord }[]> {
  const pds = await getPdsEndpoint(did);
  if (!pds) return [];

  const pdsAgent = new Agent({ service: pds });
  const res = await pdsAgent.com.atproto.repo.listRecords({
    repo: did,
    collection: NSID_PLAYLIST
  });
  return res.data.records as unknown as { uri: string, cid: string, value: PlaylistRecord }[];
}

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

export async function deletePlaylist(rkey: string) {
  const res = await fetch('/api/playlist', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rkey }),
  });
  if (!res.ok) throw new Error('Failed to delete playlist');
  return res.json();
}

export async function addToPlaylist(playlistUri: string, track: MusicTrack, currentPlaylistRecordWrapper: { uri: string, cid: string, value: PlaylistRecord }) {
  const content = currentPlaylistRecordWrapper.value;

  const newTracks: SchemaTrack[] = [...(content.tracks || []), {
    provider: track.provider,
    track: track.title,
    artist: track.artist,
    album: track.album,
    trackUri: track.trackUri,
    img: track.artworkUrl,
    links: { spotify: track.spotifyUrl, youtube: track.youtubeMusicUrl }
  }];

  const rkey = playlistUri.split('/').pop()!;

  const res = await fetch('/api/playlist', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rkey,
      record: { ...content, tracks: newTracks },
    }),
  });
  if (!res.ok) throw new Error('Failed to update playlist');
  return res.json();
}

// --- FEED ---

export async function postToFeed(track: MusicTrack, text?: string) {
  const res = await fetch('/api/feed/post', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ track, text }),
  });
  if (!res.ok) throw new Error('Failed to post to feed');
  return res.json();
}

// --- CONFIG ---

export async function ensureConfig() {
  await fetch('/api/config', { method: 'POST' });
}

// --- GLOBAL TIMELINE ---

const HUB_DID = 'did:plc:uixgxpiqf4i63p6rgpu7ytmx';
const HUB_REF = `at://${HUB_DID}/app.bsky.actor.profile/self`;

// Process slow per-user PDS fetches in batches so callers can render progressively.
const TIMELINE_BATCH_SIZE = 25;

/**
 * Build the global "Discover" timeline.
 * If `onProgress` is given, it is called after each user batch resolves with the
 * sorted items so far (so the UI can render incrementally). The fully-resolved,
 * sorted array is always returned at the end.
 */
export async function getGlobalTimeline(
  onProgress?: (items: any[], done: boolean) => void
) {
  const backlinks = await getBacklinks(HUB_REF, `${NSID_CONFIG}:hubRef`);
  const userDids = Array.from(new Set(backlinks.map(b => b.did)));

  if (userDids.length === 0) {
    onProgress?.([], true);
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
          res.data.records.forEach((r: any) => {
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
    onProgress?.(sorted(), bi === batches.length - 1);
  }

  return sorted();
}

// --- FOLLOWEES FEED (おすすめ) ---

/**
 * Build the "Recommend" feed: history records played by the people the given
 * user follows, returned in random order. Item shape matches the discovery
 * timeline `history` items so they can be rendered with ActivityCard.
 */
export async function getFolloweesFeed(did: string) {
  // 1. Collect followees (with their profiles) up to a reasonable cap.
  const follows: any[] = [];
  let cursor: string | undefined = undefined;
  for (let page = 0; page < 3; page++) {
    const res = await publicAgent.app.bsky.graph.getFollows({ actor: did, limit: 100, cursor });
    follows.push(...res.data.follows);
    cursor = res.data.cursor;
    if (!cursor) break;
  }

  if (follows.length === 0) return [];

  const profilesByDid = new Map<string, any>();
  follows.forEach((f) => profilesByDid.set(f.did, f));
  const followeeDids = Array.from(profilesByDid.keys());

  const followeeDidsSet = new Set(followeeDids);

  // 2. Try to use the cached global timeline to filter followee records.
  try {
    const cacheRes = await fetch('/api/timeline');
    if (cacheRes.ok) {
      const { data } = await cacheRes.json();
      if (data && Array.isArray(data) && data.length > 0) {
        const cachedItems = data.filter((item: any) => 
          item.author && item.author.did && followeeDidsSet.has(item.author.did) && item.type === 'history'
        );
        if (cachedItems.length > 0) {
          return cachedItems.sort(() => Math.random() - 0.5);
        }
      }
    }
  } catch (e) {
    console.warn("Failed to load timeline cache for followees feed", e);
  }

  // 3. Fallback: Fetch each followee's recent history in batches.
  const items: any[] = [];
  for (let i = 0; i < followeeDids.length; i += TIMELINE_BATCH_SIZE) {
    const batch = followeeDids.slice(i, i + TIMELINE_BATCH_SIZE);
    await Promise.all(batch.map(async (followeeDid) => {
      try {
        const { records } = await getHistory(followeeDid);
        const author = profilesByDid.get(followeeDid) || { did: followeeDid, handle: 'unknown' };
        records.forEach((r) => {
          items.push({
            type: 'history',
            author,
            record: r.value,
            uri: r.uri,
            cid: r.cid,
            indexedAt: (r.value as any).postedAt || (r.value as any).createdAt,
          });
        });
      } catch (e) {
        console.warn(`Failed to fetch history for ${followeeDid}`, e);
      }
    }));
  }

  // 4. Random order.
  return items.sort(() => Math.random() - 0.5);
}

// --- HYDRATION ---

export async function hydrateReactions(records: ConstellationRecord[]): Promise<{ record: ReactionRecord, authorDid: string, uri: string }[]> {
  const results: { record: ReactionRecord, authorDid: string, uri: string }[] = [];
  const pdsCache = new Map<string, string | null>();

  await Promise.all(records.map(async (rec) => {
    try {
      let pds = pdsCache.get(rec.did);
      if (pds === undefined) {
        pds = await getPdsEndpoint(rec.did);
        pdsCache.set(rec.did, pds);
      }
      if (!pds) return;

      const pdsAgent = new Agent({ service: pds });
      const res = await pdsAgent.com.atproto.repo.getRecord({
        repo: rec.did,
        collection: rec.collection,
        rkey: rec.rkey
      });

      if (res.success && res.data.value) {
        results.push({
          record: res.data.value as unknown as ReactionRecord,
          authorDid: rec.did,
          uri: res.data.uri || `at://${rec.did}/${rec.collection}/${rec.rkey}`
        });
      }
    } catch (e) { console.warn(`Failed to hydrate reaction for ${rec.did}:`, e); }
  }));

  return results;
}

// --- HOT CONTENT ---

// Stable per-song key. Auto-posts (Last.fm) have no trackUri, so we key songs by
// normalized artist::title and fall back to trackUri/subjectUri only if both empty.
export function songKey(artist?: string, track?: string, fallback?: string): string {
  const a = (artist || '').trim().toLowerCase();
  const t = (track || '').trim().toLowerCase();
  if (a || t) return `song:${a}::${t}`;
  return fallback || '';
}

// What's hot ranking windows / thresholds (tweak here to retune).
// AGGREGATION window: only reactions / history within this window are counted at all.
const HOT_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const TRENDING_WINDOW_MS = 24 * 60 * 60 * 1000; // "急上昇" window
const TRENDING_MIN = 3;                          // "急上昇" needs >= this many in the trending window
const HOT_BATCH_SIZE = 25;

type HotStat = {
  count: number;
  record: any;
  authors: any[];
  reactions: Record<string, any[]>;
  recent24: number;     // reactions within TRENDING_WINDOW_MS, for the trending badge
};

// Fetch likes for a Bluesky post via the AppView. Unlike Constellation's count-only
// backlinks, app.bsky.feed.like records carry a createdAt, so we can count likes
// within the trending window precisely. Also returns liker profiles (avatar/handle),
// avoiding a separate profile lookup. One request (first page) to keep it cheap.
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

export async function getHotContent(
  onProgress?: (data: { tracks: any[]; playlists: any[]; users: any[] }, done: boolean) => void
) {
  const backlinks = await getBacklinks(HUB_REF, `${NSID_CONFIG}:hubRef`);
  const uniqueDids = new Set(backlinks.map(b => b.did));

  const me = get(userProfile);
  if (me) uniqueDids.add(me.did);

  const userDids = Array.from(uniqueDids);
  if (userDids.length === 0) {
    const empty = { tracks: [], playlists: [], users: [] };
    onProgress?.(empty, true);
    return empty;
  }

  const profilesMap = new Map<string, any>();
  // songKey -> { Bluesky post AT-URIs, representative metadata for display }.
  // Includes Last.fm auto-posts (no trackUri) so their likes can surface too.
  const songPosts = new Map<string, { postUris: Set<string>, meta: any }>();

  const trackStats = new Map<string, HotStat>();
  const playlistStats = new Map<string, HotStat>();
  // did -> per-user history stats for the Top Users ranking
  const userStats = new Map<string, { profile: any, count: number, recent24: number }>();
  // cache hydrated playlist records across batch emits
  const playlistCache = new Map<string, any>();

  try {
    const chunks = [];
    for (let i = 0; i < userDids.length; i += 25) chunks.push(userDids.slice(i, i + 25));
    for (const chunk of chunks) {
      const pRes = await publicAgent.app.bsky.actor.getProfiles({ actors: chunk });
      pRes.data.profiles.forEach((p: any) => profilesMap.set(p.did, p));
    }
  } catch (e) { console.error('Failed to fetch profiles for hot content', e); }

  const addReaction = (r: any) => {
    // Aggregation condition: only reactions within the last week are measured.
    const ts = new Date(r.createdAt || 0).getTime();
    if (ts < Date.now() - HOT_WEEK_MS) return;

    let stat: HotStat | undefined;
    if (r.kind === 'playlist' && r.playlist?.uri) {
      const key = r.playlist.uri;
      if (!playlistStats.has(key)) playlistStats.set(key, { count: 0, record: r, authors: [], reactions: {}, recent24: 0 });
      stat = playlistStats.get(key)!;
    } else if (r.kind === 'track' || !r.kind) {
      // Reaction records store subjectUri = the track's web URL (trackUri).
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

  // Build the ranked result. Counts already only include in-window activity,
  // so items with no recent reactions/history simply never appear here.
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

    return { tracks, playlists, users };
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
            if (ts < Date.now() - HOT_WEEK_MS) {
              keepFetching = false;
              continue;
            }
            addReaction({ ...v, author: profilesMap.get(did) || { did, handle: 'unknown' }, uri: r.uri });
          }
          cursor = res.data.cursor;
          if (!cursor) keepFetching = false;
        }
      } catch { /* ignore */ }

      // History: collect song -> postUris for like aggregation, and per-user counts for Top Users.
      // Aggregation condition: only history added within the last week is measured.
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
            if (ts < Date.now() - HOT_WEEK_MS) {
              keepFetching = false;
              continue;
            }
            us.count++;
            if (ts >= Date.now() - TRENDING_WINDOW_MS) us.recent24++;
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
    }));

    onProgress?.(await buildResult(), false);
  }

  // --- Aggregate Bluesky post likes (app.bsky.feed.like) per song ---
  // Walk every song that has a Bluesky post (incl. Last.fm auto-posts with no
  // trackUri), sum likes across its posts, and either merge into the matching
  // reaction entry or create a "like-only" hot entry keyed by artist::title.
  const MAX_POSTS_PER_SONG = 5;     // cap posts queried per song
  const LIKE_QUERY_BUDGET = 150;    // overall cap on getPostLikes calls
  const HEART = '❤️';

  // Prioritize already-trending songs (more in-app reactions first).
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
      let recent24 = 0; // likes whose createdAt is within the trending window
      results.forEach((res) => {
        likeCount += res.count;
        recent24 += res.recent24;
        res.likers.forEach((a: any) => { if (a?.did && !likersByDid.has(a.did)) likersByDid.set(a.did, a); });
      });
      if (likeCount === 0) return;
      likeResults.set(key, { likeCount, recent24, likers: Array.from(likersByDid.values()) });
    }));
  }

  // Merge likes into existing reaction entries, or create like-only entries.
  likeResults.forEach(({ likeCount, recent24, likers }, key) => {
    let stat = trackStats.get(key);
    if (!stat) {
      // Like-only song (e.g. Last.fm auto-post): synthesize a record from history meta.
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
    stat.recent24 += recent24; // likes within 24h (by like createdAt) count toward 急上昇
    if (!stat.reactions[HEART]) stat.reactions[HEART] = [];
    likers.forEach((a) => {
      if (!stat!.reactions[HEART].find((u: any) => u.did === a.did)) {
        stat!.reactions[HEART].push({ did: a.did, handle: a.handle, avatar: a.avatar, displayName: a.displayName, reactionUri: undefined });
      }
      if (!stat!.authors.find((x: any) => x.did === a.did)) stat!.authors.push(a);
    });
  });

  const final = await buildResult();
  onProgress?.(final, true);
  return final;
}
