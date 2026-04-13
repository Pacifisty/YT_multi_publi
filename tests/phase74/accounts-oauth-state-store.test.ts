import { describe, expect, test, vi } from 'vitest';
import { AccountsService } from '../../apps/api/src/accounts/accounts.service';
import { TokenCryptoService } from '../../apps/api/src/common/crypto/token-crypto.service';
import type { GoogleOauthService } from '../../apps/api/src/integrations/google/google-oauth.service';

const TEST_KEY = '12345678901234567890123456789012';

function createServiceWithStateStore(authUrlWithState: string) {
  const exchangeCodeForTokens = vi.fn(async () => ({
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    scopes: ['https://www.googleapis.com/auth/youtube.readonly'],
    tokenExpiresAt: new Date(Date.now() + 3600_000).toISOString(),
    profile: {
      googleSubject: 'google-subject',
      email: 'owner@example.com',
      displayName: 'Owner',
    },
  }));
  const validateCallbackState = vi.fn(() => false);

  const googleOauthService = {
    validateCallbackState,
    exchangeCodeForTokens,
  } as unknown as GoogleOauthService;

  const service = new AccountsService({
    tokenCryptoService: new TokenCryptoService({ OAUTH_TOKEN_KEY: TEST_KEY }),
    createAuthorizationRedirect: async () => authUrlWithState,
    googleOauthService,
  });

  return {
    service,
    exchangeCodeForTokens,
    validateCallbackState,
    googleOauthService,
  };
}

describe('AccountsService OAuth state fallback', () => {
  test('accepts callback with stored state when session nonce is unavailable', async () => {
    const { service, exchangeCodeForTokens, validateCallbackState } = createServiceWithStateStore(
      'https://accounts.google.com/o/oauth2/v2/auth?state=state-abc',
    );

    await service.createAuthorizationRedirect({
      adminUser: {
        email: 'admin@example.com',
      },
    } as any);

    const result = await service.handleOauthCallback({
      code: 'oauth-code',
      state: 'state-abc',
      session: {
        adminUser: {
          email: 'admin@example.com',
        },
      } as any,
    });

    expect(validateCallbackState).toHaveBeenCalled();
    expect(exchangeCodeForTokens).toHaveBeenCalledWith('oauth-code');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.account.email).toBe('owner@example.com');
      expect(result.account.status).toBe('connected');
      await expect(service.listAccounts()).resolves.toEqual([result.account]);
      await expect(service.getAccount(result.account.id)).resolves.toEqual(result.account);
    }
  });

  test('persists oauth callback through createConnectedAccount override when provided', async () => {
    const { googleOauthService } = createServiceWithStateStore(
      'https://accounts.google.com/o/oauth2/v2/auth?state=state-db',
    );
    const createConnectedAccount = vi.fn(async (record) => ({
      ...record,
      id: 'persisted-account-id',
    }));
    const serviceWithPersistence = new AccountsService({
      tokenCryptoService: new TokenCryptoService({ OAUTH_TOKEN_KEY: TEST_KEY }),
      createAuthorizationRedirect: async () => 'https://accounts.google.com/o/oauth2/v2/auth?state=state-db',
      googleOauthService,
      createConnectedAccount,
    });

    await serviceWithPersistence.createAuthorizationRedirect({
      adminUser: {
        email: 'admin@example.com',
      },
    } as any);

    const result = await serviceWithPersistence.handleOauthCallback({
      code: 'oauth-code',
      state: 'state-db',
      session: {
        adminUser: {
          email: 'admin@example.com',
        },
      } as any,
    });

    expect(result.ok).toBe(true);
    expect(createConnectedAccount).toHaveBeenCalledTimes(1);
    if (result.ok) {
      expect(result.account.id).toBe('persisted-account-id');
    }
  });

  test('rejects reused OAuth state after first successful callback', async () => {
    const { service, exchangeCodeForTokens } = createServiceWithStateStore(
      'https://accounts.google.com/o/oauth2/v2/auth?state=state-once',
    );

    await service.createAuthorizationRedirect({
      adminUser: {
        email: 'admin@example.com',
      },
    } as any);

    const first = await service.handleOauthCallback({
      code: 'oauth-code',
      state: 'state-once',
      session: {
        adminUser: {
          email: 'admin@example.com',
        },
      } as any,
    });
    expect(first.ok).toBe(true);

    const second = await service.handleOauthCallback({
      code: 'oauth-code',
      state: 'state-once',
      session: {
        adminUser: {
          email: 'admin@example.com',
        },
      } as any,
    });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.reason).toBe('INVALID_STATE');
    }
    expect(exchangeCodeForTokens).toHaveBeenCalledTimes(1);
  });

  test('rejects callback when state was issued for another admin user', async () => {
    const { service, exchangeCodeForTokens } = createServiceWithStateStore(
      'https://accounts.google.com/o/oauth2/v2/auth?state=state-owner',
    );

    await service.createAuthorizationRedirect({
      adminUser: {
        email: 'owner@example.com',
      },
    } as any);

    const result = await service.handleOauthCallback({
      code: 'oauth-code',
      state: 'state-owner',
      session: {
        adminUser: {
          email: 'another-admin@example.com',
        },
      } as any,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('INVALID_STATE');
    }
    expect(exchangeCodeForTokens).not.toHaveBeenCalled();
  });
});
