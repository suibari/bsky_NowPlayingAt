import { json, error, isHttpError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { Agent, RichText } from '@atproto/api';
import { createOAuthClient, restoreOAuthSession } from '$lib/server/oauth';
import { getSession } from '$lib/server/db';
import { resolveArtworkUrl } from '$lib/server/artwork';
import { processImage } from '$lib/server/image';

const SITE_ORIGIN = 'https://nowplayingat.suibari.com';
const SITE_LABEL = 'なうぷれあっと';
const NSID_HISTORY = 'com.suibari.nowplayingat.history';

export const POST: RequestHandler = async (event) => {
  // Verify shared secret
  const auth = event.request.headers.get('Authorization');
  if (!auth || auth !== `Bearer ${env.NOWPLAYINGAT_SHARED_SECRET}`) {
    throw error(401, 'Unauthorized');
  }

  const { did, artist, title, album, skipPost } = await event.request.json();
  if (!did || !artist || !title) throw error(400, 'did, artist, title required');

  const warnings: string[] = [];

  try {
  const oauthClient = await createOAuthClient(event.url.origin);
  const session = await restoreOAuthSession(oauthClient, did, event);
  const agent = new Agent(session);

  const userSession = await getSession(did);
  const attachImage = userSession?.attach_image ?? true;

  // auto-post は Odesli を使わずジャケット画像のみ添付する（Odesli レートリミット対策）
  // ジャケット画像URL解決: Last.fm → MusicBrainz/CAA（優先順位順）
  let thumbBlob: any = undefined;
  let imgBlob: string | undefined = undefined;
  const { artworkUrl } = await resolveArtworkUrl(
    artist, title, album,
  ).catch(() => ({ artworkUrl: undefined, lastFmUrl: undefined }));
  if (attachImage && artworkUrl) {
    try {
      const res = await fetch(artworkUrl);
      if (res.ok) {
        const { blob } = await processImage(await res.blob());
        const uploadRes = await agent.uploadBlob(blob, { encoding: 'image/jpeg' });
        thumbBlob = uploadRes.data.blob;
        imgBlob = `${session.server.issuer}/xrpc/com.atproto.sync.getBlob?did=${did}&cid=${thumbBlob.ref.toString()}`;
      }
    } catch (e) {
      console.warn('[auto-post] thumbnail upload failed:', e);
    }
  }
  // skipPost: 確率スキップ時は投稿せず history のみ登録する（再生記録だけ残す）
  let postRes: { uri: string } | undefined;
  if (!skipPost) {
    const profileUrl = `${SITE_ORIGIN}/profile/${did}`;
    const customText = userSession?.custom_text?.trim();
    const rawText = customText
      ? `💿 ${title} - ${artist}\n${customText}\n#NowPlaying #なうぷれ #なうぷれあっと`
      : `💿 ${title} - ${artist}\n#NowPlaying #なうぷれ #なうぷれあっと`;

    const rt = new RichText({ text: rawText });
    await rt.detectFacets(agent);

    const postRecord: any = { text: rt.text, facets: rt.facets, langs: ['ja'], createdAt: new Date().toISOString() };
    postRecord.embed = {
      $type: 'app.bsky.embed.external',
      external: {
        uri: profileUrl,
        title: `${title} - ${artist}`,
        description: SITE_LABEL,
        thumb: thumbBlob,
      },
    };

    postRes = await agent.post(postRecord);
  }

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
        postUri: postRes?.uri ?? undefined,
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
    // restoreOAuthSession throws SvelteKit HttpError (401 dead session / 503 transient).
    // These are not `instanceof Error`, so honor their status instead of always 500ing.
    if (isHttpError(e)) {
      const message = typeof e.body === 'object' && e.body ? e.body.message : String(e.body);
      console.warn(`[auto-post] ${e.status}:`, message);
      return json({ ok: false, error: message }, { status: e.status });
    }
    const message = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    console.error('[auto-post] error:', e);
    return json({ ok: false, error: message, stack }, { status: 500 });
  }
};
