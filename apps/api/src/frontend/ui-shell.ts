import { readFileSync } from 'node:fs';

interface FrontendAsset {
  contentType: string;
  body: string;
}

const APP_JS_PATH = new URL('./public/app.js', import.meta.url);
const APP_CSS_PATH = new URL('./public/app.css', import.meta.url);

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

  return null;
}

export function renderFrontendDocument(path: string): string {
  const initialPath = escapeHtml(path);
  const tiktokVerification = process.env.TIKTOK_DEVELOPER_VERIFICATION || '';
  const tiktokMetaTag = tiktokVerification
    ? `    <meta name="tiktok-developers-site-verification" content="${escapeHtml(tiktokVerification)}" />\n`
    : '';
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>YT Multi Publi</title>
${tiktokMetaTag}    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/app.css" />
  </head>
  <body data-initial-path="${initialPath}">
    <div id="app"></div>
    <script type="module" src="/app.js"></script>
  </body>
</html>`;
}
