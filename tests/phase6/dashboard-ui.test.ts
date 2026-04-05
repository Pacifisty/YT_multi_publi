import { describe, expect, test } from 'vitest';

import {
  buildDashboardView,
  type DashboardData,
} from '../../apps/web/components/campaigns/dashboard';

describe('buildDashboardView', () => {
  test('renders summary cards from stats', () => {
    const data: DashboardData = {
      campaigns: { total: 10, byStatus: { draft: 2, ready: 1, launching: 1, completed: 5, failed: 1 } },
      targets: { total: 30, byStatus: { aguardando: 3, enviando: 2, publicado: 20, erro: 5 }, successRate: 66.67 },
      jobs: { total: 40, byStatus: { queued: 2, processing: 1, completed: 30, failed: 7 }, totalRetries: 5 },
      channels: [
        { channelId: 'ch-1', totalTargets: 15, published: 12, failed: 3, successRate: 80 },
        { channelId: 'ch-2', totalTargets: 15, published: 8, failed: 2, successRate: 53.33 },
      ],
    };

    const view = buildDashboardView(data);

    expect(view.summaryCards).toHaveLength(4);
    expect(view.summaryCards[0]).toMatchObject({ label: 'Total Campaigns', value: 10 });
    expect(view.summaryCards[1]).toMatchObject({ label: 'Published Videos', value: 20 });
    expect(view.summaryCards[2]).toMatchObject({ label: 'Success Rate', value: '66.67%' });
    expect(view.summaryCards[3]).toMatchObject({ label: 'Failed Uploads', value: 5 });
  });

  test('renders campaign status breakdown', () => {
    const data: DashboardData = {
      campaigns: { total: 5, byStatus: { draft: 1, ready: 1, launching: 1, completed: 1, failed: 1 } },
      targets: { total: 0, byStatus: { aguardando: 0, enviando: 0, publicado: 0, erro: 0 }, successRate: 0 },
      jobs: { total: 0, byStatus: { queued: 0, processing: 0, completed: 0, failed: 0 }, totalRetries: 0 },
      channels: [],
    };

    const view = buildDashboardView(data);

    expect(view.campaignBreakdown).toEqual([
      { status: 'draft', count: 1 },
      { status: 'ready', count: 1 },
      { status: 'launching', count: 1 },
      { status: 'completed', count: 1 },
      { status: 'failed', count: 1 },
    ]);
  });

  test('renders channel leaderboard sorted by published desc', () => {
    const data: DashboardData = {
      campaigns: { total: 0, byStatus: { draft: 0, ready: 0, launching: 0, completed: 0, failed: 0 } },
      targets: { total: 0, byStatus: { aguardando: 0, enviando: 0, publicado: 0, erro: 0 }, successRate: 0 },
      jobs: { total: 0, byStatus: { queued: 0, processing: 0, completed: 0, failed: 0 }, totalRetries: 0 },
      channels: [
        { channelId: 'ch-low', totalTargets: 5, published: 2, failed: 3, successRate: 40 },
        { channelId: 'ch-high', totalTargets: 10, published: 9, failed: 1, successRate: 90 },
        { channelId: 'ch-mid', totalTargets: 8, published: 5, failed: 3, successRate: 62.5 },
      ],
    };

    const view = buildDashboardView(data);

    expect(view.channelLeaderboard).toHaveLength(3);
    expect(view.channelLeaderboard[0].channelId).toBe('ch-high');
    expect(view.channelLeaderboard[1].channelId).toBe('ch-mid');
    expect(view.channelLeaderboard[2].channelId).toBe('ch-low');
  });

  test('empty dashboard renders zero-state', () => {
    const data: DashboardData = {
      campaigns: { total: 0, byStatus: { draft: 0, ready: 0, launching: 0, completed: 0, failed: 0 } },
      targets: { total: 0, byStatus: { aguardando: 0, enviando: 0, publicado: 0, erro: 0 }, successRate: 0 },
      jobs: { total: 0, byStatus: { queued: 0, processing: 0, completed: 0, failed: 0 }, totalRetries: 0 },
      channels: [],
    };

    const view = buildDashboardView(data);

    expect(view.isEmpty).toBe(true);
    expect(view.summaryCards[0].value).toBe(0);
    expect(view.channelLeaderboard).toHaveLength(0);
  });
});
