import { describe, expect, test } from 'vitest';

import { buildAccountTableView, type AccountRow } from '../../apps/web/components/accounts/account-table';
import { buildChannelToggleListView, type ChannelToggleItem } from '../../apps/web/components/accounts/channel-toggle-list';
import { buildAccountsPageView, type AccountsPageData } from '../../apps/web/app/(admin)/workspace/accounts/page';

describe('accounts tab empty state', () => {
  test('shows empty state with connect CTA when no accounts exist', () => {
    const view = buildAccountsPageView({
      accounts: [],
      channelsByAccount: {},
    });

    expect(view.emptyState).toBeDefined();
    expect(view.emptyState!.heading).toBe('No accounts connected');
    expect(view.emptyState!.ctas).toEqual([
      'Connect YouTube Account',
      'Connect TikTok Account',
    ]);
    expect(view.connectUrls.youtube).toBe('/accounts/oauth/youtube/start');
    expect(view.connectUrls.tiktok).toBe('/accounts/oauth/tiktok/start');
  });
});

describe('account table with connected accounts', () => {
  const connectedAccount: AccountRow = {
    id: 'acct-1',
    provider: 'google',
    email: 'ops@example.com',
    displayName: 'Ops User',
    status: 'connected',
    channelCount: 2,
    connectedAt: '2026-04-04T00:00:00Z',
  };

  test('renders account row with view channels and disconnect actions', () => {
    const view = buildAccountTableView({ accounts: [connectedAccount] });

    expect(view.isEmpty).toBe(false);
    expect(view.rows).toHaveLength(1);
    expect(view.rows[0].account.email).toBe('ops@example.com');
    expect(view.rows[0].actions).toContain('View Channels');
    expect(view.rows[0].actions).toContain('Disconnect');
  });

  test('does not show reauth badge for connected accounts', () => {
    const view = buildAccountTableView({ accounts: [connectedAccount] });
    expect(view.rows[0].showReauthBadge).toBe(false);
  });
});

describe('reauth required accounts', () => {
  const reauthAccount: AccountRow = {
    id: 'acct-2',
    provider: 'google',
    email: 'stale@example.com',
    displayName: 'Stale User',
    status: 'reauth_required',
    channelCount: 1,
    connectedAt: '2026-04-03T00:00:00Z',
  };

  test('shows reauth badge for reauth_required accounts', () => {
    const view = buildAccountTableView({ accounts: [reauthAccount] });
    expect(view.rows[0].showReauthBadge).toBe(true);
  });

  test('shows Reconnect Google Account action for reauth_required accounts', () => {
    const view = buildAccountTableView({ accounts: [reauthAccount] });
    expect(view.rows[0].actions).toContain('Reconnect Google Account');
  });
});

describe('channel toggle list', () => {
  const channels: ChannelToggleItem[] = [
    {
      id: 'ch-1',
      youtubeChannelId: 'UC_channel_1',
      title: 'Tech Reviews',
      handle: '@techreviews',
      isActive: true,
    },
    {
      id: 'ch-2',
      youtubeChannelId: 'UC_channel_2',
      title: 'Gaming Hub',
      isActive: false,
    },
  ];

  test('builds channel toggle list with active count', () => {
    const view = buildChannelToggleListView({ channels });

    expect(view.isEmpty).toBe(false);
    expect(view.items).toHaveLength(2);
    expect(view.activeCount).toBe(1);
    expect(view.totalCount).toBe(2);
  });

  test('includes handle in label when present', () => {
    const view = buildChannelToggleListView({ channels });
    expect(view.items[0].label).toBe('Tech Reviews (@techreviews)');
  });

  test('shows title only when handle is missing', () => {
    const view = buildChannelToggleListView({ channels });
    expect(view.items[1].label).toBe('Gaming Hub');
  });

  test('shows empty state for no channels', () => {
    const view = buildChannelToggleListView({ channels: [] });
    expect(view.isEmpty).toBe(true);
    expect(view.activeCount).toBe(0);
  });
});

describe('accounts page with channels', () => {
  test('builds full page view with account table and channel lists', () => {
    const data: AccountsPageData = {
      accounts: [
        {
          id: 'acct-1',
          provider: 'google',
          email: 'ops@example.com',
          displayName: 'Ops User',
          status: 'connected',
          channelCount: 2,
          connectedAt: '2026-04-04T00:00:00Z',
        },
      ],
      channelsByAccount: {
        'acct-1': [
          { id: 'ch-1', youtubeChannelId: 'UC_1', title: 'Channel 1', isActive: true },
          { id: 'ch-2', youtubeChannelId: 'UC_2', title: 'Channel 2', isActive: false },
        ],
      },
    };

    const view = buildAccountsPageView(data);

    expect(view.emptyState).toBeUndefined();
    expect(view.table.rows).toHaveLength(1);
    expect(view.channelLists['acct-1'].items).toHaveLength(2);
    expect(view.channelLists['acct-1'].activeCount).toBe(1);
  });
});
