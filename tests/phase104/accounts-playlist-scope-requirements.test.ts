import { describe, expect, test } from 'vitest';

import {
  AccountsService,
  type ChannelRecord,
  type ChannelStore,
  type ConnectedAccountRecord,
} from '../../apps/api/src/accounts/accounts.service';
import { TokenCryptoService } from '../../apps/api/src/common/crypto/token-crypto.service';
import { ChannelTokenResolverError } from '../../apps/api/src/integrations/youtube/channel-token-resolver';

const TEST_KEY = '12345678901234567890123456789012';

function createTokenCrypto(): TokenCryptoService {
  return new TokenCryptoService({ OAUTH_TOKEN_KEY: TEST_KEY });
}

function createConnectedAccount(
  crypto: TokenCryptoService,
  overrides: Partial<ConnectedAccountRecord> = {},
): ConnectedAccountRecord {
  return {
    id: 'acct-1',
    provider: 'google',
    googleSubject: 'google-sub-1',
    email: 'ops@example.com',
    displayName: 'Ops User',
    accessTokenEnc: crypto.encrypt('access-token'),
    refreshTokenEnc: crypto.encrypt('refresh-token'),
    scopes: [
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/youtube.upload',
    ],
    tokenExpiresAt: new Date(Date.now() + 3600_000).toISOString(),
    status: 'connected',
    connectedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('accounts playlist scope requirements', () => {
  function createChannelStore(channel: ChannelRecord): ChannelStore {
    return {
      upsert: async (record) => record,
      findByAccountId: async () => [channel],
      findById: async (channelId) => (channelId === channel.id ? channel : null),
      update: async () => channel,
      deactivateAllForAccount: async () => undefined,
    };
  }

  test('allows standard uploads without playlist scope escalation', async () => {
    const crypto = createTokenCrypto();
    const account = createConnectedAccount(crypto);
    const channel: ChannelRecord = {
      id: 'channel-1',
      connectedAccountId: account.id,
      youtubeChannelId: 'UC_test_1',
      title: 'Main Channel',
      isActive: true,
      lastSyncedAt: '2026-04-20T18:00:00.000Z',
    };

    const service = new AccountsService({
      tokenCryptoService: crypto,
      getConnectedAccount: async () => account,
      channelStore: createChannelStore(channel),
      now: () => new Date('2026-04-20T18:00:00.000Z'),
    });

    const token = await service.resolveAccessTokenForChannel(channel.id);
    expect(token).toBe('access-token');
  });

  test('requires reauthorization before playlist uploads when playlist scope is missing', async () => {
    const crypto = createTokenCrypto();
    const account = createConnectedAccount(crypto);
    const channel: ChannelRecord = {
      id: 'channel-1',
      connectedAccountId: account.id,
      youtubeChannelId: 'UC_test_1',
      title: 'Main Channel',
      isActive: true,
      lastSyncedAt: '2026-04-20T18:00:00.000Z',
    };

    const service = new AccountsService({
      tokenCryptoService: crypto,
      getConnectedAccount: async () => account,
      channelStore: createChannelStore(channel),
      now: () => new Date('2026-04-20T18:00:00.000Z'),
    });

    await expect(
      service.resolveAccessTokenForChannel(channel.id, { requirePlaylistWriteScope: true }),
    ).rejects.toMatchObject({
      name: 'ChannelTokenResolverError',
      code: 'REAUTH_REQUIRED',
      channelId: channel.id,
      accountId: account.id,
    } satisfies Partial<ChannelTokenResolverError>);
  });

  test('allows playlist uploads when youtube.force-ssl is already granted', async () => {
    const crypto = createTokenCrypto();
    const account = createConnectedAccount(crypto, {
      scopes: [
        'https://www.googleapis.com/auth/youtube.readonly',
        'https://www.googleapis.com/auth/youtube.upload',
        'https://www.googleapis.com/auth/youtube.force-ssl',
      ],
    });
    const channel: ChannelRecord = {
      id: 'channel-1',
      connectedAccountId: account.id,
      youtubeChannelId: 'UC_test_1',
      title: 'Main Channel',
      isActive: true,
      lastSyncedAt: '2026-04-20T18:00:00.000Z',
    };

    const service = new AccountsService({
      tokenCryptoService: crypto,
      getConnectedAccount: async () => account,
      channelStore: createChannelStore(channel),
      now: () => new Date('2026-04-20T18:00:00.000Z'),
    });

    const token = await service.resolveAccessTokenForChannel(channel.id, { requirePlaylistWriteScope: true });
    expect(token).toBe('access-token');
  });
});
