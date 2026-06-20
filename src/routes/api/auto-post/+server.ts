import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { Agent, RichText } from '@atproto/api';
import { createOAuthClient } from '$lib/server/oauth';

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

  // Get artwork from iTunes Search API; keep artworkUrl for history record
  let artworkUrl: string | undefined;
  let thumbBlob: any = undefined;
  try {
    const searchRes = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(`${artist} ${title}`)}&media=music&limit=1`
    );
    const searchData = await searchRes.json();
    artworkUrl = searchData?.results?.[0]?.artworkUrl100?.replace('100x100bb', '600x600bb');
    if (artworkUrl) {
      const imgRes = await fetch(artworkUrl);
      if (imgRes.ok) {
        const imgBlob = await imgRes.blob();
        const uploadRes = await agent.uploadBlob(imgBlob, { encoding: 'image/jpeg' });
        thumbBlob = uploadRes.data.blob;
      }
    }
  } catch (e) {
    console.warn('[auto-post] artwork fetch/upload failed:', e);
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
  if (thumbBlob) {
    postRecord.embed = {
      $type: 'app.bsky.embed.images',
      images: [{ image: thumbBlob, alt: `${title} - ${artist}` }],
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
