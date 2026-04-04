import { buildAccountTableView, type AccountRow, type AccountTableView } from '../../../../components/accounts/account-table';
import { buildChannelToggleListView, type ChannelToggleItem, type ChannelToggleListView } from '../../../../components/accounts/channel-toggle-list';

export interface AccountsPageData {
  accounts: AccountRow[];
  channelsByAccount: Record<string, ChannelToggleItem[]>;
}

export interface AccountsPageView {
  table: AccountTableView;
  channelLists: Record<string, ChannelToggleListView>;
  connectUrl: string;
  emptyState?: {
    heading: string;
    body: string;
    cta: string;
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
    connectUrl: '/accounts/oauth/google/start',
  };

  if (table.isEmpty) {
    view.emptyState = {
      heading: 'No accounts connected',
      body: 'Connect a Google account to load available YouTube channels and choose which ones stay active.',
      cta: 'Connect Google Account',
    };
  }

  return view;
}
