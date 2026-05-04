import { describe, expect, test } from 'vitest';

import { buildGrowthPageView } from '../../apps/web/app/(admin)/workspace/growth/page';
import { buildWorkspaceLayout } from '../../apps/web/app/(admin)/workspace/layout';

describe('workspace layout includes Dashboard and Growth tabs', () => {
  test('layout has 5 tabs: Contas, Media, Campanhas, Dashboard, Growth', async () => {
    const mockFetcher = async () => ({
      status: 200,
      json: async () => ({ user: { email: 'admin@test.com' } }),
    });

    const view = await buildWorkspaceLayout({ fetcher: mockFetcher });

    expect(view.tabs).toHaveLength(5);
    expect(view.tabs![0].id).toBe('accounts');
    expect(view.tabs![0].label).toBe('Contas');
    expect(view.tabs![1].id).toBe('media');
    expect(view.tabs![2].id).toBe('campanhas');
    expect(view.tabs![3].id).toBe('dashboard');
    expect(view.tabs![3].label).toBe('Dashboard');
    expect(view.tabs![4].id).toBe('growth');
    expect(view.tabs![4].label).toBe('Growth');
  });

  test('Growth route view is available for the new workspace tab', () => {
    const view = buildGrowthPageView();

    expect(view.route).toBe('/workspace/growth');
    expect(view.heading).toBe('Growth');
    expect(view.sections.map((section) => section.id)).toEqual([
      'cockpit',
      'conteudo',
      'metricas',
      'campanhas',
      'relatorios',
    ]);
    expect(view.focusAreas).toEqual(['Sinais operacionais', 'Consistencia', 'Correcoes']);
  });
});
