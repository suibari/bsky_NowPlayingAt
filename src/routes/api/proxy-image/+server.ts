import type { RequestHandler } from './$types';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 5_000;
const MAX_REDIRECTS = 3;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

const LAST_FM_HOSTS = new Set(['lastfm.freetls.fastly.net', 'lastfm-img.freetls.fastly.net']);
const DEEZER_HOSTS = new Set(['cdn-images.dzcdn.net', 'e-cdns-images.dzcdn.net']);
const DISCOGS_HOSTS = new Set(['i.discogs.com', 'img.discogs.com']);
const COVER_ART_PATH = /^\/release\/[\da-f-]{36}\/(?:front|\d+)(?:-(?:250|500|1200))?(?:\.(?:jpe?g|png|gif|webp))?$/i;
const ARCHIVE_IMAGE = /^\/mbid-([\da-f-]{36})\/mbid-\1-\d+(?:(?:_thumb|-)(?:250|500|1200))?\.(?:jpe?g|png|gif|webp)$/i;

function isArtworkUrl(url: URL): boolean {
    const { protocol, username, password, port, hostname, pathname } = url;
    if (protocol !== 'https:' || username || password || port) return false;

    if (/^is\d+-ssl\.mzstatic\.com$/.test(hostname)) {
        return /^\/image\/thumb\/(?:Music|Features|Purple)\d*\//.test(pathname);
    }
    if (DISCOGS_HOSTS.has(hostname)) return true;
    if (LAST_FM_HOSTS.has(hostname)) return pathname.startsWith('/i/u/');
    if (DEEZER_HOSTS.has(hostname)) return pathname.startsWith('/images/cover/');
    if (hostname === 'i.ytimg.com') return /^\/vi(?:_webp)?\//.test(pathname);
    if (hostname === 'cdn.bsky.app') return /^\/img\/feed_(?:thumbnail|fullsize)\/plain\//.test(pathname);
    if (hostname === 'coverartarchive.org') return COVER_ART_PATH.test(pathname);

    // Cover Art Archive may redirect through archive.org to an Internet Archive storage host.
    if (hostname === 'archive.org') {
        return pathname.startsWith('/download/') && ARCHIVE_IMAGE.test(pathname.slice('/download'.length));
    }
    if (/^ia\d+\.(?:us\.)?archive\.org$/.test(hostname)) {
        const storagePath = /^\/\d+\/items(\/.*)$/.exec(pathname);
        return !!storagePath && ARCHIVE_IMAGE.test(storagePath[1]);
    }
    return false;
}

function parseArtworkUrl(input: string, base?: URL): URL | null {
    try {
        const url = new URL(input, base);
        return isArtworkUrl(url) ? url : null;
    } catch {
        return null;
    }
}

function matchesBytes(bytes: Uint8Array, signature: number[], offset = 0): boolean {
    return signature.every((byte, index) => bytes[offset + index] === byte);
}

const IMAGE_TYPES = new Map<string, (bytes: Uint8Array) => boolean>([
    ['image/jpeg', (bytes) => matchesBytes(bytes, [0xff, 0xd8, 0xff])],
    ['image/png', (bytes) => matchesBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    ['image/gif', (bytes) => matchesBytes(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
        matchesBytes(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])],
    ['image/webp', (bytes) => matchesBytes(bytes, [0x52, 0x49, 0x46, 0x46]) &&
        matchesBytes(bytes, [0x57, 0x45, 0x42, 0x50], 8)],
]);

async function readImage(body: ReadableStream<Uint8Array>): Promise<Uint8Array<ArrayBuffer> | null> {
    const reader = body.getReader();
    let bytes = new Uint8Array(0);
    let size = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) return bytes.subarray(0, size);

            const nextSize = size + value.byteLength;
            if (nextSize > MAX_IMAGE_BYTES) return null;
            if (nextSize > bytes.byteLength) {
                const expanded = new Uint8Array(Math.min(MAX_IMAGE_BYTES, Math.max(nextSize, bytes.byteLength * 2)));
                expanded.set(bytes);
                bytes = expanded;
            }
            bytes.set(value, size);
            size = nextSize;
        }
    } finally {
        reader.releaseLock();
    }
}

export const GET: RequestHandler = async ({ url }) => {
    const imageUrl = url.searchParams.get('url');
    if (!imageUrl) return new Response('Missing url parameter', { status: 400 });

    const initialTarget = parseArtworkUrl(imageUrl);
    if (!initialTarget) return new Response('Unsupported image URL', { status: 400 });

    let target = initialTarget;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        for (let redirects = 0; ; redirects++) {
            const response = await fetch(target, { redirect: 'manual', signal: controller.signal });
            if (REDIRECT_STATUSES.has(response.status)) {
                const location = response.headers.get('location');
                const next = location && parseArtworkUrl(location, target);
                if (!next || redirects >= MAX_REDIRECTS) {
                    return new Response('Unsupported image redirect', { status: 502 });
                }
                await response.body?.cancel();
                target = next;
                continue;
            }

            if (response.status !== 200 || !response.body) {
                return new Response('Failed to fetch image', { status: 502 });
            }

            const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
            const matchesImage = IMAGE_TYPES.get(contentType);
            if (!matchesImage) return new Response('Unsupported image type', { status: 415 });

            if (Number(response.headers.get('content-length')) > MAX_IMAGE_BYTES) {
                return new Response('Image is too large', { status: 413 });
            }
            const bytes = await readImage(response.body);
            if (!bytes) return new Response('Image is too large', { status: 413 });
            if (!matchesImage(bytes)) return new Response('Invalid image data', { status: 415 });

            return new Response(bytes, {
                headers: {
                    'Content-Type': contentType,
                    'Cache-Control': 'public, max-age=3600',
                    'Access-Control-Allow-Origin': '*',
                    'X-Content-Type-Options': 'nosniff'
                }
            });
        }
    } catch {
        return controller.signal.aborted
            ? new Response('Image fetch timed out', { status: 504 })
            : new Response('Failed to fetch image', { status: 502 });
    } finally {
        clearTimeout(timeout);
        controller.abort();
    }
};
