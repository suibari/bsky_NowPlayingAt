import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { Agent, RichText } from '@atproto/api';
import { createOAuthClient } from '$lib/server/oauth';
import { fetchArtwork } from '$lib/server/artwork';
import { searchTracks } from '$lib/server/music';
import { resolveLinks, pickBestServiceLink } from '$lib/odesli';

const SITE_ORIGIN = 'https://nowplayingat.suibari.com';
const LINK_LABEL = '💿なうぷれあっとで見る';
const NSID_HISTORY = 'com.suibari.nowplayingat.history';

export const POST: RequestHandler = async (event) => {
  // Verify shared secret
  const auth = event.request.headers.get('Authorization');
  if (!auth || auth !== `Bearer ${env.NOWPLAYINGAT_SHARED_SECRET}`) {
    throw error(401, 'Unauthorized');
  }

  const { did, artist, title, album } = await event.request.json();
  if (!did || !artist || !title) throw error(400, 'did, artist, title required');

  const oauthClient = createOAuthClient(event.url.origin);
  const session = await oauthClient.restore(did);
  const agent = new Agent(session);

  // Artwork and track search in parallel
  const [artwork, tracks] = await Promise.all([
    fetchArtwork(artist, title).catch(() => undefined),
    searchTracks(artist, title).catch(() => []),
  ]);

  // Upload artwork
  let artworkUrl: string | undefined;
  let thumbBlob: any = undefined;
  if (artwork) {
    try {
      const uploadRes = await agent.uploadBlob(artwork.blob, { encoding: 'image/jpeg' });
      thumbBlob = uploadRes.data.blob;
      artworkUrl = artwork.url;
    } catch (e) {
      console.warn('[auto-post] blob upload failed (image skipped):', e);
    }
  }

  // Resolve streaming link via Odesli — same flow as feed/post
  // trackUri can be iTunes (Apple Music) or Discogs; Odesli handles both
  const track = tracks[0];
  let targetUrl: string | undefined;
  let serviceName = 'Apple Music';

  if (track?.trackUri) {
    const odesliLinks = await resolveLinks(track.trackUri).catch(() => null);
    ({ url: targetUrl, name: serviceName } = pickBestServiceLink(odesliLinks, track.trackUri));
  }

  const profileUrl = `${SITE_ORIGIN}/profile/${did}`;
  const rawText = `🎵 Now Playing\n${title}\n${artist}${album ? `\n${album}` : ''}\n\n#NowPlaying #なうぷれ\n\n${LINK_LABEL}`;

  const rt = new RichText({ text: rawText });
  await rt.detectFacets(agent);

  // Attach profile link facet to LINK_LABEL
  const enc = new TextEncoder();
  const linkStart = rawText.indexOf(LINK_LABEL);
  const startByte = enc.encode(rawText.substring(0, linkStart)).byteLength;
  const endByte = startByte + enc.encode(LINK_LABEL).byteLength;
  if (!rt.facets) rt.facets = [];
  rt.facets.push({
    index: { byteStart: startByte, byteEnd: endByte },
    features: [{ $type: 'app.bsky.richtext.facet#link', uri: profileUrl }],
  });

  const postRecord: any = { text: rt.text, facets: rt.facets, createdAt: new Date().toISOString() };
  if (targetUrl) {
    postRecord.embed = {
      $type: 'app.bsky.embed.external',
      external: {
        uri: targetUrl,
        title: `${title} - ${artist}`,
        description: `Listen on ${serviceName}`,
        thumb: thumbBlob,
      },
    };
  }

  await agent.post(postRecord);

  // Also record to PDS history (non-fatal)
  try {
    await agent.com.atproto.repo.createRecord({
      repo: did,
      collection: NSID_HISTORY,
      record: {
        $type: NSID_HISTORY,
        provider: 'lastfm',
        track: title,
        artist,
        album: album ?? undefined,
        img: artworkUrl ?? undefined,
        postedAt: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.warn('[auto-post] history record failed:', e);
  }

  return json({ ok: true });
};
