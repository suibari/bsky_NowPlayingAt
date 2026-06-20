import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Agent } from '@atproto/api';
import { getDid } from '$lib/server/session';
import { createOAuthClient } from '$lib/server/oauth';
import { getPdsEndpoint } from '$lib/atproto';

const NSID_REACTION = 'com.suibari.nowplayingat.reaction';

// GET: check if user has reacted to a specific subject
export const GET: RequestHandler = async (event) => {
  const did = getDid(event);
  if (!did) return json(null);

  const subjectUri = event.url.searchParams.get('subjectUri');
  if (!subjectUri) throw error(400, 'subjectUri required');

  const pds = await getPdsEndpoint(did);
  if (!pds) return json(null);

  const pdsAgent = new Agent({ service: pds });
  const res = await pdsAgent.com.atproto.repo.listRecords({
    repo: did,
    collection: NSID_REACTION,
    limit: 100,
  });

  const match = res.data.records.find((r: any) => r.value.subjectUri === subjectUri);
  if (!match) return json(null);
  return json({ uri: match.uri, value: match.value });
};

export const POST: RequestHandler = async (event) => {
  const did = getDid(event);
  if (!did) throw error(401, 'Unauthorized');

  const opts = await event.request.json();
  if (!opts.subjectUri) throw error(400, 'subjectUri required');

  const oauthClient = createOAuthClient(event.url.origin);
  const session = await oauthClient.restore(did);
  const agent = new Agent(session);

  const record: any = {
    $type: NSID_REACTION,
    subjectUri: opts.subjectUri,
    emoji: opts.emoji,
    createdAt: new Date().toISOString(),
  };

  if (opts.track) {
    record.kind = 'track';
    record.provider = opts.track.provider;
    record.track = opts.track.title;
    record.artist = opts.track.artist;
    record.album = opts.track.album;
    record.img = opts.track.artworkUrl;
    record.links = { spotify: opts.track.spotifyUrl, youtube: opts.track.youtubeMusicUrl };
  } else if (opts.playlist) {
    record.kind = 'playlist';
    record.playlist = {
      uri: opts.subjectUri,
      title: opts.playlist.record.name,
      author: opts.playlist.author,
    };
  }

  const res = await agent.com.atproto.repo.createRecord({
    repo: did,
    collection: NSID_REACTION,
    record: record as any,
  });
  return json(res.data);
};

export const DELETE: RequestHandler = async (event) => {
  const did = getDid(event);
  if (!did) throw error(401, 'Unauthorized');

  const { rkey } = await event.request.json();

  const oauthClient = createOAuthClient(event.url.origin);
  const session = await oauthClient.restore(did);
  const agent = new Agent(session);

  await agent.com.atproto.repo.deleteRecord({
    repo: did,
    collection: NSID_REACTION,
    rkey,
  });
  return json({ ok: true });
};
