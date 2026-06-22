import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Agent, RichText } from '@atproto/api';
import { getDid } from '$lib/server/session';
import { createOAuthClient } from '$lib/server/oauth';
import { processImage } from '$lib/server/image';

export const POST: RequestHandler = async (event) => {
  const did = getDid(event);
  if (!did) throw error(401, 'Unauthorized');

  const { track } = await event.request.json();

  const oauthClient = await createOAuthClient(event.url.origin);
  const session = await oauthClient.restore(did);
  const agent = new Agent(session);

  // Upload thumbnail
  let thumbBlob = undefined;
  let imgBlob: string | undefined = undefined;
  if (track.artworkUrl) {
    try {
      const res = await fetch(track.artworkUrl.replace('100x100', '600x600'));
      if (res.ok) {
        const { blob } = await processImage(await res.blob());
        const uploadRes = await agent.uploadBlob(blob, { encoding: 'image/jpeg' });
        thumbBlob = uploadRes.data.blob;
        imgBlob = `${session.server.issuer}/xrpc/com.atproto.sync.getBlob?did=${did}&cid=${thumbBlob.ref.toString()}`;
      }
    } catch {
      // ignore
    }
  }

  const profileLink = `https://nowplayingat.suibari.com/profile/${did}`;
  const finalString = `💿 ${track.title} - ${track.artist}\n#NowPlaying #なうぷれ`;

  const rt = new RichText({ text: finalString });
  await rt.detectFacets(agent);

  const res = await agent.post({
    text: rt.text,
    facets: rt.facets,
    embed: {
      $type: 'app.bsky.embed.external',
      external: {
        uri: profileLink,
        title: `${track.title} - ${track.artist}`,
        description: 'nowplaying.at',
        thumb: thumbBlob,
      },
    },
    createdAt: new Date().toISOString(),
    langs: ['ja'],
  });
  return json({ ...res, imgBlob });
};
