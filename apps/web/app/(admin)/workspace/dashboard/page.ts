import { buildDashboardView, type DashboardData, type DashboardView } from '../../../../components/campaigns/dashboard';

export interface DashboardPageData {
  stats: DashboardData;
}

export interface DashboardPageView {
  dashboard: DashboardView;
  emptyState?: {
    heading: string;
    body: string;
  };
}

export function buildDashboardPageView(data: DashboardPageData): DashboardPageView {
  const dashboard = buildDashboardView(data.stats);

  const view: DashboardPageView = { dashboard };

  if (dashboard.isEmpty) {
    view.emptyState = {
      heading: 'No data yet',
      body: 'Launch a campaign to see analytics here.',
    };
  }

  return view;
}
