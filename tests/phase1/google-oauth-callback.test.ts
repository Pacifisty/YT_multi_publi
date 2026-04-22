import { describe, expect, test } from 'vitest';

import { AccountsController } from '../../apps/api/src/accounts/accounts.controller';
import { AccountsService } from '../../apps/api/src/accounts/accounts.service';
import { SessionGuard } from '../../apps/api/src/auth/session.guard';

describe('google oauth callback endpoint', () => {
  test('returns 400 when callback state does not match expected state', async () => {
    const service = new AccountsService({
      handleOauthCallback: async () => ({
        ok: false,
        reason: 'INVALID_STATE',
      }),
    });
    const controller = new AccountsController(service, new SessionGuard());

    const response = await controller.handleGoogleOauthCallback({
      query: {
        code: 'oauth-code',
        state: 'unexpected-state',
      },
      session: {
        adminUser: {
          email: 'admin@example.com',
        },
      },
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/state/i);
  });

  test('stores encrypted tokens, scopes, expiry, and account identity after successful callback', async () => {
    const service = new AccountsService({
      handleOauthCallback: async () => ({
        ok: true,
        account: {
          provider: 'google',
          email: 'ops@example.com',
          displayName: 'Ops User',
          accessTokenEnc: 'enc-access-token',
          refreshTokenEnc: 'enc-refresh-token',
          scopes: [
            'https://www.googleapis.com/auth/youtube.readonly',
            'https://www.googleapis.com/auth/youtube.upload',
            'https://www.googleapis.com/auth/youtube.force-ssl',
          ],
          tokenExpiresAt: '2026-04-04T04:30:00.000Z',
          status: 'connected',
        },
      }),
    });
    const controller = new AccountsController(service, new SessionGuard());

    const response = await controller.handleGoogleOauthCallback({
      query: {
        code: 'oauth-code',
        state: 'expected-state',
      },
      session: {
        adminUser: {
          email: 'admin@example.com',
        },
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.account).toMatchObject({
      provider: 'google',
      email: 'ops@example.com',
      displayName: 'Ops User',
      status: 'connected',
      tokenExpiresAt: '2026-04-04T04:30:00.000Z',
    });
    expect(response.body.account?.accessTokenEnc).toBeDefined();
    expect(response.body.account?.accessTokenEnc).not.toContain('oauth-code');
    expect(response.body.account?.refreshTokenEnc).toBeDefined();
  });
});
