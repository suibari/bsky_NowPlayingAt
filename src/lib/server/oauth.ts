import { NodeOAuthClient } from '@atproto/oauth-client-node';
import {
  setOAuthState, getOAuthState, delOAuthState,
  setOAuthSession, getOAuthSession, delOAuthSession,
} from './db';

const PROD_ORIGIN = 'https://nowplayingat.suibari.com';
const SCOPE = 'atproto blob:*/* repo:com.suibari.nowplayingat.config repo:com.suibari.nowplayingat.history repo:com.suibari.nowplayingat.playlist repo:com.suibari.nowplayingat.reaction repo:app.bsky.feed.post?action=create';

const stateStore = {
  async set(key: string, state: any) { await setOAuthState(key, state); },
  async get(key: string) { return getOAuthState(key) as any; },
  async del(key: string) { await delOAuthState(key); },
};

const sessionStore = {
  async set(sub: string, session: any) { await setOAuthSession(sub, session); },
  async get(sub: string) { return getOAuthSession(sub) as any; },
  async del(sub: string) { await delOAuthSession(sub); },
};

export function createOAuthClient(origin: string): NodeOAuthClient {
  const isLocal = origin !== PROD_ORIGIN;

  if (isLocal) {
    // ATProto loopback client:
    //   - client_id MUST start with "http://localhost" (exact string, per ATProto spec)
    //   - redirect_uri MUST use 127.0.0.1, NOT "localhost" (per RFC 8252 / library validation)
    const port = new URL(origin).port || '5173';
    const redirectUri = `http://127.0.0.1:${port}/oauth/callback`;
    return new NodeOAuthClient({
      clientMetadata: {
        client_id: `http://localhost?redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(SCOPE)}`,
        redirect_uris: [redirectUri],
        scope: SCOPE,
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
        application_type: 'web',
        dpop_bound_access_tokens: true,
      },
      stateStore,
      sessionStore,
    });
  }

  return new NodeOAuthClient({
    clientMetadata: {
      client_id: `${PROD_ORIGIN}/client-metadata.json`,
      client_name: 'なうぷれあっと',
      client_uri: PROD_ORIGIN,
      redirect_uris: [`${PROD_ORIGIN}/oauth/callback`],
      scope: SCOPE,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      application_type: 'web',
      dpop_bound_access_tokens: true,
    },
    stateStore,
    sessionStore,
  });
}
