import { describe, it, expect, vi } from 'vitest';
import { bootstrap } from '../../apps/api/src/bootstrap';
import { createServer } from '../../apps/api/src/server';
import { PrismaCampaignRepository } from '../../apps/api/src/campaigns/prisma-campaign.repository';

// Minimal mock Prisma client for testing
function makeMockPrisma() {
  const campaigns: any[] = [];
  const targets: any[] = [];

  return {
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    campaign: {
      create: vi.fn(async ({ data }: any) => {
        const record = { ...data, targets: [] };
        campaigns.push(record);
        return record;
      }),
      findUnique: vi.fn(async ({ where }: any) => {
        const c = campaigns.find((c: any) => c.id === where.id);
        if (!c) return null;
        return { ...c, targets: targets.filter((t: any) => t.campaignId === c.id) };
      }),
      findMany: vi.fn(async () =>
        campaigns.map((c) => ({
          ...c,
          targets: targets.filter((t: any) => t.campaignId === c.id),
        })),
      ),
      update: vi.fn(async ({ where, data }: any) => {
        const c = campaigns.find((c: any) => c.id === where.id);
        if (!c) return null;
        Object.assign(c, data);
        return { ...c, targets: targets.filter((t: any) => t.campaignId === c.id) };
      }),
      delete: vi.fn(async ({ where }: any) => {
        const idx = campaigns.findIndex((c: any) => c.id === where.id);
        if (idx === -1) return null;
        return campaigns.splice(idx, 1)[0];
      }),
    },
    campaignTarget: {
      create: vi.fn(async ({ data }: any) => {
        targets.push(data);
        return data;
      }),
      delete: vi.fn(async ({ where }: any) => {
        const idx = targets.findIndex((t: any) => t.id === where.id);
        if (idx === -1) return null;
        return targets.splice(idx, 1)[0];
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const t = targets.find((t: any) => t.id === where.id);
        if (!t) return null;
        Object.assign(t, data);
        return t;
      }),
    },
    _data: { campaigns, targets },
  };
}

const baseEnv = {
  OAUTH_TOKEN_KEY: 'a]3Fk9$2mP!xL7nQ&vR4wY6zA0cE8gI5',
  NODE_ENV: 'development',
  ADMIN_EMAIL: 'admin@example.com',
  ADMIN_PASSWORD_HASH: 'plain:secret123',
  DATABASE_URL: 'postgresql://localhost:5432/test',
  GOOGLE_CLIENT_ID: 'google-client-id',
  GOOGLE_CLIENT_SECRET: 'google-client-secret',
  GOOGLE_REDIRECT_URI: 'http://localhost:3000/auth/callback',
};

describe('createServer accepts repository option', () => {
  it('forwards repository to the app campaign service', async () => {
    const mockPrisma = makeMockPrisma();
    const repo = new PrismaCampaignRepository(mockPrisma as any);

    const server = createServer({
      env: baseEnv,
      campaignsModuleOptions: { repository: repo },
    });

    // Create a campaign through the app — it should use our Prisma repo
    await server.app.campaignsModule.campaignService.createCampaign({
      title: 'Prisma Test',
      videoAssetId: 'v-1',
    });

    // Verify it went through the mock Prisma client
    expect(mockPrisma.campaign.create).toHaveBeenCalledTimes(1);
  });

  it('defaults to in-memory when no repository provided', async () => {
    const server = createServer({ env: baseEnv });

    const { campaign } = await server.app.campaignsModule.campaignService.createCampaign({
      title: 'In-Memory',
      videoAssetId: 'v-1',
    });

    expect(campaign.title).toBe('In-Memory');
    // Should work fine with default in-memory repo
    const { campaigns } = await server.app.campaignsModule.campaignService.listCampaigns();
    expect(campaigns).toHaveLength(1);
  });
});

describe('bootstrap wires Prisma repository to app', () => {
  it('injects PrismaCampaignRepository when DATABASE_URL is set', () => {
    const mockPrisma = makeMockPrisma();
    const result = bootstrap({
      env: { ...baseEnv, DATABASE_URL: 'postgresql://localhost:5432/test' },
      _prismaFactory: () => mockPrisma,
    });

    // The app should be using the Prisma repository, not in-memory
    expect(result.databaseProvider.campaignRepository).toBeInstanceOf(PrismaCampaignRepository);
  });

  it('creates campaign through Prisma repo when DATABASE_URL is set', async () => {
    const mockPrisma = makeMockPrisma();
    const result = bootstrap({
      env: { ...baseEnv, DATABASE_URL: 'postgresql://localhost:5432/test' },
      _prismaFactory: () => mockPrisma,
    });

    await result.server.app.campaignsModule.campaignService.createCampaign({
      title: 'Via Bootstrap',
      videoAssetId: 'v-1',
    });

    // The campaign should have been created through Prisma mock
    expect(mockPrisma.campaign.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.campaign.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: 'Via Bootstrap' }),
      }),
    );
  });

  it('uses in-memory when no _prismaFactory provided', async () => {
    // Without _prismaFactory, databaseProvider creates a broken Prisma repo
    // bootstrap should detect this and fall back to in-memory
    const result = bootstrap({ env: baseEnv });

    // Should still work — using in-memory fallback
    const { campaign } = await result.server.app.campaignsModule.campaignService.createCampaign({
      title: 'Default In-Memory',
      videoAssetId: 'v-1',
    });

    expect(campaign.title).toBe('Default In-Memory');
  });

  it('connect calls prisma.$connect', async () => {
    const mockPrisma = makeMockPrisma();
    const result = bootstrap({
      env: { ...baseEnv, DATABASE_URL: 'postgresql://localhost:5432/test' },
      _prismaFactory: () => mockPrisma,
    });

    await result.databaseProvider.connect();
    expect(mockPrisma.$connect).toHaveBeenCalled();
    expect(result.databaseProvider.isConnected()).toBe(true);
  });

  it('disconnect calls prisma.$disconnect', async () => {
    const mockPrisma = makeMockPrisma();
    const result = bootstrap({
      env: { ...baseEnv, DATABASE_URL: 'postgresql://localhost:5432/test' },
      _prismaFactory: () => mockPrisma,
    });

    await result.databaseProvider.connect();
    await result.databaseProvider.disconnect();
    expect(mockPrisma.$disconnect).toHaveBeenCalled();
    expect(result.databaseProvider.isConnected()).toBe(false);
  });
});

describe('End-to-end: bootstrap with Prisma CRUD', () => {
  it('full CRUD through bootstrapped app with Prisma repo', async () => {
    const mockPrisma = makeMockPrisma();
    const result = bootstrap({
      env: { ...baseEnv, DATABASE_URL: 'postgresql://localhost:5432/test' },
      _prismaFactory: () => mockPrisma,
    });

    const service = result.server.app.campaignsModule.campaignService;

    // Create
    const { campaign } = await service.createCampaign({
      title: 'E2E Prisma',
      videoAssetId: 'v-1',
    });
    expect(campaign.title).toBe('E2E Prisma');

    // List
    const { campaigns } = await service.listCampaigns();
    expect(campaigns).toHaveLength(1);

    // Get by ID
    const found = await service.getCampaign(campaign.id);
    expect(found).not.toBeNull();
    expect(found!.campaign.title).toBe('E2E Prisma');

    // Delete
    const deleted = await service.deleteCampaign(campaign.id);
    expect(deleted).toEqual({ deleted: true });
  });

  it('handles routes through bootstrap with Prisma repo', async () => {
    const mockPrisma = makeMockPrisma();
    const result = bootstrap({
      env: { ...baseEnv, DATABASE_URL: 'postgresql://localhost:5432/test' },
      _prismaFactory: () => mockPrisma,
    });

    const router = result.server.app.router;

    // Create campaign through router
    const createRes = await router.handle({
      method: 'POST',
      path: '/api/campaigns',
      session: { adminUser: { email: 'admin@test.com' } },
      body: { title: 'Router Prisma', videoAssetId: 'v-1' },
    });

    expect(createRes.status).toBe(201);
    expect(createRes.body.campaign.title).toBe('Router Prisma');
    expect(mockPrisma.campaign.create).toHaveBeenCalled();

    // List campaigns through router
    const listRes = await router.handle({
      method: 'GET',
      path: '/api/campaigns',
      session: { adminUser: { email: 'admin@test.com' } },
    });

    expect(listRes.status).toBe(200);
    expect(listRes.body.campaigns).toHaveLength(1);
  });
});
