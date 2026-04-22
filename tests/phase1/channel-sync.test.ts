import { describe, expect, test } from 'vitest';

import { AccountsController } from '../../apps/api/src/accounts/accounts.controller';
import { AccountsService, type ConnectedAccountRecord, type ChannelRecord } from '../../apps/api/src/accounts/accounts.service';
import { TokenCryptoService } from '../../apps/api/src/common/crypto/token-crypto.service';
import { SessionGuard } from '../../apps/api/src/auth/session.guard';
import type { YouTubeChannelsListResult } from '../../apps/api/src/integrations/youtube/youtube-channels.service';

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
    accessTokenEnc: crypto.encrypt('valid-access-token'),
    refreshTokenEnc: crypto.encrypt('valid-refresh-token'),
    scopes: ['https://www.googleapis.com/auth/youtube.readonly'],
    tokenExpiresAt: new Date(Date.now() + 3600_000).toISOString(),
    status: 'connected',
    connectedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const MOCK_CHANNELS: YouTubeChannelsListResult = {
  channels: [
    {
      channelId: 'UC_channel_1',
      title: 'Tech Reviews',
      handle: '@techreviews',
      thumbnailUrl: 'https://yt3.ggpht.com/thumb1',
    },
    {
      channelId: 'UC_channel_2',
      title: 'Gaming Hub',
      handle: '@gaminghub',
      thumbnailUrl: 'https://yt3.ggpht.com/thumb2',
    },
  ],
};

function createMockYouTubeChannelsService() {
  return {
    listMineChannels: async (_accessToken: string) => MOCK_CHANNELS,
  };
}

describe('channel sync after OAuth callback', () => {
  test('syncs channels from YouTube channels.list mine=true after callback', async () => {
    const crypto = createTokenCrypto();
    const account = createConnectedAccount(crypto);

    const service = new AccountsService({
      tokenCryptoService: crypto,
      youtubeChannelsService: createMockYouTubeChannelsService(),
    });

    const channels = await service.syncChannelsForAccount(account);

    expect(channels).toHaveLength(2);
    expect(channels[0].youtubeChannelId).toBe('UC_channel_1');
    expect(channels[0].title).toBe('Tech Reviews');
    expect(channels[0].isActive).toBe(true);
    expect(channels[1].youtubeChannelId).toBe('UC_channel_2');
    expect(channels[1].title).toBe('Gaming Hub');
  });

  test('upserts channels on re-sync without duplicating', async () => {
    const crypto = createTokenCrypto();
    const account = createConnectedAccount(crypto);

    const service = new AccountsService({
      tokenCryptoService: crypto,
      youtubeChannelsService: createMockYouTubeChannelsService(),
    });

    await service.syncChannelsForAccount(account);
    const channels = await service.syncChannelsForAccount(account);

    expect(channels).toHaveLength(2);
  });

  test('re-sync reactivates previously deactivated channels for the same account', async () => {
    const crypto = createTokenCrypto();
    const account = createConnectedAccount(crypto);

    const service = new AccountsService({
      tokenCryptoService: crypto,
      youtubeChannelsService: createMockYouTubeChannelsService(),
    });

    const channels = await service.syncChannelsForAccount(account);
    await service.toggleChannel(channels[0].id, false);

    await service.syncChannelsForAccount(account);
    const reloadedChannels = await service.getChannelsForAccount(account.id);

    expect(reloadedChannels.find((channel) => channel.id === channels[0].id)?.isActive).toBe(true);
  });
});

describe('channel toggle activation', () => {
  test('PATCH toggles channel isActive to false', async () => {
    const crypto = createTokenCrypto();
    const account = createConnectedAccount(crypto);

    const service = new AccountsService({
      tokenCryptoService: crypto,
      youtubeChannelsService: createMockYouTubeChannelsService(),
    });

    const channels = await service.syncChannelsForAccount(account);
    const toggled = await service.toggleChannel(channels[0].id, false);

    expect(toggled).not.toBeNull();
    expect(toggled!.isActive).toBe(false);
  });

  test('PATCH toggles channel isActive back to true', async () => {
    const crypto = createTokenCrypto();
    const account = createConnectedAccount(crypto);

    const service = new AccountsService({
      tokenCryptoService: crypto,
      youtubeChannelsService: createMockYouTubeChannelsService(),
    });

    const channels = await service.syncChannelsForAccount(account);
    await service.toggleChannel(channels[0].id, false);
    const toggled = await service.toggleChannel(channels[0].id, true);

    expect(toggled).not.toBeNull();
    expect(toggled!.isActive).toBe(true);
  });

  test('PATCH returns null for unknown channel', async () => {
    const crypto = createTokenCrypto();

    const service = new AccountsService({
      tokenCryptoService: crypto,
    });

    const result = await service.toggleChannel('nonexistent-id', true);
    expect(result).toBeNull();
  });

  test('controller toggleChannel validates body and returns 400 for invalid payload', async () => {
    const crypto = createTokenCrypto();
    const service = new AccountsService({ tokenCryptoService: crypto });
    const controller = new AccountsController(service, new SessionGuard());

    const response = await controller.toggleChannel({
      session: { adminUser: { email: 'admin@example.com' } },
      params: { accountId: 'acct-1', channelId: 'ch-1' },
      body: { wrong: 'payload' },
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/isActive/i);
  });
});

describe('account disconnect', () => {
  test('disconnect deactivates all channels for the account', async () => {
    const crypto = createTokenCrypto();
    const account = createConnectedAccount(crypto);

    const service = new AccountsService({
      tokenCryptoService: crypto,
      youtubeChannelsService: createMockYouTubeChannelsService(),
    });

    await service.syncChannelsForAccount(account);
    const result = service.disconnectAccount(account.id);

    expect(result.disconnected).toBe(true);

    const channels = await service.getChannelsForAccount(account.id);
    expect(channels.every((ch) => ch.isActive === false)).toBe(true);
  });

  test('controller disconnect requires DISCONNECT confirmation', async () => {
    const crypto = createTokenCrypto();
    const service = new AccountsService({ tokenCryptoService: crypto });
    const controller = new AccountsController(service, new SessionGuard());

    const response = await controller.disconnectAccount({
      session: { adminUser: { email: 'admin@example.com' } },
      params: { accountId: 'acct-1' },
      body: {},
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/DISCONNECT/i);
  });

  test('controller disconnect succeeds with proper confirmation', async () => {
    const crypto = createTokenCrypto();
    const service = new AccountsService({
      tokenCryptoService: crypto,
      updateConnectedAccount: async (id, updates) =>
        ({ ...createConnectedAccount(crypto), ...updates, id }) as ConnectedAccountRecord,
    });
    const controller = new AccountsController(service, new SessionGuard());

    const response = await controller.disconnectAccount({
      session: { adminUser: { email: 'admin@example.com' } },
      params: { accountId: 'acct-1' },
      body: { confirm: 'DISCONNECT' },
    });

    expect(response.status).toBe(200);
    expect(response.body.disconnected).toBe(true);
  });
});
