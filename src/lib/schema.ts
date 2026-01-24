export const NSID_HISTORY = 'com.suibari.nowplayingat.history';
export const NSID_CONFIG = 'com.suibari.nowplayingat.config';
export const NSID_REACTION = 'com.suibari.nowplayingat.reaction';
export const NSID_PLAYLIST = 'com.suibari.nowplayingat.playlist';

// Constellation Source Path
export const REACTION_SOURCE = `${NSID_REACTION}:subjectUri`;

export interface Track {
  track: string;
  artist: string;
  album: string;
  trackUri: string;
  img: string;
  links: {
    spotify?: string;
    youtube?: string;
  };
}

export interface HistoryRecord extends Track {
  $type: typeof NSID_HISTORY;
  postedAt: string;
}

export interface ReactionRecord extends Partial<Track> {
  $type: typeof NSID_REACTION;
  subjectUri: string;
  emoji: string;

  // Metadata
  kind?: 'track' | 'playlist';

  // Playlist Metadata (Object)
  playlist?: {
    uri: string;
    title: string;
    author: { did: string; handle: string; avatar?: string; displayName?: string };
  };

  createdAt: string;
}

export interface PlaylistRecord {
  $type: typeof NSID_PLAYLIST;
  name: string;
  tracks: Track[];
  createdAt: string;
}

export interface ConfigRecord {
  $type: typeof NSID_CONFIG;
  hubRef: string;
  updatedAt: string;
}

export interface ConstellationRecord {
  did: string;
  collection: string;
  rkey: string;
  uri?: string;
  cid?: string;
  value?: unknown;
  author?: { did: string; handle?: string; avatar?: string };
  [key: string]: unknown;
}
