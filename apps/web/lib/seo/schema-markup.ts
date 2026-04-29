/**
 * Schema Markup Generators for SEO
 * JSON-LD structured data for Google, Bing, and other search engines
 */

export const createOrganizationSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'YT Multi Publi',
  url: 'https://ytmultipubli.com',
  logo: 'https://ytmultipubli.com/logo.png',
  description:
    'Centralized multi-platform video publishing solution for YouTube, TikTok, and Instagram',
  sameAs: [
    'https://twitter.com/ytmultipubli',
    'https://instagram.com/ytmultipubli',
    'https://github.com/ytmultipubli',
    'https://linkedin.com/company/ytmultipubli',
  ],
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: '+1-XXX-XXX-XXXX',
    contactType: 'Customer Support',
    email: 'support@ytmultipubli.com',
    availableLanguage: ['en', 'pt', 'es'],
  },
});

export const createSoftwareApplicationSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'YT Multi Publi',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web, Windows, macOS, Linux, Android, iOS',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    availability: 'https://schema.org/InStock',
  },
  description:
    'Publish and manage videos across YouTube, TikTok, and Instagram simultaneously with a unified dashboard.',
  featureList: [
    'Multi-platform video publishing (YouTube, TikTok, Instagram)',
    'Unified content dashboard',
    'Account management and OAuth integration',
    'Channel selection and activation',
    'Schedule and publish across platforms',
    'Real-time analytics dashboard',
    'Media management and optimization',
    'Team collaboration tools',
  ],
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    ratingCount: '2500',
    bestRating: '5',
    worstRating: '1',
  },
});

export const createFAQSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Which platforms does YT Multi Publi support?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'YT Multi Publi supports YouTube, TikTok, and Instagram. You can connect accounts from all three platforms and publish content simultaneously.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is YT Multi Publi free to use?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes, YT Multi Publi offers a free tier to get started with all core features. Premium plans are available for advanced features and higher publishing limits.',
      },
    },
    {
      '@type': 'Question',
      name: 'How do I connect my social media accounts?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Simply click "Connect Account" on the dashboard, select your platform (YouTube, TikTok, or Instagram), and authorize YT Multi Publi through OAuth. Your account will be securely connected and credentials are encrypted.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I schedule posts in advance?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes, you can upload videos and schedule them for publishing at a specific date and time across all connected platforms. Perfect for planning content calendars.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is my data secure?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes, we use OAuth for secure authentication, encrypt all credentials, and follow industry-standard security practices. Your social media credentials are never stored in plain text.',
      },
    },
    {
      '@type': 'Question',
      name: 'What happens to my account if I stop paying?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'You can downgrade to the free plan anytime and retain all your account connections and history. You will only lose access to pro/business features.',
      },
    },
  ],
});

export const createBreadcrumbSchema = (items: { name: string; url: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: item.url,
  })),
});

export const createProductSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'YT Multi Publi - Multi-Platform Video Publishing',
  description:
    'Centralized solution for publishing videos to YouTube, TikTok, and Instagram simultaneously.',
  image: 'https://ytmultipubli.com/product-image.png',
  brand: {
    '@type': 'Brand',
    name: 'YT Multi Publi',
  },
  offers: [
    {
      '@type': 'Offer',
      name: 'Free Plan',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      description: 'Get started with all core features',
    },
    {
      '@type': 'Offer',
      name: 'Pro Plan',
      price: '19',
      priceCurrency: 'USD',
      billingDuration: 'P1M',
      availability: 'https://schema.org/InStock',
      description: 'For professional content creators',
    },
    {
      '@type': 'Offer',
      name: 'Business Plan',
      price: '99',
      priceCurrency: 'USD',
      billingDuration: 'P1M',
      availability: 'https://schema.org/InStock',
      description: 'For teams and businesses',
    },
  ],
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    ratingCount: '2500',
  },
});
