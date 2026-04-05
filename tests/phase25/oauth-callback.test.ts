import { describe, it, expect, vi } from 'vitest';
import {
  createOAuthCallbackHandler,
  type OAuthCallbackOptions,
  type OAuthCallbackResult,
  type TokenExchangeFn,
  type AccountStoreFn,
} from '../../apps/api/src/auth/oauth-callback';

function createOptions(overrides: Partial<OAuthCallbackOptions> = {}): OAuthCallbackOptions {
  return {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    redirectUri: 'http://localhost:3000/auth/callback',
    exchangeToken: overrides.exchangeToken ?? vi.fn().mockResolvedValue({
      access_token: 'access-123',
      refresh_token: 'refresh-456',
      expires_in: 3600,
      token_type: 'Bearer',
      scope: 'https://www.googleapis.com/auth/youtube.upload',
    }),
    storeAccount: overrides.storeAccount ?? vi.fn().mockResolvedValue(undefined),
    encryptToken: overrides.encryptToken ?? vi.fn().mockImplementation((t: string) => `enc:${t}`),
    ...overrides,
  };
}

describe('OAuth Callback Handler', () => {
  it('exchanges authorization code for tokens', async () => {
    const exchangeToken = vi.fn().mockResolvedValue({
      access_token: 'access-123',
      refresh_token: 'refresh-456',
      expires_in: 3600,
      token_type: 'Bearer',
    });
    const handler = createOAuthCallbackHandler(createOptions({ exchangeToken }));

    await handler.handle({ code: 'auth-code-abc' });

    expect(exchangeToken).toHaveBeenCalledWith({
      code: 'auth-code-abc',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost:3000/auth/callback',
    });
  });

  it('returns success with account info on valid exchange', async () => {
    const handler = createOAuthCallbackHandler(createOptions());

    const result = await handler.handle({ code: 'valid-code' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.accessToken).toBe('access-123');
      expect(result.expiresIn).toBe(3600);
    }
  });

  it('encrypts refresh token before storing', async () => {
    const encryptToken = vi.fn().mockReturnValue('encrypted-refresh');
    const storeAccount = vi.fn().mockResolvedValue(undefined);
    const handler = createOAuthCallbackHandler(createOptions({
      encryptToken,
      storeAccount,
    }));

    await handler.handle({ code: 'valid-code' });

    expect(encryptToken).toHaveBeenCalledWith('refresh-456');
    expect(storeAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        encryptedRefreshToken: 'encrypted-refresh',
      }),
    );
  });

  it('stores account with access token and expiry', async () => {
    const storeAccount = vi.fn().mockResolvedValue(undefined);
    const handler = createOAuthCallbackHandler(createOptions({ storeAccount }));

    await handler.handle({ code: 'valid-code' });

    expect(storeAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: 'access-123',
        expiresIn: 3600,
      }),
    );
  });

  it('returns error when code is missing', async () => {
    const handler = createOAuthCallbackHandler(createOptions());

    const result = await handler.handle({ code: '' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('code');
    }
  });

  it('returns error when token exchange fails', async () => {
    const exchangeToken = vi.fn().mockRejectedValue(new Error('exchange failed'));
    const handler = createOAuthCallbackHandler(createOptions({ exchangeToken }));

    const result = await handler.handle({ code: 'bad-code' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('exchange failed');
    }
  });

  it('returns error when store fails', async () => {
    const storeAccount = vi.fn().mockRejectedValue(new Error('db error'));
    const handler = createOAuthCallbackHandler(createOptions({ storeAccount }));

    const result = await handler.handle({ code: 'valid-code' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('db error');
    }
  });

  it('does not store account when no refresh token is returned', async () => {
    const exchangeToken = vi.fn().mockResolvedValue({
      access_token: 'access-only',
      expires_in: 3600,
      token_type: 'Bearer',
    });
    const storeAccount = vi.fn().mockResolvedValue(undefined);
    const handler = createOAuthCallbackHandler(createOptions({
      exchangeToken,
      storeAccount,
    }));

    const result = await handler.handle({ code: 'valid-code' });

    expect(result.ok).toBe(true);
    expect(storeAccount).not.toHaveBeenCalled();
  });

  it('passes scope from token response in result', async () => {
    const exchangeToken = vi.fn().mockResolvedValue({
      access_token: 'access-123',
      refresh_token: 'refresh-456',
      expires_in: 3600,
      token_type: 'Bearer',
      scope: 'youtube.upload youtube.readonly',
    });
    const handler = createOAuthCallbackHandler(createOptions({ exchangeToken }));

    const result = await handler.handle({ code: 'valid-code' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.scope).toBe('youtube.upload youtube.readonly');
    }
  });

  it('returns handleRequest with HTTP response shape', async () => {
    const handler = createOAuthCallbackHandler(createOptions());

    const response = await handler.handleRequest({ code: 'valid-code' });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
  });

  it('handleRequest returns 400 for missing code', async () => {
    const handler = createOAuthCallbackHandler(createOptions());

    const response = await handler.handleRequest({ code: '' });

    expect(response.status).toBe(400);
    expect(response.body.ok).toBe(false);
  });

  it('handleRequest returns 502 for exchange failure', async () => {
    const exchangeToken = vi.fn().mockRejectedValue(new Error('upstream down'));
    const handler = createOAuthCallbackHandler(createOptions({ exchangeToken }));

    const response = await handler.handleRequest({ code: 'valid' });

    expect(response.status).toBe(502);
  });
});
