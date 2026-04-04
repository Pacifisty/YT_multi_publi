export interface AccountRow {
  id: string;
  provider: string;
  email?: string;
  displayName?: string;
  status: 'connected' | 'reauth_required' | 'disconnected';
  channelCount: number;
  connectedAt: string;
}

export interface AccountTableProps {
  accounts: AccountRow[];
  onDisconnect?: (accountId: string) => void;
  onReconnect?: (accountId: string) => void;
  onViewChannels?: (accountId: string) => void;
}

export interface AccountTableView {
  rows: AccountTableRowView[];
  isEmpty: boolean;
}

export interface AccountTableRowView {
  account: AccountRow;
  showReauthBadge: boolean;
  actions: string[];
}

export function buildAccountTableView(props: AccountTableProps): AccountTableView {
  if (props.accounts.length === 0) {
    return { rows: [], isEmpty: true };
  }

  const rows: AccountTableRowView[] = props.accounts.map((account) => {
    const showReauthBadge = account.status === 'reauth_required';
    const actions: string[] = ['View Channels'];

    if (showReauthBadge) {
      actions.push('Reconnect Google Account');
    }

    if (account.status !== 'disconnected') {
      actions.push('Disconnect');
    }

    return { account, showReauthBadge, actions };
  });

  return { rows, isEmpty: false };
}
