import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createSessionOAuthClient } from '$lib/server/oauth';
import { getDid, clearDidCookie } from '$lib/server/session';

export const POST: RequestHandler = async (event) => {
  const did = getDid(event);
  if (did) {
    try {
      const oauthClient = await createSessionOAuthClient(event.url.origin, did);
      await oauthClient.revoke(did);
    } catch {
      // ignore revoke failures
    }
    clearDidCookie(event);
  }
  return json({ ok: true });
};
