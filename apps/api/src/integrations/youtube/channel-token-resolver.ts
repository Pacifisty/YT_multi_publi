import type { ConnectedAccountRecord } from '../../accounts/accounts.service';

export interface ChannelTokenResolutionOptions {
  requirePlaylistWriteScope?: boolean;
}

export interface ChannelTokenResolver {
  resolve(channelId: string, options?: ChannelTokenResolutionOptions): Promise<{ accessToken: string }>;
}

export type ChannelTokenResolverErrorCode = 'CHANNEL_NOT_FOUND' | 'REAUTH_REQUIRED';

export class ChannelTokenResolverError extends Error {
  readonly code: ChannelTokenResolverErrorCode;
  readonly channelId: string;
  readonly accountId?: string;

  constructor(
    code: ChannelTokenResolverErrorCode,
    options: {
      channelId: string;
      accountId?: string;
    },
  ) {
    super(
      code === 'REAUTH_REQUIRED'
        ? `Account ${options.accountId ?? 'unknown'} requires reauthorization`
        : `No connected account found for channel ${options.channelId}`,
    );
    this.name = 'ChannelTokenResolverError';
    this.code = code;
    this.channelId = options.channelId;
    this.accountId = options.accountId;
  }
}

export function isChannelTokenResolverError(error: unknown): error is ChannelTokenResolverError {
  return error instanceof ChannelTokenResolverError;
}

export interface InMemoryChannelTokenResolverOptions {
  getAccountForChannel: (channelId: string) => Promise<ConnectedAccountRecord | null>;
  decryptToken: (encryptedToken: string) => string;
}

export class InMemoryChannelTokenResolver implements ChannelTokenResolver {
  private readonly getAccountForChannel: (channelId: string) => Promise<ConnectedAccountRecord | null>;
  private readonly decryptToken: (encryptedToken: string) => string;

  constructor(options: InMemoryChannelTokenResolverOptions) {
    this.getAccountForChannel = options.getAccountForChannel;
    this.decryptToken = options.decryptToken;
  }

  async resolve(channelId: string, _options?: ChannelTokenResolutionOptions): Promise<{ accessToken: string }> {
    const account = await this.getAccountForChannel(channelId);

    if (!account) {
      throw new ChannelTokenResolverError('CHANNEL_NOT_FOUND', { channelId });
    }

    if (account.status === 'reauth_required') {
      throw new ChannelTokenResolverError('REAUTH_REQUIRED', {
        channelId,
        accountId: account.id,
      });
    }

    const accessToken = this.decryptToken(account.accessTokenEnc);
    return { accessToken };
  }
}
