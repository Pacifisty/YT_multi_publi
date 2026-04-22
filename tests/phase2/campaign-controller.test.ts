import { describe, expect, test } from 'vitest';

import { CampaignsController } from '../../apps/api/src/campaigns/campaigns.controller';
import { CampaignService, InMemoryCampaignRepository } from '../../apps/api/src/campaigns/campaign.service';
import { SessionGuard } from '../../apps/api/src/auth/session.guard';
import { AccountPlanService } from '../../apps/api/src/account-plan/account-plan.service';

function createAuthenticatedRequest() {
  return {
    session: {
      adminUser: { email: 'admin@example.com' },
    },
  };
}

function createUnauthenticatedRequest() {
  return {
    session: {},
  };
}

describe('campaigns controller', () => {
  test('POST /campaigns creates a draft campaign', async () => {
    const repository = new InMemoryCampaignRepository();
    const service = new CampaignService({ repository });
    const controller = new CampaignsController(service, new SessionGuard());

    const response = await controller.create({
      ...createAuthenticatedRequest(),
      body: {
        title: 'My Launch',
        videoAssetId: 'asset-1',
      },
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      campaign: {
        title: 'My Launch',
        videoAssetId: 'asset-1',
        status: 'draft',
      },
    });
  });

  test('POST /campaigns returns 401 without session', async () => {
    const repository = new InMemoryCampaignRepository();
    const service = new CampaignService({ repository });
    const controller = new CampaignsController(service, new SessionGuard());

    const response = await controller.create({
      ...createUnauthenticatedRequest(),
      body: {
        title: 'My Launch',
        videoAssetId: 'asset-1',
      },
    });

    expect(response.status).toBe(401);
  });

  test('POST /campaigns returns 400 for missing title', async () => {
    const repository = new InMemoryCampaignRepository();
    const service = new CampaignService({ repository });
    const controller = new CampaignsController(service, new SessionGuard());

    const response = await controller.create({
      ...createAuthenticatedRequest(),
      body: {
        videoAssetId: 'asset-1',
      },
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: expect.stringContaining('title') });
  });

  test('GET /campaigns returns list newest-first', async () => {
    const repository = new InMemoryCampaignRepository();
    const service = new CampaignService({ repository });
    const controller = new CampaignsController(service, new SessionGuard());

    await service.createCampaign({ title: 'First', videoAssetId: 'a1' });
    await service.createCampaign({ title: 'Second', videoAssetId: 'a2' });

    const response = await controller.list(createAuthenticatedRequest());

    expect(response.status).toBe(200);
    expect(response.body.campaigns).toHaveLength(2);
    expect(response.body.campaigns[0].title).toBe('Second');
  });

  test('GET /campaigns/:id returns campaign with targets', async () => {
    const repository = new InMemoryCampaignRepository();
    const service = new CampaignService({ repository });
    const controller = new CampaignsController(service, new SessionGuard());

    const { campaign } = await service.createCampaign({ title: 'Detail', videoAssetId: 'a1' });

    const response = await controller.getById({
      ...createAuthenticatedRequest(),
      params: { id: campaign.id },
    });

    expect(response.status).toBe(200);
    expect(response.body.campaign.title).toBe('Detail');
  });

  test('GET /campaigns/:id returns 404 for missing campaign', async () => {
    const repository = new InMemoryCampaignRepository();
    const service = new CampaignService({ repository });
    const controller = new CampaignsController(service, new SessionGuard());

    const response = await controller.getById({
      ...createAuthenticatedRequest(),
      params: { id: 'nonexistent' },
    });

    expect(response.status).toBe(404);
  });

  test('POST /campaigns/:id/targets adds a target', async () => {
    const repository = new InMemoryCampaignRepository();
    const service = new CampaignService({ repository });
    const controller = new CampaignsController(service, new SessionGuard());

    const { campaign } = await service.createCampaign({ title: 'Camp', videoAssetId: 'a1' });

    const response = await controller.addTarget({
      ...createAuthenticatedRequest(),
      params: { id: campaign.id },
      body: {
        channelId: 'channel-1',
        videoTitle: 'Test Video',
        videoDescription: 'Test Desc',
      },
    });

    expect(response.status).toBe(201);
    expect(response.body.target.videoTitle).toBe('Test Video');
  });

  test('POST /campaigns/:id/launch transitions to launching', async () => {
    const repository = new InMemoryCampaignRepository();
    const service = new CampaignService({ repository });
    const controller = new CampaignsController(service, new SessionGuard());

    const { campaign } = await service.createCampaign({ title: 'Camp', videoAssetId: 'a1' });
    await service.addTarget(campaign.id, {
      channelId: 'ch-1',
      videoTitle: 'T',
      videoDescription: 'D',
    });
    await service.markReady(campaign.id);

    const response = await controller.launch({
      ...createAuthenticatedRequest(),
      params: { id: campaign.id },
    });

    expect(response.status).toBe(200);
    expect(response.body.campaign.status).toBe('launching');
  });

  test('POST /campaigns/:id/launch rejects draft campaign', async () => {
    const repository = new InMemoryCampaignRepository();
    const service = new CampaignService({ repository });
    const controller = new CampaignsController(service, new SessionGuard());

    const { campaign } = await service.createCampaign({ title: 'Camp', videoAssetId: 'a1' });

    const response = await controller.launch({
      ...createAuthenticatedRequest(),
      params: { id: campaign.id },
    });

    expect(response.status).toBe(400);
  });

  test('POST /campaigns/:id/targets blocks instagram target for non-pro plans', async () => {
    const repository = new InMemoryCampaignRepository();
    const service = new CampaignService({ repository });
    const accountPlanService = new AccountPlanService();
    const controller = new CampaignsController(service, new SessionGuard(), undefined, undefined, undefined, undefined, undefined, accountPlanService);

    const { campaign } = await service.createCampaign({ title: 'Camp', videoAssetId: 'a1' });

    const response = await controller.addTarget({
      ...createAuthenticatedRequest(),
      params: { id: campaign.id },
      body: {
        platform: 'instagram',
        destinationId: 'ig-destination-1',
        videoTitle: 'Instagram Video',
        videoDescription: 'Instagram Desc',
      },
    });

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      error: expect.stringContaining('PRO'),
    });
  });

  test('POST /campaigns/:id/launch charges tokens and blocks launch when balance is insufficient', async () => {
    const repository = new InMemoryCampaignRepository();
    const service = new CampaignService({ repository });
    const accountPlanService = new AccountPlanService();
    const controller = new CampaignsController(service, new SessionGuard(), undefined, undefined, undefined, undefined, undefined, accountPlanService);

    const { campaign } = await service.createCampaign({ title: 'Camp', videoAssetId: 'a1' });
    await service.addTarget(campaign.id, {
      channelId: 'ch-1',
      videoTitle: 'T',
      videoDescription: 'D',
    });
    await service.markReady(campaign.id);

    const firstLaunch = await controller.launch({
      ...createAuthenticatedRequest(),
      params: { id: campaign.id },
    });
    expect(firstLaunch.status).toBe(402);

    await accountPlanService.selectPlan('admin@example.com', 'FREE');
    await accountPlanService.claimDailyVisit('admin@example.com');

    const secondLaunch = await controller.launch({
      ...createAuthenticatedRequest(),
      params: { id: campaign.id },
    });

    expect(secondLaunch.status).toBe(200);

    const account = await accountPlanService.getAccount('admin@example.com');
    expect(account.tokens).toBe(5);
  });
});
