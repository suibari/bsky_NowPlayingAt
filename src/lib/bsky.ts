import { get } from 'svelte/store';
import { userProfile } from '$lib/stores';
import { publicAgent, getPdsEndpoint } from '$lib/atproto';
import { getBacklinks } from '$lib/constellation';
import type { Track as MusicTrack } from '$lib/music';
import { type HistoryRecord, type PlaylistRecord, type ReactionRecord, type Track as SchemaTrack, type ConstellationRecord } from '$lib/schema';
import type { AppBskyFeedPost, BlobRef } from '@atproto/api';
import { Agent } from '@atproto/api';

export const NSID_HISTORY = 'com.suibari.nowplayingat.history';
export const NSID_CONFIG = 'com.suibari.nowplayingat.config';
export const NSID_REACTION = 'com.suibari.nowplayingat.reaction';
export const NSID_PLAYLIST = 'com.suibari.nowplayingat.playlist';

// --- HISTORY ---

export async function createHistoryRecord(track: MusicTrack, imgBlob?: string | BlobRef, postUri?: string) {
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

const HUB_DID = 'did:plc:uixgxpiqf4i63p6rgpu7ytmx';
const HUB_REF = `at://${HUB_DID}/app.bsky.actor.profile/self`;

// Process slow per-user PDS fetches in batches so callers can render progressively.
const TIMELINE_BATCH_SIZE = 25;

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

// --- SONG KEY ---

// Stable per-song key. Auto-posts (Last.fm) have no trackUri, so we key songs by
// normalized artist::title and fall back to trackUri/subjectUri only if both empty.
export function songKey(artist?: string, track?: string, fallback?: string): string {
  const a = (artist || '').trim().toLowerCase();
  const t = (track || '').trim().toLowerCase();
  if (a || t) return `song:${a}::${t}`;
  return fallback || '';
}
