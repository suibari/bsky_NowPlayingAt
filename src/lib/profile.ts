import { Agent, type BlobRef } from '@atproto/api';
import { getPdsEndpoint } from '$lib/atproto';
import { NSID_CONFIG, NSID_PROFILE, type ProfileRecord } from '$lib/schema';

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

// AT Protocol's sortable TID stores its creation time (microseconds) in the
// first 11 base-32 characters. Config records predate an explicit createdAt
// field, so their rkey is the most reliable registration timestamp.
function dateFromTid(rkey: string): string | null {
  if (!/^[234567abcdefghij][234567abcdefghijklmnopqrstuvwxyz]{12}$/.test(rkey)) return null;
  const alphabet = '234567abcdefghijklmnopqrstuvwxyz';
  let micros = 0;
  for (const char of rkey.slice(0, 11)) {
    micros = micros * 32 + alphabet.indexOf(char);
  }
  const date = new Date(Math.floor(micros / 1000));
  const time = date.getTime();
  return Number.isNaN(time) || time > Date.now() + 86_400_000 ? null : date.toISOString();
}

/** The date this user first created NowPlayingAt's registration config. */
export async function getNowplayingRegisteredAt(did: string): Promise<string | null> {
  const pds = await getPdsEndpoint(did);
  if (!pds) return null;

  try {
    const pdsAgent = new Agent({ service: pds });
    const res = await pdsAgent.com.atproto.repo.listRecords({
      repo: did,
      collection: NSID_CONFIG,
      limit: 1,
      reverse: true,
    });
    const record = res.data.records[0];
    if (!record) return null;
    const rkey = record.uri.split('/').pop() ?? '';
    const value = record.value as { createdAt?: unknown; updatedAt?: unknown };
    return (
      dateFromTid(rkey) ??
      (typeof value.createdAt === 'string' ? value.createdAt : null) ??
      (typeof value.updatedAt === 'string' ? value.updatedAt : null)
    );
  } catch {
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

/** Update editable fields on the user's NowPlayingAt profile record. */
export async function updateNowplayingProfile(
  displayName: string,
  avatar?: Blob,
): Promise<ProfileRecord> {
  const form = new FormData();
  form.append('displayName', displayName);
  if (avatar) form.append('avatar', avatar, 'avatar.jpg');

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
