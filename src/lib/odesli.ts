export interface OdesliResult {
  entityUniqueId: string;
  userCountry: string;
  pageUrl: string;
  linksByPlatform: {
    spotify?: { url: string; nativeAppUriMobile?: string };
    youtubeMusic?: { url: string; nativeAppUriMobile?: string };
    appleMusic?: { url: string; nativeAppUriMobile?: string };
    [key: string]: any;
  };
}

/**
 * Pick the best streaming service link from Odesli results.
 * Priority: Spotify > YouTube Music > Apple Music > fallbackUrl.
 * preResolved lets callers short-circuit when links were already fetched client-side.
 */
export function pickBestServiceLink(
  links: OdesliResult | null,
  fallbackUrl: string,
  preResolved?: { spotifyUrl?: string; youtubeMusicUrl?: string },
): { url: string; name: string } {
  if (preResolved?.spotifyUrl) return { url: preResolved.spotifyUrl, name: 'Spotify' };
  if (preResolved?.youtubeMusicUrl) return { url: preResolved.youtubeMusicUrl, name: 'YouTube Music' };
  if (links?.linksByPlatform.spotify) return { url: links.linksByPlatform.spotify.url, name: 'Spotify' };
  if (links?.linksByPlatform.youtubeMusic) return { url: links.linksByPlatform.youtubeMusic.url, name: 'YouTube Music' };
  if (links?.linksByPlatform.appleMusic) return { url: links.linksByPlatform.appleMusic.url, name: 'Apple Music' };
  return { url: fallbackUrl, name: 'Apple Music' };
}

export async function resolveLinks(url: string): Promise<OdesliResult | null> {
  const encodedUrl = encodeURIComponent(url);
  const apiUrl = `https://api.song.link/v1-alpha.1/links?url=${encodedUrl}`;

  try {
    const res = await fetch(apiUrl);
    if (!res.ok) {
      console.warn(`Odesli API Error: ${res.status}`);
      return null; // Not found or error
    }
    const data = await res.json();
    return data as OdesliResult;
  } catch (e) {
    console.error("Odesli fetch failed", e);
    return null;
  }
}
