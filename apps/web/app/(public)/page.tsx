import { Metadata } from 'next';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'YT Multi Publi - Publish to YouTube, TikTok & Instagram Simultaneously',
  description:
    'Centralize your video publishing workflow. Connect YouTube, TikTok, and Instagram accounts to publish, schedule, and manage content across all platforms from one dashboard.',
  keywords:
    'video publishing, multi-platform posting, YouTube TikTok Instagram, content management, social media scheduling',
  metadataBase: new URL('https://ytmultipubli.com'),
  openGraph: {
    title: 'YT Multi Publi - Multi-Platform Video Publishing',
    description:
      'Publish to YouTube, TikTok & Instagram simultaneously from one unified dashboard.',
    type: 'website',
    locale: 'en_US',
    url: 'https://ytmultipubli.com',
    siteName: 'YT Multi Publi',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'YT Multi Publi - Multi-Platform Video Publishing',
    description:
      'Publish to YouTube, TikTok & Instagram simultaneously from one unified dashboard.',
  },
  robots: {
    index: true,
    follow: true,
    'max-image-preview': 'large',
    'max-snippet': -1,
    'max-video-preview': -1,
  },
  alternates: {
    canonical: 'https://ytmultipubli.com',
  },
};

const ldJsonOrganization = {
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
  ],
};

const ldJsonProduct = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'YT Multi Publi',
  applicationCategory: 'BusinessApplication',
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
  ],
};

const ldJsonFAQ = {
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
        text: 'Yes, YT Multi Publi offers a free tier to get started. Premium plans are available for advanced features and higher publishing limits.',
      },
    },
    {
      '@type': 'Question',
      name: 'How do I connect my social media accounts?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Simply click "Connect Account" on the dashboard, select your platform (YouTube, TikTok, or Instagram), and authorize YT Multi Publi through OAuth. Your account will be securely connected.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I schedule posts in advance?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes, you can upload videos and schedule them for publishing at a specific date and time across all connected platforms.',
      },
    },
  ],
};

export default function PublicHomePage() {
  return (
    <div className="landing-page">
      {/* Schema Markup */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ldJsonOrganization) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ldJsonProduct) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ldJsonFAQ) }}
      />

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-container">
          <h1>Publish to Every Platform. At Once.</h1>
          <p className="hero-subtitle">
            Connect your YouTube, TikTok, and Instagram accounts. Manage everything from one unified dashboard.
            Publish once, reach everyone.
          </p>

          <div className="hero-cta">
            <Link href="/login">
              <Button variant="primary" size="lg">
                Get Started Free
              </Button>
            </Link>
            <Link href="#features">
              <Button variant="secondary" size="lg">
                Learn More
              </Button>
            </Link>
          </div>

          <p className="hero-footnote">
            No credit card required • Free tier includes all core features
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="features-section">
        <div className="section-container">
          <h2>Powerful Features for Content Creators</h2>

          <div className="features-grid">
            {/* Feature 1: Multi-Platform */}
            <article className="feature-card">
              <div className="feature-icon">📺</div>
              <h3>Multi-Platform Publishing</h3>
              <p>
                Connect YouTube, TikTok, and Instagram. Upload once, publish to all platforms simultaneously.
                No more switching tabs.
              </p>
            </article>

            {/* Feature 2: Account Management */}
            <article className="feature-card">
              <div className="feature-icon">🔐</div>
              <h3>Secure Account Management</h3>
              <p>
                OAuth-secured connections with all platforms. Your credentials are encrypted and never exposed.
                Manage multiple accounts with ease.
              </p>
            </article>

            {/* Feature 3: Channel Selection */}
            <article className="feature-card">
              <div className="feature-icon">📹</div>
              <h3>Channel & Account Selection</h3>
              <p>
                Select which channels to publish to for each video. Activate/deactivate channels without disconnecting
                accounts.
              </p>
            </article>

            {/* Feature 4: Dashboard */}
            <article className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>Unified Dashboard</h3>
              <p>
                Real-time overview of all connected accounts, channels, and publishing status. Monitor everything at a
                glance.
              </p>
            </article>

            {/* Feature 5: Media Management */}
            <article className="feature-card">
              <div className="feature-icon">🎬</div>
              <h3>Media Management</h3>
              <p>
                Upload, organize, and manage your video assets. Support for multiple formats and automatic optimization
                for each platform.
              </p>
            </article>

            {/* Feature 6: Scheduling */}
            <article className="feature-card">
              <div className="feature-icon">⏰</div>
              <h3>Advanced Scheduling</h3>
              <p>
                Schedule posts in advance. Publish at the perfect time for your audience across all time zones. Batch
                operations for efficiency.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* Supported Platforms */}
      <section className="platforms-section">
        <div className="section-container">
          <h2>Supported Platforms</h2>
          <p className="section-subtitle">
            YT Multi Publi integrates with the world's largest social video platforms
          </p>

          <div className="platforms-grid">
            <div className="platform-card">
              <div className="platform-logo">📺</div>
              <h3>YouTube</h3>
              <p>Publish to YouTube channels with full account management and OAuth integration.</p>
            </div>

            <div className="platform-card">
              <div className="platform-logo">🎵</div>
              <h3>TikTok</h3>
              <p>Reach TikTok's massive audience. Connect accounts and manage all your TikTok channels.</p>
            </div>

            <div className="platform-card">
              <div className="platform-logo">📸</div>
              <h3>Instagram</h3>
              <p>Post to Instagram Reels and feed. Connect multiple accounts for cross-posting.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="pricing-section">
        <div className="section-container">
          <h2>Simple, Transparent Pricing</h2>
          <p className="section-subtitle">Start free. Upgrade when you need more.</p>

          <div className="pricing-grid">
            {/* Free Plan */}
            <article className="pricing-card">
              <h3>Free</h3>
              <div className="price">$0</div>
              <p className="price-subtitle">Perfect to start</p>

              <ul className="features-list">
                <li>✅ Connect all 3 platforms</li>
                <li>✅ Unlimited accounts</li>
                <li>✅ Unified dashboard</li>
                <li>✅ Basic analytics</li>
                <li>✅ 5 uploads per day</li>
                <li>❌ Advanced scheduling</li>
              </ul>

              <Link href="/login">
                <Button variant="secondary" size="md">
                  Get Started
                </Button>
              </Link>
            </article>

            {/* Pro Plan */}
            <article className="pricing-card featured">
              <div className="badge">Most Popular</div>
              <h3>Pro</h3>
              <div className="price">$19</div>
              <p className="price-subtitle">per month</p>

              <ul className="features-list">
                <li>✅ All Free features</li>
                <li>✅ 50 uploads per day</li>
                <li>✅ Advanced scheduling</li>
                <li>✅ Batch operations</li>
                <li>✅ Priority support</li>
                <li>✅ Advanced analytics</li>
              </ul>

              <Link href="/login">
                <Button variant="primary" size="md">
                  Start Free Trial
                </Button>
              </Link>
            </article>

            {/* Business Plan */}
            <article className="pricing-card">
              <h3>Business</h3>
              <div className="price">$99</div>
              <p className="price-subtitle">per month</p>

              <ul className="features-list">
                <li>✅ All Pro features</li>
                <li>✅ Unlimited uploads</li>
                <li>✅ Team collaboration</li>
                <li>✅ Custom integrations</li>
                <li>✅ API access</li>
                <li>✅ Dedicated support</li>
              </ul>

              <a href="mailto:PlataformMultiPublisher@gmail.com">
                <Button variant="secondary" size="md">
                  Contact Sales
                </Button>
              </a>
            </article>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-container">
          <h2>Ready to Streamline Your Publishing?</h2>
          <p>Join creators and content teams worldwide who trust YT Multi Publi.</p>

          <Link href="/login">
            <Button variant="primary" size="lg">
              Start Publishing Now
            </Button>
          </Link>
        </div>
      </section>

      {/* Styles */}
      <style jsx>{`
        .landing-page {
          min-height: 100vh;
          background: linear-gradient(160deg, #f1f5f9 0%, #e4ecf4 100%);
          color: #0f172a;
        }

        /* Hero Section */
        .hero-section {
          padding: 100px 40px;
          text-align: center;
          background: linear-gradient(135deg, #0c3440 0%, #0f766e 58%, #10b981 100%);
          color: white;
        }

        .hero-container {
          max-width: 800px;
          margin: 0 auto;
        }

        .hero-section h1 {
          font-size: 56px;
          font-weight: 700;
          margin: 0 0 24px 0;
          line-height: 1.2;
        }

        .hero-subtitle {
          font-size: 20px;
          line-height: 1.6;
          margin: 0 0 32px 0;
          opacity: 0.95;
        }

        .hero-cta {
          display: flex;
          gap: 16px;
          justify-content: center;
          margin: 0 0 24px 0;
          flex-wrap: wrap;
        }

        .hero-footnote {
          font-size: 14px;
          opacity: 0.8;
          margin: 0;
        }

        /* Features Section */
        .features-section {
          padding: 100px 40px;
          background: white;
        }

        .section-container {
          max-width: 1200px;
          margin: 0 auto;
        }

        .features-section h2 {
          text-align: center;
          font-size: 40px;
          font-weight: 700;
          margin: 0 0 60px 0;
          color: #0f766e;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 32px;
          margin-bottom: 60px;
        }

        .feature-card {
          padding: 32px;
          background: #f8fafc;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          transition: all 150ms ease;
        }

        .feature-card:hover {
          border-color: #0f766e;
          box-shadow: 0 4px 16px rgba(15, 118, 110, 0.1);
          transform: translateY(-4px);
        }

        .feature-icon {
          font-size: 40px;
          margin-bottom: 16px;
        }

        .feature-card h3 {
          font-size: 18px;
          font-weight: 600;
          margin: 0 0 12px 0;
          color: #0f172a;
        }

        .feature-card p {
          font-size: 14px;
          color: #64748b;
          line-height: 1.6;
          margin: 0;
        }

        /* Platforms Section */
        .platforms-section {
          padding: 80px 40px;
          background: linear-gradient(160deg, #f1f5f9 0%, #e4ecf4 100%);
        }

        .section-subtitle {
          text-align: center;
          font-size: 16px;
          color: #64748b;
          margin: 0 0 48px 0;
        }

        .platforms-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 32px;
        }

        .platform-card {
          background: white;
          padding: 40px 24px;
          border-radius: 12px;
          text-align: center;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
        }

        .platform-logo {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .platform-card h3 {
          font-size: 20px;
          font-weight: 600;
          margin: 0 0 12px 0;
          color: #0f172a;
        }

        .platform-card p {
          font-size: 14px;
          color: #64748b;
          line-height: 1.6;
          margin: 0;
        }

        /* Pricing Section */
        .pricing-section {
          padding: 100px 40px;
          background: white;
        }

        .pricing-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 32px;
          margin-top: 48px;
        }

        .pricing-card {
          padding: 40px 32px;
          background: white;
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          position: relative;
          transition: all 150ms ease;
        }

        .pricing-card:hover {
          border-color: #0f766e;
          box-shadow: 0 12px 32px rgba(15, 118, 110, 0.15);
        }

        .pricing-card.featured {
          border-color: #0f766e;
          box-shadow: 0 12px 32px rgba(15, 118, 110, 0.15);
          transform: scale(1.02);
        }

        .badge {
          position: absolute;
          top: -12px;
          left: 24px;
          background: #0f766e;
          color: white;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }

        .pricing-card h3 {
          font-size: 24px;
          font-weight: 600;
          margin: 0 0 12px 0;
          color: #0f172a;
        }

        .price {
          font-size: 40px;
          font-weight: 700;
          color: #0f766e;
          margin: 0;
        }

        .price-subtitle {
          font-size: 14px;
          color: #64748b;
          margin: 4px 0 24px 0;
        }

        .features-list {
          list-style: none;
          padding: 0;
          margin: 0 0 24px 0;
          text-align: left;
          font-size: 14px;
          color: #64748b;
        }

        .features-list li {
          padding: 8px 0;
          border-bottom: 1px solid #e2e8f0;
        }

        .features-list li:last-child {
          border-bottom: none;
        }

        /* CTA Section */
        .cta-section {
          padding: 80px 40px;
          background: linear-gradient(135deg, #0c3440 0%, #0f766e 58%, #10b981 100%);
          color: white;
          text-align: center;
        }

        .cta-container {
          max-width: 600px;
          margin: 0 auto;
        }

        .cta-section h2 {
          font-size: 40px;
          font-weight: 700;
          margin: 0 0 16px 0;
        }

        .cta-section > div > p {
          font-size: 18px;
          margin: 0 0 32px 0;
          opacity: 0.95;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .hero-section {
            padding: 60px 24px;
          }

          .hero-section h1 {
            font-size: 36px;
          }

          .hero-subtitle {
            font-size: 16px;
          }

          .features-section,
          .pricing-section,
          .cta-section {
            padding: 60px 24px;
          }

          .features-section h2,
          .pricing-section h2,
          .cta-section h2 {
            font-size: 28px;
          }

          .pricing-card.featured {
            transform: scale(1);
          }

          .hero-cta {
            flex-direction: column;
          }

          .hero-cta a {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
