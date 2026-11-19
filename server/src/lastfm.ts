export interface Scrobble {
  artist: string;
  title: string;
  album: string;
  playedAt: number | null; // ms epoch。Last.fm の date.uts より。不明なら null
}

const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 1500;

export async function getLatestScrobble(
  username: string,
): Promise<{ scrobble: Scrobble | null; isListening: boolean }> {
  const url = new URL('https://ws.audioscrobbler.com/2.0/');
  url.searchParams.set('method', 'user.getRecentTracks');
  url.searchParams.set('user', username);
  url.searchParams.set('api_key', process.env.LASTFM_API_KEY!);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '2');

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch(url.toString());

    if (res.ok) {
      const data = await res.json();
      if (data.error) {
        console.warn(`[lastfm] API error for ${username}: ${data.message}`);
        return { scrobble: null, isListening: false };
      }

      const tracks: any[] = data?.recenttracks?.track ?? [];
      let isListening = false;
      for (const t of tracks) {
        if (t?.['@attr']?.nowplaying) {
          isListening = true;
          continue;
        }
        return {
          scrobble: {
            artist: t.artist['#text'],
            title: t.name,
            album: t.album['#text'],
            playedAt: t.date?.uts ? Number(t.date.uts) * 1000 : null,
          },
          isListening,
        };
      }
      return { scrobble: null, isListening };
    }

    const bodyText = await res.text().catch(() => '(unreadable)');
    let detail = bodyText;
    try {
      const parsed = JSON.parse(bodyText);
      if (parsed.error != null) detail = `API error ${parsed.error}: ${parsed.message}`;
    } catch {}

    if (res.status === 500 && attempt < MAX_ATTEMPTS) {
      console.warn(`[lastfm] HTTP 500 for user ${username} (attempt ${attempt}/${MAX_ATTEMPTS}), retrying in ${RETRY_DELAY_MS}ms — ${detail}`);
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      continue;
    }

    console.warn(`[lastfm] HTTP ${res.status} for user ${username} — ${detail}`);
    return { scrobble: null, isListening: false };
  }
  return { scrobble: null, isListening: false };
}

async function fetchTopTags(params: Record<string, string>, limit: number): Promise<string[]> {
  const url = new URL('https://ws.audioscrobbler.com/2.0/');
  url.searchParams.set('api_key', process.env.LASTFM_API_KEY!);
  url.searchParams.set('format', 'json');
  url.searchParams.set('autocorrect', '1');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString());
  if (!res.ok) return [];
  const data = await res.json();
  const tags: any[] = data?.toptags?.tag ?? [];
  return tags
    .map((t) => (typeof t?.name === 'string' ? t.name.trim() : ''))
    .filter(Boolean)
    .slice(0, limit);
}

// Extract the voice-actor (seiyuu) name from an anison artist credit, but only
// when a CV/声優/Vo marker is present (so non-CV parens like "(K)NoW_NAME" are
// never touched). Returns undefined when there's no CV credit.
function extractSeiyuu(artist: string): string | undefined {
  const m = artist
    .normalize('NFKC')
    .match(/[(（][^)）]*?(?:CV|声優|Vo)[.:：．\s]*([^)）]+?)\s*[)）]/i);
  return m ? m[1].trim() : undefined;
}

// Top community tags for a track, falling back to the artist's tags when the
// track has none (track-level tags are sparse even for popular songs). For
// anison character credits ("キャラ名 (CV: 声優)"), Last.fm has no tags under the
// character name, so as a last resort we retry with the extracted seiyuu name
// (whose artist page IS tagged). Non-fatal: returns [] on any failure.
export async function getGenreTags(
  artist: string,
  title: string,
  limit = 5,
): Promise<string[]> {
  try {
    const trackTags = await fetchTopTags(
      { method: 'track.getTopTags', artist, track: title },
      limit,
    );
    if (trackTags.length > 0) return trackTags;

    const artistTags = await fetchTopTags({ method: 'artist.getTopTags', artist }, limit);
    if (artistTags.length > 0) return artistTags;

    const seiyuu = extractSeiyuu(artist);
    if (seiyuu && seiyuu !== artist) {
      return await fetchTopTags({ method: 'artist.getTopTags', artist: seiyuu }, limit);
    }
    return [];
  } catch (e) {
    console.warn(`[lastfm] getGenreTags failed for ${artist} - ${title}:`, e);
    return [];
  }
}
