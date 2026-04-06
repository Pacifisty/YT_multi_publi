import { randomUUID } from 'node:crypto';

export interface CampaignTargetRecord {
  id: string;
  campaignId: string;
  channelId: string;
  videoTitle: string;
  videoDescription: string;
  tags: string[];
  privacy: string;
  thumbnailAssetId: string | null;
  status: 'aguardando' | 'enviando' | 'publicado' | 'erro';
  youtubeVideoId: string | null;
  errorMessage: string | null;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignRecord {
  id: string;
  title: string;
  videoAssetId: string;
  status: 'draft' | 'ready' | 'launching' | 'completed' | 'failed';
  scheduledAt: string | null;
  targets: CampaignTargetRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateCampaignInput {
  title: string;
  videoAssetId: string;
  scheduledAt?: string;
}

export interface AddTargetInput {
  channelId: string;
  videoTitle: string;
  videoDescription: string;
  tags?: string[];
  privacy?: string;
  thumbnailAssetId?: string;
}

export interface CampaignRepository {
  create(record: CampaignRecord): CampaignRecord;
  findById(id: string): CampaignRecord | null;
  findAllNewestFirst(): CampaignRecord[];
  update(id: string, updates: Partial<CampaignRecord>): CampaignRecord | null;
  delete(id: string): boolean;
  addTarget(campaignId: string, target: CampaignTargetRecord): CampaignTargetRecord | null;
  removeTarget(campaignId: string, targetId: string): boolean;
  updateTarget(campaignId: string, targetId: string, updates: Partial<CampaignTargetRecord>): CampaignTargetRecord | null;
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
  now?: () => Date;
}

export class CampaignService {
  private readonly repository: CampaignRepository;
  private readonly now: () => Date;

  constructor(options: CampaignServiceOptions = {}) {
    this.repository = options.repository ?? new InMemoryCampaignRepository();
    this.now = options.now ?? (() => new Date());
  }

  createCampaign(input: CreateCampaignInput): { campaign: CampaignRecord } {
    const nowIso = this.now().toISOString();
    const record: CampaignRecord = {
      id: randomUUID(),
      title: input.title,
      videoAssetId: input.videoAssetId,
      status: 'draft',
      scheduledAt: input.scheduledAt ?? null,
      targets: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    return { campaign: this.repository.create(record) };
  }

  addTarget(campaignId: string, input: AddTargetInput): { target: CampaignTargetRecord } {
    const nowIso = this.now().toISOString();
    const target: CampaignTargetRecord = {
      id: randomUUID(),
      campaignId,
      channelId: input.channelId,
      videoTitle: input.videoTitle,
      videoDescription: input.videoDescription,
      tags: input.tags ?? [],
      privacy: input.privacy ?? 'private',
      thumbnailAssetId: input.thumbnailAssetId ?? null,
      status: 'aguardando',
      youtubeVideoId: null,
      errorMessage: null,
      retryCount: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const result = this.repository.addTarget(campaignId, target);
    if (!result) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    return { target: result };
  }

  removeTarget(campaignId: string, targetId: string): boolean {
    return this.repository.removeTarget(campaignId, targetId);
  }

  updateTarget(
    campaignId: string,
    targetId: string,
    updates: { videoTitle?: string; videoDescription?: string; tags?: string[]; privacy?: string; thumbnailAssetId?: string },
  ): { target: CampaignTargetRecord } | { error: 'NOT_FOUND' } {
    const filtered: Partial<CampaignTargetRecord> = {};
    if (updates.videoTitle !== undefined) filtered.videoTitle = updates.videoTitle;
    if (updates.videoDescription !== undefined) filtered.videoDescription = updates.videoDescription;
    if (updates.tags !== undefined) filtered.tags = updates.tags;
    if (updates.privacy !== undefined) filtered.privacy = updates.privacy;
    if (updates.thumbnailAssetId !== undefined) filtered.thumbnailAssetId = updates.thumbnailAssetId;
    filtered.updatedAt = this.now().toISOString();

    const target = this.repository.updateTarget(campaignId, targetId, filtered);
    if (!target) return { error: 'NOT_FOUND' };
    return { target };
  }

  listCampaigns(filters?: { status?: string; search?: string; limit?: number; offset?: number }): { campaigns: CampaignRecord[]; total: number; limit: number; offset: number } {
    let campaigns = this.repository.findAllNewestFirst();

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

  getCampaign(id: string): { campaign: CampaignRecord } | null {
    const campaign = this.repository.findById(id);
    if (!campaign) return null;
    return { campaign };
  }

  cloneCampaign(id: string, options?: { title?: string }): { campaign: CampaignRecord } | { error: 'NOT_FOUND' } {
    const original = this.repository.findById(id);
    if (!original) return { error: 'NOT_FOUND' };

    const nowIso = this.now().toISOString();
    const clonedTargets: CampaignTargetRecord[] = original.targets.map((t) => ({
      id: randomUUID(),
      campaignId: '',
      channelId: t.channelId,
      videoTitle: t.videoTitle,
      videoDescription: t.videoDescription,
      tags: [...t.tags],
      privacy: t.privacy,
      thumbnailAssetId: t.thumbnailAssetId,
      status: 'aguardando' as const,
      youtubeVideoId: null,
      errorMessage: null,
      retryCount: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    }));

    const cloned: CampaignRecord = {
      id: randomUUID(),
      title: options?.title ?? `Copy of ${original.title}`,
      videoAssetId: original.videoAssetId,
      status: 'draft',
      scheduledAt: original.scheduledAt,
      targets: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const created = this.repository.create(cloned);
    for (const target of clonedTargets) {
      target.campaignId = created.id;
      this.repository.addTarget(created.id, target);
    }

    return { campaign: this.repository.findById(created.id)! };
  }

  markReady(campaignId: string): { campaign: CampaignRecord } | { error: 'NO_TARGETS' | 'NOT_FOUND' } {
    const campaign = this.repository.findById(campaignId);
    if (!campaign) return { error: 'NOT_FOUND' };
    if (campaign.targets.length === 0) return { error: 'NO_TARGETS' };

    const updated = this.repository.update(campaignId, {
      status: 'ready',
      updatedAt: this.now().toISOString(),
    });

    return { campaign: updated! };
  }

  launch(campaignId: string): { campaign: CampaignRecord } | { error: 'NOT_FOUND' | 'NOT_READY' } {
    const campaign = this.repository.findById(campaignId);
    if (!campaign) return { error: 'NOT_FOUND' };
    if (campaign.status !== 'ready') return { error: 'NOT_READY' };

    const updated = this.repository.update(campaignId, {
      status: 'launching',
      updatedAt: this.now().toISOString(),
    });

    return { campaign: updated! };
  }

  updateTargetStatus(
    campaignId: string,
    targetId: string,
    status: CampaignTargetRecord['status'],
    extra?: { youtubeVideoId?: string; errorMessage?: string },
  ): { target: CampaignTargetRecord } | null {
    const updates: Partial<CampaignTargetRecord> = {
      status,
      updatedAt: this.now().toISOString(),
    };

    if (extra?.youtubeVideoId) updates.youtubeVideoId = extra.youtubeVideoId;
    if (extra?.errorMessage) updates.errorMessage = extra.errorMessage;

    const target = this.repository.updateTarget(campaignId, targetId, updates);
    if (!target) return null;

    // Check if all targets completed/failed to update campaign status
    const campaign = this.repository.findById(campaignId);
    if (campaign) {
      const allDone = campaign.targets.every((t) => t.status === 'publicado' || t.status === 'erro');
      if (allDone) {
        const anySuccess = campaign.targets.some((t) => t.status === 'publicado');
        this.repository.update(campaignId, {
          status: anySuccess ? 'completed' : 'failed',
          updatedAt: this.now().toISOString(),
        });
      }
    }

    return { target };
  }

  deleteCampaign(campaignId: string): { deleted: boolean } | { error: 'NOT_FOUND' | 'CAMPAIGN_ACTIVE' } {
    const campaign = this.repository.findById(campaignId);
    if (!campaign) return { error: 'NOT_FOUND' };
    if (campaign.status === 'launching') return { error: 'CAMPAIGN_ACTIVE' };

    return { deleted: this.repository.delete(campaignId) };
  }

  updateCampaign(
    campaignId: string,
    updates: { title?: string; scheduledAt?: string },
  ): { campaign: CampaignRecord } | { error: 'NOT_FOUND' | 'CAMPAIGN_ACTIVE' } {
    const campaign = this.repository.findById(campaignId);
    if (!campaign) return { error: 'NOT_FOUND' };
    if (campaign.status === 'launching') return { error: 'CAMPAIGN_ACTIVE' };

    const patch: Partial<CampaignRecord> = { updatedAt: this.now().toISOString() };
    if (updates.title) patch.title = updates.title;
    if (updates.scheduledAt !== undefined) patch.scheduledAt = updates.scheduledAt;

    const updated = this.repository.update(campaignId, patch);
    return { campaign: updated! };
  }
}
