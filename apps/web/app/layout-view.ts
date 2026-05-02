export interface AppLayoutView {
  lang: 'en';
  title: 'YT Multi Publi';
  rootId: 'app';
  assets: {
    stylesheet: '/app.css';
    script: '/app.js';
  };
  fonts: ['Inter', 'JetBrains Mono'];
}

export function buildAppLayout(): AppLayoutView {
  return {
    lang: 'en',
    title: 'YT Multi Publi',
    rootId: 'app',
    assets: {
      stylesheet: '/app.css',
      script: '/app.js',
    },
    fonts: ['Inter', 'JetBrains Mono'],
  };
}
