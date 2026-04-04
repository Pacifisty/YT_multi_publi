export const SESSION_COOKIE_NAME = 'gsd_admin_session';
export const SESSION_MAX_AGE_MS = 43_200_000;

export interface SessionCookieOptions {
  name: string;
  httpOnly: true;
  sameSite: 'lax';
  secure: boolean;
  maxAge: number;
  path: '/';
}

export function createSessionCookieOptions(env: Record<string, string | undefined> = process.env): SessionCookieOptions {
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE_MS,
    path: '/',
  };
}
