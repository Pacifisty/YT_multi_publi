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

  return null;
}

export function renderFrontendDocument(path: string): string {
  const initialPath = escapeHtml(path);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>YT Multi Publi</title>
    <link rel="stylesheet" href="/app.css" />
  </head>
  <body data-initial-path="${initialPath}">
    <div id="app"></div>
    <script type="module" src="/app.js"></script>
  </body>
</html>`;
}
