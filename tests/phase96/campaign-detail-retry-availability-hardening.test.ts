import { describe, expect, test } from 'vitest';

import {
  buildCampaignDetailView,
  type CampaignDetailData,
} from '../../apps/web/components/campaigns/campaign-detail';

const baseCampaign: CampaignDetailData = {
  id: 'camp-1',
  title: 'Retry UI Guard',
  videoAssetName: 'intro.mp4',
  status: 'failed',
  targets: [
    {
      id: 'target-1',
      channelTitle: 'Main Channel',
      videoTitle: 'Failed Upload',
      status: 'erro',
      youtubeVideoId: null,
      errorMessage: 'quotaExceeded',
      retryCount: 1,
    },
  ],
  createdAt: '2026-04-01T00:00:00Z',
};

describe('campaign detail retry availability hardening', () => {
  test('failed targets still expose retry when retryCount is below the default limit and maxRetries is omitted', () => {
    const view = buildCampaignDetailView(baseCampaign);

    expect(view.targets[0].retryAvailable).toBe(true);
  });

  test('failed targets stop exposing retry once retryCount reaches the default limit even without maxRetries', () => {
    const view = buildCampaignDetailView({
      ...baseCampaign,
      targets: [{
        ...baseCampaign.targets[0],
        retryCount: 3,
      }],
    });

    expect(view.targets[0].retryAvailable).toBe(false);
  });
});
