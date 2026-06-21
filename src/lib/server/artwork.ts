import { env } from '$env/dynamic/private';

const MB_UA = 'NowPlayingAt/1.0 (https://nowplayingat.suibari.com)';
const LFM_PLACEHOLDER = '2a96cbd8b46e442fc41c2b86b821562f';

function isValidDiscogsUrl(url: string | undefined): url is string {
  return !!url && url.length > 0;
}

/**
 * Resolve jacket image URL using a fallback chain.
 * Priority: Last.fm album.getInfo → MusicBrainz + CAA → Discogs cover_image
 * Discogs is last because its fuzzy q-search often returns mismatched releases.
 */
export async function resolveArtworkUrl(
  artist: string,
  title: string,
  album: string | undefined,
  discogsUrl: string | undefined,
): Promise<string | undefined> {
  // 1. Last.fm album.getInfo (structured artist+album query — most accurate when album is known)
  if (album) {
    try {
      const lfUrl =
        `https://ws.audioscrobbler.com/2.0/?method=album.getInfo` +
        `&api_key=${env.LASTFM_API_KEY}` +
        `&artist=${encodeURIComponent(artist)}` +
        `&album=${encodeURIComponent(album)}` +
        `&format=json`;
      const res = await fetch(lfUrl);
      if (res.ok) {
        const data = await res.json();
        const images: Array<{ '#text': string; size: string }> = data?.album?.image ?? [];
        for (const size of ['mega', 'extralarge', 'large']) {
          const img = images.find((i) => i.size === size);
          if (img?.['#text'] && !img['#text'].includes(LFM_PLACEHOLDER)) {
            return img['#text'];
          }
        }
      }
    } catch {
      // fall through
    }
  }

  // 2. MusicBrainz recording search → Cover Art Archive
  try {
    const mbQuery = encodeURIComponent(`recording:"${title}" AND artist:"${artist}"`);
    const mbRes = await fetch(
      `https://musicbrainz.org/ws/2/recording/?query=${mbQuery}&fmt=json&limit=1&inc=releases`,
      { headers: { 'User-Agent': MB_UA } },
    );
    if (mbRes.ok) {
      const mbData = await mbRes.json();
      const releases: Array<{ id: string }> = mbData?.recordings?.[0]?.releases ?? [];
      for (const release of releases) {
        for (const variant of ['front-500', 'front'] as const) {
          const caaRes = await fetch(`https://coverartarchive.org/release/${release.id}/${variant}`);
          if (caaRes.ok && caaRes.headers.get('content-type')?.startsWith('image/')) {
            return caaRes.url;
          }
        }
      }
    }
  } catch {
    // fall through
  }

  // 3. Discogs cover_image (fuzzy fallback — may match a different release)
  if (isValidDiscogsUrl(discogsUrl)) {
    return discogsUrl.replace('100x100', '600x600');
  }

  return undefined;
}
