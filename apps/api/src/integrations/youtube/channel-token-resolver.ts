import type { ConnectedAccountRecord } from '../../accounts/accounts.service';

export interface ChannelTokenResolver {
  resolve(channelId: string): Promise<{ accessToken: string }>;
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

  async resolve(channelId: string): Promise<{ accessToken: string }> {
    const account = await this.getAccountForChannel(channelId);

    if (!account) {
      throw new Error(`No connected account found for channel ${channelId}`);
    }

    if (account.status === 'reauth_required') {
      throw new Error(`Account ${account.id} requires reauthorization`);
    }

    const accessToken = this.decryptToken(account.accessTokenEnc);
    return { accessToken };
  }
}
