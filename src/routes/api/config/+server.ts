import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Agent } from '@atproto/api';
import { getDid } from '$lib/server/session';
import { createOAuthClient, restoreOAuthSession } from '$lib/server/oauth';

const NSID_CONFIG = 'com.suibari.nowplayingat.config';
const NSID_PLAYLIST = 'com.suibari.nowplayingat.playlist';
const HUB_DID = 'did:plc:uixgxpiqf4i63p6rgpu7ytmx';
const HUB_REF = `at://${HUB_DID}/app.bsky.actor.profile/self`;

export const POST: RequestHandler = async (event) => {
  const did = getDid(event);
  if (!did) throw error(401, 'Unauthorized');

  const oauthClient = await createOAuthClient(event.url.origin);
  const session = await restoreOAuthSession(oauthClient, did, event);
  const agent = new Agent(session);

  try {
    const res = await agent.com.atproto.repo.listRecords({
      repo: did,
      collection: NSID_CONFIG,
      limit: 1,
    });

    if (res.data.records.length > 0) {
      const rec = res.data.records[0].value as any;
      if (rec.hubRef !== HUB_REF) {
        const rkey = res.data.records[0].uri.split('/').pop();
        await agent.com.atproto.repo.putRecord({
          repo: did,
          collection: NSID_CONFIG,
          rkey: rkey!,
          record: { $type: NSID_CONFIG, hubRef: HUB_REF, updatedAt: new Date().toISOString() },
        });
      }
    } else {
      await agent.com.atproto.repo.createRecord({
        repo: did,
        collection: NSID_CONFIG,
        record: { $type: NSID_CONFIG, hubRef: HUB_REF, updatedAt: new Date().toISOString() },
      });
      // Tag the auto-created favorites so timeline filters can identify it reliably.
      await agent.com.atproto.repo.createRecord({
        repo: did,
        collection: NSID_PLAYLIST,
        record: {
          $type: NSID_PLAYLIST,
          name: 'お気に入り',
          tracks: [],
          createdAt: new Date().toISOString(),
          isDefault: true,
        },
      });
    }
  } catch (e) {
    console.warn('ensureConfig failed:', e);
  }

  return json({ ok: true });
};
