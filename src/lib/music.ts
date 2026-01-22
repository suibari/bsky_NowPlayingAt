export interface Track {
  id: string; // iTunes Track ID
  title: string;
  artist: string;
  album: string;
  artworkUrl: string; // usually 100x100, can be resized
  previewUrl?: string; // iTunes often provides 30s preview
  trackUri: string; // The iTunes Store URL (Canonical Subject)
  spotifyUrl?: string; // Generated search link
  youtubeUrl?: string; // Generated search link
}

export async function searchTracks(query: string): Promise<Track[]> {
  if (!query || query.length < 2) return [];

  const encoded = encodeURIComponent(query);
  const url = `https://itunes.apple.com/search?term=${encoded}&entity=song&limit=20`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`iTunes API Failed: ${res.status}`);

    const data = await res.json();

    return data.results.map((item: any) => {
      const trackUri = item.trackViewUrl; // Canonical URL
      return {
        id: String(item.trackId),
        title: item.trackName,
        artist: item.artistName,
        album: item.collectionName,
        artworkUrl: item.artworkUrl100?.replace('100x100', '600x600'), // Get higher res
        previewUrl: item.previewUrl,
        trackUri: trackUri,
        // Fallbacks since we don't have real Spotify IDs without their API
        spotifyUrl: `https://open.spotify.com/search/${encodeURIComponent(item.artistName + " " + item.trackName)}`,
        youtubeUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(item.artistName + " " + item.trackName)}`
      };
    });
  } catch (e) {
    console.error("Music search error:", e);
    return [];
  }
}
