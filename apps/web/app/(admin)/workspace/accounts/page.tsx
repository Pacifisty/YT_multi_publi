import { buildAccountTableView, type AccountRow, type AccountTableView } from '../../../../components/accounts/account-table';
import { buildChannelToggleListView, type ChannelToggleItem, type ChannelToggleListView } from '../../../../components/accounts/channel-toggle-list';

export interface AccountsPageData {
  accounts: AccountRow[];
  channelsByAccount: Record<string, ChannelToggleItem[]>;
}

export interface AccountsPageView {
  table: AccountTableView;
  channelLists: Record<string, ChannelToggleListView>;
  connectUrls: {
    youtube: string;
    instagram: string;
    tiktok: string;
  };
  emptyState?: {
    heading: string;
    body: string;
    ctas: string[];
  };
}

export function buildAccountsPageView(data: AccountsPageData): AccountsPageView {
  const table = buildAccountTableView({ accounts: data.accounts });

  const channelLists: Record<string, ChannelToggleListView> = {};
  for (const [accountId, channels] of Object.entries(data.channelsByAccount)) {
    channelLists[accountId] = buildChannelToggleListView({ channels });
  }

  const view: AccountsPageView = {
    table,
    channelLists,
    connectUrls: {
      youtube: '/accounts/oauth/youtube/start',
      instagram: '/accounts/oauth/instagram/start',
      tiktok: '/accounts/oauth/tiktok/start',
    },
  };

  if (table.isEmpty) {
    view.emptyState = {
      heading: 'No accounts connected',
      body: 'Connect YouTube, Instagram, or TikTok accounts to centralize your publishing workspace.',
      ctas: ['Connect YouTube Account', 'Connect Instagram Account', 'Connect TikTok Account'],
    };
  }

  return view;
}
