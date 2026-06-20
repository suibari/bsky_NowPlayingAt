import type { Track } from '$lib/music';
import { env } from '$env/dynamic/private';

const DISCOGS_UA = 'NowPlayingAt/1.0 (https://nowplayingat.suibari.com)';

export async function searchTracks(artist: string, title: string): Promise<Track[]> {
  const [itunesResults, discogsResults] = await Promise.all([
    searchITunes(artist, title),
    searchDiscogs(artist, title),
  ]);
  return [...itunesResults, ...discogsResults];
}

async function searchITunes(artist: string, title: string): Promise<Track[]> {
  for (const term of [title, `${title} ${artist}`]) {
    try {
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=5`;
      const res = await fetch(url);
      const data = await res.json();
      console.log('[music] iTunes search:', { term, status: res.status, resultCount: data?.resultCount });
      if (!res.ok) continue;
      const results: Track[] = (data.results ?? [])
        .filter((item: any) => item.trackViewUrl)
        .map((item: any) => ({
          id: `itunes:${item.trackId}`,
          provider: 'itunes' as const,
          title: item.trackName,
          artist: item.artistName,
          album: item.collectionName,
          artworkUrl: item.artworkUrl100?.replace('100x100bb', '600x600bb') ?? '',
          trackUri: item.trackViewUrl,
        }));
      if (results.length) return results;
    } catch (e) {
      console.warn('[music] iTunes search error:', e);
      continue;
    }
  }
  return [];
}

async function searchDiscogs(artist: string, title: string): Promise<Track[]> {
  try {
    const res = await fetch(
      `https://api.discogs.com/database/search?artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(title)}&type=release&per_page=3&token=${env.DISCOGS_TOKEN}`,
      { headers: { 'User-Agent': DISCOGS_UA } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return mapDiscogsResults(data.results ?? [], artist);
  } catch {
    return [];
  }
}

// Used by /api/search for free-form user queries
export async function searchDiscogsQuery(query: string): Promise<Track[]> {
  try {
    const res = await fetch(
      `https://api.discogs.com/database/search?q=${encodeURIComponent(query)}&type=release&per_page=20&token=${env.DISCOGS_TOKEN}`,
      { headers: { 'User-Agent': DISCOGS_UA } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return mapDiscogsResults(data.results ?? []);
  } catch {
    return [];
  }
}

function mapDiscogsResults(results: any[], fallbackArtist = ''): Track[] {
  return results.map((item: any) => {
    const parts = (item.title as string).split(' - ');
    return {
      id: `discogs:${item.id}`,
      provider: 'discogs' as const,
      title: parts.length > 1 ? parts.slice(1).join(' - ') : item.title,
      artist: parts.length > 1 ? parts[0] : fallbackArtist || 'Unknown',
      album: item.title,
      artworkUrl: item.cover_image ?? '',
      trackUri: `https://www.discogs.com${item.uri}`,
    };
  });
}
