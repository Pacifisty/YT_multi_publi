import { describe, expect, test } from 'vitest';

import { CampaignService, InMemoryCampaignRepository } from '../../apps/api/src/campaigns/campaign.service';
import { buildCampaignDetailView, type CampaignDetailData } from '../../apps/web/components/campaigns/campaign-detail';

describe('campaign stale youtube id hardening', () => {
  test('updateTargetStatus clears a stale youtubeVideoId when a published target later fails', async () => {
    const service = new CampaignService({ repository: new InMemoryCampaignRepository() });

    const { campaign } = await service.createCampaign({ title: 'Stale Id', videoAssetId: 'asset-1' });
    const { target } = await service.addTarget(campaign.id, {
      channelId: 'ch-1',
      videoTitle: 'Video',
      videoDescription: 'Desc',
    });

    await service.markReady(campaign.id);
    await service.launch(campaign.id);
    await service.updateTargetStatus(campaign.id, target.id, 'publicado', { youtubeVideoId: 'yt-123' });
    await service.updateTargetStatus(campaign.id, target.id, 'erro', { errorMessage: 'quotaExceeded' });

    const persisted = await service.getCampaign(campaign.id);
    expect(persisted!.campaign.targets[0]).toMatchObject({
      status: 'erro',
      youtubeVideoId: null,
      errorMessage: 'quotaExceeded',
    });
  });

  test('campaign detail hides youtube links for non-published targets even when a stale video id exists', () => {
    const data: CampaignDetailData = {
      id: 'camp-1',
      title: 'Partial Launch',
      videoAssetName: 'clip.mp4',
      status: 'failed',
      targets: [
        {
          id: 'target-1',
          channelTitle: 'Main Channel',
          videoTitle: 'Upload',
          status: 'erro',
          youtubeVideoId: 'yt-stale',
          errorMessage: 'quotaExceeded',
        },
      ],
      createdAt: '2026-04-01T00:00:00Z',
    };

    const view = buildCampaignDetailView(data);

    expect(view.targets[0].youtubeUrl).toBeUndefined();
  });
});
