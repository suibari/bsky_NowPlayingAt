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
  comment?: string; // User comment
}

export async function searchTracks(query: string): Promise<Track[]> {
  if (!query || query.length < 2) return [];

  const encoded = encodeURIComponent(query);
  const url = `/api/search?q=${encoded}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Search API Failed: ${res.status}`);

    const data: Track[] = await res.json();
    return data;
  } catch (e) {
    console.error("Music search error:", e);
    return [];
  }
}
