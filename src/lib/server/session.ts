import type { RequestEvent } from '@sveltejs/kit';

export function getDid(event: RequestEvent): string | null {
  return event.cookies.get('did') ?? null;
}

export function setDidCookie(event: RequestEvent, did: string): void {
  event.cookies.set('did', did, {
    path: '/',
    httpOnly: true,
    // Local dev is served over http://127.0.0.1, where a Secure cookie is only
    // accepted by browsers that treat loopback as a trustworthy origin (Chrome,
    // Firefox — but not Safari). Drop the flag for http: so sign-in works in any
    // browser locally; every deployed origin is https: and keeps it.
    secure: event.url.protocol === 'https:',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export function clearDidCookie(event: RequestEvent): void {
  event.cookies.delete('did', { path: '/' });
}
