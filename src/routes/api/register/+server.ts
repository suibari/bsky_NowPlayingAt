import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { getDid } from '$lib/server/session';
import { upsertSession, getSession, upsertHideFromFeed } from '$lib/server/db';
import { publicAgent } from '$lib/atproto';

// GET: fetch current registration
export const GET: RequestHandler = async (event) => {
  const did = getDid(event);
  if (!did) throw error(401, 'Unauthorized');

  const session = await getSession(did);
  if (!session) return json({ lastfm_username: null, enabled: false, custom_text: null, attach_image: true, post_probability: 100, hide_from_feed: false });
  return json({ lastfm_username: session.lastfm_username, enabled: session.enabled, custom_text: session.custom_text ?? null, attach_image: session.attach_image ?? true, post_probability: session.post_probability ?? 100, hide_from_feed: session.hide_from_feed ?? false });
};

// POST: save Last.fm username + enabled flag
export const POST: RequestHandler = async (event) => {
  const did = getDid(event);
  if (!did) throw error(401, 'Unauthorized');

  const { lastfm_username, enabled, custom_text, attach_image, post_probability, hide_from_feed } = await event.request.json();
  if (!lastfm_username?.trim()) return json({ error: 'LASTFM_USERNAME_REQUIRED' }, { status: 400 });
  const probability = typeof post_probability === 'number'
    ? Math.max(0, Math.min(100, Math.round(post_probability)))
    : 100;

  // Verify Last.fm user exists
  const lfRes = await fetch(
    `https://ws.audioscrobbler.com/2.0/?method=user.getInfo&user=${encodeURIComponent(lastfm_username)}&api_key=${env.LASTFM_API_KEY}&format=json`
  );
  const lfData = await lfRes.json();
  if (lfData.error) return json({ error: 'LASTFM_USER_NOT_FOUND' }, { status: 400 });

  // Get handle for session record
  let handle = did;
  try {
    const profile = await publicAgent.getProfile({ actor: did });
    handle = profile.data.handle;
  } catch { /* fallback to DID */ }

  try {
    await upsertSession({ did, bsky_handle: handle, lastfm_username: lastfm_username.trim(), enabled: enabled ?? true, custom_text: custom_text?.trim() || null, attach_image: attach_image ?? true, post_probability: probability, hide_from_feed: hide_from_feed ?? false });
  } catch {
    return json({ error: 'DB_SAVE_FAILED' }, { status: 500 });
  }
  return json({ ok: true });
};

// PATCH: save hide_from_feed only (no Last.fm validation required)
export const PATCH: RequestHandler = async (event) => {
  const did = getDid(event);
  if (!did) throw error(401, 'Unauthorized');

  const { hide_from_feed } = await event.request.json();
  let handle = did;
  try {
    const profile = await publicAgent.getProfile({ actor: did });
    handle = profile.data.handle;
  } catch { /* fallback to DID */ }

  try {
    await upsertHideFromFeed(did, handle, hide_from_feed ?? false);
  } catch {
    return json({ error: 'DB_SAVE_FAILED' }, { status: 500 });
  }
  return json({ ok: true });
};
