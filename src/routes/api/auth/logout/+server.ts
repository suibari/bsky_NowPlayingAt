import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createOAuthClient } from '$lib/server/oauth';
import { getDid, clearDidCookie } from '$lib/server/session';

export const POST: RequestHandler = async (event) => {
  const did = getDid(event);
  if (did) {
    try {
      const oauthClient = createOAuthClient(event.url.origin);
      await oauthClient.revoke(did);
    } catch {
      // ignore revoke failures
    }
    clearDidCookie(event);
  }
  return json({ ok: true });
};
