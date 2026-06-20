export interface ArtworkResult {
  blob: Blob;
  url: string;       // artwork CDN URL, for history img field
  trackUrl?: string; // Apple Music trackViewUrl, set when iTunes was the source
}

/**
 * Fetch artwork for a given track.
 *
 * Priority:
 *  1. existingUrl (if provided) — from iTunes/Discogs search results
 *  2. MusicBrainz recording search → Cover Art Archive
 *  3. iTunes Search API
 *
 * Returns undefined if all sources fail.
 */
export async function fetchArtwork(
  artist: string,
  title: string,
  existingUrl?: string,
): Promise<ArtworkResult | undefined> {
  // 1. Existing URL (passed from search results)
  if (existingUrl) {
    try {
      const url = existingUrl.replace('100x100', '600x600').replace('100x100bb', '600x600bb');
      const res = await fetch(url);
      if (res.ok) return { blob: await res.blob(), url };
    } catch {
      // fall through
    }
  }

  // 2. MusicBrainz + Cover Art Archive
  try {
    const mbQuery = encodeURIComponent(`recording:"${title}" AND artist:"${artist}"`);
    const mbRes = await fetch(
      `https://musicbrainz.org/ws/2/recording/?query=${mbQuery}&fmt=json&limit=1&inc=releases`,
      { headers: { 'User-Agent': 'NowPlayingAt/1.0 (https://nowplayingat.suibari.com)' } },
    );
    if (mbRes.ok) {
      const mbData = await mbRes.json();
      const mbid = mbData?.recordings?.[0]?.releases?.[0]?.id;
      if (mbid) {
        const caaUrl = `https://coverartarchive.org/release/${mbid}/front`;
        const caaRes = await fetch(caaUrl);
        if (caaRes.ok) return { blob: await caaRes.blob(), url: caaUrl };
      }
    }
  } catch {
    // fall through
  }

  // 3. iTunes Search API
  try {
    const searchRes = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(`${artist} ${title}`)}&media=music&limit=1`,
    );
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      const result = searchData?.results?.[0];
      const url: string | undefined = result?.artworkUrl100?.replace('100x100bb', '600x600bb');
      const trackUrl: string | undefined = result?.trackViewUrl;
      if (url) {
        const imgRes = await fetch(url);
        if (imgRes.ok) return { blob: await imgRes.blob(), url, trackUrl };
      }
    }
  } catch {
    // fall through
  }

  return undefined;
}
