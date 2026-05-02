import { readFileSync, statSync } from 'node:fs';
import { LEGAL_DOCUMENTS, type LegalDocument, type LegalDocumentKey } from './legal-documents';

interface FrontendAsset {
  contentType: string;
  body: string | Buffer;
}

const APP_JS_PATH = new URL('./public/app.js', import.meta.url);
const APP_CSS_PATH = new URL('./public/app.css', import.meta.url);
const I18N_JS_PATH = new URL('./public/i18n.js', import.meta.url);
const SITE_NAME = 'Platform Multi Publisher';
const DEFAULT_LOCALE = 'pt-BR';
const SUPPORTED_LOCALES = new Set(['pt-BR', 'en']);
export type FrontendLocale = 'pt-BR' | 'en';

const SEO_METADATA = {
  'pt-BR': {
    siteName: 'Platform Multi Publisher',
    title: 'Platform Multi Publisher | Publique em YouTube, TikTok e Instagram',
    description: 'Automatize campanhas, mídias e publicações no YouTube, TikTok e Instagram a partir de um único workspace visual.',
    keywords: [
      'publicador multi plataforma',
      'publicar no YouTube TikTok Instagram',
      'automação de campanhas de vídeo',
      'gerenciador de mídias sociais',
      'dashboard de publicação',
    ],
    initialTitle: 'Planeje e publique vídeos em YouTube, TikTok e Instagram',
    initialText: 'Plataforma de publicação operacional com campanhas, automação e distribuição cross-platform.',
    initialPublicSectionTitle: 'Publicação multi plataforma',
    initialPublicSectionText: 'Crie campanhas para YouTube, TikTok e Instagram com biblioteca de mídias, destinos conectados, fila de jobs e dashboard operacional.',
    initialIndexSectionTitle: 'Base técnica para indexação',
    initialIndexSectionText: 'Página pública, sitemap XML, robots.txt, metadados, canonical e dados estruturados preparados para o Google Search Console.',
  },
  en: {
    siteName: 'Platform Multi Publisher',
    title: 'Platform Multi Publisher | Publish to YouTube, TikTok and Instagram',
    description: 'Run publishing campaigns, media and scheduling workflows for YouTube, TikTok, and Instagram from one visual workspace.',
    keywords: [
      'multi-platform publishing',
      'publish to YouTube TikTok Instagram',
      'video publishing automation',
      'social media publishing dashboard',
      'campaign management',
    ],
    initialTitle: 'Plan and publish your videos on YouTube, TikTok and Instagram',
    initialText: 'An operational publishing workflow with campaigns, automation and cross-platform distribution.',
    initialPublicSectionTitle: 'Cross-platform publishing',
    initialPublicSectionText: 'Build campaigns for YouTube, TikTok and Instagram with a media library, connected destinations, publish queue and operational dashboard.',
    initialIndexSectionTitle: 'Technical SEO base',
    initialIndexSectionText: 'Public page, XML sitemap, robots.txt, metadata, canonical and structured data prepared for Google Search Console.',
  },
};

const APP_JS = readFileSync(APP_JS_PATH, 'utf-8');
const APP_CSS = readFileSync(APP_CSS_PATH, 'utf-8');
const FRONTEND_ASSET_VERSION = [
  statSync(APP_JS_PATH).mtimeMs,
  statSync(APP_CSS_PATH).mtimeMs,
  statSync(I18N_JS_PATH).mtimeMs,
].map((value) => Math.round(value)).join('.');
const FRONTEND_STATIC_ASSETS = new Map<string, FrontendAsset>();

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

function repairUtf8Mojibake(value: string): string {
  if (!/[ÃÂâð]/.test(value)) return value;
  try {
    return Buffer.from(value, 'latin1').toString('utf8');
  } catch {
    return value;
  }
}

const PUBLIC_INDEXABLE_PATHS = ['/', '/privacy', '/terms', '/data-deletion'] as const;
const LEGAL_PATH_TO_DOCUMENT_KEY: Partial<Record<string, LegalDocumentKey>> = {
  '/privacy': 'privacy',
  '/terms': 'terms',
  '/data-deletion': 'data-deletion',
};

function normalizeFrontendPath(path: string): string {
  if (path.length > 1 && path.endsWith('/')) {
    return path.replace(/\/+$/, '');
  }
  return path || '/';
}

function shouldIndexPath(path: string): boolean {
  const normalizedPath = normalizeFrontendPath(path);
  return PUBLIC_INDEXABLE_PATHS.includes(normalizedPath as (typeof PUBLIC_INDEXABLE_PATHS)[number]);
}

function getLegalDocumentKeyForPath(path: string): LegalDocumentKey | null {
  return LEGAL_PATH_TO_DOCUMENT_KEY[normalizeFrontendPath(path)] ?? null;
}

function renderLegalDocumentBodyHtml(document: LegalDocument): string {
  return document.sections
    .map((section) => `
        <section>
          <h2>${escapeHtml(section.heading)}</h2>
          ${section.html}
        </section>
      `)
    .join('');
}

function renderLegalDocumentsInlineJson(): string {
  return JSON.stringify(LEGAL_DOCUMENTS)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
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
  const entries = PUBLIC_INDEXABLE_PATHS
    .map((path) => {
      const priority = path === '/' ? '1.0' : '0.7';
      return [
        '  <url>',
        `    <loc>${escapeXml(buildAbsoluteUrl(path))}</loc>`,
        '    <changefreq>monthly</changefreq>',
        `    <priority>${priority}</priority>`,
        '  </url>',
      ].join('\n');
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entries,
    '</urlset>',
    '',
  ].join('\n');
}

function buildStructuredData(locale: FrontendLocale = DEFAULT_LOCALE): string {
  const seo = getSeoForLocale(locale);
  const json = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: seo.siteName,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: seo.description,
    url: buildAbsoluteUrl('/'),
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'BRL',
    },
    featureList: [
      'Publishing to YouTube, TikTok and Instagram',
      'Operational campaign dashboard',
      'Media and thumbnail library',
      'Scheduling and job tracking',
      'Connected account management',
    ],
  });

  return json.replaceAll('<', '\\u003c');
}

export function normalizeFrontendLocale(rawLocale: string | null | undefined): FrontendLocale {
  const normalized = String(rawLocale ?? '').trim().toLowerCase();
  if (normalized === 'pt-br' || normalized === 'pt') {
    return 'pt-BR';
  }
  if (normalized === 'en' || normalized.startsWith('en-')) {
    return 'en';
  }
  return DEFAULT_LOCALE;
}

function getSeoForLocale(locale: FrontendLocale) {
  const seo = SEO_METADATA[locale] ?? SEO_METADATA[DEFAULT_LOCALE];
  return {
    ...seo,
    title: repairUtf8Mojibake(seo.title),
    description: repairUtf8Mojibake(seo.description),
    keywords: seo.keywords.map(repairUtf8Mojibake),
    initialTitle: repairUtf8Mojibake(seo.initialTitle),
    initialText: repairUtf8Mojibake(seo.initialText),
    initialPublicSectionTitle: repairUtf8Mojibake(seo.initialPublicSectionTitle),
    initialPublicSectionText: repairUtf8Mojibake(seo.initialPublicSectionText),
    initialIndexSectionTitle: repairUtf8Mojibake(seo.initialIndexSectionTitle),
    initialIndexSectionText: repairUtf8Mojibake(seo.initialIndexSectionText),
  };
}

function getSeoForPath(path: string, locale: FrontendLocale) {
  const normalizedPath = normalizeFrontendPath(path);
  const base = getSeoForLocale(locale);
  const legalDocumentKey = getLegalDocumentKeyForPath(normalizedPath);
  if (legalDocumentKey) {
    const document = LEGAL_DOCUMENTS[legalDocumentKey];
    return {
      ...base,
      title: `${document.title} | Platform Multi Publisher`,
      description: document.subtitle,
    };
  }
  return base;
}

function renderInitialLegalContent(path: string): string {
  const legalDocumentKey = getLegalDocumentKeyForPath(path);
  if (!legalDocumentKey) return '';
  const document = LEGAL_DOCUMENTS[legalDocumentKey];
  const bodyHtml = renderLegalDocumentBodyHtml(document);

  return `
      <main class="seo-static-content legal-static-content">
        <h1>${escapeHtml(document.title)}</h1>
        <p>${escapeHtml(document.subtitle)}</p>
        <p>Document last updated: ${escapeHtml(document.lastUpdated)}.</p>
        <p>${escapeHtml(document.reviewNote)}</p>
        <p>Platform Multi Publisher is not owned by, endorsed by, sponsored by, or officially operated by TikTok, YouTube, Google, Instagram, Meta, or their affiliates.</p>
        ${bodyHtml}
      </main>
    `;
}
function renderInitialAppContent(path: string, locale: FrontendLocale): string {
  const seo = getSeoForLocale(locale);
  const normalizedPath = normalizeFrontendPath(path);
  if (normalizedPath === '/privacy' || normalizedPath === '/terms' || normalizedPath === '/data-deletion') {
    return renderInitialLegalContent(normalizedPath);
  }
  if (!shouldIndexPath(path)) {
    return '';
  }
  const publicSectionLabel = locale === 'en' ? 'Main features' : 'Recursos principais';
  const indexSectionLabel = locale === 'en' ? 'SEO base' : 'Base de SEO';
  return `
      <main class="seo-static-content">
        <h1>${escapeHtml(seo.initialTitle)}</h1>
        <p>${escapeHtml(seo.initialText)}</p>
        <section aria-label="${escapeHtml(publicSectionLabel)}">
          <h2>${escapeHtml(seo.initialPublicSectionTitle)}</h2>
          <p>${escapeHtml(seo.initialPublicSectionText)}</p>
        </section>
        <section aria-label="${escapeHtml(indexSectionLabel)}">
          <h2>${escapeHtml(seo.initialIndexSectionTitle)}</h2>
          <p>${escapeHtml(seo.initialIndexSectionText)}</p>
        </section>
        <nav aria-label="Legal links">
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms">Terms of Service</a>
          <a href="/data-deletion">User Data Deletion</a>
        </nav>
      </main>
    `;
}

export function isFrontendRoute(path: string): boolean {
  const normalizedPath = normalizeFrontendPath(path);
  return normalizedPath === '/'
    || normalizedPath === '/privacy'
    || normalizedPath === '/terms'
    || normalizedPath === '/data-deletion'
    || normalizedPath === '/login'
    || normalizedPath === '/login/callback'
    || normalizedPath === '/onboarding/plan'
    || normalizedPath.startsWith('/workspace');
}

export function resolveFrontendAsset(path: string): FrontendAsset | null {
  if (path === '/app.js') {
    return {
      contentType: 'application/javascript; charset=utf-8',
      body: APP_JS,
    };
  }

  if (path === '/i18n.js') {
    return {
      contentType: 'application/javascript; charset=utf-8',
      body: readFileSync(I18N_JS_PATH, 'utf-8'),
    };
  }

  if (path === '/app.css') {
    return {
      contentType: 'text/css; charset=utf-8',
      body: APP_CSS,
    };
  }

  const staticAsset = FRONTEND_STATIC_ASSETS.get(path);
  if (staticAsset) {
    return staticAsset;
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

export function renderFrontendDocument(path: string, locale: FrontendLocale = DEFAULT_LOCALE): string {
  const safeLocale = normalizeFrontendLocale(locale);
  const normalizedPath = normalizeFrontendPath(path);
  const legalDocumentKey = getLegalDocumentKeyForPath(normalizedPath);
  const initialPath = escapeHtml(normalizedPath);
  const canonicalPath = normalizedPath === '/' ? '/' : normalizedPath;
  const canonicalUrl = escapeHtml(buildAbsoluteUrl(canonicalPath));
  const robotsMeta = shouldIndexPath(normalizedPath) ? 'index,follow' : 'noindex,nofollow';
  const seo = getSeoForPath(normalizedPath, safeLocale);
  const tiktokVerification = process.env.TIKTOK_DEVELOPER_VERIFICATION || '';
  const tiktokMetaTag = tiktokVerification
    ? `    <meta name="tiktok-developers-site-verification" content="${escapeHtml(tiktokVerification)}" />\n`
    : '';
  const googleVerification = process.env.GOOGLE_SITE_VERIFICATION || '';
  const googleMetaTag = googleVerification
    ? `    <meta name="google-site-verification" content="${escapeHtml(googleVerification)}" />\n`
    : '';
  const structuredData = buildStructuredData(safeLocale);
  const initialContent = renderInitialAppContent(normalizedPath, safeLocale);
  const legalDocumentsBootstrap = legalDocumentKey
    ? `    <script>window.__PMP_LEGAL_DOCUMENTS__=${renderLegalDocumentsInlineJson()};</script>\n`
    : '';
  return `<!doctype html>
<html lang="${escapeHtml(safeLocale)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(seo.title)}</title>
    <meta name="description" content="${escapeHtml(seo.description)}" />
    <meta name="keywords" content="${escapeHtml(seo.keywords.join(', '))}" />
    <meta name="robots" content="${robotsMeta}" />
    <meta name="application-name" content="${escapeHtml(seo.siteName)}" />
    <meta name="theme-color" content="#0f766e" />
    <link rel="canonical" href="${canonicalUrl}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${escapeHtml(seo.siteName)}" />
    <meta property="og:title" content="${escapeHtml(seo.title)}" />
    <meta property="og:description" content="${escapeHtml(seo.description)}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeHtml(seo.title)}" />
    <meta name="twitter:description" content="${escapeHtml(seo.description)}" />
${googleMetaTag}${tiktokMetaTag}    <script type="application/ld+json">${structuredData}</script>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&family=Libre+Baskerville:wght@400;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/app.css?v=${FRONTEND_ASSET_VERSION}" />
  </head>
    <body data-initial-path="${initialPath}" data-initial-locale="${escapeHtml(safeLocale)}">
    <div id="app">${initialContent}</div>
${legalDocumentsBootstrap}    <script src="/i18n.js?v=${FRONTEND_ASSET_VERSION}"></script>
    <script type="module" src="/app.js?v=${FRONTEND_ASSET_VERSION}"></script>
  </body>
</html>`;
}
