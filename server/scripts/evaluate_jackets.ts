interface TestCase {
  artist: string;
  track: string;
}

const testCases: TestCase[] = [
  { artist: '家入レオ', track: 'Walk' },
  { artist: 'ハセガワダイスケ', track: '裏切り者のレクイエム' },
  { artist: 'フレン・E・ルスタリオ', track: '全肯定！' },
  { artist: 'さかな', track: '天国に一番近い日' },
  { artist: 'きただにひろし', track: 'ウィーアー!' },
];

const LASTFM_API_KEY = process.env.LASTFM_API_KEY;
const RAKUTEN_APP_ID = process.env.RAKUTEN_APP_ID;
const RAKUTEN_ACCESS_KEY = process.env.RAKUTEN_ACCESS_KEY;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

async function fetchLastFm(artist: string, track: string): Promise<{ url: string | null; ms: number }> {
  const start = Date.now();
  try {
    const url = `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=${LASTFM_API_KEY}&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}&format=json`;
    const res = await fetch(url);
    if (!res.ok) return { url: null, ms: Date.now() - start };
    const data = await res.json();
    const images = data?.track?.album?.image ?? [];
    for (const size of ['mega', 'extralarge', 'large']) {
      const img = images.find((i: any) => i.size === size);
      if (img?.['#text'] && !img['#text'].includes('2a96cbd8b46e442fc41c2b86b821562f')) {
        return { url: img['#text'], ms: Date.now() - start };
      }
    }
  } catch (e) {
    // ignore
  }
  return { url: null, ms: Date.now() - start };
}

async function fetchMusicBrainz(artist: string, track: string): Promise<{ url: string | null; ms: number }> {
  const start = Date.now();
  try {
    const query = encodeURIComponent(`recording:"${track}" AND artist:"${artist}"`);
    const url = `https://musicbrainz.org/ws/2/recording/?query=${query}&fmt=json&limit=1&inc=releases`;
    const res = await fetch(url, { headers: { 'User-Agent': 'NowPlayingAt/1.0' } });
    if (!res.ok) return { url: null, ms: Date.now() - start };
    const data = await res.json();
    const releases = data?.recordings?.[0]?.releases ?? [];
    for (const release of releases) {
      for (const variant of ['front-500', 'front']) {
        const caaUrl = `https://coverartarchive.org/release/${release.id}/${variant}`;
        const caaRes = await fetch(caaUrl);
        if (caaRes.ok && caaRes.headers.get('content-type')?.startsWith('image/')) {
          return { url: caaRes.url, ms: Date.now() - start };
        }
      }
    }
  } catch (e) {
    // ignore
  }
  return { url: null, ms: Date.now() - start };
}

async function fetchDeezer(artist: string, track: string): Promise<{ url: string | null; ms: number }> {
  const start = Date.now();
  try {
    const query = encodeURIComponent(`${artist} ${track}`);
    const url = `https://api.deezer.com/search?q=${query}`;
    const res = await fetch(url);
    if (!res.ok) return { url: null, ms: Date.now() - start };
    const data = await res.json();
    if (data.data && data.data.length > 0) {
      const album = data.data[0].album;
      if (album && album.cover_xl) return { url: album.cover_xl, ms: Date.now() - start };
      if (album && album.cover_big) return { url: album.cover_big, ms: Date.now() - start };
    }
  } catch (e) {
    // ignore
  }
  return { url: null, ms: Date.now() - start };
}

async function fetchRakuten(artist: string, track: string): Promise<{ url: string | null; ms: number }> {
  const start = Date.now();
  if (!RAKUTEN_APP_ID || !RAKUTEN_ACCESS_KEY) return { url: 'API KEY MISSING', ms: 0 };
  try {
    const url = `https://openapi.rakuten.co.jp/services/api/BooksCD/Search/20170404?format=json&title=${encodeURIComponent(track)}&artistName=${encodeURIComponent(artist)}&applicationId=${RAKUTEN_APP_ID}&accessKey=${RAKUTEN_ACCESS_KEY}`;
    const res = await fetch(url, {
      headers: {
        'Referer': 'https://nowplayingat.suibari.com',
        'Origin': 'https://nowplayingat.suibari.com',
        'accessKey': RAKUTEN_ACCESS_KEY,
      },
    });
    if (!res.ok) {
      console.log(`Rakuten Error: ${res.status} ${await res.text()}`);
      return { url: null, ms: Date.now() - start };
    }
    const data = await res.json();
    if (data.Items && data.Items.length > 0) {
      const item = data.Items[0].Item;
      if (item.largeImageUrl) return { url: item.largeImageUrl, ms: Date.now() - start };
      if (item.mediumImageUrl) return { url: item.mediumImageUrl, ms: Date.now() - start };
    }
  } catch (e) {
    // ignore
  }
  return { url: null, ms: Date.now() - start };
}

async function fetchYouTube(artist: string, track: string): Promise<{ url: string | null; ms: number }> {
  const start = Date.now();
  if (!YOUTUBE_API_KEY) return { url: 'API KEY MISSING', ms: 0 };
  try {
    const query = encodeURIComponent(`${artist} ${track}`);
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=video&maxResults=1&key=${YOUTUBE_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.log(`YouTube Error: ${res.status} ${await res.text()}`);
      return { url: null, ms: Date.now() - start };
    }
    const data = await res.json();
    if (data.items && data.items.length > 0) {
      const snippet = data.items[0].snippet;
      const thumb = snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url;
      if (thumb) return { url: thumb, ms: Date.now() - start };
    }
  } catch (e) {
    // ignore
  }
  return { url: null, ms: Date.now() - start };
}

async function main() {
  const results = [];

  for (const t of testCases) {
    const [lfm, mb, deezer, rakuten, youtube] = await Promise.all([
      fetchLastFm(t.artist, t.track),
      fetchMusicBrainz(t.artist, t.track),
      fetchDeezer(t.artist, t.track),
      fetchRakuten(t.artist, t.track),
      fetchYouTube(t.artist, t.track)
    ]);

    results.push({
      Case: `${t.track} / ${t.artist}`,
      'Last.fm': lfm.url ? `✅ (${lfm.ms}ms)` : `❌ (${lfm.ms}ms)`,
      'MusicBrainz': mb.url ? `✅ (${mb.ms}ms)` : `❌ (${mb.ms}ms)`,
      'Deezer': deezer.url ? `✅ (${deezer.ms}ms)` : `❌ (${deezer.ms}ms)`,
      'Rakuten Books': rakuten.url ? (rakuten.url === 'API KEY MISSING' ? 'MISSING' : `✅ (${rakuten.ms}ms)`) : `❌ (${rakuten.ms}ms)`,
      'YouTube': youtube.url ? (youtube.url === 'API KEY MISSING' ? 'MISSING' : `✅ (${youtube.ms}ms)`) : `❌ (${youtube.ms}ms)`
    });

    console.log(`\n--- Test Case: ${t.track} / ${t.artist} ---`);
    console.log(`Last.fm URL: ${lfm.url || 'Not found'}`);
    console.log(`MusicBrainz URL: ${mb.url || 'Not found'}`);
    console.log(`Deezer URL: ${deezer.url || 'Not found'}`);
    console.log(`Rakuten Books URL: ${rakuten.url || 'Not found'}`);
    console.log(`YouTube URL: ${youtube.url || 'Not found'}`);
  }

  console.log('\n=== Summary ===');
  console.table(results);
}

main().catch(console.error);
