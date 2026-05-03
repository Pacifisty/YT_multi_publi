export interface GrowthPageView {
  route: '/workspace/growth';
  heading: 'Growth';
  summary: string;
  sections: Array<{
    id: string;
    label: string;
    href: string;
  }>;
  focusAreas: string[];
}

export function buildGrowthPageView(): GrowthPageView {
  return {
    route: '/workspace/growth',
    heading: 'Growth',
    summary: 'Growth turns connected account, campaign, channel, and failure signals into operational decisions for what to post, where to publish, what to fix, and what to repeat.',
    sections: [
      { id: 'cockpit', label: 'Cockpit', href: '/workspace/growth' },
      { id: 'conteudo', label: 'Conteudo', href: '/workspace/growth/conteudo' },
      { id: 'metricas', label: 'Metricas', href: '/workspace/growth/metricas' },
      { id: 'campanhas', label: 'Campanhas', href: '/workspace/growth/campanhas' },
      { id: 'relatorios', label: 'Relatorios', href: '/workspace/growth/relatorios' },
    ],
    focusAreas: ['Sinais operacionais', 'Consistencia', 'Correcoes'],
  };
}
