import { get } from 'svelte/store';
import { agent, userProfile } from '$lib/stores';
import type { Track } from '$lib/music';

const NSID_HISTORY = 'com.suibari.nowplayingat.history';
const NSID_CONFIG = 'com.suibari.nowplayingat.config';
const NSID_REACTION = 'com.suibari.nowplayingat.reaction';
const NSID_PLAYLIST = 'com.suibari.nowplayingat.playlist';

// --- HISTORY ---

export async function createHistoryRecord(track: Track) {
  const ag = get(agent);
  const profile = get(userProfile);
  if (!ag || !profile) throw new Error("Not authenticated");

  await ensureConfig();

  const record = {
    $type: NSID_HISTORY,
    track: track.title,
    artist: track.artist,
    album: track.album,
    trackUri: track.trackUri,
    links: {
      spotify: track.spotifyUrl,
      youtube: track.youtubeUrl
    },
    postedAt: new Date().toISOString()
  };

  return await ag.com.atproto.repo.createRecord({
    repo: profile.did,
    collection: NSID_HISTORY,
    record: record
  });
}

export async function getHistory(did: string) {
  const ag = get(agent);
  if (!ag) throw new Error("Not authenticated");

  const res = await ag.com.atproto.repo.listRecords({
    repo: did,
    collection: NSID_HISTORY,
    limit: 50
  });
  return res.data.records;
}

// --- REACTIONS ---

export async function createReactionRecord(track: Track, emoji: string) {
  const ag = get(agent);
  const profile = get(userProfile);
  if (!ag || !profile) throw new Error("Not authenticated");

  return await ag.com.atproto.repo.createRecord({
    repo: profile.did,
    collection: NSID_REACTION,
    record: {
      $type: NSID_REACTION,
      subjectUri: track.trackUri,
      emoji: emoji,
      createdAt: new Date().toISOString()
    }
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

export async function getPlaylists(did: string) {
  const ag = get(agent);
  if (!ag) throw new Error("Not authenticated");

  const res = await ag.com.atproto.repo.listRecords({
    repo: did,
    collection: NSID_PLAYLIST
  });
  return res.data.records;
}

export async function getPlaylist(did: string, rkey: string) {
  const ag = get(agent);
  if (!ag) throw new Error("Not authenticated");

  const res = await ag.com.atproto.repo.getRecord({
    repo: did,
    collection: NSID_PLAYLIST,
    rkey: rkey
  });
  return res.data;
}

export async function addToPlaylist(playlistUri: string, track: Track, currentPlaylistRecordWrapper: any) {
  const ag = get(agent);
  const profile = get(userProfile);
  if (!ag || !profile) throw new Error("Not authenticated");

  // currentPlaylistRecordWrapper is { uri, cid, value: { name, tracks, ... } }
  const content = currentPlaylistRecordWrapper.value;

  const newTracks = [...(content.tracks || []), {
    track: track.title,
    artist: track.artist,
    album: track.album,
    trackUri: track.trackUri,
    img: track.artworkUrl,
    links: { spotify: track.spotifyUrl, youtube: track.youtubeUrl }
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

export async function postToFeed(track: Track, text?: string) {
  const ag = get(agent);
  const profile = get(userProfile);
  if (!ag || !profile) throw new Error("Not authenticated");

  const postText = text || `#NowPlaying ${track.title} - ${track.artist} \n\n${track.trackUri}`;

  const embed = {
    $type: 'app.bsky.embed.external',
    external: {
      uri: track.trackUri,
      title: `${track.title} - ${track.artist}`,
      description: `Listen on Apple Music`,
      thumb: undefined
    }
  };

  return await ag.post({
    text: postText,
    embed: embed,
    createdAt: new Date().toISOString()
  });
}

// --- CONFIG ---

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

    if (res.data.records.length === 0) {
      console.log("Creating initial config...");
      await ag.com.atproto.repo.createRecord({
        repo: profile.did,
        collection: NSID_CONFIG,
        record: {
          $type: NSID_CONFIG,
          hubRef: `at://${profile.did}`,
          updatedAt: new Date().toISOString()
        }
      });

      // Create Favorites Playlist
      await createPlaylist("Favorites");
      console.log("Created Favorites playlist");
    }
  } catch (e) {
    console.warn("Failed to check/create config:", e);
  }
}
