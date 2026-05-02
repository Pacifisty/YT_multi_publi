import type { Metadata, Viewport } from 'next';
import { ReactNode } from 'react';
export { buildAppLayout, type AppLayoutView } from './layout-view';

// Global Metadata for SEO
export const metadata: Metadata = {
  metadataBase: new URL('https://ytmultipubli.com'),
  title: {
    default: 'YT Multi Publi - Multi-Platform Video Publishing',
    template: '%s | YT Multi Publi',
  },
  description:
    'Centralize your video publishing workflow. Connect YouTube, TikTok, and Instagram accounts to publish, schedule, and manage content across all platforms from one dashboard.',
  keywords: [
    'video publishing',
    'multi-platform posting',
    'YouTube TikTok Instagram',
    'content management',
    'social media scheduling',
    'content creator tools',
  ],
  authors: [{ name: 'YT Multi Publi', url: 'https://ytmultipubli.com' }],
  creator: 'YT Multi Publi',
  publisher: 'YT Multi Publi',
  formatDetection: {
    email: false,
    telephone: false,
    address: false,
  },
  robots: {
    index: true,
    follow: true,
    'max-image-preview': 'large',
    'max-snippet': -1,
    'max-video-preview': -1,
    'googlebot-image': 'index',
    'googlebot': 'index, follow',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://ytmultipubli.com',
    siteName: 'YT Multi Publi',
    title: 'YT Multi Publi - Multi-Platform Video Publishing',
    description:
      'Centralize your video publishing workflow. Publish to YouTube, TikTok & Instagram simultaneously.',
  },
  twitter: {
    card: 'summary_large_image',
    creator: '@ytmultipubli',
    site: '@ytmultipubli',
  },
  verification: {
    google: 'google-site-verification-code',
    yandex: 'yandex-verification-code',
  },
  alternates: {
    canonical: 'https://ytmultipubli.com',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#0f766e',
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0f766e" />
        <link rel="canonical" href="https://ytmultipubli.com" />

        {/* Preload fonts */}
        <link
          rel="preload"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          as="style"
        />
        <link
          rel="preload"
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap"
          as="style"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
