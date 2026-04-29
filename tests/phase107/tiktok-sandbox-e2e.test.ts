import { describe, expect, test } from 'vitest';

import { TikTokOauthService, type TikTokTokenResult } from '../../apps/api/src/integrations/tiktok/tiktok-oauth.service';
import {
  tiktokDirectPostFromUrl,
  tiktokFetchPublishStatus,
  tiktokQueryCreatorInfo,
} from '../../apps/api/src/campaigns/tiktok-upload.worker';

const sandboxEnv = {
  TIKTOK_CLIENT_KEY: process.env.TIKTOK_SANDBOX_CLIENT_KEY,
  TIKTOK_CLIENT_SECRET: process.env.TIKTOK_SANDBOX_CLIENT_SECRET,
  TIKTOK_REDIRECT_URI: process.env.TIKTOK_SANDBOX_REDIRECT_URI,
  TIKTOK_SANDBOX: 'true',
};

const shouldRunSandboxE2E = process.env.RUN_TIKTOK_SANDBOX_E2E === 'true';
const hasSandboxOauthConfig = Boolean(
  sandboxEnv.TIKTOK_CLIENT_KEY &&
    sandboxEnv.TIKTOK_CLIENT_SECRET &&
    sandboxEnv.TIKTOK_REDIRECT_URI,
);
const hasSandboxOauthExchange = Boolean(hasSandboxOauthConfig && process.env.TIKTOK_SANDBOX_AUTH_CODE);
const hasSandboxPublishConfig = Boolean(
  hasSandboxOauthConfig &&
    process.env.TIKTOK_SANDBOX_PUBLIC_VIDEO_URL &&
    (process.env.TIKTOK_SANDBOX_AUTH_CODE || process.env.TIKTOK_SANDBOX_ACCESS_TOKEN),
);

function createSandboxOauthService(): TikTokOauthService {
  return new TikTokOauthService({ env: sandboxEnv });
}

async function resolveSandboxToken(service: TikTokOauthService): Promise<TikTokTokenResult> {
  if (process.env.TIKTOK_SANDBOX_AUTH_CODE) {
    return service.exchangeCodeForTokens(
      process.env.TIKTOK_SANDBOX_AUTH_CODE,
      process.env.TIKTOK_SANDBOX_CODE_VERIFIER,
    );
  }

  return {
    accessToken: process.env.TIKTOK_SANDBOX_ACCESS_TOKEN!,
    refreshToken: process.env.TIKTOK_SANDBOX_REFRESH_TOKEN,
    scopes: ['user.info.basic', 'video.publish', 'video.upload'],
    tokenExpiresAt: null,
    profile: {
      providerSubject: process.env.TIKTOK_SANDBOX_TEST_USER_ID,
    },
  };
}

describe('TikTok sandbox E2E harness', () => {
  test('builds a sandbox OAuth authorization URL and validates callback state locally', async () => {
    const session: { oauthStateNonce?: string; tiktokCodeVerifier?: string } = {};
    const service = new TikTokOauthService({
      env: {
        TIKTOK_CLIENT_KEY: 'sandbox-client-key',
        TIKTOK_REDIRECT_URI: 'https://app.example.com/workspace/accounts/callback?provider=tiktok',
        TIKTOK_SANDBOX: 'true',
      },
    });

    const redirectUrl = await service.createAuthorizationRedirect(session);
    const url = new URL(redirectUrl);

    expect(url.origin).toBe('https://www.tiktok.com');
    expect(url.searchParams.get('client_key')).toBe('sandbox-client-key');
    expect(url.searchParams.get('scope')).toBe('user.info.basic');
    expect(session.oauthStateNonce).toBeTruthy();
    expect(session.tiktokCodeVerifier).toBeTruthy();
    expect(service.validateCallbackState(session, session.oauthStateNonce!)).toBe(true);
    expect(service.validateCallbackState(session, 'wrong-state')).toBe(false);
  });

  test.skipIf(!shouldRunSandboxE2E || !hasSandboxOauthExchange)(
    '@Integration @Slow exchanges a TikTok sandbox OAuth code and refreshes the token',
    async () => {
      const service = createSandboxOauthService();

      const tokenResult = await service.exchangeCodeForTokens(
        process.env.TIKTOK_SANDBOX_AUTH_CODE!,
        process.env.TIKTOK_SANDBOX_CODE_VERIFIER,
      );

      expect(tokenResult.accessToken).toBeTruthy();
      expect(tokenResult.profile.providerSubject).toBeTruthy();

      if (process.env.TIKTOK_SANDBOX_REFRESH_TOKEN || tokenResult.refreshToken) {
        const refreshed = await service.refreshAccessToken(
          process.env.TIKTOK_SANDBOX_REFRESH_TOKEN ?? tokenResult.refreshToken!,
        );

        expect(refreshed.accessToken).toBeTruthy();
        expect(refreshed.refreshToken).toBeTruthy();
      }
    },
    130_000,
  );

  test.skipIf(!shouldRunSandboxE2E || !hasSandboxPublishConfig)(
    '@Integration @Slow publishes a sandbox TikTok draft via PULL_FROM_URL and polls status',
    async () => {
      const service = createSandboxOauthService();
      const tokenResult = await resolveSandboxToken(service);
      const creatorInfo = await tiktokQueryCreatorInfo(tokenResult.accessToken);

      expect(creatorInfo.privacyLevelOptions).toContain('SELF_ONLY');

      const init = await tiktokDirectPostFromUrl({
        accessToken: tokenResult.accessToken,
        videoUrl: process.env.TIKTOK_SANDBOX_PUBLIC_VIDEO_URL!,
        title: 'TikTok sandbox E2E verification',
        privacy: 'SELF_ONLY',
        disableComment: false,
        disableDuet: false,
        disableStitch: false,
      });

      expect(init.publishId).toBeTruthy();

      let finalStatus: Awaited<ReturnType<typeof tiktokFetchPublishStatus>> | null = null;
      for (let attempt = 0; attempt < 24; attempt += 1) {
        finalStatus = await tiktokFetchPublishStatus(tokenResult.accessToken, init.publishId);
        if (finalStatus.status === 'PUBLISH_COMPLETE' || finalStatus.status === 'FAILED') {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 5_000));
      }

      expect(finalStatus?.status).toBe('PUBLISH_COMPLETE');
      expect(finalStatus?.publiclyAvailablePostId).toBeTruthy();
    },
    130_000,
  );
});
