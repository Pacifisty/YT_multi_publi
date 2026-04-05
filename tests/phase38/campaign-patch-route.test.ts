import { describe, it, expect, beforeEach } from 'vitest';
import { createApiRouter } from '../../apps/api/src/router';
import { createCampaignsModule, type CampaignsModuleInstance } from '../../apps/api/src/campaigns/campaigns.module';

const authedSession = { adminUser: { email: 'admin@test.com' } };

describe('API Router — campaign PATCH route', () => {
  let router: ReturnType<typeof createApiRouter>;
  let campaignsModule: CampaignsModuleInstance;

  beforeEach(() => {
    campaignsModule = createCampaignsModule();
    router = createApiRouter({ campaignsModule });
  });

  function createCampaign() {
    return campaignsModule.campaignService.createCampaign({
      title: 'Original Title',
      videoAssetId: 'video-1',
    });
  }

  it('PATCH /api/campaigns/:id updates campaign title', async () => {
    const { campaign } = createCampaign();

    const res = await router.handle({
      method: 'PATCH',
      path: `/api/campaigns/${campaign.id}`,
      session: authedSession,
      body: { title: 'Updated Title' },
    });

    expect(res.status).toBe(200);
    expect(res.body.campaign.title).toBe('Updated Title');
    expect(res.body.campaign.id).toBe(campaign.id);
  });

  it('PATCH /api/campaigns/:id updates scheduledAt', async () => {
    const { campaign } = createCampaign();
    const scheduled = '2025-12-25T10:00:00Z';

    const res = await router.handle({
      method: 'PATCH',
      path: `/api/campaigns/${campaign.id}`,
      session: authedSession,
      body: { scheduledAt: scheduled },
    });

    expect(res.status).toBe(200);
    expect(res.body.campaign.scheduledAt).toBe(scheduled);
  });

  it('PATCH /api/campaigns/:id updates both title and scheduledAt', async () => {
    const { campaign } = createCampaign();

    const res = await router.handle({
      method: 'PATCH',
      path: `/api/campaigns/${campaign.id}`,
      session: authedSession,
      body: { title: 'New Title', scheduledAt: '2025-12-31T00:00:00Z' },
    });

    expect(res.status).toBe(200);
    expect(res.body.campaign.title).toBe('New Title');
    expect(res.body.campaign.scheduledAt).toBe('2025-12-31T00:00:00Z');
  });

  it('returns 404 for unknown campaign', async () => {
    const res = await router.handle({
      method: 'PATCH',
      path: '/api/campaigns/nonexistent-id',
      session: authedSession,
      body: { title: 'Nope' },
    });

    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it('returns 400 for active campaign', async () => {
    const { campaign } = createCampaign();
    // Add target and launch to make it active
    campaignsModule.campaignService.addTarget(campaign.id, {
      channelId: 'ch-1',
      videoTitle: 'V',
      videoDescription: 'D',
    });
    campaignsModule.campaignService.markReady(campaign.id);
    campaignsModule.campaignService.launch(campaign.id);

    const res = await router.handle({
      method: 'PATCH',
      path: `/api/campaigns/${campaign.id}`,
      session: authedSession,
      body: { title: 'Should Fail' },
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 401 for unauthenticated request', async () => {
    const { campaign } = createCampaign();

    const res = await router.handle({
      method: 'PATCH',
      path: `/api/campaigns/${campaign.id}`,
      session: null,
      body: { title: 'No Auth' },
    });

    expect(res.status).toBe(401);
  });

  it('preserves original title when only scheduledAt is sent', async () => {
    const { campaign } = createCampaign();

    const res = await router.handle({
      method: 'PATCH',
      path: `/api/campaigns/${campaign.id}`,
      session: authedSession,
      body: { scheduledAt: '2025-11-01T00:00:00Z' },
    });

    expect(res.status).toBe(200);
    expect(res.body.campaign.title).toBe('Original Title');
    expect(res.body.campaign.scheduledAt).toBe('2025-11-01T00:00:00Z');
  });

  it('preserves original scheduledAt when only title is sent', async () => {
    const { campaign } = createCampaign();

    // First set a schedule
    await router.handle({
      method: 'PATCH',
      path: `/api/campaigns/${campaign.id}`,
      session: authedSession,
      body: { scheduledAt: '2025-10-15T08:00:00Z' },
    });

    const res = await router.handle({
      method: 'PATCH',
      path: `/api/campaigns/${campaign.id}`,
      session: authedSession,
      body: { title: 'Only Title Changed' },
    });

    expect(res.status).toBe(200);
    expect(res.body.campaign.title).toBe('Only Title Changed');
    expect(res.body.campaign.scheduledAt).toBe('2025-10-15T08:00:00Z');
  });
});
