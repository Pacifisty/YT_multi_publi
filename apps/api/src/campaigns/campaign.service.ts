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
  now?: () => Date;
}

export class CampaignService {
  private readonly repository: CampaignRepository;
  private readonly now: () => Date;

  constructor(options: CampaignServiceOptions = {}) {
    this.repository = options.repository ?? new InMemoryCampaignRepository();
    this.now = options.now ?? (() => new Date());
  }

  async createCampaign(input: CreateCampaignInput): Promise<{ campaign: CampaignRecord }> {
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

    return { campaign: await this.repository.create(record) };
  }

  async addTarget(campaignId: string, input: AddTargetInput): Promise<{ target: CampaignTargetRecord }> {
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

    const result = await this.repository.addTarget(campaignId, target);
    if (!result) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    return { target: result };
  }

  async removeTarget(campaignId: string, targetId: string): Promise<boolean> {
    return await this.repository.removeTarget(campaignId, targetId);
  }

  async updateTarget(
    campaignId: string,
    targetId: string,
    updates: { videoTitle?: string; videoDescription?: string; tags?: string[]; privacy?: string; thumbnailAssetId?: string },
  ): Promise<{ target: CampaignTargetRecord } | { error: 'NOT_FOUND' }> {
    const filtered: Partial<CampaignTargetRecord> = {};
    if (updates.videoTitle !== undefined) filtered.videoTitle = updates.videoTitle;
    if (updates.videoDescription !== undefined) filtered.videoDescription = updates.videoDescription;
    if (updates.tags !== undefined) filtered.tags = updates.tags;
    if (updates.privacy !== undefined) filtered.privacy = updates.privacy;
    if (updates.thumbnailAssetId !== undefined) filtered.thumbnailAssetId = updates.thumbnailAssetId;
    filtered.updatedAt = this.now().toISOString();

    const target = await this.repository.updateTarget(campaignId, targetId, filtered);
    if (!target) return { error: 'NOT_FOUND' };
    return { target };
  }

  async listCampaigns(filters?: { status?: string; search?: string; limit?: number; offset?: number }): Promise<{ campaigns: CampaignRecord[]; total: number; limit: number; offset: number }> {
    let campaigns = await this.repository.findAllNewestFirst();

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

  async getCampaign(id: string): Promise<{ campaign: CampaignRecord } | null> {
    const campaign = await this.repository.findById(id);
    if (!campaign) return null;
    return { campaign };
  }

  async cloneCampaign(id: string, options?: { title?: string }): Promise<{ campaign: CampaignRecord } | { error: 'NOT_FOUND' }> {
    const original = await this.repository.findById(id);
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

    const created = await this.repository.create(cloned);
    for (const target of clonedTargets) {
      target.campaignId = created.id;
      await this.repository.addTarget(created.id, target);
    }

    return { campaign: (await this.repository.findById(created.id))! };
  }

  async markReady(campaignId: string): Promise<{ campaign: CampaignRecord } | { error: 'NO_TARGETS' | 'NOT_FOUND' | 'INVALID_STATUS' }> {
    const campaign = await this.repository.findById(campaignId);
    if (!campaign) return { error: 'NOT_FOUND' };
    if (campaign.targets.length === 0) return { error: 'NO_TARGETS' };
    if (campaign.status !== 'draft') return { error: 'INVALID_STATUS' };

    const updated = await this.repository.update(campaignId, {
      status: 'ready',
      updatedAt: this.now().toISOString(),
    });

    return { campaign: updated! };
  }

  async launch(campaignId: string): Promise<{ campaign: CampaignRecord } | { error: 'NOT_FOUND' | 'NOT_READY' }> {
    const campaign = await this.repository.findById(campaignId);
    if (!campaign) return { error: 'NOT_FOUND' };
    if (campaign.status !== 'ready') return { error: 'NOT_READY' };

    const updated = await this.repository.update(campaignId, {
      status: 'launching',
      updatedAt: this.now().toISOString(),
    });

    return { campaign: updated! };
  }

  async updateTargetStatus(
    campaignId: string,
    targetId: string,
    status: CampaignTargetRecord['status'],
    extra?: { youtubeVideoId?: string; errorMessage?: string | null },
  ): Promise<{ target: CampaignTargetRecord } | null> {
    const updates: Partial<CampaignTargetRecord> = {
      status,
      updatedAt: this.now().toISOString(),
    };

    if (extra?.youtubeVideoId) updates.youtubeVideoId = extra.youtubeVideoId;
    if (extra && 'errorMessage' in extra) updates.errorMessage = extra.errorMessage ?? null;

    const target = await this.repository.updateTarget(campaignId, targetId, updates);
    if (!target) return null;

    // Check if target progress changed overall campaign lifecycle state
    const campaign = await this.repository.findById(campaignId);
    if (campaign) {
      const allDone = campaign.targets.every((t) => t.status === 'publicado' || t.status === 'erro');
      if (allDone) {
        const anySuccess = campaign.targets.some((t) => t.status === 'publicado');
        await this.repository.update(campaignId, {
          status: anySuccess ? 'completed' : 'failed',
          updatedAt: this.now().toISOString(),
        });
      } else if (campaign.status !== 'draft' && campaign.status !== 'ready' && campaign.status !== 'launching') {
        await this.repository.update(campaignId, {
          status: 'launching',
          updatedAt: this.now().toISOString(),
        });
      }
    }

    return { target };
  }

  async deleteCampaign(campaignId: string): Promise<{ deleted: boolean } | { error: 'NOT_FOUND' | 'CAMPAIGN_ACTIVE' }> {
    const campaign = await this.repository.findById(campaignId);
    if (!campaign) return { error: 'NOT_FOUND' };
    if (campaign.status !== 'draft' && campaign.status !== 'ready') return { error: 'CAMPAIGN_ACTIVE' };

    return { deleted: await this.repository.delete(campaignId) };
  }

  async updateCampaign(
    campaignId: string,
    updates: { title?: string; scheduledAt?: string },
  ): Promise<{ campaign: CampaignRecord } | { error: 'NOT_FOUND' | 'CAMPAIGN_ACTIVE' }> {
    const campaign = await this.repository.findById(campaignId);
    if (!campaign) return { error: 'NOT_FOUND' };
    if (campaign.status !== 'draft' && campaign.status !== 'ready') return { error: 'CAMPAIGN_ACTIVE' };

    const patch: Partial<CampaignRecord> = { updatedAt: this.now().toISOString() };
    if (updates.title) patch.title = updates.title;
    if (updates.scheduledAt !== undefined) patch.scheduledAt = updates.scheduledAt;

    const updated = await this.repository.update(campaignId, patch);
    return { campaign: updated! };
  }
}
