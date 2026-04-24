import { SessionGuard, type SessionRequestLike } from '../auth/session.guard';
import type { ConnectedAccountRecord, ChannelRecord, SupportedOauthProvider } from './accounts.service';
import { AccountDeletionBlockedError, AccountsService } from './accounts.service';
import { isValidToggleChannelDto } from './dto/toggle-channel.dto';

interface OAuthQuery {
  code?: string;
  state?: string;
}

export interface AccountsRequest extends SessionRequestLike {
  query?: OAuthQuery;
  body?: unknown;
  params?: Record<string, string>;
}

export interface AccountsControllerResponse<TBody> {
  status: number;
  body: TBody;
}

interface ChannelSyncSummary {
  channelCount: number;
  message: string;
}

export class AccountsController {
  constructor(
    private readonly accountsService: AccountsService,
    private readonly sessionGuard: SessionGuard,
  ) {}

  async listAccounts(
    request: SessionRequestLike,
  ): Promise<AccountsControllerResponse<{ accounts?: ConnectedAccountRecord[]; error?: string }>> {
    const guardResult = this.sessionGuard.check(request);
    if (!guardResult.allowed) {
      return { status: guardResult.status, body: { error: guardResult.reason } };
    }

    const ownerEmail = request.session?.adminUser?.email;
    const accounts = await this.accountsService.listAccounts(ownerEmail);
    return { status: 200, body: { accounts } };
  }

  async getAccount(
    request: AccountsRequest,
  ): Promise<AccountsControllerResponse<{ account?: ConnectedAccountRecord; error?: string }>> {
    const guardResult = this.sessionGuard.check(request);
    if (!guardResult.allowed) {
      return { status: guardResult.status, body: { error: guardResult.reason } };
    }

    const accountId = request.params?.accountId;
    if (!accountId) {
      return { status: 400, body: { error: 'Missing accountId parameter.' } };
    }

    const account = await this.accountsService.getAccount(accountId);
    if (!account) {
      return { status: 404, body: { error: 'Account not found.' } };
    }

    return { status: 200, body: { account } };
  }

  async startGoogleOauth(request: SessionRequestLike): Promise<AccountsControllerResponse<{ error?: string; redirectUrl?: string }>> {
    return this.startOauthForProvider('google', request);
  }

  async startTikTokOauth(request: SessionRequestLike): Promise<AccountsControllerResponse<{ error?: string; redirectUrl?: string }>> {
    return this.startOauthForProvider('tiktok', request);
  }

  private async startOauthForProvider(
    provider: SupportedOauthProvider,
    request: SessionRequestLike,
  ): Promise<AccountsControllerResponse<{ error?: string; redirectUrl?: string }>> {
    const guardResult = this.sessionGuard.check(request);

    if (!guardResult.allowed) {
      return {
        status: 401,
        body: {
          error: guardResult.reason,
        },
      };
    }

    try {
      const redirectUrl = await this.accountsService.createAuthorizationRedirectForProvider(
        provider,
        request.session as unknown as Record<string, unknown> | null | undefined,
      );

      return {
        status: 200,
        body: {
          redirectUrl,
        },
      };
    } catch (error) {
      const label = provider === 'tiktok' ? 'TikTok' : provider === 'youtube' ? 'YouTube' : 'Google';
      const message = error instanceof Error ? error.message : `${label} OAuth start failed.`;
      return {
        status: 500,
        body: {
          error: message,
        },
      };
    }
  }

  async startYouTubeOauth(request: SessionRequestLike): Promise<AccountsControllerResponse<{ error?: string; redirectUrl?: string }>> {
    return this.startOauthForProvider('youtube', request);
  }

  async handleGoogleOauthCallback(
    request: AccountsRequest,
  ): Promise<AccountsControllerResponse<{ error?: string; account?: ConnectedAccountRecord; sync?: ChannelSyncSummary }>> {
    return this.handleOauthCallbackForProvider('google', request);
  }

  async handleTikTokOauthCallback(
    request: AccountsRequest,
  ): Promise<AccountsControllerResponse<{ error?: string; account?: ConnectedAccountRecord; sync?: ChannelSyncSummary }>> {
    return this.handleOauthCallbackForProvider('tiktok', request);
  }

  private async handleOauthCallbackForProvider(
    provider: SupportedOauthProvider,
    request: AccountsRequest,
  ): Promise<AccountsControllerResponse<{ error?: string; account?: ConnectedAccountRecord; sync?: ChannelSyncSummary }>> {
    const guardResult = this.sessionGuard.check(request);

    if (!guardResult.allowed) {
      return {
        status: 401,
        body: {
          error: guardResult.reason,
        },
      };
    }

    const code = request.query?.code;
    const state = request.query?.state;

    if (!code || !state) {
      return {
        status: 400,
        body: {
          error: 'Missing OAuth callback code or state.',
        },
      };
    }

    let result;
    try {
      result = await this.accountsService.handleOauthCallbackForProvider(provider, {
        code,
        state,
        session: request.session as unknown as Record<string, unknown> | null | undefined,
      });
    } catch (error) {
      const label = provider === 'tiktok' ? 'TikTok' : provider === 'youtube' ? 'YouTube' : 'Google';
      const message = error instanceof Error ? error.message : `${label} OAuth callback failed.`;
      return {
        status: 500,
        body: {
          error: message,
        },
      };
    }

    if (!result.ok) {
      return {
        status: 400,
        body: {
          error: 'OAuth state validation failed. Please reconnect and try again.',
        },
      };
    }

    let syncSummary: ChannelSyncSummary | undefined;
    if (provider === 'google' || provider === 'youtube') {
      try {
        const channels = await this.accountsService.syncChannelsForAccount(result.account);
        syncSummary = buildChannelSyncSummary(channels.length);
      } catch {
        // Keep the OAuth connection successful even if channel sync fails.
      }
    }

    return {
      status: 200,
      body: {
        account: result.account,
        sync: syncSummary,
      },
    };
  }

  async getChannels(
    request: AccountsRequest,
  ): Promise<AccountsControllerResponse<{ error?: string; channels?: ChannelRecord[] }>> {
    const guardResult = this.sessionGuard.check(request);

    if (!guardResult.allowed) {
      return { status: 401, body: { error: guardResult.reason } };
    }

    const accountId = request.params?.accountId;
    if (!accountId) {
      return { status: 400, body: { error: 'Missing accountId parameter.' } };
    }

    const ownerEmail = request.session?.adminUser?.email;
    const account = await this.accountsService.getAccount(accountId, ownerEmail);
    if (!account) {
      return { status: 404, body: { error: 'Account not found.' } };
    }

    const channels = await this.accountsService.getChannelsForAccount(account.id);
    return { status: 200, body: { channels } };
  }

  async handleYouTubeOauthCallback(
    request: AccountsRequest,
  ): Promise<AccountsControllerResponse<{ error?: string; account?: ConnectedAccountRecord; sync?: ChannelSyncSummary }>> {
    return this.handleOauthCallbackForProvider('youtube', request);
  }

  async syncChannels(
    request: AccountsRequest,
  ): Promise<AccountsControllerResponse<{ error?: string; channels?: ChannelRecord[]; sync?: ChannelSyncSummary }>> {
    const guardResult = this.sessionGuard.check(request);

    if (!guardResult.allowed) {
      return { status: 401, body: { error: guardResult.reason } };
    }

    const accountId = request.params?.accountId;
    if (!accountId) {
      return { status: 400, body: { error: 'Missing accountId parameter.' } };
    }

    const ownerEmail = request.session?.adminUser?.email;
    const account = await this.accountsService.getAccount(accountId, ownerEmail);
    if (!account) {
      return { status: 404, body: { error: 'Account not found.' } };
    }

    try {
      const channels = await this.accountsService.syncChannelsForAccount(account);
      return { status: 200, body: { channels, sync: buildChannelSyncSummary(channels.length) } };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sync YouTube channels.';
      return { status: 500, body: { error: message } };
    }
  }

  async toggleChannel(
    request: AccountsRequest,
  ): Promise<AccountsControllerResponse<{ error?: string; channel?: ChannelRecord }>> {
    const guardResult = this.sessionGuard.check(request);

    if (!guardResult.allowed) {
      return { status: 401, body: { error: guardResult.reason } };
    }

    const channelId = request.params?.channelId;
    if (!channelId) {
      return { status: 400, body: { error: 'Missing channelId parameter.' } };
    }

    if (!isValidToggleChannelDto(request.body)) {
      return { status: 400, body: { error: 'Invalid request body. Expected { isActive: boolean }.' } };
    }

    const ownerEmail = request.session?.adminUser?.email;
    const channel = await this.accountsService.toggleChannel(channelId, request.body.isActive, ownerEmail);

    if (!channel) {
      return { status: 404, body: { error: 'Channel not found.' } };
    }

    return { status: 200, body: { channel } };
  }

  async disconnectAccount(
    request: AccountsRequest,
  ): Promise<AccountsControllerResponse<{ error?: string; disconnected?: boolean }>> {
    const guardResult = this.sessionGuard.check(request);

    if (!guardResult.allowed) {
      return { status: 401, body: { error: guardResult.reason } };
    }

    const accountId = request.params?.accountId;
    if (!accountId) {
      return { status: 400, body: { error: 'Missing accountId parameter.' } };
    }

    if (typeof request.body !== 'object' || request.body === null || (request.body as Record<string, unknown>).confirm !== 'DISCONNECT') {
      return { status: 400, body: { error: 'Confirmation required. Send { confirm: "DISCONNECT" } in the request body.' } };
    }

    const ownerEmail = request.session?.adminUser?.email;
    const result = await this.accountsService.disconnectAccountAsync(accountId, ownerEmail);

    if (!result.disconnected) {
      return { status: 404, body: { error: 'Account not found.' } };
    }

    return { status: 200, body: { disconnected: result.disconnected } };
  }

  async deleteAccount(
    request: AccountsRequest,
  ): Promise<AccountsControllerResponse<{ error?: string; deleted?: boolean; removedChannels?: number }>> {
    const guardResult = this.sessionGuard.check(request);

    if (!guardResult.allowed) {
      return { status: 401, body: { error: guardResult.reason } };
    }

    const accountId = request.params?.accountId;
    if (!accountId) {
      return { status: 400, body: { error: 'Missing accountId parameter.' } };
    }

    if (typeof request.body !== 'object' || request.body === null || (request.body as Record<string, unknown>).confirm !== 'DELETE') {
      return { status: 400, body: { error: 'Confirmation required. Send { confirm: "DELETE" } in the request body.' } };
    }

    const ownerEmail = request.session?.adminUser?.email;
    const account = await this.accountsService.getAccount(accountId, ownerEmail);
    if (!account) {
      return { status: 404, body: { error: 'Account not found.' } };
    }

    try {
      const result = await this.accountsService.deleteAccountAsync(accountId, ownerEmail);
      return { status: 200, body: { deleted: result.deleted, removedChannels: result.removedChannels } };
    } catch (error) {
      if (error instanceof AccountDeletionBlockedError) {
        return { status: 409, body: { error: error.message } };
      }

      const message = error instanceof Error ? error.message : 'Unable to delete account.';
      return { status: 500, body: { error: message } };
    }
  }
}

function buildChannelSyncSummary(channelCount: number): ChannelSyncSummary {
  if (channelCount > 0) {
    return {
      channelCount,
      message: `Found ${channelCount} YouTube channel${channelCount === 1 ? '' : 's'} for this Google account.`,
    };
  }

  return {
    channelCount: 0,
    message: 'No YouTube channels were returned. If you use Brand Accounts, sign in with the Google profile that owns them and try Sync channels again.',
  };
}
