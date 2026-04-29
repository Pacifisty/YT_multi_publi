import { readFileSync } from 'node:fs';

interface FrontendAsset {
  contentType: string;
  body: string;
}

const APP_JS_PATH = new URL('./public/app.js', import.meta.url);
const APP_CSS_PATH = new URL('./public/app.css', import.meta.url);
const SITE_NAME = 'Platform Multi Publisher';
const SEO_TITLE = 'Platform Multi Publisher | Publique em YouTube, TikTok e Instagram';
const SEO_DESCRIPTION = 'Automatize campanhas, midias e publicacoes em YouTube, TikTok e Instagram a partir de um unico workspace visual.';
const SEO_KEYWORDS = [
  'publicador multi plataforma',
  'publicar no YouTube TikTok Instagram',
  'automacao de campanhas de video',
  'gerenciador de midias sociais',
  'dashboard de publicacao',
];

const APP_JS = readFileSync(APP_JS_PATH, 'utf-8');
const APP_CSS = readFileSync(APP_CSS_PATH, 'utf-8');

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function normalizePublicBaseUrl(): string {
  const explicit = process.env.PUBLIC_APP_URL?.trim();
  const host = process.env.HOST?.trim() || '127.0.0.1';
  const port = process.env.PORT?.trim() || '3000';
  const candidate = explicit || `http://${host}:${port}`;

  try {
    return new URL(candidate).toString().replace(/\/+$/, '');
  } catch {
    return 'http://127.0.0.1:3000';
  }
}

function buildAbsoluteUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizePublicBaseUrl()}${normalizedPath}`;
}

function shouldIndexPath(path: string): boolean {
  return path === '/';
}

function buildRobotsTxt(): string {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /auth/',
    'Disallow: /workspace/',
    'Disallow: /login',
    'Disallow: /onboarding/',
    'Disallow: /media-files/',
    'Disallow: /public-media/',
    `Sitemap: ${buildAbsoluteUrl('/sitemap.xml')}`,
    '',
  ].join('\n');
}

function buildSitemapXml(): string {
  const rootUrl = escapeXml(buildAbsoluteUrl('/'));

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '  <url>',
    `    <loc>${rootUrl}</loc>`,
    '    <changefreq>weekly</changefreq>',
    '    <priority>1.0</priority>',
    '  </url>',
    '</urlset>',
    '',
  ].join('\n');
}

function buildStructuredData(): string {
  const json = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: SEO_DESCRIPTION,
    url: buildAbsoluteUrl('/'),
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'BRL',
    },
    featureList: [
      'Publicacao em YouTube, TikTok e Instagram',
      'Dashboard operacional de campanhas',
      'Biblioteca de midias e thumbnails',
      'Agendamento e acompanhamento de jobs',
      'Gestao de contas conectadas',
    ],
  });

  return json.replaceAll('<', '\\u003c');
}

function renderInitialAppContent(path: string): string {
  if (!shouldIndexPath(path)) {
    return '';
  }

  return `
      <main class="seo-static-content">
        <h1>${escapeHtml(SITE_NAME)}</h1>
        <p>${escapeHtml(SEO_DESCRIPTION)}</p>
        <section aria-label="Recursos principais">
          <h2>Publicacao multi plataforma</h2>
          <p>Crie campanhas para YouTube, TikTok e Instagram com biblioteca de midias, destinos conectados, fila de jobs e dashboard operacional.</p>
        </section>
        <section aria-label="Base de SEO">
          <h2>Base tecnica para indexacao</h2>
          <p>Pagina publica, sitemap XML, robots.txt, metadados, canonical e dados estruturados preparados para o Google Search Console.</p>
        </section>
      </main>
    `;
}

export function isFrontendRoute(path: string): boolean {
  return path === '/'
    || path === '/login'
    || path === '/login/callback'
    || path === '/onboarding/plan'
    || path.startsWith('/workspace');
}

export function resolveFrontendAsset(path: string): FrontendAsset | null {
  if (path === '/app.js') {
    return {
      contentType: 'application/javascript; charset=utf-8',
      body: APP_JS,
    };
  }

  if (path === '/app.css') {
    return {
      contentType: 'text/css; charset=utf-8',
      body: APP_CSS,
    };
  }

  if (path === '/robots.txt') {
    return {
      contentType: 'text/plain; charset=utf-8',
      body: buildRobotsTxt(),
    };
  }

  if (path === '/sitemap.xml') {
    return {
      contentType: 'application/xml; charset=utf-8',
      body: buildSitemapXml(),
    };
  }

  if (path === '/tiktok8COodYfNAGHdJBdORbUZUwaC9XDJBjpn.txt') {
    return {
      contentType: 'text/plain; charset=utf-8',
      body: 'tiktok-developers-site-verification=8COodYfNAGHdJBdORbUZUwaC9XDJBjpn',
    };
  }

  if (path === '/tiktokY0qPZzbYMlseg8jR6X6IWUq4Z943nKtq.txt') {
    return {
      contentType: 'text/plain; charset=utf-8',
      body: 'tiktok-developers-site-verification=Y0qPZzbYMlseg8jR6X6IWUq4Z943nKtq',
    };
  }

  if (path === '/terms/tiktokyQY5fafpnYO0QynFIa9YoptEkeAOAm1p.txt') {
    return {
      contentType: 'text/plain; charset=utf-8',
      body: 'tiktok-developers-site-verification=yQY5fafpnYO0QynFIa9YoptEkeAOAm1p',
    };
  }

  if (path === '/privacy/tiktokh4lzAEArircjMLNxYEvA21NjqtOGoEzF.txt') {
    return {
      contentType: 'text/plain; charset=utf-8',
      body: 'tiktok-developers-site-verification=h4lzAEArircjMLNxYEvA21NjqtOGoEzF',
    };
  }

  if (path === '/tiktokNVSgdCAUsAxDS5TEw8yXUi7A1FSf6jKc.txt') {
    return {
      contentType: 'text/plain; charset=utf-8',
      body: 'tiktok-developers-site-verification=NVSgdCAUsAxDS5TEw8yXUi7A1FSf6jKc',
    };
  }

  if (path === '/privacy/tiktokXNH7PCMgnzRsFGVTsZ1YT3rs9gEuFJgv.txt') {
    return {
      contentType: 'text/plain; charset=utf-8',
      body: 'tiktok-developers-site-verification=XNH7PCMgnzRsFGVTsZ1YT3rs9gEuFJgv',
    };
  }

  if (
    path === '/tiktokzsdDYJcFSlyxl0sCmWarxBHG2i9LXTCl.txt' ||
    path === '/terms/tiktokzsdDYJcFSlyxl0sCmWarxBHG2i9LXTCl.txt' ||
    path === '/privacy/tiktokzsdDYJcFSlyxl0sCmWarxBHG2i9LXTCl.txt'
  ) {
    return {
      contentType: 'text/plain; charset=utf-8',
      body: 'tiktok-developers-site-verification=zsdDYJcFSlyxl0sCmWarxBHG2i9LXTCl',
    };
  }

  return null;
}

export function renderFrontendDocument(path: string): string {
  const initialPath = escapeHtml(path);
  const canonicalUrl = escapeHtml(buildAbsoluteUrl(shouldIndexPath(path) ? '/' : path));
  const robotsMeta = shouldIndexPath(path) ? 'index,follow' : 'noindex,nofollow';
  const tiktokVerification = process.env.TIKTOK_DEVELOPER_VERIFICATION || '';
  const tiktokMetaTag = tiktokVerification
    ? `    <meta name="tiktok-developers-site-verification" content="${escapeHtml(tiktokVerification)}" />\n`
    : '';
  const googleVerification = process.env.GOOGLE_SITE_VERIFICATION || '';
  const googleMetaTag = googleVerification
    ? `    <meta name="google-site-verification" content="${escapeHtml(googleVerification)}" />\n`
    : '';
  const structuredData = buildStructuredData();
  const initialContent = renderInitialAppContent(path);
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(SEO_TITLE)}</title>
    <meta name="description" content="${escapeHtml(SEO_DESCRIPTION)}" />
    <meta name="keywords" content="${escapeHtml(SEO_KEYWORDS.join(', '))}" />
    <meta name="robots" content="${robotsMeta}" />
    <meta name="application-name" content="${escapeHtml(SITE_NAME)}" />
    <meta name="theme-color" content="#0f766e" />
    <link rel="canonical" href="${canonicalUrl}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />
    <meta property="og:title" content="${escapeHtml(SEO_TITLE)}" />
    <meta property="og:description" content="${escapeHtml(SEO_DESCRIPTION)}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeHtml(SEO_TITLE)}" />
    <meta name="twitter:description" content="${escapeHtml(SEO_DESCRIPTION)}" />
${googleMetaTag}${tiktokMetaTag}    <script type="application/ld+json">${structuredData}</script>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/app.css" />
  </head>
  <body data-initial-path="${initialPath}">
    <div id="app">${initialContent}</div>
    <script type="module" src="/app.js"></script>
  </body>
</html>`;
}
