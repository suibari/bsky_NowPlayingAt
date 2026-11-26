import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GET } from '../src/routes/api/proxy-image/+server.ts';

const mbid = '01234567-89ab-cdef-0123-456789abcdef';
const archiveFile = `mbid-${mbid}/mbid-${mbid}-123_thumb500.jpg`;
const coverArt = `https://coverartarchive.org/release/${mbid}/front-500`;
const archiveDownload = `https://archive.org/download/${archiveFile}`;
const archiveStorage = `https://ia600001.us.archive.org/1/items/${archiveFile}`;
const appleArtwork = 'https://is1-ssl.mzstatic.com/image/thumb/Music123/test.jpg/600x600bb.jpg';
const unrelatedUrl = 'https://example.invalid/image.jpg';
const maxImageBytes = 5 * 1024 * 1024;
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jEL8AAAAASUVORK5CYII=', 'base64');

function requestImage(target) {
    const url = new URL('https://nowplaying.example.invalid/api/proxy-image');
    if (target !== undefined) url.searchParams.set('url', target);
    return GET({ url });
}

function imageResponse(body = png, headers = { 'Content-Type': 'image/png' }) {
    return new Response(body, { headers });
}

test('serves supported artwork with the existing cache and CORS headers', async (t) => {
    const fetch = t.mock.method(globalThis, 'fetch', () => imageResponse(png, {
        'Content-Type': 'Image/PNG; charset=binary'
    }));
    const supportedArtwork = [
        appleArtwork,
        'https://i.discogs.com/test/image.jpg',
        'https://lastfm.freetls.fastly.net/i/u/300x300/test.png',
        'https://lastfm-img.freetls.fastly.net/i/u/300x300/test.png',
        'https://cdn-images.dzcdn.net/images/cover/test/500x500.jpg',
        'https://e-cdns-images.dzcdn.net/images/cover/test/500x500.jpg',
        'https://i.ytimg.com/vi/test/hqdefault.jpg',
        'https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:test/bafytest@jpeg',
        archiveStorage
    ];

    for (const [index, artwork] of supportedArtwork.entries()) {
        const response = await requestImage(artwork);
        assert.equal(response.status, 200, artwork);
        assert.equal(response.headers.get('content-type'), 'image/png');
        assert.equal(response.headers.get('cache-control'), 'public, max-age=3600');
        assert.equal(response.headers.get('access-control-allow-origin'), '*');
        assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
        assert.deepEqual(Buffer.from(await response.arrayBuffer()), png);
        assert.equal(fetch.mock.calls[index].arguments[0].href, artwork);
        assert.equal(fetch.mock.calls[index].arguments[1].redirect, 'manual');
    }
    assert.equal(fetch.mock.callCount(), supportedArtwork.length);
});

test('stops before fetching missing URLs and unlisted artwork providers', async (t) => {
    const fetch = t.mock.method(globalThis, 'fetch', () => imageResponse());
    assert.equal((await requestImage()).status, 400);
    assert.equal((await requestImage(unrelatedUrl)).status, 400);
    assert.equal(fetch.mock.callCount(), 0);
});

test('follows Cover Art Archive artwork through its download and storage hosts', async (t) => {
    const redirect = [Response.redirect(archiveDownload, 307), Response.redirect(archiveStorage, 302)];
    const fetch = t.mock.method(globalThis, 'fetch', () => redirect.shift() ?? imageResponse());

    const response = await requestImage(coverArt);
    assert.equal(response.status, 200);
    assert.deepEqual(fetch.mock.calls.map(({ arguments: [url] }) => url.href), [
        coverArt, archiveDownload, archiveStorage
    ]);
    const requests = fetch.mock.calls.map(({ arguments: [, options] }) => options);
    assert.ok(requests.every(({ redirect, signal }) => redirect === 'manual' && signal === requests[0].signal));
});

test('checks a redirect destination before following it', async (t) => {
    const fetch = t.mock.method(globalThis, 'fetch', () => Response.redirect(unrelatedUrl));
    const response = await requestImage(appleArtwork);
    assert.equal(response.status, 502);
    assert.equal(response.headers.has('location'), false);
    assert.equal(fetch.mock.callCount(), 1);
});

test('resolves relative redirects and caps the number followed', async (t) => {
    const fetch = t.mock.method(globalThis, 'fetch', () => new Response(null, {
        status: 302,
        headers: { Location: '300x300bb.jpg' }
    }));
    assert.equal((await requestImage(appleArtwork)).status, 502);
    assert.equal(fetch.mock.callCount(), 4);
    assert.equal(fetch.mock.calls[1].arguments[0].href, appleArtwork.replace('600x600', '300x300'));
});

test('requires a supported raster type and a matching file signature', async (t) => {
    const responses = [
        imageResponse('Artwork metadata', { 'Content-Type': 'text/plain' }),
        imageResponse(png, { 'Content-Type': 'image/jpeg' })
    ];
    t.mock.method(globalThis, 'fetch', () => responses.shift());

    for (let count = 0; count < 2; count++) {
        const response = await requestImage(appleArtwork);
        assert.equal(response.status, 415);
        assert.equal(response.headers.has('cache-control'), false);
    }
});

test('enforces the byte limit with or without a declared length', async (t) => {
    const oversizedStream = new ReadableStream({
        start(controller) {
            controller.enqueue(new Uint8Array(maxImageBytes));
            controller.enqueue(new Uint8Array(1));
            controller.close();
        }
    });
    const responses = [
        imageResponse(png, { 'Content-Type': 'image/png', 'Content-Length': String(maxImageBytes + 1) }),
        imageResponse(oversizedStream)
    ];
    t.mock.method(globalThis, 'fetch', () => responses.shift());

    for (let count = 0; count < 2; count++) {
        const response = await requestImage(appleArtwork);
        assert.equal(response.status, 413);
        assert.equal(response.headers.has('cache-control'), false);
    }
});

test('uses the same deadline while waiting for headers and reading the body', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });

    t.mock.method(globalThis, 'fetch', (_url, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }));
    const pendingHeaders = requestImage(appleArtwork);
    t.mock.timers.tick(5_000);
    assert.equal((await pendingHeaders).status, 504);

    globalThis.fetch.mock.mockImplementation((_url, { signal }) => imageResponse(new ReadableStream({
        start(controller) {
            controller.enqueue(png);
            signal.addEventListener('abort', () => controller.error(signal.reason), { once: true });
        }
    })));
    const pendingBody = requestImage(appleArtwork);
    await Promise.resolve();
    t.mock.timers.tick(5_000);
    assert.equal((await pendingBody).status, 504);
});
