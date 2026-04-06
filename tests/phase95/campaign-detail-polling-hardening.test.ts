import { describe, expect, test } from 'vitest';

import {
  buildCampaignDetailView,
  type CampaignDetailData,
} from '../../apps/web/components/campaigns/campaign-detail';

const baseCampaign: CampaignDetailData = {
  id: 'camp-1',
  title: 'Polling Guard',
  videoAssetName: 'intro.mp4',
  status: 'ready',
  targets: [
    {
      id: 'target-1',
      channelTitle: 'Main Channel',
      videoTitle: 'First Upload',
      status: 'aguardando',
      youtubeVideoId: null,
      errorMessage: null,
    },
  ],
  createdAt: '2026-04-01T00:00:00Z',
};

describe('campaign detail polling hardening', () => {
  test('does not enable polling for a ready campaign that has not started launching yet', () => {
    const view = buildCampaignDetailView(baseCampaign);

    expect(view.pollingEnabled).toBe(false);
  });

  test('does not enable polling for an empty draft campaign', () => {
    const view = buildCampaignDetailView({
      ...baseCampaign,
      status: 'draft',
      targets: [],
    });

    expect(view.pollingEnabled).toBe(false);
    expect(view.progress).toMatchObject({ completed: 0, total: 0 });
  });
});
