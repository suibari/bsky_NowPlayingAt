import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { getDid } from '$lib/server/session';
import { upsertSession, getSession } from '$lib/server/db';
import { publicAgent } from '$lib/atproto';

// GET: fetch current registration
export const GET: RequestHandler = async (event) => {
  const did = getDid(event);
  if (!did) throw error(401, 'Unauthorized');

  const session = await getSession(did);
  if (!session) return json({ lastfm_username: null, enabled: false });
  return json({ lastfm_username: session.lastfm_username, enabled: session.enabled });
};

// POST: save Last.fm username + enabled flag
export const POST: RequestHandler = async (event) => {
  const did = getDid(event);
  if (!did) throw error(401, 'Unauthorized');

  const { lastfm_username, enabled } = await event.request.json();
  if (!lastfm_username?.trim()) throw error(400, 'lastfm_username is required');

  // Verify Last.fm user exists
  const lfRes = await fetch(
    `https://ws.audioscrobbler.com/2.0/?method=user.getInfo&user=${encodeURIComponent(lastfm_username)}&api_key=${env.LASTFM_API_KEY}&format=json`
  );
  const lfData = await lfRes.json();
  if (lfData.error) throw error(400, 'Last.fm user not found');

  // Get handle for session record
  let handle = did;
  try {
    const profile = await publicAgent.getProfile({ actor: did });
    handle = profile.data.handle;
  } catch { /* fallback to DID */ }

  await upsertSession({ did, bsky_handle: handle, lastfm_username: lastfm_username.trim(), enabled: enabled ?? true });
  return json({ ok: true });
};
