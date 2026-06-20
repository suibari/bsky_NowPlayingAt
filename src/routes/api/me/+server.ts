import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDid } from '$lib/server/session';
import { publicAgent } from '$lib/atproto';

export const GET: RequestHandler = async (event) => {
  const did = getDid(event);
  if (!did) throw error(401, 'Unauthorized');

  try {
    const profile = await publicAgent.getProfile({ actor: did as any });
    return json({
      did,
      handle: profile.data.handle,
      displayName: profile.data.displayName ?? null,
      avatar: profile.data.avatar ?? null,
    });
  } catch (e) {
    console.error('Profile fetch failed:', e);
    throw error(401, 'Unauthorized');
  }
};
