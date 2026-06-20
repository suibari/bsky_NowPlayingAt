import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Agent, RichText } from '@atproto/api';
import { getDid } from '$lib/server/session';
import { createOAuthClient } from '$lib/server/oauth';
import { publicAgent } from '$lib/atproto';
import { resolveLinks, pickBestServiceLink } from '$lib/odesli';

export const POST: RequestHandler = async (event) => {
  const did = getDid(event);
  if (!did) throw error(401, 'Unauthorized');

  const { track, text } = await event.request.json();

  const oauthClient = createOAuthClient(event.url.origin);
  const session = await oauthClient.restore(did);
  const agent = new Agent(session);

  // Resolve streaming links: skip Odesli if client already resolved them
  let odesliLinks = null;
  if (!track.spotifyUrl && !track.youtubeMusicUrl && track.trackUri) {
    odesliLinks = await resolveLinks(track.trackUri).catch(() => null);
  }
  const { url: targetUrl, name: serviceName } = pickBestServiceLink(
    odesliLinks,
    track.trackUri,
    { spotifyUrl: track.spotifyUrl, youtubeMusicUrl: track.youtubeMusicUrl },
  );

  // Upload thumbnail
  let thumbBlob = undefined;
  if (track.artworkUrl) {
    try {
      const res = await fetch(track.artworkUrl.replace('100x100', '600x600'));
      if (res.ok) {
        const uploadRes = await agent.uploadBlob(await res.blob(), { encoding: 'image/jpeg' });
        thumbBlob = uploadRes.data.blob;
      }
    } catch {
      // ignore
    }
  }

  const profile = await publicAgent.getProfile({ actor: did });
  const profileLink = `https://nowplayingat.suibari.com/profile/${did}`;
  const linkLabel = '💿なうぷれあっとで見る';
  const comment = text || track.comment;

  const segments = [
    '#NowPlaying #なうぷれ',
    comment ? `\n\n${comment}` : '',
    `\n\n${track.title} - ${track.artist}\n`,
    linkLabel,
  ];
  const finalString = segments.join('');

  const rt = new RichText({ text: finalString });
  await rt.detectFacets(agent);

  const enc = new TextEncoder();
  const linkStart = finalString.indexOf(linkLabel);
  const startByte = enc.encode(finalString.substring(0, linkStart)).byteLength;
  const endByte = startByte + enc.encode(linkLabel).byteLength;

  if (!rt.facets) rt.facets = [];
  rt.facets.push({
    index: { byteStart: startByte, byteEnd: endByte },
    features: [{ $type: 'app.bsky.richtext.facet#link', uri: profileLink }],
  });

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
  return json(res);
};
