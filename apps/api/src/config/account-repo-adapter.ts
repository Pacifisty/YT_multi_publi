import type { ConnectedAccountRepository, ConnectedAccount } from '../accounts/connected-account.service';
import type { ConnectedAccountRecord } from '../accounts/accounts.service';

function toRecord(account: ConnectedAccount): ConnectedAccountRecord {
  return {
    id: account.id,
    provider: account.provider,
    email: account.email ?? undefined,
    displayName: account.displayName ?? undefined,
    accessTokenEnc: account.accessTokenEnc,
    refreshTokenEnc: account.refreshTokenEnc,
    scopes: account.scopes,
    tokenExpiresAt: account.tokenExpiresAt?.toISOString() ?? null,
    status: account.status as 'connected' | 'reauth_required' | 'disconnected',
    connectedAt: account.connectedAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}

function toPartialAccount(updates: Partial<ConnectedAccountRecord>): Partial<ConnectedAccount> {
  const result: Partial<ConnectedAccount> = {};
  if (updates.provider !== undefined) result.provider = updates.provider;
  if (updates.email !== undefined) result.email = updates.email ?? null;
  if (updates.displayName !== undefined) result.displayName = updates.displayName ?? null;
  if (updates.accessTokenEnc !== undefined) result.accessTokenEnc = updates.accessTokenEnc;
  if (updates.refreshTokenEnc !== undefined) result.refreshTokenEnc = updates.refreshTokenEnc;
  if (updates.scopes !== undefined) result.scopes = updates.scopes;
  if (updates.tokenExpiresAt !== undefined) {
    result.tokenExpiresAt = updates.tokenExpiresAt ? new Date(updates.tokenExpiresAt) : null;
  }
  if (updates.status !== undefined) result.status = updates.status;
  if (updates.connectedAt !== undefined) result.connectedAt = new Date(updates.connectedAt);
  if (updates.updatedAt !== undefined) result.updatedAt = new Date(updates.updatedAt);
  return result;
}

function toCreateDto(record: ConnectedAccountRecord) {
  return {
    provider: record.provider,
    email: record.email ?? null,
    displayName: record.displayName ?? null,
    accessTokenEnc: record.accessTokenEnc,
    refreshTokenEnc: record.refreshTokenEnc,
    scopes: record.scopes,
    tokenExpiresAt: record.tokenExpiresAt ? new Date(record.tokenExpiresAt) : null,
  };
}

export function createAccountRepoAdapter(repo: ConnectedAccountRepository) {
  return {
    createConnectedAccount: async (record: ConnectedAccountRecord): Promise<ConnectedAccountRecord> => {
      const created = await repo.create(toCreateDto(record));
      return toRecord(created);
    },
    getConnectedAccount: async (id: string): Promise<ConnectedAccountRecord | null> => {
      const account = await repo.findById(id);
      return account ? toRecord(account) : null;
    },
    listConnectedAccounts: async (): Promise<ConnectedAccountRecord[]> => {
      const accounts = await repo.findAll();
      return accounts.map(toRecord);
    },
    updateConnectedAccount: async (id: string, updates: Partial<ConnectedAccountRecord>): Promise<ConnectedAccountRecord> => {
      const result = await repo.update(id, toPartialAccount(updates));
      if (!result) throw new Error(`Account ${id} not found`);
      return toRecord(result);
    },
  };
}
