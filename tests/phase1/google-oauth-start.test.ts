import { describe, expect, test } from 'vitest';

import { AccountsController } from '../../apps/api/src/accounts/accounts.controller';
import { AccountsService } from '../../apps/api/src/accounts/accounts.service';
import { SessionGuard } from '../../apps/api/src/auth/session.guard';

describe('google oauth start endpoint', () => {
  test('returns redirect url with offline access and include granted scopes', async () => {
    const service = new AccountsService({
      createAuthorizationRedirect: () =>
        'https://accounts.google.com/o/oauth2/v2/auth?access_type=offline&include_granted_scopes=true&scope=openid%20email%20profile%20https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fyoutube.readonly%20https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fyoutube.upload',
    });
    const controller = new AccountsController(service, new SessionGuard());

    const response = await controller.startGoogleOauth({
      session: {
        adminUser: {
          email: 'admin@example.com',
        },
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.redirectUrl).toContain('access_type=offline');
    expect(response.body.redirectUrl).toContain('include_granted_scopes=true');
    expect(response.body.redirectUrl).toContain('openid');
    expect(response.body.redirectUrl).toContain('email');
    expect(response.body.redirectUrl).toContain('profile');
    expect(response.body.redirectUrl).toContain('youtube.readonly');
    expect(response.body.redirectUrl).toContain('youtube.upload');
  });
});
