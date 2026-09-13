import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createOAuthClient } from '$lib/server/oauth';

// `prompt` の許可値。'create' は認可サーバー側のアカウント作成画面から始める
// サインアップ導線で使う（bsky.social は prompt_values_supported に 'create' を含む）。
const ALLOWED_PROMPTS = ['create', 'login', 'select_account'] as const;
type Prompt = (typeof ALLOWED_PROMPTS)[number];

export const GET: RequestHandler = async (event) => {
  // handle にはハンドル / DID のほか、entryway・PDS の URL も渡せる
  // （サインアップ時は https://bsky.social のような entryway を渡す）。
  const handle = event.url.searchParams.get('handle');
  if (!handle) throw error(400, 'handle is required');

  const promptParam = event.url.searchParams.get('prompt');
  if (promptParam && !ALLOWED_PROMPTS.includes(promptParam as Prompt)) {
    throw error(400, 'invalid prompt');
  }
  const prompt = (promptParam as Prompt | null) ?? undefined;

  try {
    const oauthClient = await createOAuthClient(event.url.origin);
    console.log('[login] origin:', event.url.origin, 'client_id:', oauthClient.clientMetadata.client_id, 'prompt:', prompt ?? '-');
    const url = await oauthClient.authorize(handle, {
      scope: 'atproto blob:*/* repo:com.suibari.nowplayingat.config repo:com.suibari.nowplayingat.history repo:com.suibari.nowplayingat.playlist repo:com.suibari.nowplayingat.profile repo:com.suibari.nowplayingat.reaction repo:app.bsky.feed.post?action=create',
      ...(prompt ? { prompt } : {}),
    });
    console.log('[login] authorize URL:', url.toString());
    return json({ url: url.toString() });
  } catch (e: any) {
    const serializeCause = (err: any, depth = 0): string => {
      if (!err || depth > 5) return '';
      const msg = err?.message ?? String(err);
      const next = serializeCause(err?.cause, depth + 1);
      return next ? `${msg} → ${next}` : msg;
    };
    console.error('[login] OAuth error for handle:', handle, '| chain:', serializeCause(e), '| stack:', e?.stack);
    throw error(500, 'Failed to start OAuth flow');
  }
};
