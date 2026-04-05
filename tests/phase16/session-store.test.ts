import { describe, expect, test } from 'vitest';

import {
  SessionStore,
  parseCookieHeader,
  type SessionStoreOptions,
} from '../../apps/api/src/auth/session-store';
import { SESSION_COOKIE_NAME } from '../../apps/api/src/main';

const SECRET = 'test-secret-key-for-hmac-signing!';

describe('SessionStore — token creation and verification', () => {
  test('creates a signed session token from user data', () => {
    const store = new SessionStore({ secret: SECRET });

    const token = store.createToken({ email: 'admin@test.com' });

    expect(token).toBeTypeOf('string');
    expect(token.length).toBeGreaterThan(0);
  });

  test('verifies a valid token and returns session', () => {
    const store = new SessionStore({ secret: SECRET });

    const token = store.createToken({ email: 'admin@test.com' });
    const session = store.verifyToken(token);

    expect(session).not.toBeNull();
    expect(session!.adminUser!.email).toBe('admin@test.com');
  });

  test('returns null for tampered token', () => {
    const store = new SessionStore({ secret: SECRET });

    const token = store.createToken({ email: 'admin@test.com' });
    const tampered = token.slice(0, -5) + 'XXXXX';
    const session = store.verifyToken(tampered);

    expect(session).toBeNull();
  });

  test('returns null for empty token', () => {
    const store = new SessionStore({ secret: SECRET });

    const session = store.verifyToken('');

    expect(session).toBeNull();
  });

  test('returns null for garbage token', () => {
    const store = new SessionStore({ secret: SECRET });

    const session = store.verifyToken('not-a-real-token');

    expect(session).toBeNull();
  });

  test('tokens from different secrets are not compatible', () => {
    const store1 = new SessionStore({ secret: 'secret-one-aaaaaaaaaaaaaaaa' });
    const store2 = new SessionStore({ secret: 'secret-two-bbbbbbbbbbbbbbbb' });

    const token = store1.createToken({ email: 'admin@test.com' });
    const session = store2.verifyToken(token);

    expect(session).toBeNull();
  });

  test('token contains authenticatedAt timestamp', () => {
    const store = new SessionStore({ secret: SECRET });

    const token = store.createToken({ email: 'admin@test.com' });
    const session = store.verifyToken(token);

    expect(session!.adminUser!.authenticatedAt).toBeDefined();
    expect(session!.adminUser!.authenticatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('SessionStore — createSessionResolver', () => {
  test('returns a function', () => {
    const store = new SessionStore({ secret: SECRET });

    const resolver = store.createSessionResolver();

    expect(resolver).toBeTypeOf('function');
  });

  test('resolves session from valid cookie header', () => {
    const store = new SessionStore({ secret: SECRET });
    const token = store.createToken({ email: 'admin@test.com' });
    const cookieHeader = `${SESSION_COOKIE_NAME}=${token}`;

    const resolver = store.createSessionResolver();
    const session = resolver(cookieHeader);

    expect(session).not.toBeNull();
    expect(session!.adminUser!.email).toBe('admin@test.com');
  });

  test('returns null when cookie header is undefined', () => {
    const store = new SessionStore({ secret: SECRET });

    const resolver = store.createSessionResolver();
    const session = resolver(undefined);

    expect(session).toBeNull();
  });

  test('returns null when session cookie is missing from header', () => {
    const store = new SessionStore({ secret: SECRET });

    const resolver = store.createSessionResolver();
    const session = resolver('other_cookie=abc; another=xyz');

    expect(session).toBeNull();
  });

  test('handles multiple cookies in header', () => {
    const store = new SessionStore({ secret: SECRET });
    const token = store.createToken({ email: 'admin@test.com' });
    const cookieHeader = `theme=dark; ${SESSION_COOKIE_NAME}=${token}; lang=en`;

    const resolver = store.createSessionResolver();
    const session = resolver(cookieHeader);

    expect(session).not.toBeNull();
    expect(session!.adminUser!.email).toBe('admin@test.com');
  });
});

describe('parseCookieHeader', () => {
  test('parses simple cookie header', () => {
    const cookies = parseCookieHeader('name=value');

    expect(cookies).toEqual({ name: 'value' });
  });

  test('parses multiple cookies', () => {
    const cookies = parseCookieHeader('a=1; b=2; c=3');

    expect(cookies).toEqual({ a: '1', b: '2', c: '3' });
  });

  test('returns empty object for undefined', () => {
    const cookies = parseCookieHeader(undefined);

    expect(cookies).toEqual({});
  });

  test('handles values with equals signs', () => {
    const cookies = parseCookieHeader('token=abc=def=ghi');

    expect(cookies).toEqual({ token: 'abc=def=ghi' });
  });

  test('trims whitespace around names and values', () => {
    const cookies = parseCookieHeader('  name  =  value  ;  other  =  val2  ');

    expect(cookies).toEqual({ name: 'value', other: 'val2' });
  });
});
