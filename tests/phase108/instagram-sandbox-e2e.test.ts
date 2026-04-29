import { describe, expect, test } from 'vitest';

import { InstagramApiClient } from '../../apps/api/src/integrations/instagram/instagram-api.client';
import {
  InstagramOauthService,
  type InstagramTokenResult,
} from '../../apps/api/src/integrations/instagram/instagram-oauth.service';

const sandboxEnv = {
  INSTAGRAM_CLIENT_ID: process.env.INSTAGRAM_SANDBOX_CLIENT_ID,
  INSTAGRAM_CLIENT_SECRET: process.env.INSTAGRAM_SANDBOX_CLIENT_SECRET,
  INSTAGRAM_REDIRECT_URI: process.env.INSTAGRAM_SANDBOX_REDIRECT_URI,
};

const shouldRunSandboxE2E = process.env.RUN_INSTAGRAM_SANDBOX_E2E === 'true';
const hasSandboxOauthConfig = Boolean(
  sandboxEnv.INSTAGRAM_CLIENT_ID &&
    sandboxEnv.INSTAGRAM_CLIENT_SECRET &&
    sandboxEnv.INSTAGRAM_REDIRECT_URI,
);
const hasSandboxOauthExchange = Boolean(hasSandboxOauthConfig && process.env.INSTAGRAM_SANDBOX_AUTH_CODE);
const hasSandboxPublishConfig = Boolean(
  hasSandboxOauthConfig &&
    process.env.INSTAGRAM_SANDBOX_BUSINESS_ACCOUNT_ID &&
    process.env.INSTAGRAM_SANDBOX_PUBLIC_VIDEO_URL &&
    (process.env.INSTAGRAM_SANDBOX_AUTH_CODE || process.env.INSTAGRAM_SANDBOX_ACCESS_TOKEN),
);

function createSandboxOauthService(): InstagramOauthService {
  return new InstagramOauthService({ env: sandboxEnv });
}

async function resolveSandboxToken(service: InstagramOauthService): Promise<InstagramTokenResult> {
  if (process.env.INSTAGRAM_SANDBOX_AUTH_CODE) {
    return service.exchangeCodeForTokens(
      process.env.INSTAGRAM_SANDBOX_AUTH_CODE,
      process.env.INSTAGRAM_SANDBOX_CODE_VERIFIER,
    );
  }

  return {
    accessToken: process.env.INSTAGRAM_SANDBOX_ACCESS_TOKEN!,
    refreshToken: process.env.INSTAGRAM_SANDBOX_REFRESH_TOKEN,
    scopes: ['instagram_business_basic', 'instagram_business_content_publish'],
    tokenExpiresAt: null,
    profile: {
      providerSubject: process.env.INSTAGRAM_SANDBOX_BUSINESS_ACCOUNT_ID,
    },
  };
}

describe('Instagram sandbox E2E harness', () => {
  test('builds a sandbox OAuth authorization URL and validates callback state locally', async () => {
    const session: { oauthStateNonce?: string; instagramCodeVerifier?: string } = {};
    const service = new InstagramOauthService({
      env: {
        INSTAGRAM_CLIENT_ID: 'instagram-client-id',
        INSTAGRAM_REDIRECT_URI: 'https://app.example.com/workspace/accounts/callback?provider=instagram',
      },
    });

    const redirectUrl = await service.createAuthorizationRedirect(session);
    const url = new URL(redirectUrl);

    expect(url.origin).toBe('https://www.facebook.com');
    expect(url.pathname).toContain('/dialog/oauth');
    expect(url.searchParams.get('client_id')).toBe('instagram-client-id');
    expect(url.searchParams.get('scope')).toContain('instagram_business_content_publish');
    expect(session.oauthStateNonce).toBeTruthy();
    expect(session.instagramCodeVerifier).toBeTruthy();
    expect(service.validateCallbackState(session, session.oauthStateNonce!)).toBe(true);
    expect(service.validateCallbackState(session, 'wrong-state')).toBe(false);
  });

  test.skipIf(!shouldRunSandboxE2E || !hasSandboxOauthExchange)(
    '@Integration @Slow exchanges an Instagram sandbox OAuth code and refreshes the token',
    async () => {
      const service = createSandboxOauthService();

      const tokenResult = await service.exchangeCodeForTokens(
        process.env.INSTAGRAM_SANDBOX_AUTH_CODE!,
        process.env.INSTAGRAM_SANDBOX_CODE_VERIFIER,
      );

      expect(tokenResult.accessToken).toBeTruthy();
      expect(tokenResult.profile.providerSubject).toBeTruthy();

      if (process.env.INSTAGRAM_SANDBOX_REFRESH_TOKEN || tokenResult.refreshToken) {
        const refreshed = await service.refreshAccessToken(
          process.env.INSTAGRAM_SANDBOX_REFRESH_TOKEN ?? tokenResult.refreshToken!,
        );

        expect(refreshed.accessToken).toBeTruthy();
      }
    },
    130_000,
  );

  test.skipIf(!shouldRunSandboxE2E || !hasSandboxPublishConfig)(
    '@Integration @Slow publishes an Instagram sandbox Reel and polls status',
    async () => {
      const service = createSandboxOauthService();
      const tokenResult = await resolveSandboxToken(service);
      const client = new InstagramApiClient(
        tokenResult.accessToken,
        process.env.INSTAGRAM_SANDBOX_BUSINESS_ACCOUNT_ID!,
      );

      const container = await client.createReelsContainer({
        videoUrl: process.env.INSTAGRAM_SANDBOX_PUBLIC_VIDEO_URL!,
        caption: 'Instagram sandbox E2E verification',
        shareToFeed: false,
      });

      expect(container.creation_id).toBeTruthy();

      let finalStatus: Awaited<ReturnType<InstagramApiClient['fetchContainerStatus']>> | null = null;
      for (let attempt = 0; attempt < 24; attempt += 1) {
        finalStatus = await client.fetchContainerStatus(container.creation_id);
        if (finalStatus.status_code === 'FINISHED' || finalStatus.status_code === 'ERROR') {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 5_000));
      }

      expect(finalStatus?.status_code).toBe('FINISHED');

      const publish = await client.publishReelsContainer(container.creation_id);
      expect(publish.id).toBeTruthy();
    },
    160_000,
  );
});
