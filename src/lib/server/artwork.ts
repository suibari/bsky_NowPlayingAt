const MB_UA = 'NowPlayingAt/1.0 (https://nowplayingat.suibari.com)';

export interface ArtworkResult {
  blob: Blob;
  url: string; // artwork CDN URL, for history img field
  streamingUrl?: string; // from MusicBrainz URL relations (Spotify/Apple Music/YouTube Music)
}

export async function fetchArtwork(
  artist: string,
  title: string,
  existingUrl?: string,
): Promise<ArtworkResult | undefined> {
  // 1. Existing URL (passed from search results for manual posts)
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
      { headers: { 'User-Agent': MB_UA } },
    );
    if (mbRes.ok) {
      const mbData = await mbRes.json();
      const recording = mbData?.recordings?.[0];
      const recordingMbid: string | undefined = recording?.id;
      const releaseMbid: string | undefined = recording?.releases?.[0]?.id;
      if (releaseMbid) {
        const caaUrl = `https://coverartarchive.org/release/${releaseMbid}/front`;
        const [caaRes, streamingUrl] = await Promise.all([
          fetch(caaUrl),
          recordingMbid ? fetchMBStreamingUrl(recordingMbid) : Promise.resolve(undefined),
        ]);
        if (caaRes.ok) {
          return { blob: await caaRes.blob(), url: caaUrl, streamingUrl };
        }
      }
    }
  } catch {
    // fall through
  }

  return undefined;
}

async function fetchMBStreamingUrl(recordingMbid: string): Promise<string | undefined> {
  try {
    const res = await fetch(
      `https://musicbrainz.org/ws/2/recording/${recordingMbid}?inc=url-rels&fmt=json`,
      { headers: { 'User-Agent': MB_UA } },
    );
    if (!res.ok) return undefined;
    const data = await res.json();
    const relations: any[] = data.relations ?? [];

    // Priority: Spotify > Apple Music > YouTube Music
    const spotify = relations.find((r: any) =>
      r.url?.resource?.startsWith('https://open.spotify.com/track/'),
    );
    if (spotify) return spotify.url.resource;

    const appleMusic = relations.find((r: any) => r.url?.resource?.includes('music.apple.com'));
    if (appleMusic) return appleMusic.url.resource;

    const youtube = relations.find((r: any) => r.url?.resource?.includes('music.youtube.com'));
    if (youtube) return youtube.url.resource;

    return undefined;
  } catch {
    return undefined;
  }
}
