import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Agent, RichText } from '@atproto/api';
import { getDid } from '$lib/server/session';
import { createSessionOAuthClient } from '$lib/server/oauth';
import { playUrl } from '$lib/playLink';
import { processImage } from '$lib/server/image';

export const POST: RequestHandler = async (event) => {
  const did = getDid(event);
  if (!did) throw error(401, 'Unauthorized');

  const { track, text } = await event.request.json();

  const oauthClient = await createSessionOAuthClient(event.url.origin, did);
  const session = await oauthClient.restore(did);
  const agent = new Agent(session);

  const targetUrl = playUrl(
    { spotify: track.spotifyUrl, youtube: track.youtubeMusicUrl, appleMusic: track.appleMusicUrl },
    track.artist,
    track.title,
  );
  const host = new URL(targetUrl).hostname;
  const serviceName = host.endsWith('youtube.com') ? 'YouTube Music'
    : host.endsWith('apple.com') ? 'Apple Music' : 'Spotify';

  // Upload thumbnail
  let thumbBlob = undefined;
  if (track.artworkUrl) {
    try {
      const res = await fetch(track.artworkUrl.replace('100x100', '600x600'));
      if (res.ok) {
        const { blob } = await processImage(await res.blob());
        const uploadRes = await agent.uploadBlob(blob, { encoding: 'image/jpeg' });
        thumbBlob = uploadRes.data.blob;
      }
    } catch {
      // ignore
    }
  }

  const customText = text?.trim();
  const finalString = customText
    ? `💿 ${track.title} - ${track.artist}\n${customText}\n#NowPlaying #なうぷれ #なうぷれあっと`
    : `💿 ${track.title} - ${track.artist}\n#NowPlaying #なうぷれ #なうぷれあっと`;

  const rt = new RichText({ text: finalString });
  await rt.detectFacets(agent);

  const res = await agent.post({
    text: rt.text,
    facets: rt.facets,
    embed: {
      $type: 'app.bsky.embed.external',
      external: {
        uri: targetUrl,
        title: `${track.title} - ${track.artist}`,
        description: `Listen on ${serviceName}`,
        thumb: thumbBlob,
      },
    },
    createdAt: new Date().toISOString(),
    langs: ['ja'],
  });
  return json({ ...res, thumbBlob });
};
