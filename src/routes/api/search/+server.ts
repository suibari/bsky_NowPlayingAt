import { json } from '@sveltejs/kit';
import { DISCOGS_TOKEN } from '$env/static/private';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
    const query = url.searchParams.get('q');
    if (!query || query.length < 2) {
        return json([]);
    }

    const encodedQuery = encodeURIComponent(query);

    // 1. Discogs Search
    console.log(`[Search] Discogs query: ${query}`);
    const discogsUrl = `https://api.discogs.com/database/search?q=${encodedQuery}&type=release&per_page=20&token=${DISCOGS_TOKEN}`;
    // Mask token for logging if desired, or just log the base URL
    console.log(`[Search] Fetching from Discogs...`);

    const discogsResults = await fetch(
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

            return data.results.map((item: any) => {
                const parts = item.title.split(' - ');
                const artist = parts.length > 1 ? parts[0] : 'Unknown';
                const title = parts.length > 1 ? parts.slice(1).join(' - ') : item.title;

                return {
                    id: `discogs:${item.id}`,
                    provider: 'discogs',
                    title: title,
                    artist: artist,
                    album: title, // Discogs "release" is basically the album
                    artworkUrl: item.cover_image, // Discogs image (might fail 403 hotlinking, checking later)
                    trackUri: `https://www.discogs.com${item.uri}`,
                    previewUrl: null, // Discogs doesn't easily provide preview
                };
            });
        })
        .catch((e) => {
            console.error('Discogs search failed:', e);
            return [];
        });

    return json(discogsResults);
};
