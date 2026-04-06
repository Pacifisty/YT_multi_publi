import { describe, expect, test } from 'vitest';

import { CampaignStatusService } from '../../apps/api/src/campaigns/campaign-status.service';
import { CampaignService, InMemoryCampaignRepository } from '../../apps/api/src/campaigns/campaign.service';
import { InMemoryPublishJobRepository, PublishJobService } from '../../apps/api/src/campaigns/publish-job.service';
import { buildCampaignDetailView, type CampaignDetailData } from '../../apps/web/components/campaigns/campaign-detail';

function createStack() {
  const campaignService = new CampaignService({ repository: new InMemoryCampaignRepository() });
  const jobService = new PublishJobService({ repository: new InMemoryPublishJobRepository() });
  const statusService = new CampaignStatusService({ campaignService, jobService });

  return { campaignService, statusService };
}

describe('campaign failed error reason hardening', () => {
  test('updateTargetStatus rejects erro status without an errorMessage and keeps polling active', async () => {
    const { campaignService, statusService } = createStack();

    const { campaign } = await campaignService.createCampaign({ title: 'Missing Failure Reason', videoAssetId: 'asset-1' });
    const { target } = await campaignService.addTarget(campaign.id, {
      channelId: 'ch-1',
      videoTitle: 'Video',
      videoDescription: 'Desc',
    });

    await campaignService.markReady(campaign.id);
    await campaignService.launch(campaign.id);

    const result = await campaignService.updateTargetStatus(campaign.id, target.id, 'erro');
    expect(result).toBeNull();

    const persisted = await campaignService.getCampaign(campaign.id);
    expect(persisted!.campaign.status).toBe('launching');
    expect(persisted!.campaign.targets[0]).toMatchObject({
      status: 'aguardando',
      errorMessage: null,
    });

    const liveStatus = await statusService.getStatus(campaign.id);
    expect(liveStatus!.shouldPoll).toBe(true);
    expect(liveStatus!.progress.failed).toBe(0);
  });

  test('campaign detail keeps polling when a failed target is missing its errorMessage', () => {
    const data: CampaignDetailData = {
      id: 'camp-1',
      title: 'Corrupted Campaign',
      videoAssetName: 'clip.mp4',
      status: 'launching',
      targets: [
        {
          id: 'target-1',
          channelTitle: 'Main Channel',
          videoTitle: 'Upload',
          status: 'erro',
          youtubeVideoId: null,
          errorMessage: null,
        },
      ],
      createdAt: '2026-04-01T00:00:00Z',
    };

    const view = buildCampaignDetailView(data);

    expect(view.pollingEnabled).toBe(true);
    expect(view.progress.completed).toBe(0);
    expect(view.targets[0].retryAvailable).toBe(true);
  });
});
