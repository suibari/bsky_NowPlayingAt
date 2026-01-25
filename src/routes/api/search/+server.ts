import { json } from '@sveltejs/kit';
import { DISCOGS_TOKEN } from '$env/static/private';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
    const query = url.searchParams.get('q');
    if (!query || query.length < 2) {
        return json([]);
    }

    const encodedQuery = encodeURIComponent(query);

    // 1. iTunes Search
    const itunesPromise = fetch(
        `https://itunes.apple.com/search?term=${encodedQuery}&entity=song&limit=20`
    )
        .then(async (res) => {
            if (!res.ok) throw new Error(`iTunes error: ${res.status}`);
            const data = await res.json();
            return data.results.map((item: any) => ({
                id: `itunes:${item.trackId}`,
                provider: 'itunes',
                title: item.trackName,
                artist: item.artistName,
                album: item.collectionName,
                artworkUrl: item.artworkUrl100?.replace('100x100', '600x600'),
                previewUrl: item.previewUrl,
                trackUri: item.trackViewUrl,
            }));
        })
        .catch((e) => {
            console.error('iTunes search failed:', e);
            return [];
        });

    // 2. Discogs Search
    console.log(`[Search] Discogs query: ${query}`);
    const discogsUrl = `https://api.discogs.com/database/search?q=${encodedQuery}&type=release&per_page=20&token=${DISCOGS_TOKEN}`;
    // Mask token for logging if desired, or just log the base URL
    console.log(`[Search] Fetching from Discogs...`);

    const discogsPromise = fetch(
        discogsUrl,
        {
            headers: {
                'User-Agent': 'NowPlayingAt/1.0', // Discogs requires a User-Agent
            },
        }
    )
        .then(async (res) => {
            console.log(`[Search] Discogs response status: ${res.status}`);
            console.log(`[Search] Discogs rate limit rem: ${res.headers.get('X-Discogs-Ratelimit-Remaining')}`);

            if (!res.ok) {
                const text = await res.text();
                console.error(`[Search] Discogs error body: ${text}`);
                throw new Error(`Discogs error: ${res.status}`);
            }
            const data = await res.json();
            console.log(`[Search] Discogs results count: ${data.results?.length}`);

            return data.results.map((item: any) => ({
                id: `discogs:${item.id}`,
                provider: 'discogs',
                title: item.title, // "Artist - Title" format often
                artist: item.title.split(' - ')[0] || 'Unknown', // Naive parsing, Discogs often returns "Artist - Title"
                album: item.title.split(' - ')[1] || item.title, // Fallback
                artworkUrl: item.cover_image, // Discogs image (might fail 403 hotlinking, checking later)
                trackUri: `https://www.discogs.com${item.uri}`,
                previewUrl: null, // Discogs doesn't easily provide preview
            }));
        })
        .catch((e) => {
            console.error('Discogs search failed:', e);
            return [];
        });

    const [itunesResults, discogsResults] = await Promise.all([
        itunesPromise,
        discogsPromise,
    ]);

    // Merge (interleave or just concat)
    // Let's concat for simplicity, with iTunes first as they are usually better formatted for single tracks
    const combined = [...itunesResults, ...discogsResults];

    return json(combined);
};
