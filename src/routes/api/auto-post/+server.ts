import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { Agent, RichText } from '@atproto/api';
import { createOAuthClient, restoreOAuthSession } from '$lib/server/oauth';
import { getSession } from '$lib/server/db';
import { searchTracks } from '$lib/server/music';
import { resolveArtworkUrl } from '$lib/server/artwork';
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

  const warnings: string[] = [];

  try {
  const oauthClient = createOAuthClient(event.url.origin);
  const session = await restoreOAuthSession(oauthClient, did, event);
  const agent = new Agent(session);

  // Discogs で track 取得（artworkUrl + trackUri）
  const tracks = await searchTracks(artist, title).catch(() => []);
  const track = tracks[0];

  // 制約（設計メモ）:
  //   - iTunes Search API はサーバーサイドで叩くとレートリミットに即ヒットするためクライアント専用
  //     → auto_post では Apple Music URL を取得できない
  //   - Discogs URL は Odesli 非対応（HTTP 400）のためストリーミングリンクへの変換不可
  //     → Discogs しかない auto_post では Odesli によるリンク解決が失敗する場合がある
  //   フォールバック: ストリーミングリンクが取れない場合はジャケット画像のみ添付

  // ストリーミングリンク解決: Discogs trackUri → Odesli
  let targetUrl: string | undefined;
  let serviceName = 'Apple Music';
  if (track?.trackUri) {
    const odesliLinks = await resolveLinks(track.trackUri).catch(() => null);
    ({ url: targetUrl, name: serviceName } = pickBestServiceLink(odesliLinks, track.trackUri));
    if (targetUrl === track.trackUri) targetUrl = undefined;
  }

  // サムネイルは常にアップロード試みる（リンクカードにもフォールバック画像にも使う）
  // ジャケット画像URL解決: Last.fm → MusicBrainz/CAA → Discogs（優先順位順）
  let thumbBlob: any = undefined;
  let imgBlob: string | undefined = undefined;
  const artworkUrl = await resolveArtworkUrl(
    artist, title, album, track?.artworkUrl || undefined,
  ).catch(() => undefined);
  if (artworkUrl) {
    try {
      const res = await fetch(artworkUrl);
      if (res.ok) {
        const uploadRes = await agent.uploadBlob(await res.blob(), { encoding: 'image/jpeg' });
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
  const rawText = `🎵 Now Playing\n${title}\n${artist}${album ? `\n${album}` : ''}${customLine}\n\n#NowPlaying #なうぷれ\n\n${LINK_LABEL}`;

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

  const postRecord: any = { text: rt.text, facets: rt.facets, langs: ['ja'], createdAt: new Date().toISOString() };
  if (targetUrl) {
    // ストリーミングリンクカード（サムネイル付き）
    postRecord.embed = {
      $type: 'app.bsky.embed.external',
      external: {
        uri: targetUrl,
        title: `${title} - ${artist}`,
        description: `Listen on ${serviceName}`,
        thumb: thumbBlob,
      },
    };
  } else if (thumbBlob) {
    // フォールバック: ストリーミングリンクなし → ジャケット画像のみ添付
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
