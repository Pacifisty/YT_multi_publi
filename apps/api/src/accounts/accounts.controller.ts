import { SessionGuard, type SessionRequestLike } from '../auth/session.guard';
import type { ConnectedAccountRecord, ChannelRecord } from './accounts.service';
import { AccountsService } from './accounts.service';
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

    const accounts = await this.accountsService.listAccounts();
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
      const redirectUrl = await this.accountsService.createAuthorizationRedirect(request.session);

      return {
        status: 200,
        body: {
          redirectUrl,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Google OAuth start failed.';
      return {
        status: 500,
        body: {
          error: message,
        },
      };
    }
  }

  async startYouTubeOauth(request: SessionRequestLike): Promise<AccountsControllerResponse<{ error?: string; redirectUrl?: string }>> {
    return this.startGoogleOauth(request);
  }

  async handleGoogleOauthCallback(
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
      result = await this.accountsService.handleOauthCallback({
        code,
        state,
        session: request.session,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Google OAuth callback failed.';
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
    try {
      const channels = await this.accountsService.syncChannelsForAccount(result.account);
      syncSummary = buildChannelSyncSummary(channels.length);
    } catch {
      // Keep the OAuth connection successful even if channel sync fails.
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

    const channels = await this.accountsService.getChannelsForAccount(accountId);
    return { status: 200, body: { channels } };
  }

  async handleYouTubeOauthCallback(
    request: AccountsRequest,
  ): Promise<AccountsControllerResponse<{ error?: string; account?: ConnectedAccountRecord; sync?: ChannelSyncSummary }>> {
    return this.handleGoogleOauthCallback(request);
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

    const account = await this.accountsService.getAccount(accountId);
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

    const channel = await this.accountsService.toggleChannel(channelId, request.body.isActive);

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

    const result = await this.accountsService.disconnectAccountAsync(accountId);

    return { status: 200, body: { disconnected: result.disconnected } };
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
