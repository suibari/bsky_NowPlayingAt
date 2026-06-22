import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Agent } from '@atproto/api';
import { getDid } from '$lib/server/session';
import { createOAuthClient, restoreOAuthSession } from '$lib/server/oauth';

const NSID_HISTORY = 'com.suibari.nowplayingat.history';

export const POST: RequestHandler = async (event) => {
  const did = getDid(event);
  if (!did) throw error(401, 'Unauthorized');

  const { imgBlob, ...track } = await event.request.json();

  const oauthClient = await createOAuthClient(event.url.origin);
  const session = await restoreOAuthSession(oauthClient, did, event);
  const agent = new Agent(session);

  const record = {
    $type: NSID_HISTORY,
    provider: track.provider,
    track: track.title,
    artist: track.artist,
    album: track.album,
    trackUri: track.trackUri,
    img: track.artworkUrl,
    imgBlob: imgBlob ?? undefined,
    links: {
      spotify: track.spotifyUrl ?? undefined,
      youtube: track.youtubeMusicUrl ?? undefined,
    },
    comment: track.comment ?? undefined,
    postedAt: new Date().toISOString(),
  };

  const res = await agent.com.atproto.repo.createRecord({
    repo: did,
    collection: NSID_HISTORY,
    record: record as any,
  });
  return json(res.data);
};

export const DELETE: RequestHandler = async (event) => {
  const did = getDid(event);
  if (!did) throw error(401, 'Unauthorized');

  const { rkey } = await event.request.json();

  const oauthClient = await createOAuthClient(event.url.origin);
  const session = await restoreOAuthSession(oauthClient, did, event);
  const agent = new Agent(session);

  await agent.com.atproto.repo.deleteRecord({
    repo: did,
    collection: NSID_HISTORY,
    rkey,
  });
  return json({ ok: true });
};
