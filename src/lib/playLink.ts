export interface SavedLinks {
  spotify?: string | null;
  youtube?: string | null;
  appleMusic?: string | null;
}

/**
 * Where the play button goes. Links saved on a record (resolved back when Odesli
 * still worked) open the track itself; everything else opens a Spotify search,
 * since Odesli's public API is gone and Spotify's API is no longer free.
 */
export function playUrl(links: SavedLinks | null | undefined, artist: string, title: string): string {
  return links?.spotify || links?.youtube || links?.appleMusic || spotifySearchUrl(artist, title);
}

export function spotifySearchUrl(artist: string, title: string): string {
  return `https://open.spotify.com/search/${encodeURIComponent(`${artist} ${title}`)}`;
}
