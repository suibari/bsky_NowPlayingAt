import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchDiscogsQuery } from '$lib/server/music';

export const GET: RequestHandler = async ({ url }) => {
  const query = url.searchParams.get('q');
  if (!query || query.length < 2) return json([]);

  console.log(`[Search] Discogs query: ${query}`);
  const results = await searchDiscogsQuery(query);
  console.log(`[Search] Discogs results count: ${results.length}`);
  return json(results);
};
