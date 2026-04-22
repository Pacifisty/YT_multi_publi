import { describe, it, expect, vi } from 'vitest';
import { AccountsService, type ChannelRecord } from '../../apps/api/src/accounts/accounts.service';
import { AccountsController } from '../../apps/api/src/accounts/accounts.controller';
import { SessionGuard } from '../../apps/api/src/auth/session.guard';
import { TokenCryptoService } from '../../apps/api/src/common/crypto/token-crypto.service';

const TEST_KEY = '12345678901234567890123456789012';

function createTestChannelRecord(overrides: Partial<ChannelRecord> = {}): ChannelRecord {
  return {
    id: 'ch-1',
    connectedAccountId: 'acc-1',
    youtubeChannelId: 'UC_test',
    title: 'Test Channel',
    handle: '@test',
    thumbnailUrl: 'https://example.com/thumb.jpg',
    isActive: true,
    lastSyncedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createAsyncChannelStore(seedRecords: ChannelRecord[] = []) {
  const records = new Map<string, ChannelRecord>();
  for (const r of seedRecords) {
    records.set(r.id, r);
  }

  return {
    upsert: vi.fn(async (record: ChannelRecord) => {
      records.set(record.id, record);
      return record;
    }),
    findByAccountId: vi.fn(async (accountId: string) => {
      return Array.from(records.values()).filter((r) => r.connectedAccountId === accountId);
    }),
    findById: vi.fn(async (channelId: string) => {
      return records.get(channelId) ?? null;
    }),
    update: vi.fn(async (channelId: string, updates: Partial<ChannelRecord>) => {
      const record = records.get(channelId);
      if (!record) return null;
      const updated = { ...record, ...updates };
      records.set(channelId, updated);
      return updated;
    }),
    delete: vi.fn(async (channelId: string) => {
      return records.delete(channelId);
    }),
    deactivateAllForAccount: vi.fn(async (accountId: string) => {
      for (const [key, record] of records) {
        if (record.connectedAccountId === accountId) {
          records.set(key, { ...record, isActive: false });
        }
      }
    }),
  };
}

function authedRequest(overrides: Record<string, any> = {}) {
  return {
    session: { adminUser: { email: 'admin@test.com', authenticatedAt: new Date().toISOString() } },
    ...overrides,
  };
}

describe('Phase 56: Async ChannelStore through controller', () => {
  it('controller getChannels returns resolved array from async store', async () => {
    const testChannel = createTestChannelRecord();
    const asyncStore = createAsyncChannelStore([testChannel]);

    const service = new AccountsService({ channelStore: asyncStore as any });
    const controller = new AccountsController(service, new SessionGuard());

    const res = await controller.getChannels(
      authedRequest({ params: { accountId: 'acc-1' } }),
    );

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.channels)).toBe(true);
    expect(res.body.channels).toHaveLength(1);
    expect(res.body.channels![0].id).toBe('ch-1');
  });

  it('controller toggleChannel resolves with updated channel from async store', async () => {
    const testChannel = createTestChannelRecord();
    const asyncStore = createAsyncChannelStore([testChannel]);

    const service = new AccountsService({ channelStore: asyncStore as any });
    const controller = new AccountsController(service, new SessionGuard());

    const res = await controller.toggleChannel(
      authedRequest({ params: { channelId: 'ch-1' }, body: { isActive: false } }),
    );

    expect(res.status).toBe(200);
    expect(res.body.channel).toBeDefined();
    expect(res.body.channel!.isActive).toBe(false);
  });

  it('controller toggleChannel returns 404 when async store returns null', async () => {
    const asyncStore = createAsyncChannelStore(); // empty store

    const service = new AccountsService({ channelStore: asyncStore as any });
    const controller = new AccountsController(service, new SessionGuard());

    const res = await controller.toggleChannel(
      authedRequest({ params: { channelId: 'nonexistent' }, body: { isActive: false } }),
    );

    expect(res.status).toBe(404);
  });

  it('service toggleChannel awaits async store and returns resolved value', async () => {
    const testChannel = createTestChannelRecord();
    const asyncStore = createAsyncChannelStore([testChannel]);

    const service = new AccountsService({ channelStore: asyncStore as any });
    const result = await service.toggleChannel('ch-1', false);

    expect(result).not.toBeNull();
    expect(typeof result!.isActive).toBe('boolean');
    expect(result!.isActive).toBe(false);
  });

  it('service getChannelsForAccount awaits async store and returns array', async () => {
    const testChannel = createTestChannelRecord();
    const asyncStore = createAsyncChannelStore([testChannel]);

    const service = new AccountsService({ channelStore: asyncStore as any });
    const result = await service.getChannelsForAccount('acc-1');

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
  });

  it('service disconnectAccountAsync awaits async deactivateAllForAccount', async () => {
    const testChannel = createTestChannelRecord();
    const asyncStore = createAsyncChannelStore([testChannel]);

    const service = new AccountsService({ channelStore: asyncStore as any });
    await service.disconnectAccountAsync('acc-1');

    expect(asyncStore.deactivateAllForAccount).toHaveBeenCalledWith('acc-1');
  });

  it('service deleteAccountAsync removes all channels before deleting the account', async () => {
    const testChannel = createTestChannelRecord();
    const asyncStore = createAsyncChannelStore([testChannel]);
    const deleteConnectedAccount = vi.fn(async () => true);
    const service = new AccountsService({
      channelStore: asyncStore as any,
      getConnectedAccount: async (id: string) => ({
        id,
        provider: 'google',
        accessTokenEnc: 'enc',
        refreshTokenEnc: null,
        scopes: [],
        tokenExpiresAt: null,
        status: 'connected',
        connectedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      deleteConnectedAccount,
    });

    const result = await service.deleteAccountAsync('acc-1');

    expect(asyncStore.delete).toHaveBeenCalledWith('ch-1');
    expect(deleteConnectedAccount).toHaveBeenCalledWith('acc-1');
    expect(result.deleted).toBe(true);
    expect(result.removedChannels).toBe(1);
  });
});
