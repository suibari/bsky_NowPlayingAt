import type { Track } from '$lib/music';
import { env } from '$env/dynamic/private';

const DISCOGS_UA = 'NowPlayingAt/1.0 (https://nowplayingat.suibari.com)';

export async function searchTracks(artist: string, title: string): Promise<Track[]> {
  return searchDiscogsQuery(`${artist} ${title}`);
}

// Used by /api/search for free-form user queries, and searchTracks above
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
      genres: Array.isArray(item.genre) ? item.genre : undefined,
    };
  });
}
