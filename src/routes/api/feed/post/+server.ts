import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Agent, RichText } from '@atproto/api';
import { getDid } from '$lib/server/session';
import { createOAuthClient } from '$lib/server/oauth';
import { publicAgent } from '$lib/atproto';
import { resolveLinks } from '$lib/odesli';
import { fetchArtwork } from '$lib/server/artwork';

export const POST: RequestHandler = async (event) => {
  const did = getDid(event);
  if (!did) throw error(401, 'Unauthorized');

  const { track, text } = await event.request.json();

  const oauthClient = createOAuthClient(event.url.origin);
  const session = await oauthClient.restore(did);
  const agent = new Agent(session);

  // Resolve links if missing
  if (!track.spotifyUrl && !track.youtubeMusicUrl && track.trackUri) {
    try {
      const links = await resolveLinks(track.trackUri);
      if (links) {
        if (links.linksByPlatform.spotify) track.spotifyUrl = links.linksByPlatform.spotify.url;
        if (links.linksByPlatform.youtubeMusic) track.youtubeMusicUrl = links.linksByPlatform.youtubeMusic.url;
      }
    } catch {
      // ignore
    }
  }

  let targetUrl = track.trackUri;
  let serviceName = 'Apple Music';
  if (track.spotifyUrl) { targetUrl = track.spotifyUrl; serviceName = 'Spotify'; }
  else if (track.youtubeMusicUrl) { targetUrl = track.youtubeMusicUrl; serviceName = 'YouTube Music'; }

  // Upload thumbnail: existing URL first, then MusicBrainz+CAA, then iTunes
  let thumbBlob = undefined;
  try {
    const artwork = await fetchArtwork(track.artist, track.title, track.artworkUrl);
    if (artwork) {
      const uploadRes = await agent.uploadBlob(artwork.blob, { encoding: 'image/jpeg' });
      thumbBlob = uploadRes.data.blob;
    }
  } catch {
    // ignore
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
