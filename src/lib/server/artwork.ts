import { env } from '$env/dynamic/private';

const MB_UA = 'NowPlayingAt/1.0 (https://nowplayingat.suibari.com)';
const LFM_PLACEHOLDER = '2a96cbd8b46e442fc41c2b86b821562f';

export interface ArtworkResult {
  artworkUrl: string | undefined;
  lastFmUrl: string | undefined;
  isYouTube?: boolean;
}

/**
 * Resolve jacket image URL using a fallback chain.
 * Priority: Last.fm → Deezer → MusicBrainz + CAA → YouTube
 * lastFmUrl is set only when artwork is obtained from Last.fm.
 */
export async function resolveArtworkUrl(
  artist: string,
  title: string,
  album: string | undefined,
): Promise<ArtworkResult> {
  const getLfmImage = async (images: Array<any> | undefined) => {
    if (!images) return undefined;
    for (const size of ['mega', 'extralarge', 'large']) {
      const img = images.find((i: any) => i.size === size);
      if (img?.['#text'] && !img['#text'].includes(LFM_PLACEHOLDER)) {
        const url = img['#text'];
        try {
          const res = await fetch(url, { method: 'HEAD' });
          if (res.ok) {
            return url;
          }
        } catch (e) {
          // ignore network errors
        }
      }
    }
    return undefined;
  };

  const lastFmUrl = `https://www.last.fm/music/${encodeURIComponent(artist)}/_/${encodeURIComponent(title)}`;

  // 1. Last.fm (album.getInfo then track.getInfo)
  try {
    let imgUrl: string | undefined = undefined;

    if (album) {
      const albumUrl =
        `https://ws.audioscrobbler.com/2.0/?method=album.getInfo` +
        `&api_key=${env.LASTFM_API_KEY}` +
        `&artist=${encodeURIComponent(artist)}` +
        `&album=${encodeURIComponent(album)}` +
        `&format=json`;
      const res = await fetch(albumUrl);
      if (res.ok) {
        const data = await res.json();
        imgUrl = await getLfmImage(data?.album?.image);
      }
    }

    if (!imgUrl) {
      const trackUrl =
        `https://ws.audioscrobbler.com/2.0/?method=track.getInfo` +
        `&api_key=${env.LASTFM_API_KEY}` +
        `&artist=${encodeURIComponent(artist)}` +
        `&track=${encodeURIComponent(title)}` +
        `&format=json`;
      const res = await fetch(trackUrl);
      if (res.ok) {
        const data = await res.json();
        imgUrl = await getLfmImage(data?.track?.album?.image);
      }
    }

    if (imgUrl) {
      return { artworkUrl: imgUrl, lastFmUrl };
    }
  } catch (e) {
    console.warn('[artwork] Last.fm fetch failed:', e);
  }

  // 2. Deezer API
  try {
    const dzQuery = encodeURIComponent(`${artist} ${title}`);
    const dzRes = await fetch(`https://api.deezer.com/search?q=${dzQuery}`);
    if (dzRes.ok) {
      const data = await dzRes.json();
      if (data.data && data.data.length > 0) {
        const dzAlbum = data.data[0].album;
        const imgUrl = dzAlbum?.cover_xl || dzAlbum?.cover_big;
        if (imgUrl) {
          return { artworkUrl: imgUrl, lastFmUrl: undefined };
        }
      }
    }
  } catch (e) {
    console.warn('[artwork] Deezer fetch failed:', e);
  }

  // 3. MusicBrainz recording search → Cover Art Archive
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
            return { artworkUrl: caaRes.url, lastFmUrl: undefined };
          }
        }
      }
    }
  } catch (e) {
    console.warn('[artwork] MusicBrainz fetch failed:', e);
  }

  // 4. YouTube Data API v3 (Last resort)
  if (env.YOUTUBE_API_KEY) {
    try {
      const ytQuery = encodeURIComponent(`${artist} ${title}`);
      const ytRes = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${ytQuery}&type=video&maxResults=1&key=${env.YOUTUBE_API_KEY}`
      );
      if (ytRes.ok) {
        const data = await ytRes.json();
        if (data.items && data.items.length > 0) {
          const snippet = data.items[0].snippet;
          const thumb = snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url;
          if (thumb) {
            return { artworkUrl: thumb, lastFmUrl: undefined, isYouTube: true };
          }
        }
      }
    } catch (e) {
      console.warn('[artwork] YouTube fetch failed:', e);
    }
  }

  return { artworkUrl: undefined, lastFmUrl: undefined };
}
