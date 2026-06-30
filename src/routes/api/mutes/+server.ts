import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDid } from '$lib/server/session';
import { getMutedDids, addMute, removeMute } from '$lib/server/db';

// GET: list the current viewer's muted dids
export const GET: RequestHandler = async (event) => {
  const did = getDid(event);
  if (!did) return json({ mutedDids: [] });

  const mutedDids = await getMutedDids(did);
  return json({ mutedDids });
};

export const POST: RequestHandler = async (event) => {
  const did = getDid(event);
  if (!did) throw error(401, 'Unauthorized');

  const { muted_did } = await event.request.json();
  if (!muted_did) throw error(400, 'muted_did required');
  if (muted_did === did) throw error(400, 'Cannot mute yourself');

  await addMute(did, muted_did);
  return json({ ok: true });
};

export const DELETE: RequestHandler = async (event) => {
  const did = getDid(event);
  if (!did) throw error(401, 'Unauthorized');

  const { muted_did } = await event.request.json();
  if (!muted_did) throw error(400, 'muted_did required');

  await removeMute(did, muted_did);
  return json({ ok: true });
};
