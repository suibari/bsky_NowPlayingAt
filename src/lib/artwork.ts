import type { BlobRef } from '@atproto/api';

/**
 * Resolve the best displayable artwork URL for a history / track-like record.
 *
 * Priority:
 *  1. Proper BlobRef → bsky image CDN (`cdn.bsky.app`). Needs `did`.
 *  2. A plain, renderable string imgBlob — but NOT a legacy
 *     `https://bsky.social/xrpc/com.atproto.sync.getBlob?...` URL, which does
 *     not render reliably in <img> (and its cid is usually not on the CDN).
 *  3. The original source artwork URL (`img`, e.g. Last.fm / iTunes).
 *  4. "" — let the <img> error handler fall back to a placeholder.
 */
export function resolveArtworkUrl(
  imgBlob: string | BlobRef | undefined | null,
  img: string | undefined | null,
  did?: string,
): string {
  const blob: any = imgBlob;
  if (blob?.ref && did) {
    const cid = blob.ref.$link || blob.ref.toString();
    return `https://cdn.bsky.app/img/feed_thumbnail/plain/${did}/${cid}@jpeg`;
  }
  if (
    typeof blob === 'string' &&
    !blob.includes('com.atproto.sync.getBlob') &&
    !blob.includes('cid=undefined')
  ) {
    return blob;
  }
  return img ?? '';
}
