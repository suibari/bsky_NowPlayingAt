import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createOAuthClient } from '$lib/server/oauth';

export const GET: RequestHandler = async (event) => {
  const handle = event.url.searchParams.get('handle');
  if (!handle) throw error(400, 'handle is required');

  try {
    const oauthClient = createOAuthClient(event.url.origin);
    console.log('[login] origin:', event.url.origin, 'client_id:', oauthClient.clientMetadata.client_id);
    const url = await oauthClient.authorize(handle, {
      scope: 'atproto blob:*/* repo:com.suibari.nowplayingat.config repo:com.suibari.nowplayingat.history repo:com.suibari.nowplayingat.playlist repo:com.suibari.nowplayingat.reaction repo:app.bsky.feed.post?action=create',
    });
    console.log('[login] authorize URL:', url.toString());
    return json({ url: url.toString() });
  } catch (e: any) {
    console.error('OAuth login error:', e?.message, 'cause:', e?.cause?.message ?? e?.cause, 'stack:', e?.stack);
    throw error(500, 'Failed to start OAuth flow');
  }
};
