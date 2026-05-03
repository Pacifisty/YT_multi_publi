import { describe, expect, test, vi } from 'vitest';

import { buildWorkspaceLayout } from '../../apps/web/app/(admin)/workspace/layout';
import { renderLoginPage } from '../../apps/web/app/(public)/login/page';

describe('protected workspace shell', () => {
  test('renders a login page with email/password fields and inline error text', () => {
    const page = renderLoginPage({ error: 'Invalid email or password.' });

    expect(page.fields.map((field) => field.name)).toEqual(['email', 'password']);
    expect(page.inlineError).toBe('Invalid email or password.');
  });

  test('redirects to /login when /auth/me returns 401', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
    });

    await expect(buildWorkspaceLayout({ fetcher })).resolves.toEqual({
      redirectTo: '/login',
    });
    expect(fetcher).toHaveBeenCalledWith(
      '/auth/me',
      expect.objectContaining({
        credentials: 'include',
        method: 'GET',
      }),
    );
  });

  test('renders Accounts and Media tabs with Accounts selected by default for authenticated admins', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({
        user: {
          email: 'admin@example.com',
        },
      }),
    });

    const result = await buildWorkspaceLayout({ fetcher });

    if (!result.tabs || !result.emptyStates) {
      throw new Error('Expected the authenticated workspace shell to render tabs and empty states.');
    }

    expect(result.redirectTo).toBeUndefined();
    expect(result.tabs).toEqual([
      { id: 'accounts', label: 'Accounts', selected: true },
      { id: 'media', label: 'Media', selected: false },
      { id: 'campanhas', label: 'Campanhas', selected: false },
      { id: 'dashboard', label: 'Dashboard', selected: false },
      { id: 'growth', label: 'Growth', selected: false },
    ]);
    expect(result.emptyStates.accounts).toEqual({
      heading: 'No accounts connected',
      body: 'Connect a Google account to load available YouTube channels and choose which ones stay active.',
      cta: 'Connect Google Account',
    });
    expect(result.emptyStates.media).toEqual({
      heading: 'No media assets uploaded.',
      body: 'Upload one video (and optional thumbnail) to reuse in future campaigns.',
      cta: 'Upload video',
    });
  });
});
