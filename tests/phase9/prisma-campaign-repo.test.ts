import { describe, expect, test } from 'vitest';

import {
  PrismaCampaignRepository,
} from '../../apps/api/src/campaigns/prisma-campaign.repository';
import type { CampaignRecord, CampaignTargetRecord } from '../../apps/api/src/campaigns/campaign.service';

function makeMockPrisma() {
  const campaigns: any[] = [];
  const targets: any[] = [];

  return {
    campaign: {
      create: async ({ data }: any) => {
        const record = { ...data, targets: [] };
        campaigns.push(record);
        return record;
      },
      findUnique: async ({ where }: any) => {
        const c = campaigns.find((c: any) => c.id === where.id);
        if (!c) return null;
        return { ...c, targets: targets.filter((t: any) => t.campaignId === c.id) };
      },
      findMany: async ({ orderBy }: any) => {
        const sorted = [...campaigns].sort((a, b) => {
          const aTime = new Date(a.createdAt).getTime();
          const bTime = new Date(b.createdAt).getTime();
          return orderBy?.createdAt === 'desc' ? bTime - aTime : aTime - bTime;
        });
        return sorted.map((c) => ({
          ...c,
          targets: targets.filter((t: any) => t.campaignId === c.id),
        }));
      },
      update: async ({ where, data }: any) => {
        const c = campaigns.find((c: any) => c.id === where.id);
        if (!c) return null;
        Object.assign(c, data);
        return { ...c, targets: targets.filter((t: any) => t.campaignId === c.id) };
      },
      delete: async ({ where }: any) => {
        const idx = campaigns.findIndex((c: any) => c.id === where.id);
        if (idx === -1) return null;
        const [removed] = campaigns.splice(idx, 1);
        // Also remove targets
        const targetIdxs = targets
          .map((t: any, i: number) => (t.campaignId === removed.id ? i : -1))
          .filter((i: number) => i !== -1)
          .reverse();
        for (const i of targetIdxs) targets.splice(i, 1);
        return removed;
      },
    },
    campaignTarget: {
      create: async ({ data }: any) => {
        const record = { ...data };
        targets.push(record);
        return record;
      },
      delete: async ({ where }: any) => {
        const idx = targets.findIndex((t: any) => t.id === where.id);
        if (idx === -1) return null;
        return targets.splice(idx, 1)[0];
      },
      update: async ({ where, data }: any) => {
        const t = targets.find((t: any) => t.id === where.id);
        if (!t) return null;
        Object.assign(t, data);
        return t;
      },
    },
    _data: { campaigns, targets },
  };
}

describe('PrismaCampaignRepository', () => {
  test('create stores and returns a campaign', async () => {
    const prisma = makeMockPrisma();
    const repo = new PrismaCampaignRepository(prisma as any);

    const record: CampaignRecord = {
      id: 'c1',
      title: 'Test Campaign',
      videoAssetId: 'v1',
      status: 'draft',
      scheduledAt: null,
      targets: [],
      createdAt: '2026-04-01T00:00:00Z',
      updatedAt: '2026-04-01T00:00:00Z',
    };

    const result = await repo.create(record);
    expect(result.id).toBe('c1');
    expect(result.title).toBe('Test Campaign');
  });

  test('findById retrieves a campaign with targets', async () => {
    const prisma = makeMockPrisma();
    const repo = new PrismaCampaignRepository(prisma as any);

    const record: CampaignRecord = {
      id: 'c1',
      title: 'Findable',
      videoAssetId: 'v1',
      status: 'draft',
      scheduledAt: null,
      targets: [],
      createdAt: '2026-04-01T00:00:00Z',
      updatedAt: '2026-04-01T00:00:00Z',
    };
    await repo.create(record);

    const found = await repo.findById('c1');
    expect(found).not.toBeNull();
    expect(found!.title).toBe('Findable');
  });

  test('findById returns null for non-existent campaign', async () => {
    const prisma = makeMockPrisma();
    const repo = new PrismaCampaignRepository(prisma as any);

    const result = await repo.findById('nonexistent');
    expect(result).toBeNull();
  });

  test('findAllNewestFirst returns campaigns in reverse-chronological order', async () => {
    const prisma = makeMockPrisma();
    const repo = new PrismaCampaignRepository(prisma as any);

    await repo.create({
      id: 'c1', title: 'First', videoAssetId: 'v1', status: 'draft',
      scheduledAt: null, targets: [],
      createdAt: '2026-04-01T00:00:00Z', updatedAt: '2026-04-01T00:00:00Z',
    });
    await repo.create({
      id: 'c2', title: 'Second', videoAssetId: 'v1', status: 'draft',
      scheduledAt: null, targets: [],
      createdAt: '2026-04-02T00:00:00Z', updatedAt: '2026-04-02T00:00:00Z',
    });

    const all = await repo.findAllNewestFirst();
    expect(all).toHaveLength(2);
    expect(all[0].id).toBe('c2');
    expect(all[1].id).toBe('c1');
  });

  test('update modifies campaign fields', async () => {
    const prisma = makeMockPrisma();
    const repo = new PrismaCampaignRepository(prisma as any);

    await repo.create({
      id: 'c1', title: 'Original', videoAssetId: 'v1', status: 'draft',
      scheduledAt: null, targets: [],
      createdAt: '2026-04-01T00:00:00Z', updatedAt: '2026-04-01T00:00:00Z',
    });

    const updated = await repo.update('c1', { title: 'Updated', status: 'ready' });
    expect(updated).not.toBeNull();
    expect(updated!.title).toBe('Updated');
    expect(updated!.status).toBe('ready');
  });

  test('delete removes a campaign', async () => {
    const prisma = makeMockPrisma();
    const repo = new PrismaCampaignRepository(prisma as any);

    await repo.create({
      id: 'c1', title: 'Deletable', videoAssetId: 'v1', status: 'draft',
      scheduledAt: null, targets: [],
      createdAt: '2026-04-01T00:00:00Z', updatedAt: '2026-04-01T00:00:00Z',
    });

    const result = await repo.delete('c1');
    expect(result).toBe(true);

    const found = await repo.findById('c1');
    expect(found).toBeNull();
  });

  test('addTarget adds a target to a campaign', async () => {
    const prisma = makeMockPrisma();
    const repo = new PrismaCampaignRepository(prisma as any);

    await repo.create({
      id: 'c1', title: 'WithTargets', videoAssetId: 'v1', status: 'draft',
      scheduledAt: null, targets: [],
      createdAt: '2026-04-01T00:00:00Z', updatedAt: '2026-04-01T00:00:00Z',
    });

    const target: CampaignTargetRecord = {
      id: 't1', campaignId: 'c1', channelId: 'ch1',
      videoTitle: 'V', videoDescription: 'D', tags: [], privacy: 'private',
      thumbnailAssetId: null, status: 'aguardando',
      youtubeVideoId: null, errorMessage: null, retryCount: 0,
      createdAt: '2026-04-01T00:00:00Z', updatedAt: '2026-04-01T00:00:00Z',
    };

    const added = await repo.addTarget('c1', target);
    expect(added).not.toBeNull();
    expect(added!.id).toBe('t1');

    // Verify it appears in findById
    const campaign = await repo.findById('c1');
    expect(campaign!.targets).toHaveLength(1);
  });

  test('removeTarget removes a target from a campaign', async () => {
    const prisma = makeMockPrisma();
    const repo = new PrismaCampaignRepository(prisma as any);

    await repo.create({
      id: 'c1', title: 'C1', videoAssetId: 'v1', status: 'draft',
      scheduledAt: null, targets: [],
      createdAt: '2026-04-01T00:00:00Z', updatedAt: '2026-04-01T00:00:00Z',
    });

    await repo.addTarget('c1', {
      id: 't1', campaignId: 'c1', channelId: 'ch1',
      videoTitle: 'V', videoDescription: 'D', tags: [], privacy: 'private',
      thumbnailAssetId: null, status: 'aguardando',
      youtubeVideoId: null, errorMessage: null, retryCount: 0,
      createdAt: '2026-04-01T00:00:00Z', updatedAt: '2026-04-01T00:00:00Z',
    });

    const removed = await repo.removeTarget('c1', 't1');
    expect(removed).toBe(true);

    const campaign = await repo.findById('c1');
    expect(campaign!.targets).toHaveLength(0);
  });

  test('updateTarget modifies target fields', async () => {
    const prisma = makeMockPrisma();
    const repo = new PrismaCampaignRepository(prisma as any);

    await repo.create({
      id: 'c1', title: 'C1', videoAssetId: 'v1', status: 'draft',
      scheduledAt: null, targets: [],
      createdAt: '2026-04-01T00:00:00Z', updatedAt: '2026-04-01T00:00:00Z',
    });

    await repo.addTarget('c1', {
      id: 't1', campaignId: 'c1', channelId: 'ch1',
      videoTitle: 'V', videoDescription: 'D', tags: [], privacy: 'private',
      thumbnailAssetId: null, status: 'aguardando',
      youtubeVideoId: null, errorMessage: null, retryCount: 0,
      createdAt: '2026-04-01T00:00:00Z', updatedAt: '2026-04-01T00:00:00Z',
    });

    const updated = await repo.updateTarget('c1', 't1', {
      status: 'publicado',
      youtubeVideoId: 'yt-123',
    });

    expect(updated).not.toBeNull();
    expect(updated!.status).toBe('publicado');
    expect(updated!.youtubeVideoId).toBe('yt-123');
  });
});
