/**
 * Meta Tags Utilities
 * Helper functions for generating consistent meta tags across pages
 */

export interface PageMetadata {
  title: string;
  description: string;
  keywords?: string[];
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: 'website' | 'article' | 'product';
  twitterCard?: 'summary' | 'summary_large_image' | 'app' | 'player';
  canonical?: string;
  robots?: 'index, follow' | 'noindex, follow' | 'index, nofollow' | 'noindex, nofollow';
}

export const createMetadataObject = (meta: PageMetadata) => ({
  title: meta.title,
  description: meta.description,
  keywords: meta.keywords || [],
  openGraph: {
    title: meta.ogTitle || meta.title,
    description: meta.ogDescription || meta.description,
    type: meta.ogType || 'website',
    ...(meta.ogImage && { image: meta.ogImage }),
  },
  twitter: {
    card: meta.twitterCard || 'summary_large_image',
    title: meta.ogTitle || meta.title,
    description: meta.ogDescription || meta.description,
    ...(meta.ogImage && { image: meta.ogImage }),
  },
  robots: meta.robots || 'index, follow',
  ...(meta.canonical && { alternates: { canonical: meta.canonical } }),
});

/**
 * Common page metadata definitions
 */

export const pageMetadata = {
  home: {
    title: 'YT Multi Publi - Multi-Platform Video Publishing',
    description:
      'Centralize your video publishing workflow. Connect YouTube, TikTok, and Instagram accounts to publish, schedule, and manage content across all platforms from one dashboard.',
    keywords: [
      'video publishing',
      'multi-platform posting',
      'YouTube TikTok Instagram',
      'content management',
      'social media scheduling',
    ],
    ogImage: 'https://ytmultipubli.com/og-home.png',
  },
  login: {
    title: 'Sign In | YT Multi Publi',
    description: 'Sign in to your YT Multi Publi account to access your publishing dashboard.',
    robots: 'noindex, follow',
    canonical: 'https://ytmultipubli.com/login',
  },
  onboarding: {
    title: 'Choose Your Plan | YT Multi Publi',
    description: 'Select the perfect plan for your video publishing needs. Free forever or upgrade for advanced features.',
    robots: 'noindex, follow',
    canonical: 'https://ytmultipubli.com/onboarding/plan',
  },
  dashboard: {
    title: 'Dashboard | YT Multi Publi',
    description: 'Your unified dashboard to manage videos across YouTube, TikTok, and Instagram.',
    robots: 'noindex, follow',
    canonical: 'https://ytmultipubli.com/workspace/dashboard',
  },
  accounts: {
    title: 'Manage Accounts | YT Multi Publi',
    description: 'Connect and manage your YouTube, TikTok, and Instagram accounts.',
    robots: 'noindex, follow',
    canonical: 'https://ytmultipubli.com/workspace/accounts',
  },
  campaigns: {
    title: 'Campaigns | YT Multi Publi',
    description: 'Create, manage, and publish video campaigns across all connected platforms.',
    robots: 'noindex, follow',
    canonical: 'https://ytmultipubli.com/workspace/campanhas',
  },
  media: {
    title: 'Media Library | YT Multi Publi',
    description: 'Upload, organize, and manage your video assets.',
    robots: 'noindex, follow',
    canonical: 'https://ytmultipubli.com/workspace/media',
  },
};
