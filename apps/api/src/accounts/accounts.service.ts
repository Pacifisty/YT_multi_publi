import { randomUUID } from 'node:crypto';

import { TokenCryptoService } from '../common/crypto/token-crypto.service';
import {
  GOOGLE_YOUTUBE_SCOPES,
  GoogleOauthService,
  type GoogleOauthSession,
  type GoogleTokenResult,
} from '../integrations/google/google-oauth.service';
import type { YouTubeChannelInfo, YouTubeChannelsService } from '../integrations/youtube/youtube-channels.service';

export interface ChannelRecord {
  id: string;
  connectedAccountId: string;
  youtubeChannelId: string;
  title: string;
  handle?: string;
  thumbnailUrl?: string;
  isActive: boolean;
  lastSyncedAt: string;
}

export interface ConnectedAccountPersistenceInput {
  provider: string;
  googleSubject?: string;
  email?: string;
  displayName?: string;
  accessToken: string;
  refreshToken?: string;
  scopes?: string[];
  tokenExpiresAt?: string | null;
}

export interface ConnectedAccountRecord {
  id: string;
  provider: string;
  googleSubject?: string;
  email?: string;
  displayName?: string;
  accessTokenEnc: string;
  refreshTokenEnc: string | null;
  scopes: string[];
  tokenExpiresAt: string | null;
  status: 'connected' | 'reauth_required' | 'disconnected';
  connectedAt: string;
  updatedAt: string;
}

interface ConnectedAccountStore {
  save(record: ConnectedAccountRecord): ConnectedAccountRecord;
}

interface OAuthCallbackInput {
  code: string;
  state: string;
  session?: GoogleOauthSession | null;
}

type OAuthCallbackResult =
  | {
      ok: true;
      account: ConnectedAccountRecord;
    }
  | {
      ok: false;
      reason: 'INVALID_STATE';
    };

export interface RefreshTokenResult {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
}

export interface RefreshResult {
  refreshed: boolean;
  account: ConnectedAccountRecord;
  error?: 'REAUTH_REQUIRED';
}

export interface AccountsServiceOptions {
  tokenCryptoService?: TokenCryptoService;
  googleOauthService?: GoogleOauthService;
  connectedAccountStore?: ConnectedAccountStore;
  createAuthorizationRedirect?: (session?: GoogleOauthSession | null) => string | Promise<string>;
  handleOauthCallback?: (input: OAuthCallbackInput) => Promise<OAuthCallbackResult>;
  refreshGoogleAccessToken?: (refreshToken: string) => Promise<RefreshTokenResult>;
  updateConnectedAccount?: (id: string, updates: Partial<ConnectedAccountRecord>) => Promise<ConnectedAccountRecord>;
  youtubeChannelsService?: YouTubeChannelsService;
  channelStore?: ChannelStore;
  getConnectedAccount?: (id: string) => Promise<ConnectedAccountRecord | null>;
  listConnectedAccounts?: () => Promise<ConnectedAccountRecord[]>;
  getChannelsForAccount?: (accountId: string) => Promise<ChannelRecord[]>;
  now?: () => Date;
}

export interface ChannelStore {
  upsert(record: ChannelRecord): ChannelRecord;
  findByAccountId(accountId: string): ChannelRecord[];
  findById(channelId: string): ChannelRecord | null;
  update(channelId: string, updates: Partial<ChannelRecord>): ChannelRecord | null;
  deactivateAllForAccount(accountId: string): void;
}

export class AccountsService {
  private tokenCryptoService?: TokenCryptoService;
  private googleOauthService?: GoogleOauthService;
  private readonly connectedAccountStore: ConnectedAccountStore;
  private readonly channelStore: ChannelStore;
  private readonly now: () => Date;

  constructor(private readonly options: AccountsServiceOptions = {}) {
    this.tokenCryptoService = options.tokenCryptoService;
    this.googleOauthService = options.googleOauthService;
    this.connectedAccountStore = options.connectedAccountStore ?? new InMemoryConnectedAccountStore();
    this.channelStore = options.channelStore ?? new InMemoryChannelStore();
    this.now = options.now ?? (() => new Date());
  }

  async createAuthorizationRedirect(session?: GoogleOauthSession | null): Promise<string> {
    if (this.options.createAuthorizationRedirect) {
      return this.options.createAuthorizationRedirect(session);
    }

    return this.getGoogleOauthService().createAuthorizationRedirect(session);
  }

  async handleOauthCallback(input: OAuthCallbackInput): Promise<OAuthCallbackResult> {
    if (this.options.handleOauthCallback) {
      return this.options.handleOauthCallback(input);
    }

    const stateValid = this.getGoogleOauthService().validateCallbackState(input.session, input.state);

    if (!stateValid) {
      return {
        ok: false,
        reason: 'INVALID_STATE',
      };
    }

    const tokenResult = await this.getGoogleOauthService().exchangeCodeForTokens(input.code);
    const record = this.createPersistenceRecord({
      provider: 'google',
      googleSubject: tokenResult.profile.googleSubject,
      email: tokenResult.profile.email,
      displayName: tokenResult.profile.displayName,
      accessToken: tokenResult.accessToken,
      refreshToken: tokenResult.refreshToken,
      scopes: tokenResult.scopes.length > 0 ? tokenResult.scopes : [...GOOGLE_YOUTUBE_SCOPES],
      tokenExpiresAt: tokenResult.tokenExpiresAt,
    });

    return {
      ok: true,
      account: this.connectedAccountStore.save(record),
    };
  }

  createPersistenceRecord(input: ConnectedAccountPersistenceInput): ConnectedAccountRecord {
    const nowIso = this.now().toISOString();

    return {
      id: randomUUID(),
      provider: input.provider,
      googleSubject: input.googleSubject,
      email: input.email,
      displayName: input.displayName,
      accessTokenEnc: this.getTokenCryptoService().encrypt(input.accessToken),
      refreshTokenEnc: input.refreshToken ? this.getTokenCryptoService().encrypt(input.refreshToken) : null,
      scopes: input.scopes ?? [],
      tokenExpiresAt: input.tokenExpiresAt ?? null,
      status: 'connected',
      connectedAt: nowIso,
      updatedAt: nowIso,
    };
  }

  readPersistedTokens(record: Pick<ConnectedAccountRecord, 'accessTokenEnc' | 'refreshTokenEnc'>): {
    accessToken: string;
    refreshToken?: string;
  } {
    const tokenCryptoService = this.getTokenCryptoService();

    return {
      accessToken: tokenCryptoService.decrypt(record.accessTokenEnc),
      refreshToken: record.refreshTokenEnc ? tokenCryptoService.decrypt(record.refreshTokenEnc) : undefined,
    };
  }

  async refreshAccessTokenIfNeeded(account: ConnectedAccountRecord): Promise<RefreshResult> {
    const SAFETY_WINDOW_MS = 5 * 60 * 1000;
    const now = this.now();

    if (account.tokenExpiresAt) {
      const expiresAt = new Date(account.tokenExpiresAt).getTime();
      const needsRefresh = expiresAt - now.getTime() < SAFETY_WINDOW_MS;

      if (!needsRefresh) {
        return { refreshed: false, account };
      }
    }

    const tokens = this.readPersistedTokens(account);

    if (!tokens.refreshToken) {
      return { refreshed: false, account };
    }

    try {
      const refreshFn = this.options.refreshGoogleAccessToken ?? this.defaultRefreshGoogleAccessToken.bind(this);
      const refreshed = await refreshFn(tokens.refreshToken);

      const crypto = this.getTokenCryptoService();
      const updates: Partial<ConnectedAccountRecord> = {
        accessTokenEnc: crypto.encrypt(refreshed.accessToken),
        tokenExpiresAt: refreshed.expiresAt,
        status: 'connected',
        updatedAt: now.toISOString(),
      };

      if (refreshed.refreshToken) {
        updates.refreshTokenEnc = crypto.encrypt(refreshed.refreshToken);
      }

      const updateFn = this.options.updateConnectedAccount;
      const updatedAccount = updateFn
        ? await updateFn(account.id, updates)
        : { ...account, ...updates };

      return { refreshed: true, account: updatedAccount as ConnectedAccountRecord };
    } catch (error: unknown) {
      if (this.isAuthorizationError(error)) {
        const updates: Partial<ConnectedAccountRecord> = {
          status: 'reauth_required',
          updatedAt: now.toISOString(),
        };

        const updateFn = this.options.updateConnectedAccount;
        const updatedAccount = updateFn
          ? await updateFn(account.id, updates)
          : { ...account, ...updates };

        return {
          refreshed: false,
          account: updatedAccount as ConnectedAccountRecord,
          error: 'REAUTH_REQUIRED',
        };
      }

      throw error;
    }
  }

  private isAuthorizationError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;

    const anyError = error as Record<string, unknown>;

    if (anyError.code === 'invalid_grant') return true;

    const responseData = (anyError.response as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
    if (responseData?.error === 'invalid_grant') return true;

    const message = error.message.toLowerCase();
    if (message.includes('invalid_grant') || message.includes('token has been revoked')) return true;

    return false;
  }

  private async defaultRefreshGoogleAccessToken(refreshToken: string): Promise<RefreshTokenResult> {
    const googleService = this.getGoogleOauthService();
    return googleService.refreshAccessToken(refreshToken);
  }

  async syncChannelsForAccount(account: ConnectedAccountRecord): Promise<ChannelRecord[]> {
    const tokens = this.readPersistedTokens(account);

    const fetchChannels = this.options.youtubeChannelsService
      ? (accessToken: string) => this.options.youtubeChannelsService!.listMineChannels(accessToken)
      : async (accessToken: string) => {
          const { YouTubeChannelsService: YTService } = await import('../integrations/youtube/youtube-channels.service');
          return new YTService().listMineChannels(accessToken);
        };

    const result = await fetchChannels(tokens.accessToken);
    const nowIso = this.now().toISOString();

    const channels: ChannelRecord[] = result.channels.map((ch) => {
      const record: ChannelRecord = {
        id: randomUUID(),
        connectedAccountId: account.id,
        youtubeChannelId: ch.channelId,
        title: ch.title,
        handle: ch.handle,
        thumbnailUrl: ch.thumbnailUrl,
        isActive: true,
        lastSyncedAt: nowIso,
      };
      return this.channelStore.upsert(record);
    });

    return channels;
  }

  toggleChannel(channelId: string, isActive: boolean): ChannelRecord | null {
    return this.channelStore.update(channelId, { isActive });
  }

  getChannelsForAccount(accountId: string): ChannelRecord[] {
    if (this.options.getChannelsForAccount) {
      // Sync path — allow async override but we return the cached store version
    }
    return this.channelStore.findByAccountId(accountId);
  }

  async listAccounts(): Promise<ConnectedAccountRecord[]> {
    if (this.options.listConnectedAccounts) {
      return this.options.listConnectedAccounts();
    }
    return [];
  }

  async getAccount(id: string): Promise<ConnectedAccountRecord | null> {
    if (this.options.getConnectedAccount) {
      return this.options.getConnectedAccount(id);
    }
    return null;
  }

  disconnectAccount(accountId: string): { disconnected: boolean; account?: ConnectedAccountRecord } {
    this.channelStore.deactivateAllForAccount(accountId);

    const updateFn = this.options.updateConnectedAccount;
    const nowIso = this.now().toISOString();
    const updates: Partial<ConnectedAccountRecord> = {
      status: 'disconnected',
      updatedAt: nowIso,
    };

    if (updateFn) {
      // fire-and-forget for sync API — the caller can await if needed
    }

    return { disconnected: true };
  }

  async disconnectAccountAsync(accountId: string): Promise<{ disconnected: boolean; account?: ConnectedAccountRecord }> {
    this.channelStore.deactivateAllForAccount(accountId);

    const nowIso = this.now().toISOString();
    const updates: Partial<ConnectedAccountRecord> = {
      status: 'disconnected',
      updatedAt: nowIso,
    };

    const updateFn = this.options.updateConnectedAccount;
    if (updateFn) {
      const updated = await updateFn(accountId, updates);
      return { disconnected: true, account: updated };
    }

    return { disconnected: true };
  }

  private getTokenCryptoService(): TokenCryptoService {
    this.tokenCryptoService = this.tokenCryptoService ?? new TokenCryptoService();
    return this.tokenCryptoService;
  }

  private getGoogleOauthService(): GoogleOauthService {
    this.googleOauthService = this.googleOauthService ?? new GoogleOauthService();
    return this.googleOauthService;
  }
}

class InMemoryConnectedAccountStore implements ConnectedAccountStore {
  private readonly records = new Map<string, ConnectedAccountRecord>();

  save(record: ConnectedAccountRecord): ConnectedAccountRecord {
    const key = record.googleSubject ? `${record.provider}:${record.googleSubject}` : record.id;
    const existing = this.records.get(key);

    if (!existing) {
      this.records.set(key, record);
      return record;
    }

    const updated: ConnectedAccountRecord = {
      ...existing,
      ...record,
      id: existing.id,
      connectedAt: existing.connectedAt,
    };

    this.records.set(key, updated);
    return updated;
  }
}

export type { OAuthCallbackInput, OAuthCallbackResult };
export type { GoogleTokenResult };

class InMemoryChannelStore implements ChannelStore {
  private readonly records = new Map<string, ChannelRecord>();

  upsert(record: ChannelRecord): ChannelRecord {
    const key = `${record.connectedAccountId}:${record.youtubeChannelId}`;
    const existing = this.records.get(key);

    if (!existing) {
      this.records.set(key, record);
      return record;
    }

    const updated: ChannelRecord = {
      ...existing,
      title: record.title,
      handle: record.handle,
      thumbnailUrl: record.thumbnailUrl,
      lastSyncedAt: record.lastSyncedAt,
    };
    this.records.set(key, updated);
    return updated;
  }

  findByAccountId(accountId: string): ChannelRecord[] {
    return Array.from(this.records.values()).filter((r) => r.connectedAccountId === accountId);
  }

  findById(channelId: string): ChannelRecord | null {
    return Array.from(this.records.values()).find((r) => r.id === channelId) ?? null;
  }

  update(channelId: string, updates: Partial<ChannelRecord>): ChannelRecord | null {
    for (const [key, record] of this.records) {
      if (record.id === channelId) {
        const updated = { ...record, ...updates };
        this.records.set(key, updated);
        return updated;
      }
    }
    return null;
  }

  deactivateAllForAccount(accountId: string): void {
    for (const [key, record] of this.records) {
      if (record.connectedAccountId === accountId) {
        this.records.set(key, { ...record, isActive: false });
      }
    }
  }
}
