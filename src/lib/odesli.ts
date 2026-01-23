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
