import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TikTokOauthService, TIKTOK_BASIC_SCOPES } from './tiktok-oauth.service';

describe('TikTokOauthService', () => {
  let service: TikTokOauthService;
  const mockEnv = {
    TIKTOK_CLIENT_KEY: 'test_client_key',
    TIKTOK_CLIENT_SECRET: 'test_client_secret',
    TIKTOK_REDIRECT_URI: 'https://app.example.com/oauth/tiktok/callback',
  };

  beforeEach(() => {
    service = new TikTokOauthService({ env: mockEnv });
  });

  describe('createAuthorizationRedirect', () => {
    it('should generate valid authorization URL', async () => {
      const session: any = {};
      const url = await service.createAuthorizationRedirect(session);

      expect(url).toContain('https://www.tiktok.com/v2/auth/authorize/');
      expect(url).toContain('client_key=test_client_key');
      expect(url).toContain('response_type=code');
      expect(url).toContain('redirect_uri=');
      expect(url).toContain('scope=');
      expect(url).toContain('state=');
      expect(url).toContain('code_challenge=');
      expect(url).toContain('code_challenge_method=S256');
      expect(url).toContain('disable_auto_auth=1');
    });

    it('should store state nonce in session', async () => {
      const session: any = {};
      await service.createAuthorizationRedirect(session);

      expect(session.oauthStateNonce).toBeTruthy();
      expect(typeof session.oauthStateNonce).toBe('string');
    });

    it('should store PKCE code verifier in session', async () => {
      const session: any = {};
      await service.createAuthorizationRedirect(session);

      expect(session.tiktokCodeVerifier).toBeTruthy();
      expect(typeof session.tiktokCodeVerifier).toBe('string');
      expect(session.tiktokCodeVerifier.length).toBeGreaterThan(100);
    });

    it('should use sandbox scopes when TIKTOK_SANDBOX=true', async () => {
      const sandboxService = new TikTokOauthService({
        env: { ...mockEnv, TIKTOK_SANDBOX: 'true' },
      });

      const url = await sandboxService.createAuthorizationRedirect({});

      expect(url).toContain('scope=user.info.basic');
      expect(url).not.toContain('video.publish');
    });

    it('should use full scopes when TIKTOK_SANDBOX is not set', async () => {
      const url = await service.createAuthorizationRedirect({});

      expect(url).toContain('video.upload');
      expect(url).toContain('video.publish');
      expect(url).toContain('user.info.basic');
    });

    it('should throw error when CLIENT_KEY is missing', async () => {
      const badService = new TikTokOauthService({
        env: { TIKTOK_CLIENT_SECRET: 'secret', TIKTOK_REDIRECT_URI: 'uri' },
      });

      await expect(badService.createAuthorizationRedirect()).rejects.toThrow(
        'TikTok OAuth env is incomplete',
      );
    });
  });

  describe('validateCallbackState', () => {
    it('should validate matching state tokens', async () => {
      const session: any = {};
      await service.createAuthorizationRedirect(session);
      const state = session.oauthStateNonce;

      const isValid = service.validateCallbackState(session, state);

      expect(isValid).toBe(true);
    });

    it('should reject mismatched state tokens', () => {
      const session: any = { oauthStateNonce: 'state-1' };

      const isValid = service.validateCallbackState(session, 'state-2');

      expect(isValid).toBe(false);
    });

    it('should reject when session state is missing', () => {
      const session: any = {};

      const isValid = service.validateCallbackState(session, 'state-123');

      expect(isValid).toBe(false);
    });

    it('should reject when callback state is missing', () => {
      const session: any = { oauthStateNonce: 'state-123' };

      const isValid = service.validateCallbackState(session, '');

      expect(isValid).toBe(false);
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('should exchange valid authorization code for tokens', async () => {
      const mockFetch = vi.fn(async () => ({
        ok: true,
        json: async () => ({
          access_token: 'access_token_123',
          refresh_token: 'refresh_token_456',
          expires_in: 7200,
          open_id: 'open_id_789',
          scope: 'video.upload,video.publish,user.info.basic',
        }),
      }));

      const userMockFetch = vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: {
            user: {
              open_id: 'open_id_789',
              display_name: 'test_user',
              avatar_url: 'https://example.com/avatar.jpg',
            },
          },
        }),
      }));

      let callCount = 0;
      const combinedFetch = vi.fn(async (url: string, ...args) => {
        callCount++;
        if (callCount === 1) return mockFetch(url, ...args);
        return userMockFetch(url, ...args);
      });

      const serviceWithMock = new TikTokOauthService({
        env: mockEnv,
        fetchImpl: combinedFetch,
      });

      const result = await serviceWithMock.exchangeCodeForTokens('auth_code_123', 'code_verifier_123');

      expect(result.accessToken).toBe('access_token_123');
      expect(result.refreshToken).toBe('refresh_token_456');
      expect(result.profile.providerSubject).toBe('open_id_789');
      expect(result.profile.displayName).toBe('test_user');
      expect(result.scopes).toContain('video.upload');
      expect(result.tokenExpiresAt).toBeTruthy();
    });

    it('should throw error when access token is missing', async () => {
      const mockFetch = vi.fn(async () => ({
        ok: true,
        json: async () => ({ error: 'invalid_code' }),
      }));

      const service = new TikTokOauthService({
        env: mockEnv,
        fetchImpl: mockFetch,
      });

      await expect(service.exchangeCodeForTokens('invalid_code')).rejects.toThrow(
        'TikTok OAuth callback did not return an access token',
      );
    });

    it('should throw error on API error response', async () => {
      const mockFetch = vi.fn(async () => ({
        ok: false,
        status: 400,
        json: async () => ({
          error: { code: 'invalid_code', message: 'Authorization code is invalid' },
        }),
      }));

      const service = new TikTokOauthService({
        env: mockEnv,
        fetchImpl: mockFetch,
      });

      await expect(service.exchangeCodeForTokens('invalid_code')).rejects.toThrow(
        'Authorization code is invalid',
      );
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh access token using refresh token', async () => {
      const mockFetch = vi.fn(async () => ({
        ok: true,
        json: async () => ({
          access_token: 'new_access_token',
          refresh_token: 'new_refresh_token',
          expires_in: 7200,
          open_id: 'open_id_789',
          scope: 'video.upload,video.publish',
        }),
      }));

      const service = new TikTokOauthService({
        env: mockEnv,
        fetchImpl: mockFetch,
      });

      const result = await service.refreshAccessToken('old_refresh_token');

      expect(result.accessToken).toBe('new_access_token');
      expect(result.refreshToken).toBe('new_refresh_token');
      expect(result.tokenExpiresAt).toBeTruthy();
    });

    it('should handle revoked token error', async () => {
      const mockFetch = vi.fn(async () => ({
        ok: false,
        status: 401,
        json: async () => ({
          error: { code: 'invalid_grant', message: 'Refresh token has been revoked' },
        }),
      }));

      const service = new TikTokOauthService({
        env: mockEnv,
        fetchImpl: mockFetch,
      });

      await expect(service.refreshAccessToken('revoked_token')).rejects.toThrow(
        'Refresh token has been revoked',
      );
    });

    it('should maintain refresh token if new one not provided', async () => {
      const mockFetch = vi.fn(async () => ({
        ok: true,
        json: async () => ({
          access_token: 'new_access_token',
          // No refresh_token in response
          expires_in: 7200,
        }),
      }));

      const service = new TikTokOauthService({
        env: mockEnv,
        fetchImpl: mockFetch,
      });

      const result = await service.refreshAccessToken('old_refresh_token');

      expect(result.refreshToken).toBe('old_refresh_token');
    });

    it('should throw error when env is incomplete', async () => {
      const incompleteService = new TikTokOauthService({
        env: { TIKTOK_CLIENT_KEY: 'key' },
      });

      await expect(incompleteService.refreshAccessToken('token')).rejects.toThrow(
        'TikTok OAuth env is incomplete',
      );
    });
  });

  describe('PKCE challenge generation', () => {
    it('should generate different challenges for each authorization', async () => {
      const session1: any = {};
      const session2: any = {};

      await service.createAuthorizationRedirect(session1);
      await service.createAuthorizationRedirect(session2);

      expect(session1.tiktokCodeVerifier).not.toBe(session2.tiktokCodeVerifier);
      expect(session1.oauthStateNonce).not.toBe(session2.oauthStateNonce);
    });

    it('should have PKCE verifier of expected length', async () => {
      const session: any = {};
      await service.createAuthorizationRedirect(session);

      // Base64url encoding of 48 bytes = 64 characters (48 * 4/3)
      expect(session.tiktokCodeVerifier.length).toBeGreaterThanOrEqual(60);
    });
  });
});
