import { get } from 'svelte/store';
import { userProfile } from '$lib/stores';
import { publicAgent, getPdsEndpoint } from '$lib/atproto';
import { getBacklinks, getPostLikes } from '$lib/constellation';
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

export async function getHistory(did: string): Promise<{ uri: string, cid: string, value: HistoryRecord }[]> {
  const pds = await getPdsEndpoint(did);
  if (!pds) return [];

  const pdsAgent = new Agent({ service: pds });
  const res = await pdsAgent.com.atproto.repo.listRecords({
    repo: did,
    collection: NSID_HISTORY,
    limit: 50
  });
  return res.data.records as unknown as { uri: string, cid: string, value: HistoryRecord }[];
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

export async function getGlobalTimeline() {
  const backlinks = await getBacklinks(HUB_REF, `${NSID_CONFIG}:hubRef`);
  const userDids = Array.from(new Set(backlinks.map(b => b.did)));

  if (userDids.length === 0) return [];

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

  await Promise.all(userDids.map(async (did) => {
    const profile = profilesMap.get(did);
    const pds = await getPdsEndpoint(did);
    if (!pds) return;

    const pdsAgent = new Agent({ service: pds });

    const fetchCollection = async (collection: string, typeName: string) => {
      try {
        const res = await pdsAgent.com.atproto.repo.listRecords({ repo: did, collection, limit: 5 });
        res.data.records.forEach((r: any) => {
          timelineItems.push({
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

  // Hydrate playlist reactions
  const playlistsToFetch = new Map<string, { did: string, rkey: string }>();
  timelineItems.forEach(item => {
    if (item.type === 'reaction' && item.record.kind === 'playlist' && item.record.playlist?.uri) {
      const uri = item.record.playlist.uri;
      if (!playlistsToFetch.has(uri)) {
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

  const fetchedPlaylists = new Map<string, any>();
  await Promise.all(Array.from(playlistsToFetch.entries()).map(async ([uri, { did, rkey }]) => {
    try {
      const data = await getPlaylist(did, rkey);
      if (data?.value) fetchedPlaylists.set(uri, data.value);
    } catch { /* ignore */ }
  }));

  timelineItems.forEach(item => {
    if (item.type === 'reaction' && item.record.kind === 'playlist' && item.record.playlist?.uri) {
      const fetched = fetchedPlaylists.get(item.record.playlist.uri);
      if (fetched) item.record.playlist.record = fetched;
    }
  });

  return timelineItems.sort((a, b) => new Date(b.indexedAt).getTime() - new Date(a.indexedAt).getTime());
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

export async function getHotContent() {
  const backlinks = await getBacklinks(HUB_REF, `${NSID_CONFIG}:hubRef`);
  const uniqueDids = new Set(backlinks.map(b => b.did));

  const me = get(userProfile);
  if (me) uniqueDids.add(me.did);

  const userDids = Array.from(uniqueDids);
  if (userDids.length === 0) return { tracks: [], playlists: [] };

  const reactions: any[] = [];
  const profilesMap = new Map<string, any>();
  // trackUri -> set of Bluesky post AT-URIs (one song can be posted by many users)
  const trackPostUris = new Map<string, Set<string>>();

  try {
    const chunks = [];
    for (let i = 0; i < userDids.length; i += 25) chunks.push(userDids.slice(i, i + 25));
    for (const chunk of chunks) {
      const pRes = await publicAgent.app.bsky.actor.getProfiles({ actors: chunk });
      pRes.data.profiles.forEach((p: any) => profilesMap.set(p.did, p));
    }
  } catch (e) { console.error('Failed to fetch profiles for hot content', e); }

  await Promise.all(userDids.map(async (did) => {
    const pds = await getPdsEndpoint(did);
    if (!pds) return;

    const pdsAgent = new Agent({ service: pds });
    try {
      const res = await pdsAgent.com.atproto.repo.listRecords({ repo: did, collection: NSID_REACTION, limit: 50 });
      res.data.records.forEach((r: any) => {
        reactions.push({ ...r.value, author: profilesMap.get(did) || { did, handle: 'unknown' }, uri: r.uri });
      });
    } catch { /* ignore */ }

    // Collect trackUri -> postUri so Bluesky likes can be aggregated per song.
    try {
      const hRes = await pdsAgent.com.atproto.repo.listRecords({ repo: did, collection: NSID_HISTORY, limit: 100 });
      hRes.data.records.forEach((r: any) => {
        const v = r.value || {};
        if (v.trackUri && v.postUri) {
          if (!trackPostUris.has(v.trackUri)) trackPostUris.set(v.trackUri, new Set());
          trackPostUris.get(v.trackUri)!.add(v.postUri);
        }
      });
    } catch { /* ignore */ }
  }));

  const trackStats = new Map<string, { count: number, record: any, authors: any[], reactions: Record<string, any[]>, likeCount?: number, likerDids?: string[] }>();
  const playlistStats = new Map<string, { count: number, record: any, authors: any[], reactions: Record<string, any[]> }>();

  reactions.forEach(r => {
    let stat;
    if (r.kind === 'playlist' && r.playlist?.uri) {
      const key = r.playlist.uri;
      if (!playlistStats.has(key)) playlistStats.set(key, { count: 0, record: r, authors: [], reactions: {} });
      stat = playlistStats.get(key)!;
    } else if ((r.kind === 'track' || !r.kind) && r.subjectUri) {
      const key = r.subjectUri;
      if (!trackStats.has(key)) trackStats.set(key, { count: 0, record: r, authors: [], reactions: {} });
      stat = trackStats.get(key)!;
    }
    if (stat) {
      stat.count++;
      if (!stat.authors.find((a: any) => a.did === r.author.did)) stat.authors.push(r.author);
      const emoji = r.emoji || '👍';
      if (!stat.reactions[emoji]) stat.reactions[emoji] = [];
      stat.reactions[emoji].push({ did: r.author.did, handle: r.author.handle, avatar: r.author.avatar, displayName: r.author.displayName, reactionUri: r.uri });
    }
  });

  // --- Aggregate Bluesky post likes (app.bsky.feed.like) per song ---
  // For the top tracks (by in-app reactions), sum likes across every post of
  // that song and merge likers into the ❤️ group + reaction count.
  const LIKE_TRACK_LIMIT = 30;      // only enrich the top N tracks (cost bound)
  const MAX_POSTS_PER_TRACK = 10;   // cap posts queried per song
  const HEART = '❤️';

  const topTrackKeys = Array.from(trackStats.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, LIKE_TRACK_LIMIT)
    .map(([key]) => key);

  const likerDidSet = new Set<string>();
  await Promise.all(topTrackKeys.map(async (key) => {
    const postUris = Array.from(trackPostUris.get(key) || []).slice(0, MAX_POSTS_PER_TRACK);
    if (postUris.length === 0) return;
    const results = await Promise.all(postUris.map((u) => getPostLikes(u)));
    const dids = new Set<string>();
    let likeCount = 0;
    results.forEach((res) => {
      likeCount += res.count;
      res.dids.forEach((d) => dids.add(d));
    });
    if (likeCount === 0) return;
    const stat = trackStats.get(key)!;
    stat.likeCount = likeCount;
    stat.likerDids = Array.from(dids);
    stat.likerDids.forEach((d) => likerDidSet.add(d));
  }));

  // Fetch profiles for likers we don't already know
  const missingLikerDids = Array.from(likerDidSet).filter((d) => !profilesMap.has(d));
  if (missingLikerDids.length > 0) {
    try {
      for (let i = 0; i < missingLikerDids.length; i += 25) {
        const chunk = missingLikerDids.slice(i, i + 25);
        const pRes = await publicAgent.app.bsky.actor.getProfiles({ actors: chunk });
        pRes.data.profiles.forEach((p: any) => profilesMap.set(p.did, p));
      }
    } catch (e) { console.error('Failed to fetch liker profiles', e); }
  }

  // Merge likes into stats: count + ❤️ group + recentReactors (dedupe by did)
  topTrackKeys.forEach((key) => {
    const stat = trackStats.get(key)!;
    if (!stat.likeCount || !stat.likerDids) return;
    stat.count += stat.likeCount;
    if (!stat.reactions[HEART]) stat.reactions[HEART] = [];
    stat.likerDids.forEach((d) => {
      const prof = profilesMap.get(d) || { did: d, handle: 'unknown' };
      if (!stat.reactions[HEART].find((u: any) => u.did === d)) {
        stat.reactions[HEART].push({ did: d, handle: prof.handle, avatar: prof.avatar, displayName: prof.displayName, reactionUri: undefined });
      }
      if (!stat.authors.find((a: any) => a.did === d)) stat.authors.push(prof);
    });
  });

  const hotTracks = Array.from(trackStats.values())
    .sort((a, b) => b.count - a.count)
    .map(s => ({
      ...s.record,
      reactionCount: s.count,
      recentReactors: s.authors.slice(0, 5),
      reactionGroups: Object.entries(s.reactions).map(([emoji, users]) => ({ emoji, users }))
    }));

  const hotPlaylistsRaw = Array.from(playlistStats.values()).sort((a, b) => b.count - a.count);
  const hydratedPlaylists = [];
  for (const item of hotPlaylistsRaw.slice(0, 20)) {
    try {
      const uri = item.record.playlist.uri;
      if (!uri) continue;
      const parts = uri.split('/');
      const rkey = parts.pop();
      parts.pop();
      const did = parts.pop();
      if (did && rkey) {
        const data = await getPlaylist(did, rkey);
        if (data?.value) {
          hydratedPlaylists.push({
            playlist: data.value,
            author: item.record.playlist.author,
            reactionCount: item.count,
            recentReactors: item.authors.slice(0, 5),
            uri,
            reactionGroups: Object.entries(item.reactions).map(([emoji, users]) => ({ emoji, users }))
          });
        }
      }
    } catch { /* ignore */ }
  }

  return { tracks: hotTracks, playlists: hydratedPlaylists };
}
