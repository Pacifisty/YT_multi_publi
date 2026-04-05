import { describe, it, expect, beforeEach } from 'vitest';
import {
  AccountsController,
  type AccountsRequest,
} from '../../apps/api/src/accounts/accounts.controller';
import {
  ConnectedAccountService,
  InMemoryConnectedAccountRepository,
} from '../../apps/api/src/accounts/connected-account.service';
import {
  YouTubeChannelService,
  InMemoryYouTubeChannelRepository,
} from '../../apps/api/src/channels/youtube-channel.service';
import { SessionGuard } from '../../apps/api/src/auth/session.guard';

function authedRequest(overrides: Partial<AccountsRequest> = {}): AccountsRequest {
  return {
    session: { adminUser: { email: 'admin@test.com', authenticatedAt: new Date().toISOString() } },
    ...overrides,
  };
}

function unauthedRequest(overrides: Partial<AccountsRequest> = {}): AccountsRequest {
  return { session: null, ...overrides };
}

describe('AccountsController', () => {
  let accountService: ConnectedAccountService;
  let channelService: YouTubeChannelService;
  let controller: AccountsController;

  beforeEach(() => {
    accountService = new ConnectedAccountService(new InMemoryConnectedAccountRepository());
    channelService = new YouTubeChannelService(new InMemoryYouTubeChannelRepository());
    controller = new AccountsController(accountService, channelService, new SessionGuard());
  });

  describe('listAccounts', () => {
    it('returns 401 for unauthenticated request', async () => {
      const res = await controller.listAccounts(unauthedRequest());
      expect(res.status).toBe(401);
    });

    it('returns empty list initially', async () => {
      const res = await controller.listAccounts(authedRequest());
      expect(res.status).toBe(200);
      expect(res.body.accounts).toEqual([]);
    });

    it('returns created accounts', async () => {
      await accountService.create({
        provider: 'google',
        accessTokenEnc: 'enc:token',
        email: 'user@gmail.com',
      });

      const res = await controller.listAccounts(authedRequest());
      expect(res.body.accounts).toHaveLength(1);
      expect(res.body.accounts[0].provider).toBe('google');
    });
  });

  describe('getAccount', () => {
    it('returns 401 for unauthenticated request', async () => {
      const res = await controller.getAccount(unauthedRequest({ params: { id: 'x' } }));
      expect(res.status).toBe(401);
    });

    it('returns 404 for nonexistent account', async () => {
      const res = await controller.getAccount(authedRequest({ params: { id: 'nonexistent' } }));
      expect(res.status).toBe(404);
    });

    it('returns account by id', async () => {
      const { account } = await accountService.create({
        provider: 'google',
        accessTokenEnc: 'enc:token',
      });

      const res = await controller.getAccount(authedRequest({ params: { id: account.id } }));
      expect(res.status).toBe(200);
      expect(res.body.account.id).toBe(account.id);
    });
  });

  describe('disconnectAccount', () => {
    it('returns 401 for unauthenticated request', async () => {
      const res = await controller.disconnectAccount(unauthedRequest({ params: { id: 'x' } }));
      expect(res.status).toBe(401);
    });

    it('disconnects an account', async () => {
      const { account } = await accountService.create({
        provider: 'google',
        accessTokenEnc: 'enc:token',
      });

      const res = await controller.disconnectAccount(authedRequest({ params: { id: account.id } }));
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const found = await accountService.getById(account.id);
      expect(found!.status).toBe('disconnected');
    });

    it('returns 404 for nonexistent account', async () => {
      const res = await controller.disconnectAccount(authedRequest({ params: { id: 'x' } }));
      expect(res.status).toBe(404);
    });
  });

  describe('reconnectAccount', () => {
    it('reconnects a disconnected account', async () => {
      const { account } = await accountService.create({
        provider: 'google',
        accessTokenEnc: 'enc:token',
      });
      await accountService.disconnect(account.id);

      const res = await controller.reconnectAccount(authedRequest({ params: { id: account.id } }));
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('deleteAccount', () => {
    it('deletes an account', async () => {
      const { account } = await accountService.create({
        provider: 'google',
        accessTokenEnc: 'enc:token',
      });

      const res = await controller.deleteAccount(authedRequest({ params: { id: account.id } }));
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(await accountService.getById(account.id)).toBeNull();
    });

    it('returns 404 for nonexistent account', async () => {
      const res = await controller.deleteAccount(authedRequest({ params: { id: 'x' } }));
      expect(res.status).toBe(404);
    });
  });

  describe('listChannels', () => {
    it('returns channels for an account', async () => {
      const { account } = await accountService.create({
        provider: 'google',
        accessTokenEnc: 'enc:token',
      });
      await channelService.create({
        connectedAccountId: account.id,
        youtubeChannelId: 'UC1',
        title: 'Channel 1',
      });

      const res = await controller.listChannels(authedRequest({ params: { id: account.id } }));
      expect(res.status).toBe(200);
      expect(res.body.channels).toHaveLength(1);
    });

    it('returns 401 for unauthenticated request', async () => {
      const res = await controller.listChannels(unauthedRequest({ params: { id: 'x' } }));
      expect(res.status).toBe(401);
    });
  });

  describe('deactivateChannel', () => {
    it('deactivates a channel', async () => {
      const { account } = await accountService.create({
        provider: 'google',
        accessTokenEnc: 'enc:token',
      });
      const { channel } = await channelService.create({
        connectedAccountId: account.id,
        youtubeChannelId: 'UC1',
        title: 'Channel 1',
      });

      const res = await controller.deactivateChannel(
        authedRequest({ params: { id: account.id, channelId: channel.id } }),
      );
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const found = await channelService.getById(channel.id);
      expect(found!.isActive).toBe(false);
    });

    it('returns 404 for nonexistent channel', async () => {
      const res = await controller.deactivateChannel(
        authedRequest({ params: { id: 'x', channelId: 'y' } }),
      );
      expect(res.status).toBe(404);
    });
  });

  describe('activateChannel', () => {
    it('activates a deactivated channel', async () => {
      const { account } = await accountService.create({
        provider: 'google',
        accessTokenEnc: 'enc:token',
      });
      const { channel } = await channelService.create({
        connectedAccountId: account.id,
        youtubeChannelId: 'UC1',
        title: 'Channel 1',
      });
      await channelService.deactivate(channel.id);

      const res = await controller.activateChannel(
        authedRequest({ params: { id: account.id, channelId: channel.id } }),
      );
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
