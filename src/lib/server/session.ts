import type { RequestEvent } from '@sveltejs/kit';

export function getDid(event: RequestEvent): string | null {
  return event.cookies.get('did') ?? null;
}

export function setDidCookie(event: RequestEvent, did: string): void {
  event.cookies.set('did', did, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export function clearDidCookie(event: RequestEvent): void {
  event.cookies.delete('did', { path: '/' });
}
