import { describe, expect, test, vi } from 'vitest';

import { AccountsService, type ConnectedAccountRecord } from '../../apps/api/src/accounts/accounts.service';
import { TokenCryptoService } from '../../apps/api/src/common/crypto/token-crypto.service';

const TEST_KEY = '12345678901234567890123456789012';

function createTokenCrypto(): TokenCryptoService {
  return new TokenCryptoService({ OAUTH_TOKEN_KEY: TEST_KEY });
}

function createConnectedAccount(
  crypto: TokenCryptoService,
  overrides: Partial<ConnectedAccountRecord> = {},
): ConnectedAccountRecord {
  return {
    id: 'acct-1',
    provider: 'google',
    googleSubject: 'google-sub-1',
    email: 'ops@example.com',
    displayName: 'Ops User',
    accessTokenEnc: crypto.encrypt('valid-access-token'),
    refreshTokenEnc: crypto.encrypt('valid-refresh-token'),
    scopes: ['https://www.googleapis.com/auth/youtube.readonly'],
    tokenExpiresAt: new Date(Date.now() - 60_000).toISOString(), // expired 1 min ago
    status: 'connected',
    connectedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('token refresh lifecycle', () => {
  test('triggers refresh when token_expires_at is in the past', async () => {
    const crypto = createTokenCrypto();
    const refreshedAccessToken = 'refreshed-access-token';
    const newExpiry = new Date(Date.now() + 3600_000).toISOString();

    let persistedRecord: ConnectedAccountRecord | null = null;

    const service = new AccountsService({
      tokenCryptoService: crypto,
      refreshGoogleAccessToken: async () => ({
        accessToken: refreshedAccessToken,
        expiresAt: newExpiry,
      }),
      updateConnectedAccount: async (id, updates) => {
        persistedRecord = {
          ...createConnectedAccount(crypto),
          ...updates,
          id,
        } as ConnectedAccountRecord;
        return persistedRecord;
      },
    });

    const account = createConnectedAccount(crypto);
    const result = await service.refreshAccessTokenIfNeeded(account);

    expect(result.refreshed).toBe(true);
    expect(result.account.tokenExpiresAt).toBe(newExpiry);
    // Verify the new access token is persisted encrypted
    const decrypted = crypto.decrypt(result.account.accessTokenEnc);
    expect(decrypted).toBe(refreshedAccessToken);
  });

  test('triggers refresh when token expires within 5-minute safety window', async () => {
    const crypto = createTokenCrypto();
    const refreshedAccessToken = 'refreshed-within-window';
    const newExpiry = new Date(Date.now() + 3600_000).toISOString();

    const service = new AccountsService({
      tokenCryptoService: crypto,
      refreshGoogleAccessToken: async () => ({
        accessToken: refreshedAccessToken,
        expiresAt: newExpiry,
      }),
      updateConnectedAccount: async (id, updates) =>
        ({
          ...createConnectedAccount(crypto),
          ...updates,
          id,
        }) as ConnectedAccountRecord,
    });

    // Token expires in 3 minutes (within 5-min safety window)
    const account = createConnectedAccount(crypto, {
      tokenExpiresAt: new Date(Date.now() + 3 * 60_000).toISOString(),
    });

    const result = await service.refreshAccessTokenIfNeeded(account);

    expect(result.refreshed).toBe(true);
    const decrypted = crypto.decrypt(result.account.accessTokenEnc);
    expect(decrypted).toBe(refreshedAccessToken);
  });

  test('skips refresh when token is still valid beyond safety window', async () => {
    const crypto = createTokenCrypto();
    const refreshSpy = vi.fn();

    const service = new AccountsService({
      tokenCryptoService: crypto,
      refreshGoogleAccessToken: refreshSpy,
    });

    // Token expires in 30 minutes — well beyond safety window
    const account = createConnectedAccount(crypto, {
      tokenExpiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    });

    const result = await service.refreshAccessTokenIfNeeded(account);

    expect(result.refreshed).toBe(false);
    expect(result.account).toBe(account);
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  test('persists encrypted access token and optional rotated refresh token on successful refresh', async () => {
    const crypto = createTokenCrypto();
    const newAccessToken = 'new-access';
    const rotatedRefreshToken = 'rotated-refresh';
    const newExpiry = new Date(Date.now() + 3600_000).toISOString();

    let savedUpdates: Record<string, unknown> = {};

    const service = new AccountsService({
      tokenCryptoService: crypto,
      refreshGoogleAccessToken: async () => ({
        accessToken: newAccessToken,
        refreshToken: rotatedRefreshToken,
        expiresAt: newExpiry,
      }),
      updateConnectedAccount: async (id, updates) => {
        savedUpdates = updates;
        return {
          ...createConnectedAccount(crypto),
          ...updates,
          id,
        } as ConnectedAccountRecord;
      },
    });

    const account = createConnectedAccount(crypto);
    await service.refreshAccessTokenIfNeeded(account);

    // The saved updates should have encrypted tokens
    expect(savedUpdates.accessTokenEnc).toBeDefined();
    expect(savedUpdates.tokenExpiresAt).toBe(newExpiry);
    expect(crypto.decrypt(savedUpdates.accessTokenEnc as string)).toBe(newAccessToken);
    expect(savedUpdates.refreshTokenEnc).toBeDefined();
    expect(crypto.decrypt(savedUpdates.refreshTokenEnc as string)).toBe(rotatedRefreshToken);
  });

  test('marks account reauth_required on invalid_grant refresh failure', async () => {
    const crypto = createTokenCrypto();

    let savedUpdates: Record<string, unknown> = {};

    const service = new AccountsService({
      tokenCryptoService: crypto,
      refreshGoogleAccessToken: async () => {
        const error = new Error('Token has been expired or revoked.');
        (error as any).code = 'invalid_grant';
        throw error;
      },
      updateConnectedAccount: async (id, updates) => {
        savedUpdates = updates;
        return {
          ...createConnectedAccount(crypto),
          ...updates,
          id,
        } as ConnectedAccountRecord;
      },
    });

    const account = createConnectedAccount(crypto);
    const result = await service.refreshAccessTokenIfNeeded(account);

    expect(result.refreshed).toBe(false);
    expect(result.error).toBe('REAUTH_REQUIRED');
    expect(result.account.status).toBe('reauth_required');
    // Access token should be cleared on reauth
    expect(savedUpdates.status).toBe('reauth_required');
  });

  test('marks account reauth_required on revoked token errors', async () => {
    const crypto = createTokenCrypto();

    const service = new AccountsService({
      tokenCryptoService: crypto,
      refreshGoogleAccessToken: async () => {
        const error = new Error('Token has been revoked');
        (error as any).response = { data: { error: 'invalid_grant' } };
        throw error;
      },
      updateConnectedAccount: async (id, updates) =>
        ({
          ...createConnectedAccount(crypto),
          ...updates,
          id,
        }) as ConnectedAccountRecord,
    });

    const account = createConnectedAccount(crypto);
    const result = await service.refreshAccessTokenIfNeeded(account);

    expect(result.refreshed).toBe(false);
    expect(result.error).toBe('REAUTH_REQUIRED');
    expect(result.account.status).toBe('reauth_required');
  });

  test('does not expose raw OAuth error details in REAUTH_REQUIRED result', async () => {
    const crypto = createTokenCrypto();

    const service = new AccountsService({
      tokenCryptoService: crypto,
      refreshGoogleAccessToken: async () => {
        const error = new Error('Sensitive internal OAuth error detail xyz123');
        (error as any).code = 'invalid_grant';
        throw error;
      },
      updateConnectedAccount: async (id, updates) =>
        ({
          ...createConnectedAccount(crypto),
          ...updates,
          id,
        }) as ConnectedAccountRecord,
    });

    const account = createConnectedAccount(crypto);
    const result = await service.refreshAccessTokenIfNeeded(account);

    expect(result.error).toBe('REAUTH_REQUIRED');
    // Must not leak raw error message to consumer
    expect(JSON.stringify(result)).not.toContain('Sensitive internal OAuth error detail');
  });

  test('uses TikTok token refresh for tiktok accounts', async () => {
    const crypto = createTokenCrypto();
    const refreshedAccessToken = 'tiktok-refreshed-access-token';
    const rotatedRefreshToken = 'tiktok-rotated-refresh-token';
    const newExpiry = new Date(Date.now() + 3600_000).toISOString();
    const refreshGoogleSpy = vi.fn();
    const refreshTikTokSpy = vi.fn(async () => ({
      accessToken: refreshedAccessToken,
      refreshToken: rotatedRefreshToken,
      expiresAt: newExpiry,
    }));

    const service = new AccountsService({
      tokenCryptoService: crypto,
      refreshGoogleAccessToken: refreshGoogleSpy,
      refreshTikTokAccessToken: refreshTikTokSpy,
      updateConnectedAccount: async (id, updates) =>
        ({
          ...createConnectedAccount(crypto, {
            provider: 'tiktok',
            googleSubject: 'tt-user-1',
            providerSubject: 'tt-user-1',
            email: undefined,
            displayName: 'TikTok User',
          }),
          ...updates,
          id,
        }) as ConnectedAccountRecord,
    });

    const account = createConnectedAccount(crypto, {
      provider: 'tiktok',
      googleSubject: 'tt-user-1',
      providerSubject: 'tt-user-1',
      email: undefined,
      displayName: 'TikTok User',
    });

    const result = await service.refreshAccessTokenIfNeeded(account);

    expect(result.refreshed).toBe(true);
    expect(refreshTikTokSpy).toHaveBeenCalledOnce();
    expect(refreshGoogleSpy).not.toHaveBeenCalled();
    expect(crypto.decrypt(result.account.accessTokenEnc)).toBe(refreshedAccessToken);
    expect(crypto.decrypt(result.account.refreshTokenEnc!)).toBe(rotatedRefreshToken);
    expect(result.account.tokenExpiresAt).toBe(newExpiry);
  });
});
