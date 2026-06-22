import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createOAuthClient } from '$lib/server/oauth';
import { setDidCookie } from '$lib/server/session';
import { publicAgent } from '$lib/atproto';
import { upsertSession } from '$lib/server/db';

export const GET: RequestHandler = async (event) => {
  const params = event.url.searchParams;

  try {
    const oauthClient = await createOAuthClient(event.url.origin);
    const { session } = await oauthClient.callback(params);
    const did = session.did;

    // Fetch handle from public API
    let handle: string = did;
    try {
      const profile = await publicAgent.getProfile({ actor: did as any });
      handle = profile.data.handle;
    } catch {
      // fallback to DID
    }

    // Insert session row for new users only; ignore if already exists to preserve lastfm settings
    await upsertSession({ did, bsky_handle: handle, lastfm_username: '', enabled: false }, 'ignore');

    setDidCookie(event, did);
  } catch (e: any) {
    console.error('OAuth callback error:', e?.message, 'cause:', e?.cause?.message ?? e?.cause, 'cause2:', e?.cause?.cause?.message ?? e?.cause?.cause, 'stack:', e?.stack);
    throw error(500, 'OAuth callback failed');
  }

  // throw redirect outside try-catch: SvelteKit's redirect() throws a Redirect object,
  // not a Response instance, so it would be caught and mishandled if inside try-catch.
  throw redirect(302, '/');
};
