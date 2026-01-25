import { get } from 'svelte/store';
import { agent, userProfile } from '$lib/stores';
import { publicAgent, getPdsEndpoint } from '$lib/atproto';
import { getBacklinks } from '$lib/constellation';
import type { Track as MusicTrack } from '$lib/music';
import { type HistoryRecord, type PlaylistRecord, type ReactionRecord, type Track as SchemaTrack, type ConstellationRecord } from '$lib/schema';
import { RichText, Agent } from '@atproto/api';

export const NSID_HISTORY = 'com.suibari.nowplayingat.history';
export const NSID_CONFIG = 'com.suibari.nowplayingat.config';
export const NSID_REACTION = 'com.suibari.nowplayingat.reaction';
export const NSID_PLAYLIST = 'com.suibari.nowplayingat.playlist';

// --- HISTORY ---

export async function createHistoryRecord(track: MusicTrack) {
  const ag = get(agent);
  const profile = get(userProfile);
  if (!ag || !profile) throw new Error("Not authenticated");

  // await ensureConfig();

  const record: HistoryRecord = {
    $type: NSID_HISTORY,
    provider: track.provider,
    track: track.title,
    artist: track.artist,
    album: track.album,
    trackUri: track.trackUri,
    img: track.artworkUrl,
    links: {
      spotify: track.spotifyUrl,
      youtube: track.youtubeMusicUrl
    },
    comment: track.comment,
    postedAt: new Date().toISOString()
  };

  return await ag.com.atproto.repo.createRecord({
    repo: profile.did,
    collection: NSID_HISTORY,
    record: record as any
  });
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
  const ag = get(agent);
  const profile = get(userProfile);
  if (!ag || !profile) throw new Error("Not authenticated");

  return await ag.com.atproto.repo.deleteRecord({
    repo: profile.did,
    collection: NSID_HISTORY,
    rkey: rkey
  });
}

// --- REACTIONS ---

export async function deleteReactionRecord(rkey: string) {
  const ag = get(agent);
  const profile = get(userProfile);
  if (!ag || !profile) throw new Error("Not authenticated");

  return await ag.com.atproto.repo.deleteRecord({
    repo: profile.did,
    collection: NSID_REACTION,
    rkey: rkey
  });
}

export async function createReactionRecord(opts: {
  subjectUri: string;
  emoji: string;
  track?: MusicTrack;
  playlist?: { record: any; author: { did: string; handle: string; avatar?: string; displayName?: string } }
}) {
  const ag = get(agent);
  const profile = get(userProfile);
  if (!ag || !profile) throw new Error("Not authenticated");

  const record: any = {
    $type: NSID_REACTION,
    subjectUri: opts.subjectUri,
    emoji: opts.emoji,
    createdAt: new Date().toISOString()
  };

  if (opts.track) {
    record.kind = 'track';
    record.provider = opts.track.provider;
    record.track = opts.track.title;
    record.artist = opts.track.artist;
    record.album = opts.track.album;
    record.img = opts.track.artworkUrl;
    record.links = {
      spotify: opts.track.spotifyUrl,
      youtube: opts.track.youtubeMusicUrl
    };
  } else if (opts.playlist) {
    record.kind = 'playlist';
    record.playlist = {
      uri: opts.subjectUri,
      title: opts.playlist.record.name,
      author: opts.playlist.author
    };
  }

  return await ag.com.atproto.repo.createRecord({
    repo: profile.did,
    collection: NSID_REACTION,
    record: record as any
  });
}

// --- PLAYLISTS ---

export async function createPlaylist(name: string) {
  const ag = get(agent);
  const profile = get(userProfile);
  if (!ag || !profile) throw new Error("Not authenticated");

  return await ag.com.atproto.repo.createRecord({
    repo: profile.did,
    collection: NSID_PLAYLIST,
    record: {
      $type: NSID_PLAYLIST,
      name: name,
      tracks: [],
      createdAt: new Date().toISOString()
    }
  });
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
  const ag = get(agent);
  const profile = get(userProfile);
  if (!ag || !profile) throw new Error("Not authenticated");

  return await ag.com.atproto.repo.deleteRecord({
    repo: profile.did,
    collection: NSID_PLAYLIST,
    rkey: rkey
  });
}

export async function addToPlaylist(playlistUri: string, track: MusicTrack, currentPlaylistRecordWrapper: { uri: string, cid: string, value: PlaylistRecord }) {
  const ag = get(agent);
  const profile = get(userProfile);
  if (!ag || !profile) throw new Error("Not authenticated");

  // currentPlaylistRecordWrapper is { uri, cid, value: { name, tracks, ... } }
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

  // playlistUri: at://did/collection/rkey
  const rkey = playlistUri.split('/').pop()!;

  return await ag.com.atproto.repo.putRecord({
    repo: profile.did,
    collection: NSID_PLAYLIST,
    rkey: rkey,
    record: {
      ...content, // Spread the original CONTENT (name, etc)
      tracks: newTracks // Override tracks
    }
  });
}

// --- FEED ---

export async function postToFeed(track: MusicTrack, text?: string) {
  const ag = get(agent);
  const profile = get(userProfile);
  if (!ag || !profile) throw new Error("Not authenticated");

  // 1. Determine Target Link & Description
  let targetUrl = track.trackUri;
  let serviceName = "Apple Music";

  if (track.spotifyUrl) {
    targetUrl = track.spotifyUrl;
    serviceName = "Spotify";
  } else if (track.youtubeMusicUrl) {
    targetUrl = track.youtubeMusicUrl;
    serviceName = "YouTube Music";
  }

  // 2. Handle Thumbnail Upload
  let thumbBlob = undefined;
  if (track.artworkUrl) {
    try {
      // Fetch image
      const res = await fetch(track.artworkUrl.replace('100x100', '600x600'));
      if (res.ok) {
        const blob = await res.blob();
        // Limit size if necessary (Bluesky limit is ~1MB for blobs, strictly enforced)
        // iTunes 600x600 JPEGs are usually < 100KB, so safe.
        const uploadRes = await ag.uploadBlob(blob, { encoding: "image/jpeg" });
        thumbBlob = uploadRes.data.blob;
      }
    } catch (e) {
      console.warn("Failed to upload thumbnail for post", e);
    }
  }

  // 3. Construct Text & Facets
  const profileLink = `https://nowplayingat.suibari.com/profile/${profile.did}`;
  const linkLabel = "💿なうぷれあっとで見る";

  // We construct the text segments
  const comment = text || track.comment;

  const segments = [
    `#NowPlaying #なうぷれ`,
    comment ? `\n\n${comment}` : "",
    `\n\n${track.title} - ${track.artist}\n`,
    linkLabel
  ];

  const finalString = segments.join('');

  const rt = new RichText({ text: finalString });
  await rt.detectFacets(ag); // Detect hashtags in the first part

  const linkStartRequest = finalString.indexOf(linkLabel);

  // Calculate byte offsets for the link label
  const enc = new TextEncoder();
  const leadingText = finalString.substring(0, linkStartRequest);
  const linkText = finalString.substring(linkStartRequest, linkStartRequest + linkLabel.length);

  const startByte = enc.encode(leadingText).byteLength;
  const endByte = startByte + enc.encode(linkText).byteLength;

  if (!rt.facets) rt.facets = [];
  rt.facets.push({
    index: {
      byteStart: startByte,
      byteEnd: endByte
    },
    features: [{
      $type: 'app.bsky.richtext.facet#link',
      uri: profileLink
    }]
  });

  // 4. Construct Embed (External Link Card)
  const embed = {
    $type: 'app.bsky.embed.external',
    external: {
      uri: targetUrl,
      title: `${track.title} - ${track.artist}`,
      description: `Listen on ${serviceName}`,
      thumb: thumbBlob
    }
  };

  return await ag.post({
    text: rt.text,
    facets: rt.facets,
    embed: embed,
    createdAt: new Date().toISOString()
  });
}

// --- CONFIG ---

const HUB_DID = 'did:plc:uixgxpiqf4i63p6rgpu7ytmx';
const HUB_REF = `at://${HUB_DID}/app.bsky.actor.profile/self`;

export async function ensureConfig() {
  const ag = get(agent);
  const profile = get(userProfile);
  if (!ag || !profile) return;

  try {
    const res = await ag.com.atproto.repo.listRecords({
      repo: profile.did,
      collection: NSID_CONFIG,
      limit: 1
    });

    // Check if config points to correct Hub
    if (res.data.records.length > 0) {
      const rec = res.data.records[0].value as any;
      if (rec.hubRef !== HUB_REF) {
        console.log("Updating config linkage to Hub...");
        const rkey = res.data.records[0].uri.split('/').pop();
        await ag.com.atproto.repo.putRecord({
          repo: profile.did,
          collection: NSID_CONFIG,
          rkey: rkey!,
          record: {
            $type: NSID_CONFIG,
            hubRef: HUB_REF,
            updatedAt: new Date().toISOString()
          }
        });
      }
    } else {
      console.log("Creating initial config...");
      await ag.com.atproto.repo.createRecord({
        repo: profile.did,
        collection: NSID_CONFIG,
        record: {
          $type: NSID_CONFIG,
          hubRef: HUB_REF,
          updatedAt: new Date().toISOString()
        }
      });

      await createPlaylist("お気に入り");
    }
  } catch (e) {
    console.warn("Failed to check/create config:", e);
  }
}

// --- GLOBAL TIMELINE ---

export async function getGlobalTimeline() {
  // 1. Find Users via Constellation (Backlinks to Hub)
  const backlinks = await getBacklinks(HUB_REF, `${NSID_CONFIG}:hubRef`);
  const userDids = Array.from(new Set(backlinks.map(b => b.did)));

  if (userDids.length === 0) return [];

  // 2. Fetch Profiles & Records for each user
  const timelineItems: any[] = [];

  // Batch profile fetch
  let profilesMap = new Map<string, any>();
  try {
    const chunks = [];
    for (let i = 0; i < userDids.length; i += 25) {
      chunks.push(userDids.slice(i, i + 25));
    }
    for (const chunk of chunks) {
      const pRes = await publicAgent.app.bsky.actor.getProfiles({ actors: chunk });
      pRes.data.profiles.forEach((p: any) => profilesMap.set(p.did, p));
    }
  } catch (e) {
    console.error("Failed to fetch timeline profiles", e);
  }

  // Fetch records per user
  await Promise.all(userDids.map(async (did) => {
    const profile = profilesMap.get(did);
    // Skip if no profile (optional, but good for UI)
    const pds = await getPdsEndpoint(did);
    if (!pds) return;

    // Use Agent instead of fetch
    const pdsAgent = new Agent({ service: pds });

    const fetchCollection = async (collection: string, typeName: string) => {
      try {
        const res = await pdsAgent.com.atproto.repo.listRecords({
          repo: did,
          collection: collection,
          limit: 5
        });

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

  // 2.5 Hydrate Playlist Reactions
  // Collect all playlist URIs that need fetching
  const playlistsToFetch = new Map<string, { did: string, rkey: string }>();

  timelineItems.forEach(item => {
    if (item.type === 'reaction' && item.record.kind === 'playlist' && item.record.playlist?.uri) {
      const uri = item.record.playlist.uri;
      if (!playlistsToFetch.has(uri)) {
        try {
          // uri: at://did/collection/rkey
          const parts = uri.split('/');
          const rkey = parts.pop();
          const collection = parts.pop();
          const did = parts.pop();
          if (did && rkey) {
            playlistsToFetch.set(uri, { did, rkey });
          }
        } catch (e) {
          console.warn("Invalid playlist URI:", uri);
        }
      }
    }
  });

  // Fetch unique playlists
  const fetchedPlaylists = new Map<string, any>();
  await Promise.all(Array.from(playlistsToFetch.entries()).map(async ([uri, { did, rkey }]) => {
    try {
      // We can reuse getPlaylist if available, or just fetch directly.
      // Since getPlaylist is async and exported, let's use it.
      // However, we need to handle potential failures gracefully.
      const data = await getPlaylist(did, rkey);
      if (data && data.value) {
        fetchedPlaylists.set(uri, data.value);
      }
    } catch (e) {
      console.warn(`Failed to hydrate playlist ${uri}:`, e);
    }
  }));

  // Assign fetched records back to items
  timelineItems.forEach(item => {
    if (item.type === 'reaction' && item.record.kind === 'playlist' && item.record.playlist?.uri) {
      const fetched = fetchedPlaylists.get(item.record.playlist.uri);
      if (fetched) {
        item.record.playlist.record = fetched;
      }
    }
  });

  // 3. Sort by Date Descending
  return timelineItems.sort((a, b) => {
    return new Date(b.indexedAt).getTime() - new Date(a.indexedAt).getTime();
  });
}

// --- HYDRATION ---

export async function hydrateReactions(records: ConstellationRecord[]): Promise<{ record: ReactionRecord, authorDid: string, uri: string }[]> {
  const results: { record: ReactionRecord, authorDid: string, uri: string }[] = [];
  const pdsCache = new Map<string, string | null>();

  // Process in parallel
  const promises = records.map(async (rec) => {
    try {
      let pds = pdsCache.get(rec.did);
      // If not in cache, fetch and cache
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
    } catch (e) {
      console.warn(`Failed to hydrate reaction for ${rec.did}:`, e);
    }
  });

  await Promise.all(promises);
  return results;
}

// --- HOT CONTENT ---

export async function getHotContent() {
  // 1. Find Users via Constellation
  const backlinks = await getBacklinks(HUB_REF, `${NSID_CONFIG}:hubRef`);
  const userDids = Array.from(new Set(backlinks.map(b => b.did)));

  if (userDids.length === 0) return { tracks: [], playlists: [] };

  // 2. Fetch Reactions & Profiles
  const reactions: any[] = [];
  const profilesMap = new Map<string, any>();

  // Batch profile fetch
  try {
    const chunks = [];
    for (let i = 0; i < userDids.length; i += 25) {
      chunks.push(userDids.slice(i, i + 25));
    }
    for (const chunk of chunks) {
      const pRes = await publicAgent.app.bsky.actor.getProfiles({ actors: chunk });
      pRes.data.profiles.forEach((p: any) => profilesMap.set(p.did, p));
    }
  } catch (e) {
    console.error("Failed to fetch profiles for hot content", e);
  }

  // Fetch reactions per user
  await Promise.all(userDids.map(async (did) => {
    const pds = await getPdsEndpoint(did);
    if (!pds) return;

    const pdsAgent = new Agent({ service: pds });
    try {
      const res = await pdsAgent.com.atproto.repo.listRecords({
        repo: did,
        collection: NSID_REACTION,
        limit: 50 // Fetch more history for aggregation
      });

      res.data.records.forEach((r: any) => {
        reactions.push({
          ...r.value,
          author: profilesMap.get(did) || { did, handle: 'unknown' },
          uri: r.uri
        });
      });
    } catch (e) {
      // minimal error logging
    }
  }));

  // 3. Aggregate
  const trackStats = new Map<string, { count: number, record: any, authors: any[], reactions: Record<string, any[]> }>();
  // Key: subjectUri

  const playlistStats = new Map<string, { count: number, record: any, authors: any[], reactions: Record<string, any[]> }>();
  // Key: playlist uri

  reactions.forEach(r => {
    let stat;
    if (r.kind === 'playlist' && r.playlist?.uri) {
      const key = r.playlist.uri;
      if (!playlistStats.has(key)) {
        playlistStats.set(key, { count: 0, record: r, authors: [], reactions: {} });
      }
      stat = playlistStats.get(key)!;
    } else if ((r.kind === 'track' || !r.kind) && r.subjectUri) { // Default to track if no kind
      const key = r.subjectUri;
      if (!trackStats.has(key)) {
        trackStats.set(key, { count: 0, record: r, authors: [], reactions: {} });
      }
      stat = trackStats.get(key)!;
    }

    if (stat) {
      stat.count++;
      // Add author to recent list if unique
      if (!stat.authors.find((a: any) => a.did === r.author.did)) {
        stat.authors.push(r.author);
      }

      // Group by emoji
      const emoji = r.emoji || "👍";
      if (!stat.reactions[emoji]) stat.reactions[emoji] = [];
      stat.reactions[emoji].push({
        did: r.author.did,
        handle: r.author.handle,
        avatar: r.author.avatar,
        displayName: r.author.displayName,
        reactionUri: r.uri
      });
    }
  });

  // 4. Format & Sort
  const hotTracks = Array.from(trackStats.values())
    .sort((a, b) => b.count - a.count)
    .map(s => ({
      ...s.record, // Base track info
      reactionCount: s.count,
      recentReactors: s.authors.slice(0, 5),
      reactionGroups: Object.entries(s.reactions).map(([emoji, users]) => ({
        emoji,
        users
      }))
    }));

  // Hydrate top playlists
  const hotPlaylistsRaw = Array.from(playlistStats.values()).sort((a, b) => b.count - a.count);
  const topPlaylists = hotPlaylistsRaw.slice(0, 20);
  const hydratedPlaylists = [];

  for (const item of topPlaylists) {
    try {
      // item.record.playlist.uri -> at://did/collection/rkey
      const uri = item.record.playlist.uri;
      if (!uri) continue;

      const parts = uri.split('/');
      const rkey = parts.pop();
      const collection = parts.pop();
      const did = parts.pop();

      if (did && rkey) {
        const data = await getPlaylist(did, rkey);
        if (data && data.value) {
          hydratedPlaylists.push({
            playlist: data.value, // The full record
            author: item.record.playlist.author, // The creator
            reactionCount: item.count,
            recentReactors: item.authors.slice(0, 5),
            uri: uri,
            reactionGroups: Object.entries(item.reactions).map(([emoji, users]) => ({
              emoji,
              users
            }))
          });
        }
      }
    } catch (e) {
      console.warn("Failed to hydrate hot playlist", item.record.playlist.uri);
    }
  }

  return {
    tracks: hotTracks,
    playlists: hydratedPlaylists
  };
}
