import { describe, it, expect, vi } from 'vitest';
import { CampaignService, type CampaignRepository, type CampaignRecord, type CampaignTargetRecord } from '../../apps/api/src/campaigns/campaign.service';
import { createCampaignsModule } from '../../apps/api/src/campaigns/campaigns.module';
import { createApiRouter } from '../../apps/api/src/router';
import type { ApiRequest } from '../../apps/api/src/router';

const authedSession = () => ({ adminUser: { email: 'admin@test.com' } });

// An async repository that wraps values in promises (simulates Prisma)
class AsyncMockRepository implements CampaignRepository {
  private campaigns: CampaignRecord[] = [];

  async create(record: CampaignRecord): Promise<CampaignRecord> {
    this.campaigns.push(record);
    return record;
  }

  async findById(id: string): Promise<CampaignRecord | null> {
    return this.campaigns.find((c) => c.id === id) ?? null;
  }

  async findAllNewestFirst(): Promise<CampaignRecord[]> {
    return [...this.campaigns].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async update(id: string, updates: Partial<CampaignRecord>): Promise<CampaignRecord | null> {
    const campaign = this.campaigns.find((c) => c.id === id);
    if (!campaign) return null;
    Object.assign(campaign, updates);
    return campaign;
  }

  async delete(id: string): Promise<boolean> {
    const index = this.campaigns.findIndex((c) => c.id === id);
    if (index === -1) return false;
    this.campaigns.splice(index, 1);
    return true;
  }

  async addTarget(campaignId: string, target: CampaignTargetRecord): Promise<CampaignTargetRecord | null> {
    const campaign = this.campaigns.find((c) => c.id === campaignId);
    if (!campaign) return null;
    campaign.targets.push(target);
    return target;
  }

  async removeTarget(campaignId: string, targetId: string): Promise<boolean> {
    const campaign = this.campaigns.find((c) => c.id === campaignId);
    if (!campaign) return false;
    const index = campaign.targets.findIndex((t) => t.id === targetId);
    if (index === -1) return false;
    campaign.targets.splice(index, 1);
    return true;
  }

  async updateTarget(campaignId: string, targetId: string, updates: Partial<CampaignTargetRecord>): Promise<CampaignTargetRecord | null> {
    const campaign = this.campaigns.find((c) => c.id === campaignId);
    if (!campaign) return null;
    const target = campaign.targets.find((t) => t.id === targetId);
    if (!target) return null;
    Object.assign(target, updates);
    return target;
  }
}

describe('Async Campaign Repository', () => {
  describe('CampaignService with async repository', () => {
    it('createCampaign returns a promise', async () => {
      const service = new CampaignService({ repository: new AsyncMockRepository() });
      const result = await service.createCampaign({ title: 'Test', videoAssetId: 'v-1' });
      expect(result.campaign).toBeDefined();
      expect(result.campaign.title).toBe('Test');
    });

    it('listCampaigns returns a promise', async () => {
      const service = new CampaignService({ repository: new AsyncMockRepository() });
      await service.createCampaign({ title: 'A', videoAssetId: 'v-1' });
      await service.createCampaign({ title: 'B', videoAssetId: 'v-2' });
      const result = await service.listCampaigns();
      expect(result.campaigns).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('getCampaign returns a promise', async () => {
      const service = new CampaignService({ repository: new AsyncMockRepository() });
      const { campaign } = await service.createCampaign({ title: 'Test', videoAssetId: 'v-1' });
      const result = await service.getCampaign(campaign.id);
      expect(result).not.toBeNull();
      expect(result!.campaign.title).toBe('Test');
    });

    it('addTarget works with async repository', async () => {
      const service = new CampaignService({ repository: new AsyncMockRepository() });
      const { campaign } = await service.createCampaign({ title: 'Test', videoAssetId: 'v-1' });
      const { target } = await service.addTarget(campaign.id, {
        channelId: 'ch-1',
        videoTitle: 'V',
        videoDescription: 'D',
      });
      expect(target.channelId).toBe('ch-1');
    });

    it('markReady works with async repository', async () => {
      const service = new CampaignService({ repository: new AsyncMockRepository() });
      const { campaign } = await service.createCampaign({ title: 'Test', videoAssetId: 'v-1' });
      await service.addTarget(campaign.id, { channelId: 'ch-1', videoTitle: 'V', videoDescription: 'D' });
      const result = await service.markReady(campaign.id);
      expect('campaign' in result && result.campaign.status).toBe('ready');
    });

    it('launch works with async repository', async () => {
      const service = new CampaignService({ repository: new AsyncMockRepository() });
      const { campaign } = await service.createCampaign({ title: 'Test', videoAssetId: 'v-1' });
      await service.addTarget(campaign.id, { channelId: 'ch-1', videoTitle: 'V', videoDescription: 'D' });
      await service.markReady(campaign.id);
      const result = await service.launch(campaign.id);
      expect('campaign' in result && result.campaign.status).toBe('launching');
    });

    it('deleteCampaign works with async repository', async () => {
      const service = new CampaignService({ repository: new AsyncMockRepository() });
      const { campaign } = await service.createCampaign({ title: 'Test', videoAssetId: 'v-1' });
      const result = await service.deleteCampaign(campaign.id);
      expect('deleted' in result && result.deleted).toBe(true);
    });

    it('cloneCampaign works with async repository', async () => {
      const service = new CampaignService({ repository: new AsyncMockRepository() });
      const { campaign } = await service.createCampaign({ title: 'Original', videoAssetId: 'v-1' });
      await service.addTarget(campaign.id, { channelId: 'ch-1', videoTitle: 'V', videoDescription: 'D' });
      const result = await service.cloneCampaign(campaign.id);
      expect('campaign' in result && result.campaign.title).toBe('Copy of Original');
    });
  });

  describe('end-to-end through router with async repo', () => {
    it('POST + GET campaign works with async repository', async () => {
      const campaignsModule = createCampaignsModule({ repository: new AsyncMockRepository() });
      const router = createApiRouter({ campaignsModule });

      const createReq: ApiRequest = {
        method: 'POST',
        path: '/api/campaigns',
        session: authedSession(),
        body: { title: 'E2E Test', videoAssetId: 'v-1' },
      };
      const createRes = await router.handle(createReq);
      expect(createRes.status).toBe(201);

      const listReq: ApiRequest = {
        method: 'GET',
        path: '/api/campaigns',
        session: authedSession(),
      };
      const listRes = await router.handle(listReq);
      expect(listRes.status).toBe(200);
      expect(listRes.body.campaigns).toHaveLength(1);
      expect(listRes.body.campaigns[0].title).toBe('E2E Test');
    });

    it('full lifecycle: create → add target → ready → launch', async () => {
      const campaignsModule = createCampaignsModule({ repository: new AsyncMockRepository() });
      const router = createApiRouter({ campaignsModule });

      // Create
      const createRes = await router.handle({
        method: 'POST',
        path: '/api/campaigns',
        session: authedSession(),
        body: { title: 'Lifecycle', videoAssetId: 'v-1' },
      });
      const campaignId = createRes.body.campaign.id;

      // Add target
      const targetRes = await router.handle({
        method: 'POST',
        path: `/api/campaigns/${campaignId}/targets`,
        session: authedSession(),
        body: { channelId: 'ch-1', videoTitle: 'V', videoDescription: 'D' },
      });
      expect(targetRes.status).toBe(201);

      // Mark ready
      const readyRes = await router.handle({
        method: 'POST',
        path: `/api/campaigns/${campaignId}/ready`,
        session: authedSession(),
      });
      expect(readyRes.status).toBe(200);

      // Launch
      const launchRes = await router.handle({
        method: 'POST',
        path: `/api/campaigns/${campaignId}/launch`,
        session: authedSession(),
      });
      expect(launchRes.status).toBe(200);
      expect(launchRes.body.campaign.status).toBe('launching');
    });
  });
});
