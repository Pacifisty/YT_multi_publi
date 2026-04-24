import { randomUUID } from 'node:crypto';

import { TokenCryptoService } from '../common/crypto/token-crypto.service';
import {
  GOOGLE_YOUTUBE_SCOPES,
  GoogleOauthService,
  hasYouTubePlaylistWriteScope,
  type GoogleOauthSession,
  type GoogleTokenResult,
} from '../integrations/google/google-oauth.service';
import type { TikTokOauthSession, TikTokTokenResult } from '../integrations/tiktok/tiktok-oauth.service';
import { TikTokOauthService } from '../integrations/tiktok/tiktok-oauth.service';
import {
  ChannelTokenResolverError,
  type ChannelTokenResolutionOptions,
} from '../integrations/youtube/channel-token-resolver';
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
  ownerEmail?: string;
  provider: string;
  googleSubject?: string;
  providerSubject?: string;
  email?: string;
  displayName?: string;
  accessToken: string;
  refreshToken?: string;
  scopes?: string[];
  tokenExpiresAt?: string | null;
}

export interface ConnectedAccountRecord {
  id: string;
  ownerEmail?: string | null;
  provider: string;
  googleSubject?: string;
  providerSubject?: string;
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
  findAll(): ConnectedAccountRecord[];
  findById(id: string): ConnectedAccountRecord | null;
  delete(id: string): boolean;
}

interface OAuthCallbackInput {
  code: string;
  state: string;
  session?: Record<string, unknown> | null;
}

export type SupportedOauthProvider = 'google' | 'youtube' | 'tiktok';

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
  tikTokOauthService?: TikTokOauthService;
  connectedAccountStore?: ConnectedAccountStore;
  createConnectedAccount?: (record: ConnectedAccountRecord) => Promise<ConnectedAccountRecord>;
  createAuthorizationRedirect?: (session?: GoogleOauthSession | null) => string | Promise<string>;
  handleOauthCallback?: (input: OAuthCallbackInput) => Promise<OAuthCallbackResult>;
  refreshGoogleAccessToken?: (refreshToken: string) => Promise<RefreshTokenResult>;
  refreshTikTokAccessToken?: (refreshToken: string) => Promise<RefreshTokenResult>;
  updateConnectedAccount?: (id: string, updates: Partial<ConnectedAccountRecord>) => Promise<ConnectedAccountRecord>;
  deleteConnectedAccount?: (id: string) => Promise<boolean>;
  youtubeChannelsService?: YouTubeChannelsService;
  channelStore?: ChannelStore;
  getConnectedAccount?: (id: string) => Promise<ConnectedAccountRecord | null>;
  listConnectedAccounts?: () => Promise<ConnectedAccountRecord[]>;
  getChannelsForAccount?: (accountId: string) => Promise<ChannelRecord[]>;
  now?: () => Date;
}

export interface ChannelStore {
  upsert(record: ChannelRecord): Promise<ChannelRecord>;
  findByAccountId(accountId: string): Promise<ChannelRecord[]>;
  findById(channelId: string): Promise<ChannelRecord | null>;
  update(channelId: string, updates: Partial<ChannelRecord>): Promise<ChannelRecord | null>;
  delete(channelId: string): Promise<boolean>;
  deactivateAllForAccount(accountId: string): Promise<void>;
}

export class AccountDeletionBlockedError extends Error {
  constructor(message = 'This account cannot be deleted because one or more channels are already used in campaigns.') {
    super(message);
    this.name = 'AccountDeletionBlockedError';
  }
}

function normalizeOwnerEmail(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : null;
}

function filterAccountsByOwner(accounts: ConnectedAccountRecord[], ownerEmail?: string): ConnectedAccountRecord[] {
  const normalizedOwnerEmail = normalizeOwnerEmail(ownerEmail);
  if (!normalizedOwnerEmail) {
    return accounts;
  }

  const hasOwnedAccounts = accounts.some((account) => normalizeOwnerEmail(account.ownerEmail) !== null);
  if (!hasOwnedAccounts) {
    return accounts;
  }

  return accounts.filter((account) => normalizeOwnerEmail(account.ownerEmail) === normalizedOwnerEmail);
}

export class AccountsService {
  private static readonly OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

  private tokenCryptoService?: TokenCryptoService;
  private googleOauthService?: GoogleOauthService;
  private tikTokOauthService?: TikTokOauthService;
  private readonly connectedAccountStore: ConnectedAccountStore;
  private readonly channelStore: ChannelStore;
  private readonly now: () => Date;
  private readonly oauthStateStore = new Map<string, { createdAtMs: number; adminEmail?: string }>();

  constructor(private readonly options: AccountsServiceOptions = {}) {
    this.tokenCryptoService = options.tokenCryptoService;
    this.googleOauthService = options.googleOauthService;
    this.tikTokOauthService = options.tikTokOauthService;
    this.connectedAccountStore = options.connectedAccountStore ?? new InMemoryConnectedAccountStore();
    this.channelStore = options.channelStore ?? new InMemoryChannelStore();
    this.now = options.now ?? (() => new Date());
  }

  async createAuthorizationRedirect(session?: GoogleOauthSession | null): Promise<string> {
    return this.createAuthorizationRedirectForProvider('google', session);
  }

  async createAuthorizationRedirectForProvider(
    provider: SupportedOauthProvider,
    session?: Record<string, unknown> | null,
  ): Promise<string> {
    if (provider === 'tiktok') {
      const redirectUrl = await this.getTikTokOauthService().createAuthorizationRedirect(session as TikTokOauthSession | null | undefined);
      const state = extractStateFromAuthorizationRedirect(redirectUrl);
      if (state) {
        this.rememberOauthState(
          state,
          (session as { adminUser?: { email?: string } } | null | undefined)?.adminUser?.email,
        );
      }
      return redirectUrl;
    }

    const redirectUrl = this.options.createAuthorizationRedirect
      ? await this.options.createAuthorizationRedirect(session)
      : await this.getGoogleOauthService().createAuthorizationRedirect(session as GoogleOauthSession | null | undefined);

    const state = extractStateFromAuthorizationRedirect(redirectUrl);
    if (state) {
      this.rememberOauthState(state, (session as { adminUser?: { email?: string } } | null | undefined)?.adminUser?.email);
    }

    return redirectUrl;
  }

  async handleOauthCallback(input: OAuthCallbackInput): Promise<OAuthCallbackResult> {
    return this.handleOauthCallbackForProvider('google', input);
  }

  async handleOauthCallbackForProvider(
    provider: SupportedOauthProvider,
    input: OAuthCallbackInput,
  ): Promise<OAuthCallbackResult> {
    if (this.options.handleOauthCallback) {
      return this.options.handleOauthCallback(input);
    }

    const adminEmail = (input.session as { adminUser?: { email?: string } } | null | undefined)?.adminUser?.email;
    const canonicalProvider = provider === 'youtube' ? 'google' : provider;
    const sessionStateValid = this.validateProviderCallbackState(canonicalProvider, input.session, input.state);
    const storedStateValid = this.consumeOauthState(input.state, adminEmail);
    const stateValid = sessionStateValid || storedStateValid;

    if (!stateValid) {
      return {
        ok: false,
        reason: 'INVALID_STATE',
      };
    }

    const tokenResult = await this.exchangeProviderCode(canonicalProvider, input.code);
    const record = this.createPersistenceRecord({
      ownerEmail: adminEmail,
      provider: canonicalProvider,
      googleSubject: tokenResult.profile.providerSubject ?? tokenResult.profile.googleSubject,
      providerSubject: tokenResult.profile.providerSubject ?? tokenResult.profile.googleSubject,
      email: tokenResult.profile.email,
      displayName: tokenResult.profile.displayName,
      accessToken: tokenResult.accessToken,
      refreshToken: tokenResult.refreshToken,
      scopes: tokenResult.scopes.length > 0 ? tokenResult.scopes : [...GOOGLE_YOUTUBE_SCOPES],
      tokenExpiresAt: tokenResult.tokenExpiresAt,
    });
    const persistedAccount = this.options.createConnectedAccount
      ? await this.options.createConnectedAccount(record)
      : this.connectedAccountStore.save(record);

    return {
      ok: true,
      account: persistedAccount,
    };
  }

  createPersistenceRecord(input: ConnectedAccountPersistenceInput): ConnectedAccountRecord {
    const nowIso = this.now().toISOString();

    return {
      id: randomUUID(),
      ownerEmail: normalizeOwnerEmail(input.ownerEmail),
      provider: input.provider,
      googleSubject: input.providerSubject ?? input.googleSubject,
      providerSubject: input.providerSubject ?? input.googleSubject,
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
      const refreshFn = this.getRefreshFnForProvider(account.provider);
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

    const anyError = error as unknown as Record<string, unknown>;

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

  private async defaultRefreshTikTokAccessToken(refreshToken: string): Promise<RefreshTokenResult> {
    const tiktokService = this.getTikTokOauthService();
    const refreshed = await tiktokService.refreshAccessToken(refreshToken);
    return {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      expiresAt: refreshed.tokenExpiresAt ?? this.now().toISOString(),
    };
  }

  private getRefreshFnForProvider(provider: string): (refreshToken: string) => Promise<RefreshTokenResult> {
    if (provider === 'tiktok') {
      return this.options.refreshTikTokAccessToken ?? this.defaultRefreshTikTokAccessToken.bind(this);
    }

    return this.options.refreshGoogleAccessToken ?? this.defaultRefreshGoogleAccessToken.bind(this);
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

    const channels: ChannelRecord[] = await Promise.all(result.channels.map((ch) => {
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
    }));

    return channels;
  }

  async toggleChannel(channelId: string, isActive: boolean, ownerEmail?: string): Promise<ChannelRecord | null> {
    if (ownerEmail) {
      const channel = await this.channelStore.findById(channelId);
      if (!channel) {
        return null;
      }

      const account = await this.getAccount(channel.connectedAccountId, ownerEmail);
      if (!account) {
        return null;
      }
    }

    return this.channelStore.update(channelId, { isActive });
  }

  async getChannelsForAccount(accountId: string): Promise<ChannelRecord[]> {
    if (this.options.getChannelsForAccount) {
      // Sync path — allow async override but we return the cached store version
    }
    return this.channelStore.findByAccountId(accountId);
  }

  async getChannel(channelId: string): Promise<ChannelRecord | null> {
    return this.channelStore.findById(channelId);
  }

  async getAccountForChannel(channelId: string): Promise<ConnectedAccountRecord | null> {
    const channel = await this.channelStore.findById(channelId);
    if (!channel) {
      return null;
    }

    return this.getAccount(channel.connectedAccountId);
  }

  async resolveAccessTokenForChannel(channelId: string, options: ChannelTokenResolutionOptions = {}): Promise<string> {
    const channel = await this.getChannel(channelId);
    if (!channel) {
      throw new ChannelTokenResolverError('CHANNEL_NOT_FOUND', { channelId });
    }

    const account = await this.getAccount(channel.connectedAccountId);
    if (!account) {
      throw new ChannelTokenResolverError('CHANNEL_NOT_FOUND', { channelId });
    }

    const refreshResult = await this.refreshAccessTokenIfNeeded(account);
    if (refreshResult.error === 'REAUTH_REQUIRED') {
      throw new ChannelTokenResolverError('REAUTH_REQUIRED', {
        channelId,
        accountId: refreshResult.account.id,
      });
    }

    if (options.requirePlaylistWriteScope && !hasYouTubePlaylistWriteScope(refreshResult.account.scopes)) {
      throw new ChannelTokenResolverError('REAUTH_REQUIRED', {
        channelId,
        accountId: refreshResult.account.id,
      });
    }

    return this.readPersistedTokens(refreshResult.account).accessToken;
  }

  async listAccounts(ownerEmail?: string): Promise<ConnectedAccountRecord[]> {
    if (this.options.listConnectedAccounts) {
      const accounts = await this.options.listConnectedAccounts();
      return filterAccountsByOwner(accounts, ownerEmail);
    }
    return filterAccountsByOwner(this.connectedAccountStore.findAll(), ownerEmail);
  }

  async getAccount(id: string, ownerEmail?: string): Promise<ConnectedAccountRecord | null> {
    const normalizedOwnerEmail = normalizeOwnerEmail(ownerEmail);

    if (this.options.getConnectedAccount) {
      const account = await this.options.getConnectedAccount(id);
      if (!account) {
        return null;
      }

      if (normalizedOwnerEmail && normalizeOwnerEmail(account.ownerEmail) !== normalizedOwnerEmail) {
        const accounts = this.options.listConnectedAccounts
          ? await this.options.listConnectedAccounts()
          : [account];
        const hasOwnedAccounts = accounts.some((entry) => normalizeOwnerEmail(entry.ownerEmail) !== null);
        if (hasOwnedAccounts || normalizeOwnerEmail(account.ownerEmail) !== null) {
          return null;
        }
      }

      return account;
    }
    const account = this.connectedAccountStore.findById(id);
    if (!account) {
      return null;
    }

    if (normalizedOwnerEmail && normalizeOwnerEmail(account.ownerEmail) !== normalizedOwnerEmail) {
      const hasOwnedAccounts = this.connectedAccountStore.findAll().some((entry) => normalizeOwnerEmail(entry.ownerEmail) !== null);
      if (hasOwnedAccounts || normalizeOwnerEmail(account.ownerEmail) !== null) {
        return null;
      }
    }

    return account;
  }

  async resolveAccessTokenForConnectedAccount(accountId: string): Promise<string> {
    const account = await this.getAccount(accountId);
    if (!account) {
      throw new Error(`Connected account not found: ${accountId}`);
    }

    const refreshResult = await this.refreshAccessTokenIfNeeded(account);
    if (refreshResult.error === 'REAUTH_REQUIRED') {
      throw new Error('REAUTH_REQUIRED');
    }

    return this.readPersistedTokens(refreshResult.account).accessToken;
  }

  disconnectAccount(accountId: string): { disconnected: boolean; account?: ConnectedAccountRecord } {
    // Fire-and-forget — start async deactivation without awaiting
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

  async disconnectAccountAsync(accountId: string, ownerEmail?: string): Promise<{ disconnected: boolean; account?: ConnectedAccountRecord }> {
    const account = await this.getAccount(accountId, ownerEmail);
    if (!account) {
      return { disconnected: false };
    }

    await this.channelStore.deactivateAllForAccount(account.id);

    const nowIso = this.now().toISOString();
    const updates: Partial<ConnectedAccountRecord> = {
      status: 'disconnected',
      updatedAt: nowIso,
    };

    const updateFn = this.options.updateConnectedAccount;
    if (updateFn) {
      const updated = await updateFn(account.id, updates);
      return { disconnected: true, account: updated };
    }

    return { disconnected: true };
  }

  async deleteAccountAsync(accountId: string, ownerEmail?: string): Promise<{ deleted: boolean; removedChannels: number }> {
    const account = await this.getAccount(accountId, ownerEmail);
    if (!account) {
      return { deleted: false, removedChannels: 0 };
    }

    const channels = await this.channelStore.findByAccountId(account.id);
    let removedChannels = 0;

    for (const channel of channels) {
      try {
        const deleted = await this.channelStore.delete(channel.id);
        if (!deleted) {
          throw new Error(`Channel ${channel.id} could not be deleted.`);
        }
        removedChannels += 1;
      } catch (error) {
        if (this.isRelationConstraintError(error)) {
          throw new AccountDeletionBlockedError(
            'This account cannot be deleted because one or more of its channels are already used in campaigns. Remove those campaign targets first.',
          );
        }
        throw error;
      }
    }

    try {
      const deleted = this.options.deleteConnectedAccount
        ? await this.options.deleteConnectedAccount(account.id)
        : this.connectedAccountStore.delete(account.id);
      return { deleted, removedChannels };
    } catch (error) {
      if (this.isRelationConstraintError(error)) {
        throw new AccountDeletionBlockedError(
          'This account cannot be deleted because it is still referenced by other records in the workspace.',
        );
      }
      throw error;
    }
  }

  private getTokenCryptoService(): TokenCryptoService {
    this.tokenCryptoService = this.tokenCryptoService ?? new TokenCryptoService();
    return this.tokenCryptoService;
  }

  private getGoogleOauthService(): GoogleOauthService {
    this.googleOauthService = this.googleOauthService ?? new GoogleOauthService();
    return this.googleOauthService;
  }

  private getTikTokOauthService(): TikTokOauthService {
    this.tikTokOauthService = this.tikTokOauthService ?? new TikTokOauthService();
    return this.tikTokOauthService;
  }

  private validateProviderCallbackState(
    provider: 'google' | 'tiktok',
    session: OAuthCallbackInput['session'],
    state: string,
  ): boolean {
    if (provider === 'tiktok') {
      return this.getTikTokOauthService().validateCallbackState(
        session as TikTokOauthSession | null | undefined,
        state,
      );
    }

    return this.getGoogleOauthService().validateCallbackState(session, state);
  }

  private async exchangeProviderCode(
    provider: 'google' | 'tiktok',
    code: string,
  ): Promise<GoogleTokenResult | TikTokTokenResult> {
    if (provider === 'tiktok') {
      return this.getTikTokOauthService().exchangeCodeForTokens(code);
    }

    return this.getGoogleOauthService().exchangeCodeForTokens(code);
  }

  private rememberOauthState(state: string, adminEmail?: string): void {
    this.cleanupExpiredOauthStates();
    this.oauthStateStore.set(state, {
      createdAtMs: this.now().getTime(),
      adminEmail,
    });
  }

  private consumeOauthState(state: string, adminEmail?: string): boolean {
    this.cleanupExpiredOauthStates();
    const record = this.oauthStateStore.get(state);
    if (!record) {
      return false;
    }

    if (record.adminEmail && adminEmail && record.adminEmail !== adminEmail) {
      return false;
    }

    this.oauthStateStore.delete(state);
    return true;
  }

  private cleanupExpiredOauthStates(): void {
    const expiresBefore = this.now().getTime() - AccountsService.OAUTH_STATE_TTL_MS;
    for (const [state, record] of this.oauthStateStore.entries()) {
      if (record.createdAtMs < expiresBefore) {
        this.oauthStateStore.delete(state);
      }
    }
  }

  private isRelationConstraintError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;

    const anyError = error as unknown as Record<string, unknown>;
    if (anyError.code === 'P2003') return true;

    const message = error.message.toLowerCase();
    return (
      message.includes('foreign key') ||
      message.includes('constraint failed') ||
      message.includes('violates foreign key')
    );
  }
}

function extractStateFromAuthorizationRedirect(redirectUrl: string): string | null {
  try {
    const url = new URL(redirectUrl, 'http://localhost');
    const state = url.searchParams.get('state');
    return state && state.trim() ? state.trim() : null;
  } catch {
    return null;
  }
}

class InMemoryConnectedAccountStore implements ConnectedAccountStore {
  private readonly records = new Map<string, ConnectedAccountRecord>();

  save(record: ConnectedAccountRecord): ConnectedAccountRecord {
    const ownerKey = normalizeOwnerEmail(record.ownerEmail) ?? 'unowned';
    const key = record.googleSubject ? `${ownerKey}:${record.provider}:${record.googleSubject}` : record.id;
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

  findAll(): ConnectedAccountRecord[] {
    return Array.from(this.records.values()).sort((left, right) => {
      return right.connectedAt.localeCompare(left.connectedAt);
    });
  }

  findById(id: string): ConnectedAccountRecord | null {
    return this.findAll().find((record) => record.id === id) ?? null;
  }

  delete(id: string): boolean {
    for (const [key, record] of this.records.entries()) {
      if (record.id === id) {
        this.records.delete(key);
        return true;
      }
    }
    return false;
  }
}

export type { OAuthCallbackInput, OAuthCallbackResult };
export type { GoogleTokenResult };

class InMemoryChannelStore implements ChannelStore {
  private readonly records = new Map<string, ChannelRecord>();

  async upsert(record: ChannelRecord): Promise<ChannelRecord> {
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
      isActive: record.isActive,
      lastSyncedAt: record.lastSyncedAt,
    };
    this.records.set(key, updated);
    return updated;
  }

  async findByAccountId(accountId: string): Promise<ChannelRecord[]> {
    return Array.from(this.records.values()).filter((r) => r.connectedAccountId === accountId);
  }

  async findById(channelId: string): Promise<ChannelRecord | null> {
    return Array.from(this.records.values()).find((r) => r.id === channelId) ?? null;
  }

  async update(channelId: string, updates: Partial<ChannelRecord>): Promise<ChannelRecord | null> {
    for (const [key, record] of this.records) {
      if (record.id === channelId) {
        const updated = { ...record, ...updates };
        this.records.set(key, updated);
        return updated;
      }
    }
    return null;
  }

  async delete(channelId: string): Promise<boolean> {
    for (const [key, record] of this.records) {
      if (record.id === channelId) {
        this.records.delete(key);
        return true;
      }
    }
    return false;
  }

  async deactivateAllForAccount(accountId: string): Promise<void> {
    for (const [key, record] of this.records) {
      if (record.connectedAccountId === accountId) {
        this.records.set(key, { ...record, isActive: false });
      }
    }
  }
}
