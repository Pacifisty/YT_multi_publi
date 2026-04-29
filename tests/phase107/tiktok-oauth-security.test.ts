import { describe, expect, test, vi } from 'vitest';

import { AccountsService, type ConnectedAccountRecord } from '../../apps/api/src/accounts/accounts.service';
import { TokenCryptoService } from '../../apps/api/src/common/crypto/token-crypto.service';
import type { TikTokOauthService } from '../../apps/api/src/integrations/tiktok/tiktok-oauth.service';

function createMockTikTokOauthService() {
  return {
    createAuthorizationRedirect: vi.fn(async (session?: { oauthStateNonce?: string; tiktokCodeVerifier?: string }) => {
      if (session) {
        session.oauthStateNonce = 'state-secure';
        session.tiktokCodeVerifier = 'verifier-secure';
      }

      return 'https://www.tiktok.com/v2/auth/authorize/?client_key=test&state=state-secure';
    }),
    validateCallbackState: vi.fn((session: { oauthStateNonce?: string } | null | undefined, state: string) => (
      session?.oauthStateNonce === state
    )),
    exchangeCodeForTokens: vi.fn(async () => ({
      accessToken: 'access-token-tiktok',
      refreshToken: 'refresh-token-tiktok',
      scopes: ['user.info.basic', 'video.publish', 'video.upload'],
      tokenExpiresAt: '2026-04-28T12:00:00.000Z',
      profile: {
        providerSubject: 'tiktok-user-123',
        displayName: 'creator_123',
      },
    })),
    refreshAccessToken: vi.fn(async () => ({
      accessToken: 'rotated-access-token',
      refreshToken: 'rotated-refresh-token',
      scopes: ['user.info.basic', 'video.publish', 'video.upload'],
      tokenExpiresAt: '2026-04-28T13:00:00.000Z',
      profile: {
        providerSubject: 'tiktok-user-123',
      },
    })),
  } as unknown as TikTokOauthService & {
    createAuthorizationRedirect: ReturnType<typeof vi.fn>;
    validateCallbackState: ReturnType<typeof vi.fn>;
    exchangeCodeForTokens: ReturnType<typeof vi.fn>;
    refreshAccessToken: ReturnType<typeof vi.fn>;
  };
}

function createCrypto() {
  return new TokenCryptoService({
    OAUTH_TOKEN_KEY: '12345678901234567890123456789012',
  });
}

function createTikTokAccount(
  crypto: TokenCryptoService,
  tokenExpiresAt: string,
): ConnectedAccountRecord {
  return {
    id: 'account-tiktok-1',
    ownerEmail: 'creator@example.com',
    provider: 'tiktok',
    providerSubject: 'tiktok-user-123',
    email: undefined,
    displayName: 'creator_123',
    accessTokenEnc: crypto.encrypt('stored-access-token'),
    refreshTokenEnc: crypto.encrypt('stored-refresh-token'),
    scopes: ['user.info.basic', 'video.publish'],
    tokenExpiresAt,
    status: 'connected',
    connectedAt: '2026-04-28T10:00:00.000Z',
    updatedAt: '2026-04-28T10:00:00.000Z',
  };
}

describe('TikTok OAuth security', () => {
  test('rejects invalid callback state and creates no account', async () => {
    const oauth = createMockTikTokOauthService();
    const service = new AccountsService({
      tokenCryptoService: createCrypto(),
      tikTokOauthService: oauth,
    });
    const session: { oauthStateNonce?: string; tiktokCodeVerifier?: string } = {};

    await service.createAuthorizationRedirectForProvider('tiktok', session);
    const result = await service.handleOauthCallbackForProvider('tiktok', {
      code: 'oauth-code',
      state: 'wrong-state',
      session,
    });

    expect(result).toEqual({ ok: false, reason: 'INVALID_STATE' });
    await expect(service.listAccounts()).resolves.toEqual([]);
    expect(oauth.exchangeCodeForTokens).not.toHaveBeenCalled();
  });

  test('consumes TikTok OAuth state after a successful callback', async () => {
    const oauth = createMockTikTokOauthService();
    const service = new AccountsService({
      tokenCryptoService: createCrypto(),
      tikTokOauthService: oauth,
    });
    const session: { oauthStateNonce?: string; tiktokCodeVerifier?: string } = {};

    await service.createAuthorizationRedirectForProvider('tiktok', session);
    const first = await service.handleOauthCallbackForProvider('tiktok', {
      code: 'oauth-code',
      state: 'state-secure',
      session,
    });
    const replay = await service.handleOauthCallbackForProvider('tiktok', {
      code: 'oauth-code',
      state: 'state-secure',
      session,
    });

    expect(first.ok).toBe(true);
    expect(replay).toEqual({ ok: false, reason: 'INVALID_STATE' });
    expect(session.oauthStateNonce).toBeUndefined();
    expect(session.tiktokCodeVerifier).toBeUndefined();
    expect(oauth.exchangeCodeForTokens).toHaveBeenCalledTimes(1);
  });

  test('stores TikTok access and refresh tokens encrypted at rest', async () => {
    const crypto = createCrypto();
    const oauth = createMockTikTokOauthService();
    const service = new AccountsService({
      tokenCryptoService: crypto,
      tikTokOauthService: oauth,
    });
    const session: { oauthStateNonce?: string; tiktokCodeVerifier?: string } = {};

    await service.createAuthorizationRedirectForProvider('tiktok', session);
    const result = await service.handleOauthCallbackForProvider('tiktok', {
      code: 'oauth-code',
      state: 'state-secure',
      session,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.account.accessTokenEnc).not.toBe('access-token-tiktok');
    expect(result.account.refreshTokenEnc).not.toBe('refresh-token-tiktok');
    expect(result.account.accessTokenEnc).not.toContain('access-token-tiktok');
    expect(result.account.refreshTokenEnc).not.toContain('refresh-token-tiktok');
    expect(service.readPersistedTokens(result.account)).toEqual({
      accessToken: 'access-token-tiktok',
      refreshToken: 'refresh-token-tiktok',
    });
  });

  test('marks TikTok account as reauth_required when refresh token is revoked', async () => {
    const crypto = createCrypto();
    const oauth = createMockTikTokOauthService();
    oauth.refreshAccessToken.mockRejectedValueOnce(new Error('invalid_grant: token has been revoked'));
    const service = new AccountsService({
      tokenCryptoService: crypto,
      tikTokOauthService: oauth,
      now: () => new Date('2026-04-28T10:00:00.000Z'),
    });
    const account = createTikTokAccount(crypto, '2026-04-28T10:01:00.000Z');

    const result = await service.refreshAccessTokenIfNeeded(account);

    expect(result).toMatchObject({
      refreshed: false,
      error: 'REAUTH_REQUIRED',
      account: {
        status: 'reauth_required',
      },
    });
  });

  test('refreshes TikTok token only inside the expiry safety window', async () => {
    let nowMs = Date.parse('2026-04-28T10:00:00.000Z');
    const crypto = createCrypto();
    const oauth = createMockTikTokOauthService();
    const service = new AccountsService({
      tokenCryptoService: crypto,
      tikTokOauthService: oauth,
      now: () => new Date(nowMs),
    });
    const account = createTikTokAccount(crypto, '2026-04-28T10:10:00.000Z');

    const first = await service.refreshAccessTokenIfNeeded(account);
    nowMs = Date.parse('2026-04-28T10:06:00.000Z');
    const second = await service.refreshAccessTokenIfNeeded(account);

    expect(first.refreshed).toBe(false);
    expect(second.refreshed).toBe(true);
    expect(oauth.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(crypto.decrypt(second.account.accessTokenEnc)).toBe('rotated-access-token');
    expect(crypto.decrypt(second.account.refreshTokenEnc!)).toBe('rotated-refresh-token');
  });
});
