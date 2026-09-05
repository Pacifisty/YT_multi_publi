import { describe, expect, test } from 'vitest';

import {
  GoogleOauthConfigurationError,
  GoogleOauthService,
} from '../../apps/api/src/integrations/google/google-oauth.service';

describe('Google OAuth runtime configuration', () => {
  test('rejects placeholder credentials before redirecting the user to Google', async () => {
    const service = new GoogleOauthService({
      env: {
        GOOGLE_CLIENT_ID: 'replace-me',
        GOOGLE_CLIENT_SECRET: 'replace-me',
        GOOGLE_REDIRECT_URI: 'http://127.0.0.1:3000/workspace/accounts/callback',
      },
    });

    await expect(service.createAuthorizationRedirect({})).rejects.toMatchObject({
      name: 'GoogleOauthConfigurationError',
      code: 'GOOGLE_OAUTH_NOT_CONFIGURED',
    });
  });

  test('configuration error tells the operator which authorized redirect URI to register', () => {
    const error = new GoogleOauthConfigurationError(
      'http://127.0.0.1:3000/workspace/accounts/callback',
    );

    expect(error.message).toContain('GOOGLE_CLIENT_ID');
    expect(error.message).toContain('GOOGLE_CLIENT_SECRET');
    expect(error.message).toContain('http://127.0.0.1:3000/workspace/accounts/callback');
  });
});
