import { json, error } from '@sveltejs/kit';
import type { RequestEvent, RequestHandler } from './$types';
import { Agent } from '@atproto/api';
import { getDid } from '$lib/server/session';
import { createSessionOAuthClient, restoreOAuthSession } from '$lib/server/oauth';
import { processImage } from '$lib/server/image';

const NSID_PROFILE = 'com.suibari.nowplayingat.profile';
const PROFILE_RKEY = 'self';
// The client already crops to a square, so anything much larger than that is
// either a very large source image or a bad request.
const UPLOAD_SIZE_LIMIT = 10_000_000;

async function getAgent(did: string, event: RequestEvent) {
  const oauthClient = await createSessionOAuthClient(event.url.origin, did);
  const session = await restoreOAuthSession(oauthClient, did, event);
  return new Agent(session);
}

async function getExistingRecord(agent: Agent, did: string) {
  try {
    const res = await agent.com.atproto.repo.getRecord({
      repo: did,
      collection: NSID_PROFILE,
      rkey: PROFILE_RKEY,
    });
    return (res.data.value ?? null) as Record<string, unknown> | null;
  } catch {
    // No profile record yet.
    return null;
  }
}

// Sessions granted before this collection was added to the OAuth scope cannot
// write it; the user has to sign in again. Surface that as its own error code so
// the UI can say so instead of showing a generic failure.
function isScopeError(e: any): boolean {
  const text = `${e?.error ?? ''} ${e?.message ?? ''}`.toLowerCase();
  if (text.includes('scope') || text.includes('permission')) return true;
  const status = e?.status ?? e?.statusCode;
  return status === 401 || status === 403;
}

// PUT: update the NowPlayingAt profile. Only the avatar is editable for now;
// other fields already on the record are preserved.
export const PUT: RequestHandler = async (event) => {
  const did = getDid(event);
  if (!did) throw error(401, 'Unauthorized');

  const form = await event.request.formData();
  const file = form.get('avatar');
  if (!(file instanceof Blob)) throw error(400, 'avatar is required');
  if (file.type && !file.type.startsWith('image/')) throw error(400, 'avatar must be an image');
  if (file.size > UPLOAD_SIZE_LIMIT) throw error(413, 'avatar is too large');

  const agent = await getAgent(did, event);

  // cropSquare guards against a non-square upload; it is a no-op for the
  // already-cropped blob the editor sends.
  const { blob } = await processImage(file, true);

  try {
    const uploadRes = await agent.uploadBlob(blob, { encoding: 'image/jpeg' });

    const existing = await getExistingRecord(agent, did);
    const record = {
      ...(existing ?? {}),
      $type: NSID_PROFILE,
      avatar: uploadRes.data.blob,
      createdAt: (existing?.createdAt as string | undefined) ?? new Date().toISOString(),
    };

    await agent.com.atproto.repo.putRecord({
      repo: did,
      collection: NSID_PROFILE,
      rkey: PROFILE_RKEY,
      record,
    });

    return json({ record });
  } catch (e) {
    console.error('Failed to write profile record:', e);
    if (isScopeError(e)) throw error(403, 'SCOPE_REQUIRED');
    throw error(500, 'PROFILE_WRITE_FAILED');
  }
};
