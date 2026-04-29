import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In | YT Multi Publi',
  description:
    'Sign in to your YT Multi Publi account. Access your unified dashboard to publish videos across YouTube, TikTok, and Instagram.',
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: 'Sign In | YT Multi Publi',
    description: 'Access your YT Multi Publi account to manage multi-platform video publishing.',
    type: 'website',
  },
};

export default function LoginPageSEO() {
  return null;
}
