import { SessionGuard, type SessionRequestLike } from '../auth/session.guard';
import { GoogleOauthConfigurationError } from '../integrations/google/google-oauth.service';
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

/**
 * Browser-safe representation of a connected account.
 *
 * Keep this as an explicit allowlist. Persistence-only fields such as ownerEmail,
 * provider subjects, scopes and encrypted OAuth tokens must never cross the API
 * boundary into the browser.
 */
export interface PublicConnectedAccount {
  id: string;
  provider: string;
  email?: string;
  displayName?: string;
  tokenExpiresAt: string | null;
  status: ConnectedAccountRecord['status'];
  connectedAt: string;
  updatedAt: string;
}

export function toPublicConnectedAccount(account: ConnectedAccountRecord): PublicConnectedAccount {
  return {
    id: account.id,
    provider: account.provider,
    ...(account.email ? { email: maskEmailAddress(account.email) } : {}),
    ...(account.displayName ? { displayName: account.displayName } : {}),
    tokenExpiresAt: account.tokenExpiresAt,
    status: account.status,
    connectedAt: account.connectedAt,
    updatedAt: account.updatedAt,
  };
}

export class AccountsController {
  constructor(
    private readonly accountsService: AccountsService,
    private readonly sessionGuard: SessionGuard,
  ) {}

  async listAccounts(
    request: SessionRequestLike,
  ): Promise<AccountsControllerResponse<{ accounts?: PublicConnectedAccount[]; error?: string }>> {
    const guardResult = this.sessionGuard.check(request);
    if (!guardResult.allowed) {
      return { status: guardResult.status, body: { error: guardResult.reason } };
    }

    const ownerEmail = request.session?.adminUser?.email;
    const accounts = await this.accountsService.listAccounts(ownerEmail);
    return { status: 200, body: { accounts: accounts.map(toPublicConnectedAccount) } };
  }

  async getAccount(
    request: AccountsRequest,
  ): Promise<AccountsControllerResponse<{ account?: PublicConnectedAccount; error?: string }>> {
    const guardResult = this.sessionGuard.check(request);
    if (!guardResult.allowed) {
      return { status: guardResult.status, body: { error: guardResult.reason } };
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

    return { status: 200, body: { account: toPublicConnectedAccount(account) } };
  }

  async startGoogleOauth(request: SessionRequestLike): Promise<AccountsControllerResponse<{ error?: string; redirectUrl?: string }>> {
    return this.startOauthForProvider('google', request);
  }

  async startTikTokOauth(request: SessionRequestLike): Promise<AccountsControllerResponse<{ error?: string; redirectUrl?: string }>> {
    return this.startOauthForProvider('tiktok', request);
  }

  async startInstagramOauth(request: SessionRequestLike): Promise<AccountsControllerResponse<{ error?: string; redirectUrl?: string }>> {
    return this.startOauthForProvider('instagram', request);
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
      const label = getProviderLabel(provider);
      const message = error instanceof Error ? error.message : `${label} OAuth start failed.`;
      return {
        status: error instanceof GoogleOauthConfigurationError ? 503 : 500,
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
  ): Promise<AccountsControllerResponse<{ error?: string; account?: PublicConnectedAccount; sync?: ChannelSyncSummary }>> {
    return this.handleOauthCallbackForProvider('google', request);
  }

  async handleTikTokOauthCallback(
    request: AccountsRequest,
  ): Promise<AccountsControllerResponse<{ error?: string; account?: PublicConnectedAccount; sync?: ChannelSyncSummary }>> {
    return this.handleOauthCallbackForProvider('tiktok', request);
  }

  async handleInstagramOauthCallback(
    request: AccountsRequest,
  ): Promise<AccountsControllerResponse<{ error?: string; account?: PublicConnectedAccount; sync?: ChannelSyncSummary }>> {
    return this.handleOauthCallbackForProvider('instagram', request);
  }

  private async handleOauthCallbackForProvider(
    provider: SupportedOauthProvider,
    request: AccountsRequest,
  ): Promise<AccountsControllerResponse<{ error?: string; account?: PublicConnectedAccount; sync?: ChannelSyncSummary }>> {
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
      const label = getProviderLabel(provider);
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
        account: toPublicConnectedAccount(result.account),
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

  async getYouTubePlaylists(
    request: AccountsRequest,
  ): Promise<AccountsControllerResponse<{ error?: string; playlists?: Array<{ id: string; title: string; itemCount: number; privacyStatus: string | null }> }>> {
    const guardResult = this.sessionGuard.check(request);
    if (!guardResult.allowed) return { status: 401, body: { error: guardResult.reason } };
    const channelId = request.params?.channelId;
    if (!channelId) return { status: 400, body: { error: 'Missing channelId parameter.' } };
    try {
      const playlists = await this.accountsService.listYouTubePlaylists(channelId, request.session?.adminUser?.email);
      if (!playlists) return { status: 404, body: { error: 'Channel not found.' } };
      return { status: 200, body: { playlists } };
    } catch (error) {
      return { status: 502, body: { error: error instanceof Error ? error.message : 'Could not list YouTube playlists.' } };
    }
  }

  async handleYouTubeOauthCallback(
    request: AccountsRequest,
  ): Promise<AccountsControllerResponse<{ error?: string; account?: PublicConnectedAccount; sync?: ChannelSyncSummary }>> {
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

function getProviderLabel(provider: SupportedOauthProvider): string {
  switch (provider) {
    case 'youtube':
      return 'YouTube';
    case 'tiktok':
      return 'TikTok';
    case 'instagram':
      return 'Instagram';
    case 'google':
    default:
      return 'Google';
  }
}

function maskEmailAddress(email: string): string {
  const normalized = email.trim();
  const atIndex = normalized.lastIndexOf('@');
  if (atIndex <= 0 || atIndex === normalized.length - 1) {
    return '***';
  }

  const local = normalized.slice(0, atIndex);
  const domain = normalized.slice(atIndex + 1);
  const visibleLength = local.length <= 2 ? 1 : 2;
  return `${local.slice(0, visibleLength)}***@${domain}`;
}
