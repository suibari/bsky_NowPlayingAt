import { Agent, type BlobRef } from '@atproto/api';
import { getPdsEndpoint } from '$lib/atproto';
import { NSID_PROFILE, type ProfileRecord } from '$lib/schema';

// The NowPlayingAt profile is a singleton record, like app.bsky.actor.profile.
export const PROFILE_RKEY = 'self';

/**
 * Read a user's NowPlayingAt profile record straight from their PDS.
 * Returns null when they have never edited it (most users) — callers then fall
 * back to the Bluesky profile.
 */
export async function getNowplayingProfile(did: string): Promise<ProfileRecord | null> {
  const pds = await getPdsEndpoint(did);
  if (!pds) return null;

  try {
    const pdsAgent = new Agent({ service: pds });
    const res = await pdsAgent.com.atproto.repo.getRecord({
      repo: did,
      collection: NSID_PROFILE,
      rkey: PROFILE_RKEY,
    });
    return (res.data.value as unknown as ProfileRecord) ?? null;
  } catch {
    // RecordNotFound for anyone who has not edited their profile yet.
    return null;
  }
}

/**
 * Displayable URL for a NowPlayingAt avatar blob, via the bsky image CDN (which
 * serves any blob in a repo, not just app.bsky records). Returns null when there
 * is no usable blob, so callers can fall back to the Bluesky avatar.
 */
export function resolveAvatarUrl(
  avatar: BlobRef | string | undefined | null,
  did?: string,
): string | null {
  const blob: any = avatar;
  if (blob?.ref && did) {
    const cid = blob.ref.$link || blob.ref.toString();
    return `https://cdn.bsky.app/img/avatar/plain/${did}/${cid}@jpeg`;
  }
  if (typeof blob === 'string' && blob.startsWith('http')) return blob;
  return null;
}

export class ProfileUpdateError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

/** Upload a cropped square avatar and store it on the profile record. */
export async function updateNowplayingAvatar(avatar: Blob): Promise<ProfileRecord> {
  const form = new FormData();
  form.append('avatar', avatar, 'avatar.jpg');

  const res = await fetch('/api/profile', { method: 'PUT', body: form });
  if (!res.ok) {
    let code = 'PROFILE_WRITE_FAILED';
    try {
      const body = await res.json();
      code = body?.message || body?.error || code;
    } catch {
      // non-JSON error body
    }
    throw new ProfileUpdateError(code);
  }

  const { record } = await res.json();
  return record as ProfileRecord;
}
