import { describe, expect, test, vi } from 'vitest';

import {
  InMemoryChannelTokenResolver,
  ChannelTokenResolverError,
} from '../../apps/api/src/integrations/youtube/channel-token-resolver';
import type { ConnectedAccountRecord } from '../../apps/api/src/accounts/accounts.service';

describe('InMemoryChannelTokenResolver', () => {
  test('resolves channel ID to decrypted access token', async () => {
    const mockAccount: ConnectedAccountRecord = {
      id: 'acc-1',
      provider: 'google',
      email: 'test@example.com',
      displayName: 'Test',
      accessTokenEnc: 'encrypted-token',
      refreshTokenEnc: null,
      scopes: [],
      tokenExpiresAt: null,
      status: 'connected',
      connectedAt: '2026-04-01T00:00:00Z',
      updatedAt: '2026-04-01T00:00:00Z',
    };

    const getAccountForChannel = vi.fn().mockResolvedValue(mockAccount);
    const decryptToken = vi.fn().mockReturnValue('decrypted-access-token');

    const resolver = new InMemoryChannelTokenResolver({
      getAccountForChannel,
      decryptToken,
    });

    const result = await resolver.resolve('ch-1');
    expect(result.accessToken).toBe('decrypted-access-token');
    expect(getAccountForChannel).toHaveBeenCalledWith('ch-1');
    expect(decryptToken).toHaveBeenCalledWith('encrypted-token');
  });

  test('throws when channel has no associated account', async () => {
    const getAccountForChannel = vi.fn().mockResolvedValue(null);
    const decryptToken = vi.fn();

    const resolver = new InMemoryChannelTokenResolver({
      getAccountForChannel,
      decryptToken,
    });

    await expect(resolver.resolve('ch-bad')).rejects.toMatchObject({
      name: 'ChannelTokenResolverError',
      code: 'CHANNEL_NOT_FOUND',
      channelId: 'ch-bad',
    } satisfies Partial<ChannelTokenResolverError>);
  });

  test('throws when account requires reauthorization', async () => {
    const mockAccount: ConnectedAccountRecord = {
      id: 'acc-1',
      provider: 'google',
      email: 'test@example.com',
      displayName: 'Test',
      accessTokenEnc: 'encrypted-token',
      refreshTokenEnc: null,
      scopes: [],
      tokenExpiresAt: null,
      status: 'reauth_required',
      connectedAt: '2026-04-01T00:00:00Z',
      updatedAt: '2026-04-01T00:00:00Z',
    };

    const getAccountForChannel = vi.fn().mockResolvedValue(mockAccount);
    const decryptToken = vi.fn();

    const resolver = new InMemoryChannelTokenResolver({
      getAccountForChannel,
      decryptToken,
    });

    await expect(resolver.resolve('ch-1')).rejects.toMatchObject({
      name: 'ChannelTokenResolverError',
      code: 'REAUTH_REQUIRED',
      channelId: 'ch-1',
      accountId: 'acc-1',
    } satisfies Partial<ChannelTokenResolverError>);
  });
});
