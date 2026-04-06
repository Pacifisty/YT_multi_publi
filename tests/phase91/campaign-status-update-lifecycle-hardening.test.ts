import { describe, expect, test } from 'vitest';

import { CampaignService, InMemoryCampaignRepository } from '../../apps/api/src/campaigns/campaign.service';

function createService() {
  return new CampaignService({ repository: new InMemoryCampaignRepository() });
}

describe('campaign status update lifecycle hardening', () => {
  test('updateTargetStatus does not bypass launch while the campaign is still draft', async () => {
    const service = createService();

    const { campaign } = await service.createCampaign({ title: 'Draft Campaign', videoAssetId: 'asset-1' });
    const { target } = await service.addTarget(campaign.id, {
      channelId: 'ch-1',
      videoTitle: 'Original Title',
      videoDescription: 'Original Desc',
    });

    const result = await service.updateTargetStatus(campaign.id, target.id, 'publicado', {
      youtubeVideoId: 'yt-draft',
    });

    expect(result).toBeNull();

    const persisted = await service.getCampaign(campaign.id);
    expect(persisted!.campaign.status).toBe('draft');
    expect(persisted!.campaign.targets[0].status).toBe('aguardando');
    expect(persisted!.campaign.targets[0].youtubeVideoId).toBeNull();
  });

  test('updateTargetStatus does not bypass launch while the campaign is only ready', async () => {
    const service = createService();

    const { campaign } = await service.createCampaign({ title: 'Ready Campaign', videoAssetId: 'asset-1' });
    const { target } = await service.addTarget(campaign.id, {
      channelId: 'ch-1',
      videoTitle: 'Original Title',
      videoDescription: 'Original Desc',
    });
    await service.markReady(campaign.id);

    const result = await service.updateTargetStatus(campaign.id, target.id, 'erro', {
      errorMessage: 'should not mutate before launch',
    });

    expect(result).toBeNull();

    const persisted = await service.getCampaign(campaign.id);
    expect(persisted!.campaign.status).toBe('ready');
    expect(persisted!.campaign.targets[0].status).toBe('aguardando');
    expect(persisted!.campaign.targets[0].errorMessage).toBeNull();
  });
});
