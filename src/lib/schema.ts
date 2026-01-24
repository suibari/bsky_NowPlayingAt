export const NSID_HISTORY = 'com.suibari.nowplayingat.history';
export const NSID_CONFIG = 'com.suibari.nowplayingat.config';
export const NSID_REACTION = 'com.suibari.nowplayingat.reaction';
export const NSID_PLAYLIST = 'com.suibari.nowplayingat.playlist';

// Constellation Source Path
export const REACTION_SOURCE = `${NSID_REACTION}:subjectUri`;

export interface HistoryRecord {
  $type: typeof NSID_HISTORY;
  track: string;
  artist: string;
  album: string;
  trackUri: string;
  img: string;
  links: {
    spotify?: string;
    youtube?: string;
  };
  postedAt: string;
}

export interface ReactionRecord {
  $type: typeof NSID_REACTION;
  subjectUri: string;
  emoji: string;
  // Metadata snapshot
  track: string;
  artist: string;
  album: string;
  img: string;
  links: {
    spotify?: string;
    youtube?: string;
  };
  createdAt: string;
}

export interface PlaylistRecord {
  $type: typeof NSID_PLAYLIST;
  name: string;
  tracks: any[]; // We can refine this if needed, but 'any' structure matches current map usage
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
