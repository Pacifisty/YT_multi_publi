import { randomUUID } from 'node:crypto';
import type { EmailService } from '../integrations/email/email-service';

export type CampaignTargetPlatform = 'youtube' | 'tiktok' | 'instagram';

export interface CampaignTargetRecord {
  id: string;
  campaignId: string;
  platform: CampaignTargetPlatform;
  destinationId: string;
  destinationLabel: string | null;
  connectedAccountId: string | null;
  channelId: string | null;
  videoTitle: string;
  videoDescription: string;
  tags: string[];
  publishAt: string | null;
  playlistId: string | null;
  privacy: string;
  thumbnailAssetId: string | null;
  status: 'aguardando' | 'enviando' | 'publicado' | 'erro';
  externalPublishId: string | null;
  youtubeVideoId: string | null;
  errorMessage: string | null;
  retryCount: number;
  // TikTok-specific fields
  tiktokPrivacyLevel?: string | null;
  tiktokDisableComment?: boolean | null;
  tiktokDisableDuet?: boolean | null;
  tiktokDisableStitch?: boolean | null;
  // Instagram-specific fields
  instagramCaption?: string | null;
  instagramShareToFeed?: boolean | null;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignRecord {
  id: string;
  ownerEmail?: string | null;
  title: string;
  videoAssetId: string;
  status: 'draft' | 'ready' | 'launching' | 'completed' | 'failed';
  scheduledAt: string | null;
  playlistId: string | null;
  autoMode: boolean;
  schedulePattern: string | null;
  targets: CampaignTargetRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateCampaignInput {
  ownerEmail?: string;
  title: string;
  videoAssetId: string;
  scheduledAt?: string;
  playlistId?: string;
  autoMode?: boolean;
  schedulePattern?: string;
}

export interface AddTargetInput {
  platform?: CampaignTargetPlatform;
  destinationId?: string;
  destinationLabel?: string;
  connectedAccountId?: string;
  channelId?: string;
  videoTitle: string;
  videoDescription: string;
  tags?: string[];
  publishAt?: string;
  playlistId?: string;
  privacy?: string;
  thumbnailAssetId?: string;
  instagramCaption?: string;
  instagramShareToFeed?: boolean;
}

export interface CreateTikTokTargetInput {
  connectedAccountId: string;
  videoTitle: string;
  privacy: 'PUBLIC_TO_EVERYONE' | 'FOLLOWER_OF_CREATOR' | 'SELF_ONLY';
  disableComment?: boolean;
  disableDuet?: boolean;
  disableStitch?: boolean;
}

export interface CreateInstagramTargetInput {
  connectedAccountId: string;
  caption: string;
  shareToFeed?: boolean;
}

export interface ConnectedAccountRecord {
  id: string;
  provider: string;
  displayName?: string | null;
  email?: string | null;
  status?: string;
  ownerEmail?: string | null;
}

export interface AccountServiceProvider {
  getConnectedAccount(id: string): Promise<ConnectedAccountRecord | null>;
  listConnectedAccounts(ownerEmail: string, provider: string): Promise<ConnectedAccountRecord[]>;
}

export interface CampaignRepository {
  create(record: CampaignRecord): Promise<CampaignRecord> | CampaignRecord;
  findById(id: string): Promise<CampaignRecord | null> | CampaignRecord | null;
  findAllNewestFirst(): Promise<CampaignRecord[]> | CampaignRecord[];
  update(id: string, updates: Partial<CampaignRecord>): Promise<CampaignRecord | null> | CampaignRecord | null;
  delete(id: string): Promise<boolean> | boolean;
  addTarget(campaignId: string, target: CampaignTargetRecord): Promise<CampaignTargetRecord | null> | CampaignTargetRecord | null;
  removeTarget(campaignId: string, targetId: string): Promise<boolean> | boolean;
  updateTarget(campaignId: string, targetId: string, updates: Partial<CampaignTargetRecord>): Promise<CampaignTargetRecord | null> | CampaignTargetRecord | null;
}

export class InMemoryCampaignRepository implements CampaignRepository {
  private readonly campaigns: CampaignRecord[] = [];

  create(record: CampaignRecord): CampaignRecord {
    this.campaigns.push(record);
    return record;
  }

  findById(id: string): CampaignRecord | null {
    return this.campaigns.find((c) => c.id === id) ?? null;
  }

  findAllNewestFirst(): CampaignRecord[] {
    return [...this.campaigns].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  update(id: string, updates: Partial<CampaignRecord>): CampaignRecord | null {
    const campaign = this.findById(id);
    if (!campaign) return null;
    Object.assign(campaign, updates);
    return campaign;
  }

  delete(id: string): boolean {
    const index = this.campaigns.findIndex((c) => c.id === id);
    if (index === -1) return false;
    this.campaigns.splice(index, 1);
    return true;
  }

  addTarget(campaignId: string, target: CampaignTargetRecord): CampaignTargetRecord | null {
    const campaign = this.findById(campaignId);
    if (!campaign) return null;
    campaign.targets.push(target);
    return target;
  }

  removeTarget(campaignId: string, targetId: string): boolean {
    const campaign = this.findById(campaignId);
    if (!campaign) return false;
    const index = campaign.targets.findIndex((t) => t.id === targetId);
    if (index === -1) return false;
    campaign.targets.splice(index, 1);
    return true;
  }

  updateTarget(campaignId: string, targetId: string, updates: Partial<CampaignTargetRecord>): CampaignTargetRecord | null {
    const campaign = this.findById(campaignId);
    if (!campaign) return null;
    const target = campaign.targets.find((t) => t.id === targetId);
    if (!target) return null;
    Object.assign(target, updates);
    return target;
  }
}

export interface CampaignServiceOptions {
  repository?: CampaignRepository;
  accountService?: AccountServiceProvider;
  emailService?: EmailService;
  logger?: any;
  now?: () => Date;
}

export const DUPLICATE_CAMPAIGN_TARGET_CHANNEL_ERROR = 'Target for this channel already exists in the campaign';
export const DUPLICATE_CAMPAIGN_TARGET_DESTINATION_ERROR = DUPLICATE_CAMPAIGN_TARGET_CHANNEL_ERROR;

export class CampaignService {
  private readonly repository: CampaignRepository;
  private readonly accountService?: AccountServiceProvider;
  private readonly emailService?: EmailService;
  private readonly logger?: any;
  private readonly now: () => Date;

  constructor(options: CampaignServiceOptions = {}) {
    this.repository = options.repository ?? new InMemoryCampaignRepository();
    this.accountService = options.accountService;
    this.emailService = options.emailService;
    this.logger = options.logger;
    this.now = options.now ?? (() => new Date());
  }

  private canMutateTargets(status: CampaignRecord['status']): boolean {
    return status === 'draft' || status === 'ready';
  }

  private normalizeOwnerEmail(value: string | null | undefined): string | null {
    const normalized = value?.trim().toLowerCase();
    return normalized ? normalized : null;
  }

  private matchesOwner(campaign: Pick<CampaignRecord, 'ownerEmail'>, ownerEmail?: string): boolean {
    const normalizedOwnerEmail = this.normalizeOwnerEmail(ownerEmail);
    if (!normalizedOwnerEmail) {
      return true;
    }

    return this.normalizeOwnerEmail(campaign.ownerEmail) === normalizedOwnerEmail;
  }

  private filterCampaignsByOwner(campaigns: CampaignRecord[], ownerEmail?: string): CampaignRecord[] {
    const normalizedOwnerEmail = this.normalizeOwnerEmail(ownerEmail);
    if (!normalizedOwnerEmail) {
      return campaigns;
    }

    const hasOwnedCampaigns = campaigns.some((campaign) => this.normalizeOwnerEmail(campaign.ownerEmail) !== null);
    if (!hasOwnedCampaigns) {
      return campaigns;
    }

    return campaigns.filter((campaign) => this.matchesOwner(campaign, ownerEmail));
  }

  private async resolveCampaign(campaignId: string, ownerEmail?: string): Promise<CampaignRecord | null> {
    const campaign = await this.repository.findById(campaignId);
    if (!campaign) {
      return null;
    }

    if (this.matchesOwner(campaign, ownerEmail)) {
      return campaign;
    }

    const hasOwnedCampaigns = (await this.repository.findAllNewestFirst())
      .some((record) => this.normalizeOwnerEmail(record.ownerEmail) !== null);
    if (!hasOwnedCampaigns && this.normalizeOwnerEmail(campaign.ownerEmail) === null) {
      return campaign;
    }

    return null;
  }

  async createCampaign(input: CreateCampaignInput): Promise<{ campaign: CampaignRecord }> {
    const nowIso = this.now().toISOString();
    const record: CampaignRecord = {
      id: randomUUID(),
      ownerEmail: this.normalizeOwnerEmail(input.ownerEmail),
      title: input.title,
      videoAssetId: input.videoAssetId,
      status: 'draft',
      scheduledAt: input.scheduledAt ?? null,
      playlistId: input.playlistId ?? null,
      autoMode: input.autoMode ?? false,
      schedulePattern: input.schedulePattern ?? null,
      targets: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    return { campaign: await this.repository.create(record) };
  }

  async addTarget(campaignId: string, input: AddTargetInput, ownerEmail?: string): Promise<{ target: CampaignTargetRecord }> {
    const campaign = await this.resolveCampaign(campaignId, ownerEmail);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }
    if (!this.canMutateTargets(campaign.status)) {
      throw new Error('Cannot add targets to an active campaign');
    }
    const platform = input.platform ?? 'youtube';
    const destinationId = input.destinationId ?? input.channelId;
    if (!destinationId) {
      throw new Error('Missing target destination id');
    }

    if (campaign.targets.some((target) => target.platform === platform && target.destinationId === destinationId)) {
      throw new Error(DUPLICATE_CAMPAIGN_TARGET_DESTINATION_ERROR);
    }

    const nowIso = this.now().toISOString();
    const instagramCaption = platform === 'instagram'
      ? (input.instagramCaption ?? input.videoDescription ?? input.videoTitle).slice(0, 2200)
      : null;

    const target: CampaignTargetRecord = {
      id: randomUUID(),
      campaignId,
      platform,
      destinationId,
      destinationLabel: input.destinationLabel ?? null,
      connectedAccountId: input.connectedAccountId ?? null,
      channelId: platform === 'youtube' ? destinationId : null,
      videoTitle: input.videoTitle,
      videoDescription: input.videoDescription,
      tags: input.tags ?? [],
      publishAt: input.publishAt ?? null,
      playlistId: input.playlistId ?? null,
      privacy: input.privacy ?? (platform === 'instagram' ? 'public' : 'private'),
      thumbnailAssetId: input.thumbnailAssetId ?? null,
      status: 'aguardando',
      externalPublishId: null,
      youtubeVideoId: null,
      errorMessage: null,
      retryCount: 0,
      // TikTok fields default to null for YouTube targets
      tiktokPrivacyLevel: null,
      tiktokDisableComment: null,
      tiktokDisableDuet: null,
      tiktokDisableStitch: null,
      instagramCaption,
      instagramShareToFeed: platform === 'instagram' ? input.instagramShareToFeed ?? true : null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const result = await this.repository.addTarget(campaignId, target);
    if (!result) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    return { target: result };
  }

  async removeTarget(campaignId: string, targetId: string, ownerEmail?: string): Promise<boolean> {
    const campaign = await this.resolveCampaign(campaignId, ownerEmail);
    if (!campaign || !this.canMutateTargets(campaign.status)) {
      return false;
    }

    const removed = await this.repository.removeTarget(campaignId, targetId);
    if (!removed) {
      return false;
    }

    const refreshedCampaign = await this.repository.findById(campaignId);
    if (refreshedCampaign && refreshedCampaign.targets.length === 0 && refreshedCampaign.status === 'ready') {
      await this.repository.update(campaignId, {
        status: 'draft',
        updatedAt: this.now().toISOString(),
      });
    }

    return true;
  }

  async updateTarget(
    campaignId: string,
    targetId: string,
    updates: { videoTitle?: string; videoDescription?: string; tags?: string[]; publishAt?: string; playlistId?: string; privacy?: string; thumbnailAssetId?: string },
    ownerEmail?: string,
  ): Promise<{ target: CampaignTargetRecord } | { error: 'NOT_FOUND' | 'CAMPAIGN_ACTIVE' }> {
    const campaign = await this.resolveCampaign(campaignId, ownerEmail);
    if (!campaign) return { error: 'NOT_FOUND' };
    if (!this.canMutateTargets(campaign.status)) return { error: 'CAMPAIGN_ACTIVE' };

    const filtered: Partial<CampaignTargetRecord> = {};
    if (updates.videoTitle !== undefined) filtered.videoTitle = updates.videoTitle;
    if (updates.videoDescription !== undefined) filtered.videoDescription = updates.videoDescription;
    if (updates.tags !== undefined) filtered.tags = updates.tags;
    if (updates.publishAt !== undefined) filtered.publishAt = updates.publishAt;
    if (updates.playlistId !== undefined) filtered.playlistId = updates.playlistId;
    if (updates.privacy !== undefined) filtered.privacy = updates.privacy;
    if (updates.thumbnailAssetId !== undefined) filtered.thumbnailAssetId = updates.thumbnailAssetId;
    filtered.updatedAt = this.now().toISOString();

    const target = await this.repository.updateTarget(campaignId, targetId, filtered);
    if (!target) return { error: 'NOT_FOUND' };
    return { target };
  }

  async listCampaigns(filters?: { status?: string; search?: string; limit?: number; offset?: number; ownerEmail?: string }): Promise<{ campaigns: CampaignRecord[]; total: number; limit: number; offset: number }> {
    let campaigns = await this.repository.findAllNewestFirst();

    if (filters?.ownerEmail) {
      campaigns = this.filterCampaignsByOwner(campaigns, filters.ownerEmail);
    }

    if (filters?.status) {
      campaigns = campaigns.filter((c) => c.status === filters.status);
    }

    if (filters?.search) {
      const term = filters.search.toLowerCase();
      campaigns = campaigns.filter((c) => c.title.toLowerCase().includes(term));
    }

    const total = campaigns.length;
    const limit = Math.min(Math.max(filters?.limit ?? 20, 1), 100);
    const offset = Math.max(filters?.offset ?? 0, 0);
    campaigns = campaigns.slice(offset, offset + limit);

    return { campaigns, total, limit, offset };
  }

  async listAllCampaigns(filters?: { status?: string; search?: string; ownerEmail?: string }): Promise<CampaignRecord[]> {
    let campaigns = await this.repository.findAllNewestFirst();

    if (filters?.ownerEmail) {
      campaigns = this.filterCampaignsByOwner(campaigns, filters.ownerEmail);
    }

    if (filters?.status) {
      campaigns = campaigns.filter((campaign) => campaign.status === filters.status);
    }

    if (filters?.search) {
      const term = filters.search.toLowerCase();
      campaigns = campaigns.filter((campaign) => campaign.title.toLowerCase().includes(term));
    }

    return campaigns;
  }

  async getCampaign(id: string, ownerEmail?: string): Promise<{ campaign: CampaignRecord } | null> {
    const campaign = await this.resolveCampaign(id, ownerEmail);
    if (!campaign) return null;
    return { campaign };
  }

  async cloneCampaign(id: string, options?: { title?: string; ownerEmail?: string }): Promise<{ campaign: CampaignRecord } | { error: 'NOT_FOUND' }> {
    const original = await this.resolveCampaign(id, options?.ownerEmail);
    if (!original) return { error: 'NOT_FOUND' };

    const nowIso = this.now().toISOString();
    const clonedTargets: CampaignTargetRecord[] = original.targets.map((t) => ({
      id: randomUUID(),
      campaignId: '',
      platform: t.platform ?? 'youtube',
      destinationId: t.destinationId ?? t.channelId,
      destinationLabel: t.destinationLabel ?? null,
      connectedAccountId: t.connectedAccountId ?? null,
      channelId: t.channelId,
      videoTitle: t.videoTitle,
      videoDescription: t.videoDescription,
      tags: [...t.tags],
      publishAt: t.publishAt,
      playlistId: t.playlistId,
      privacy: t.privacy,
      thumbnailAssetId: t.thumbnailAssetId,
      status: 'aguardando' as const,
      externalPublishId: null,
      youtubeVideoId: null,
      errorMessage: null,
      retryCount: 0,
      // TikTok-specific fields
      tiktokPrivacyLevel: t.tiktokPrivacyLevel ?? null,
      tiktokDisableComment: t.tiktokDisableComment ?? null,
      tiktokDisableDuet: t.tiktokDisableDuet ?? null,
      tiktokDisableStitch: t.tiktokDisableStitch ?? null,
      instagramCaption: t.instagramCaption ?? null,
      instagramShareToFeed: t.instagramShareToFeed ?? null,
      createdAt: nowIso,
      updatedAt: nowIso,
    }));

    const cloned: CampaignRecord = {
      id: randomUUID(),
      ownerEmail: original.ownerEmail ?? null,
      title: options?.title ?? `Copy of ${original.title}`,
      videoAssetId: original.videoAssetId,
      status: 'draft',
      scheduledAt: original.scheduledAt,
      playlistId: original.playlistId ?? null,
      autoMode: original.autoMode ?? false,
      schedulePattern: original.schedulePattern ?? null,
      targets: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const created = await this.repository.create(cloned);
    for (const target of clonedTargets) {
      target.campaignId = created.id;
      await this.repository.addTarget(created.id, target);
    }

    return { campaign: (await this.repository.findById(created.id))! };
  }

  async markReady(campaignId: string, ownerEmail?: string): Promise<{ campaign: CampaignRecord } | { error: 'NO_TARGETS' | 'NOT_FOUND' | 'INVALID_STATUS' }> {
    const campaign = await this.resolveCampaign(campaignId, ownerEmail);
    if (!campaign) return { error: 'NOT_FOUND' };
    if (campaign.targets.length === 0) return { error: 'NO_TARGETS' };
    if (campaign.status !== 'draft') return { error: 'INVALID_STATUS' };

    const updated = await this.repository.update(campaignId, {
      status: 'ready',
      updatedAt: this.now().toISOString(),
    });

    return { campaign: updated! };
  }

  async launch(campaignId: string, ownerEmail?: string): Promise<{ campaign: CampaignRecord } | { error: 'NOT_FOUND' | 'NOT_READY' }> {
    const campaign = await this.resolveCampaign(campaignId, ownerEmail);
    if (!campaign) return { error: 'NOT_FOUND' };
    if (campaign.status !== 'ready') return { error: 'NOT_READY' };

    const updated = await this.repository.update(campaignId, {
      status: 'launching',
      updatedAt: this.now().toISOString(),
    });

    return { campaign: updated! };
  }

  private async notifyCampaignCompletion(campaign: CampaignRecord, newStatus: 'completed' | 'failed'): Promise<void> {
    if (!this.emailService || !campaign.ownerEmail) {
      return;
    }

    try {
      const { buildCampaignPublishedEmail, buildCampaignFailedEmail } = await import('../integrations/email/email-templates');

      const publishedTargets = campaign.targets.filter(t => t.status === 'publicado' && (t.youtubeVideoId || t.externalPublishId));
      const failedTargets = campaign.targets.filter(t => t.status === 'erro' && t.errorMessage);
      const platforms = [...new Set(publishedTargets.map(t => {
        if (t.platform === 'youtube') return 'YouTube';
        if (t.platform === 'tiktok') return 'TikTok';
        if (t.platform === 'instagram') return 'Instagram';
        return t.platform;
      }))];

      const dashboardUrl = (process.env.APP_URL || 'https://app.example.com') + '/dashboard';

      if (newStatus === 'completed') {
        const emailData = buildCampaignPublishedEmail(campaign.ownerEmail, {
          campaignTitle: campaign.title,
          platforms,
          destinationCount: publishedTargets.length,
          dashboardUrl,
          userEmail: campaign.ownerEmail,
        });
        await this.emailService.send(emailData);
      } else if (newStatus === 'failed') {
        const suggestedActions = failedTargets.map(t => {
          const msg = t.errorMessage || '';
          if (msg === 'REAUTH_REQUIRED') return { action: 'reauth' as const, count: 1 };
          if (msg.includes('quota') || msg === 'quotaExceeded') return { action: 'retry' as const, count: 1 };
          return { action: 'review' as const, count: 1 };
        });

        const actionCounts = suggestedActions.reduce((acc, item) => {
          const existing = acc.find(a => a.action === item.action);
          if (existing) {
            existing.count++;
          } else {
            acc.push({ action: item.action, count: 1 });
          }
          return acc;
        }, [] as Array<{ action: 'retry' | 'reauth' | 'review'; count: number }>);

        const emailData = buildCampaignFailedEmail(campaign.ownerEmail, {
          campaignTitle: campaign.title,
          failedCount: failedTargets.length,
          suggestedActions: actionCounts,
          dashboardUrl,
          userEmail: campaign.ownerEmail,
        });
        await this.emailService.send(emailData);
      }
    } catch (error) {
      this.logger?.warn('Failed to send campaign notification email', {
        campaignId: campaign.id,
        status: newStatus,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async updateTargetStatus(
    campaignId: string,
    targetId: string,
    status: CampaignTargetRecord['status'],
    extra?: { externalPublishId?: string; youtubeVideoId?: string; errorMessage?: string | null; retryCount?: number },
  ): Promise<{ target: CampaignTargetRecord } | null> {
    const campaign = await this.repository.findById(campaignId);
    if (!campaign) return null;

    const existingTarget = campaign.targets.find((t) => t.id === targetId);
    if (!existingTarget) return null;

    const requestedExternalId = typeof extra?.externalPublishId === 'string' && extra.externalPublishId.trim()
      ? extra.externalPublishId.trim()
      : typeof extra?.youtubeVideoId === 'string' && extra.youtubeVideoId.trim()
        ? extra.youtubeVideoId.trim()
        : null;

    const nextPublishedExternalId = status === 'publicado'
      ? (requestedExternalId ?? existingTarget.externalPublishId ?? existingTarget.youtubeVideoId)
      : null;

    const nextErrorMessage = status === 'erro'
      ? (typeof extra?.errorMessage === 'string' && extra.errorMessage.trim()
          ? extra.errorMessage.trim()
          : existingTarget.errorMessage)
      : null;

    if (status === 'publicado' && !nextPublishedExternalId) {
      return null;
    }

    if (status === 'erro' && !nextErrorMessage) {
      return null;
    }

    const updates: Partial<CampaignTargetRecord> = {
      status,
      updatedAt: this.now().toISOString(),
    };

    if (status === 'publicado') {
      updates.externalPublishId = nextPublishedExternalId;
      updates.youtubeVideoId = existingTarget.platform === 'youtube' ? nextPublishedExternalId : null;
    } else if (status === 'erro') {
      updates.externalPublishId = requestedExternalId;
      updates.youtubeVideoId = existingTarget.platform === 'youtube' && requestedExternalId
        ? requestedExternalId
        : null;
    } else {
      updates.externalPublishId = null;
      updates.youtubeVideoId = null;
    }

    if (status !== 'erro') {
      updates.errorMessage = null;
    } else {
      updates.errorMessage = nextErrorMessage;
    }

    if (extra?.retryCount !== undefined) updates.retryCount = extra.retryCount;

    const target = await this.repository.updateTarget(campaignId, targetId, updates);
    if (!target) return null;

    // Check if target progress changed overall campaign lifecycle state
    const refreshedCampaign = await this.repository.findById(campaignId);
    if (refreshedCampaign) {
      const allDone = refreshedCampaign.targets.every((t) => (
        (t.status === 'publicado' && Boolean(t.externalPublishId ?? t.youtubeVideoId))
        || (t.status === 'erro' && Boolean(t.errorMessage))
      ));
      if (allDone) {
        const anySuccess = refreshedCampaign.targets.some((t) => (
          t.status === 'publicado' && Boolean(t.externalPublishId ?? t.youtubeVideoId)
        ));
        const newStatus = anySuccess ? 'completed' : 'failed';
        await this.repository.update(campaignId, {
          status: newStatus,
          updatedAt: this.now().toISOString(),
        });
        // Send email notification for campaign completion/failure
        await this.notifyCampaignCompletion(refreshedCampaign, newStatus);
      } else {
        const shouldBeLaunching = refreshedCampaign.status !== 'launching' &&
          (refreshedCampaign.status === 'completed' || refreshedCampaign.status === 'failed' || status !== 'aguardando');

        if (shouldBeLaunching) {
          await this.repository.update(campaignId, {
            status: 'launching',
            updatedAt: this.now().toISOString(),
          });
        }
      }
    }

    return { target };
  }

  async deleteCampaign(campaignId: string, ownerEmail?: string): Promise<{ deleted: boolean } | { error: 'NOT_FOUND' | 'CAMPAIGN_ACTIVE' }> {
    const campaign = await this.resolveCampaign(campaignId, ownerEmail);
    if (!campaign) return { error: 'NOT_FOUND' };
    if (campaign.status !== 'draft' && campaign.status !== 'ready') return { error: 'CAMPAIGN_ACTIVE' };

    return { deleted: await this.repository.delete(campaignId) };
  }

  async updateCampaign(
    campaignId: string,
    updates: { title?: string; scheduledAt?: string; playlistId?: string | null; autoMode?: boolean; schedulePattern?: string | null },
    ownerEmail?: string,
  ): Promise<{ campaign: CampaignRecord } | { error: 'NOT_FOUND' | 'CAMPAIGN_ACTIVE' }> {
    const campaign = await this.resolveCampaign(campaignId, ownerEmail);
    if (!campaign) return { error: 'NOT_FOUND' };
    if (campaign.status !== 'draft' && campaign.status !== 'ready') return { error: 'CAMPAIGN_ACTIVE' };

    const patch: Partial<CampaignRecord> = { updatedAt: this.now().toISOString() };
    if (updates.title) patch.title = updates.title;
    if (updates.scheduledAt !== undefined) patch.scheduledAt = updates.scheduledAt;
    if (updates.playlistId !== undefined) patch.playlistId = updates.playlistId;
    if (updates.autoMode !== undefined) patch.autoMode = updates.autoMode;
    if (updates.schedulePattern !== undefined) patch.schedulePattern = updates.schedulePattern;

    const updated = await this.repository.update(campaignId, patch);
    return { campaign: updated! };
  }

  /**
   * Validate a TikTok account belongs to user and is connected
   */
  async validateTikTokAccount(
    connectedAccountId: string,
    ownerEmail: string,
  ): Promise<{ valid: boolean; displayName?: string }> {
    if (!this.accountService) {
      throw new Error('Account service not configured');
    }

    const account = await this.accountService.getConnectedAccount(connectedAccountId);
    if (!account) {
      return { valid: false };
    }

    if (account.provider !== 'tiktok') {
      throw new Error('Account is not a TikTok account');
    }

    if (account.ownerEmail && account.ownerEmail.toLowerCase() !== ownerEmail.toLowerCase()) {
      return { valid: false };
    }

    return { valid: true, displayName: account.displayName ?? undefined };
  }

  /**
   * List all connected TikTok accounts for a user
   */
  async listConnectedTikTokAccounts(ownerEmail: string): Promise<ConnectedAccountRecord[]> {
    if (!this.accountService) {
      throw new Error('Account service not configured');
    }

    return this.accountService.listConnectedAccounts(ownerEmail, 'tiktok');
  }

  /**
   * Get all TikTok targets in a campaign
   */
  async getTikTokTargetsForCampaign(
    campaignId: string,
    ownerEmail?: string,
  ): Promise<CampaignTargetRecord[]> {
    const campaign = await this.resolveCampaign(campaignId, ownerEmail);
    if (!campaign) {
      return [];
    }

    return campaign.targets.filter((target) => target.platform === 'tiktok');
  }

  /**
   * Create a TikTok campaign target
   * Validates account ownership, TikTok provider, and title length
   */
  async createTikTokTarget(
    campaignId: string,
    input: CreateTikTokTargetInput,
    ownerEmail?: string,
  ): Promise<{ target: CampaignTargetRecord }> {
    // Validate campaign exists and belongs to user
    const campaign = await this.resolveCampaign(campaignId, ownerEmail);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    if (!this.canMutateTargets(campaign.status)) {
      throw new Error('Cannot add targets to an active campaign');
    }

    // Validate connected account
    const validationResult = await this.validateTikTokAccount(
      input.connectedAccountId,
      ownerEmail || '',
    );
    if (!validationResult.valid) {
      throw new Error('Account not found or not accessible');
    }

    // Validate title length (TikTok limit: 2,200 characters)
    const MAX_TITLE_LENGTH = 2200;
    let videoTitle = input.videoTitle;
    if (videoTitle.length > MAX_TITLE_LENGTH) {
      videoTitle = videoTitle.substring(0, MAX_TITLE_LENGTH);
    }

    // Check for duplicate TikTok target for same account
    if (
      campaign.targets.some(
        (target) =>
          target.platform === 'tiktok' && target.connectedAccountId === input.connectedAccountId,
      )
    ) {
      throw new Error('Target for this TikTok account already exists in the campaign');
    }

    const nowIso = this.now().toISOString();
    const target: CampaignTargetRecord = {
      id: randomUUID(),
      campaignId,
      platform: 'tiktok',
      destinationId: input.connectedAccountId,
      destinationLabel: validationResult.displayName ?? null,
      connectedAccountId: input.connectedAccountId,
      channelId: null,
      videoTitle,
      videoDescription: '', // TikTok only uses title, no description field
      tags: [],
      publishAt: null,
      playlistId: null,
      privacy: 'SELF_ONLY', // Default privacy will be queried from creator info at publish time
      thumbnailAssetId: null,
      status: 'aguardando',
      externalPublishId: null,
      youtubeVideoId: null,
      errorMessage: null,
      retryCount: 0,
      // TikTok-specific fields
      tiktokPrivacyLevel: input.privacy,
      tiktokDisableComment: input.disableComment ?? false,
      tiktokDisableDuet: input.disableDuet ?? false,
      tiktokDisableStitch: input.disableStitch ?? false,
      instagramCaption: null,
      instagramShareToFeed: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const result = await this.repository.addTarget(campaignId, target);
    if (!result) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    return { target: result };
  }

  async validateInstagramAccount(
    connectedAccountId: string,
    ownerEmail: string,
  ): Promise<{ valid: boolean; displayName?: string }> {
    if (!this.accountService) {
      throw new Error('Account service not configured');
    }

    const account = await this.accountService.getConnectedAccount(connectedAccountId);
    if (!account) {
      return { valid: false };
    }

    if (account.provider !== 'instagram') {
      throw new Error('Account is not an Instagram account');
    }

    if (account.ownerEmail && account.ownerEmail.toLowerCase() !== ownerEmail.toLowerCase()) {
      return { valid: false };
    }

    return { valid: true, displayName: account.displayName ?? undefined };
  }

  async listConnectedInstagramAccounts(ownerEmail: string): Promise<ConnectedAccountRecord[]> {
    if (!this.accountService) {
      throw new Error('Account service not configured');
    }

    return this.accountService.listConnectedAccounts(ownerEmail, 'instagram');
  }

  async getInstagramTargetsForCampaign(
    campaignId: string,
    ownerEmail?: string,
  ): Promise<CampaignTargetRecord[]> {
    const campaign = await this.resolveCampaign(campaignId, ownerEmail);
    if (!campaign) {
      return [];
    }

    return campaign.targets.filter((target) => target.platform === 'instagram');
  }

  async createInstagramTarget(
    campaignId: string,
    input: CreateInstagramTargetInput,
    ownerEmail?: string,
  ): Promise<{ target: CampaignTargetRecord }> {
    const campaign = await this.resolveCampaign(campaignId, ownerEmail);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    if (!this.canMutateTargets(campaign.status)) {
      throw new Error('Cannot add targets to an active campaign');
    }

    const validationResult = await this.validateInstagramAccount(
      input.connectedAccountId,
      ownerEmail || '',
    );
    if (!validationResult.valid) {
      throw new Error('Account not found or not accessible');
    }

    const MAX_CAPTION_LENGTH = 2200;
    const caption = input.caption.length > MAX_CAPTION_LENGTH
      ? input.caption.substring(0, MAX_CAPTION_LENGTH)
      : input.caption;

    if (
      campaign.targets.some(
        (target) =>
          target.platform === 'instagram' && target.connectedAccountId === input.connectedAccountId,
      )
    ) {
      throw new Error('Target for this Instagram account already exists in the campaign');
    }

    const nowIso = this.now().toISOString();
    const target: CampaignTargetRecord = {
      id: randomUUID(),
      campaignId,
      platform: 'instagram',
      destinationId: input.connectedAccountId,
      destinationLabel: validationResult.displayName ?? null,
      connectedAccountId: input.connectedAccountId,
      channelId: null,
      videoTitle: caption.substring(0, 80) || 'Instagram Reel',
      videoDescription: caption,
      tags: [],
      publishAt: null,
      playlistId: null,
      privacy: 'public',
      thumbnailAssetId: null,
      status: 'aguardando',
      externalPublishId: null,
      youtubeVideoId: null,
      errorMessage: null,
      retryCount: 0,
      tiktokPrivacyLevel: null,
      tiktokDisableComment: null,
      tiktokDisableDuet: null,
      tiktokDisableStitch: null,
      instagramCaption: caption,
      instagramShareToFeed: input.shareToFeed ?? true,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const result = await this.repository.addTarget(campaignId, target);
    if (!result) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    return { target: result };
  }
}
