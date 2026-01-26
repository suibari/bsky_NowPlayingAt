export interface Track {
  id: string; // provider:id
  provider: 'itunes' | 'discogs';
  title: string;
  artist: string;
  album: string;
  artworkUrl: string; // usually 100x100, can be resized
  previewUrl?: string; // iTunes often provides 30s preview
  trackUri: string; // The Store/Web URL
  spotifyUrl?: string; // Resolved by Odesli
  youtubeMusicUrl?: string; // Resolved by Odesli
  appleMusicUrl?: string; // Resolved by Odesli
  comment?: string; // User comment
}

// Client-side iTunes Search
export async function searchTracks(query: string): Promise<Track[]> {
  if (!query || query.length < 2) return [];

  const encoded = encodeURIComponent(query);

  const [itunesResults, serverResults] = await Promise.all([
    searchITunes(encoded),
    searchServer(encoded),
  ]);

  return [...itunesResults, ...serverResults];
}

async function searchITunes(encodedQuery: string): Promise<Track[]> {
  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodedQuery}&entity=song&limit=20`
    );
    if (!res.ok) throw new Error(`iTunes error: ${res.status}`);
    const data = await res.json();
    return data.results
      .filter((item: any) => item.wrapperType === 'track' && item.trackViewUrl) // Ensure it's a track with a URL
      .map((item: any) => ({
        id: `itunes:${item.trackId}`,
        provider: 'itunes',
        title: item.trackName,
        artist: item.artistName,
        album: item.collectionName,
        artworkUrl: item.artworkUrl100?.replace('100x100', '600x600'),
        previewUrl: item.previewUrl,
        trackUri: item.trackViewUrl,
      }));
  } catch (e) {
    console.error("iTunes search failed (client):", e);
    return [];
  }
}

async function searchServer(encodedQuery: string): Promise<Track[]> {
  const url = `/api/search?q=${encodedQuery}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Search API Failed: ${res.status}`);
    const data: Track[] = await res.json();
    return data;
  } catch (e) {
    console.error("Server search error:", e);
    return [];
  }
}
