import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Agent } from '@atproto/api';
import { getDid } from '$lib/server/session';
import { createOAuthClient, restoreOAuthSession } from '$lib/server/oauth';

const NSID_PLAYLIST = 'com.suibari.nowplayingat.playlist';

async function getAgent(did: string, origin: string) {
  const oauthClient = createOAuthClient(origin);
  const session = await restoreOAuthSession(oauthClient, did);
  return new Agent(session);
}

// POST: create playlist
export const POST: RequestHandler = async (event) => {
  const did = getDid(event);
  if (!did) throw error(401, 'Unauthorized');

  const { name, tracks } = await event.request.json();
  const agent = await getAgent(did, event.url.origin);

  const res = await agent.com.atproto.repo.createRecord({
    repo: did,
    collection: NSID_PLAYLIST,
    record: {
      $type: NSID_PLAYLIST,
      name,
      tracks: tracks ?? [],
      createdAt: new Date().toISOString(),
    },
  });
  return json(res.data);
};

// PUT: update playlist (add track or reorder)
export const PUT: RequestHandler = async (event) => {
  const did = getDid(event);
  if (!did) throw error(401, 'Unauthorized');

  const { rkey, record } = await event.request.json();
  const agent = await getAgent(did, event.url.origin);

  const res = await agent.com.atproto.repo.putRecord({
    repo: did,
    collection: NSID_PLAYLIST,
    rkey,
    record,
  });
  return json(res.data);
};

// DELETE: delete playlist
export const DELETE: RequestHandler = async (event) => {
  const did = getDid(event);
  if (!did) throw error(401, 'Unauthorized');

  const { rkey } = await event.request.json();
  const agent = await getAgent(did, event.url.origin);

  await agent.com.atproto.repo.deleteRecord({
    repo: did,
    collection: NSID_PLAYLIST,
    rkey,
  });
  return json({ ok: true });
};
