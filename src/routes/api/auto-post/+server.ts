import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { Agent, RichText } from '@atproto/api';
import { createOAuthClient, restoreOAuthSession } from '$lib/server/oauth';
import { getSession } from '$lib/server/db';
import { searchTracks } from '$lib/server/music';
import { resolveArtworkUrl } from '$lib/server/artwork';
import { processImage } from '$lib/server/image';

const SITE_ORIGIN = 'https://nowplayingat.suibari.com';
const SITE_LABEL = 'なうぷれあっと';
const LFM_LABEL = 'lastfm';
const NSID_HISTORY = 'com.suibari.nowplayingat.history';

export const POST: RequestHandler = async (event) => {
  // Verify shared secret
  const auth = event.request.headers.get('Authorization');
  if (!auth || auth !== `Bearer ${env.NOWPLAYINGAT_SHARED_SECRET}`) {
    throw error(401, 'Unauthorized');
  }

  const { did, artist, title, album } = await event.request.json();
  if (!did || !artist || !title) throw error(400, 'did, artist, title required');

  const warnings: string[] = [];

  try {
  const oauthClient = createOAuthClient(event.url.origin);
  const session = await restoreOAuthSession(oauthClient, did, event);
  const agent = new Agent(session);

  // Discogs で track 取得（artworkUrl + trackUri）
  const tracks = await searchTracks(artist, title).catch(() => []);
  const track = tracks[0];

  // auto-post は Odesli を使わずジャケット画像のみ添付する（Odesli レートリミット対策）
  // ジャケット画像URL解決: Last.fm → MusicBrainz/CAA → Discogs（優先順位順）
  let thumbBlob: any = undefined;
  let imgBlob: string | undefined = undefined;
  let thumbAspectRatio: { width: number; height: number } | undefined;
  const { artworkUrl, lastFmUrl } = await resolveArtworkUrl(
    artist, title, album, track?.artworkUrl || undefined,
  ).catch(() => ({ artworkUrl: undefined, lastFmUrl: undefined }));
  if (artworkUrl) {
    try {
      const res = await fetch(artworkUrl);
      if (res.ok) {
        const { blob, width, height } = await processImage(await res.blob());
        thumbAspectRatio = width && height ? { width, height } : undefined;
        const uploadRes = await agent.uploadBlob(blob, { encoding: 'image/jpeg' });
        thumbBlob = uploadRes.data.blob;
        imgBlob = `${session.server.issuer}/xrpc/com.atproto.sync.getBlob?did=${did}&cid=${thumbBlob.ref.toString()}`;
      }
    } catch (e) {
      console.warn('[auto-post] thumbnail upload failed:', e);
    }
  }

  const userSession = await getSession(did);
  const customText = userSession?.custom_text?.trim() || '';
  const customLine = customText ? `\n${customText}` : '';

  const profileUrl = `${SITE_ORIGIN}/profile/${did}`;
  const viaLine = lastFmUrl
    ? `💿via ${SITE_LABEL} / ${LFM_LABEL}`
    : `💿via ${SITE_LABEL}`;
  const rawText = `🎵 Now Playing\n${title}\n${artist}${album ? `\n${album}` : ''}${customLine}\n\n#NowPlaying #なうぷれ #なうぷれあっと\n\n${viaLine}`;

  const rt = new RichText({ text: rawText });
  await rt.detectFacets(agent);

  const enc = new TextEncoder();
  if (!rt.facets) rt.facets = [];

  // なうぷれあっと → プロフィールリンク（via 行の最後の出現位置を使う）
  const siteIdx = rawText.lastIndexOf(SITE_LABEL);
  const siteStartByte = enc.encode(rawText.substring(0, siteIdx)).byteLength;
  const siteEndByte = siteStartByte + enc.encode(SITE_LABEL).byteLength;
  rt.facets.push({
    index: { byteStart: siteStartByte, byteEnd: siteEndByte },
    features: [{ $type: 'app.bsky.richtext.facet#link', uri: profileUrl }],
  });

  // lastfm → Last.fm トラックリンク（取得できた場合のみ）
  if (lastFmUrl) {
    const lfmIdx = rawText.lastIndexOf(LFM_LABEL);
    const lfmStartByte = enc.encode(rawText.substring(0, lfmIdx)).byteLength;
    const lfmEndByte = lfmStartByte + enc.encode(LFM_LABEL).byteLength;
    rt.facets.push({
      index: { byteStart: lfmStartByte, byteEnd: lfmEndByte },
      features: [{ $type: 'app.bsky.richtext.facet#link', uri: lastFmUrl }],
    });
  }

  const postRecord: any = { text: rt.text, facets: rt.facets, langs: ['ja'], createdAt: new Date().toISOString() };
  if (thumbBlob) {
    postRecord.embed = {
      $type: 'app.bsky.embed.images',
      images: [{ image: thumbBlob, alt: `${title} - ${artist}`, aspectRatio: thumbAspectRatio }],
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
        imgBlob: imgBlob ?? undefined,
        postedAt: new Date().toISOString(),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[auto-post] history record failed:', e);
    warnings.push(`history: ${msg}`);
  }

  return json({ ok: true, warnings: warnings.length ? warnings : undefined });

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    console.error('[auto-post] error:', e);
    return json({ ok: false, error: message, stack }, { status: 500 });
  }
};
