import { describe, expect, test } from 'vitest';

import { CampaignService, InMemoryCampaignRepository } from '../../apps/api/src/campaigns/campaign.service';

function createService() {
  return new CampaignService({ repository: new InMemoryCampaignRepository() });
}

describe('campaign service target mutation hardening', () => {
  test('updateTarget rejects updates after launch and preserves the original target data', async () => {
    const service = createService();

    const { campaign } = await service.createCampaign({ title: 'Live', videoAssetId: 'asset-1' });
    const { target } = await service.addTarget(campaign.id, {
      channelId: 'ch-1',
      videoTitle: 'Original Title',
      videoDescription: 'Original Desc',
    });
    await service.markReady(campaign.id);
    await service.launch(campaign.id);

    const result = await service.updateTarget(campaign.id, target.id, {
      videoTitle: 'Changed After Launch',
    });

    expect(result).toEqual({ error: 'CAMPAIGN_ACTIVE' });

    const updated = await service.getCampaign(campaign.id);
    expect(updated!.campaign.targets[0].videoTitle).toBe('Original Title');
  });

  test('removeTarget and addTarget are blocked after launch', async () => {
    const service = createService();

    const { campaign } = await service.createCampaign({ title: 'Live', videoAssetId: 'asset-1' });
    const { target } = await service.addTarget(campaign.id, {
      channelId: 'ch-1',
      videoTitle: 'Original Title',
      videoDescription: 'Original Desc',
    });
    await service.markReady(campaign.id);
    await service.launch(campaign.id);

    const removed = await service.removeTarget(campaign.id, target.id);
    expect(removed).toBe(false);

    await expect(
      service.addTarget(campaign.id, {
        channelId: 'ch-2',
        videoTitle: 'New Title',
        videoDescription: 'New Desc',
      }),
    ).rejects.toThrow(/active|launch/i);

    const persisted = await service.getCampaign(campaign.id);
    expect(persisted!.campaign.targets).toHaveLength(1);
  });
});
