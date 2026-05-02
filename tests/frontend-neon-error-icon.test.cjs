'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..');
const APP_JS = fs.readFileSync(path.join(ROOT, 'apps', 'api', 'src', 'frontend', 'public', 'app.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'apps', 'api', 'src', 'frontend', 'public', 'app.css'), 'utf8');

test('neon error icon uses transparent failed-folder artwork', () => {
  assert.match(APP_JS, /const NEON_MEDIA_ICON_KIND_ALIASES = \{/);
  assert.match(APP_JS, /falha: 'error'/);
  assert.match(APP_JS, /falhas: 'error'/);
  assert.match(APP_JS, /failed: 'error'/);
  assert.match(APP_JS, /NEON_MEDIA_ERROR_SVG_KINDS = new Set\(\['error', 'erro', 'falha', 'falhas', 'failed', 'failure'\]\)/);
  assert.match(APP_JS, /class="neon-media-error-svg"/);
  assert.match(APP_JS, /const shouldRenderErrorSvg = safeKind === 'error' && NEON_MEDIA_ERROR_SVG_KINDS\.has\(requestedKind\)/);
  assert.match(APP_JS, /const errorSvgHtml = shouldRenderErrorSvg/);
  assert.match(APP_JS, /\$\{errorSvgHtml\}/);
  assert.doesNotMatch(APP_JS, /falhou: 'error'/);
  assert.doesNotMatch(APP_JS, /erros: 'error'/);
  assert.doesNotMatch(APP_JS, /<span class="neon-media-icon-canvas">\s*<svg class="neon-media-error-svg"/);
  assert.match(APP_JS, /viewBox="0 0 100 100"/);
  assert.match(APP_JS, /M10 46C11 40 16 37 23 37H43C50 37 50 45 57 45H86/);
  assert.match(APP_JS, /M40 60L60 80M60 60L40 80/);

  assert.match(CSS, /\.neon-media-icon-error\s*\{[\s\S]*background: transparent !important/);
  assert.match(CSS, /\.neon-media-icon-error \.neon-media-icon-glow[\s\S]*rgba\(255, 23, 68, 0\.58\)/);
  assert.match(CSS, /\.neon-media-icon-error \.neon-media-frame,[\s\S]*\.neon-media-icon-error \.neon-media-plus-y[\s\S]*display: none/);
  assert.match(CSS, /\.neon-media-icon-error \.neon-media-icon-canvas[\s\S]*background: transparent !important/);
  assert.match(CSS, /\.neon-media-error-svg[\s\S]*display: none[\s\S]*background: transparent/);
  assert.match(CSS, /\.neon-media-icon-error \.neon-media-error-svg\s*\{[\s\S]*display: block;[\s\S]*fill: none/);
  assert.match(CSS, /\.neon-media-error-stroke[\s\S]*fill: none/);
  assert.match(CSS, /\.neon-media-error-stroke[\s\S]*vector-effect: non-scaling-stroke/);
  assert.match(CSS, /\.neon-media-error-hot-stroke/);
  assert.match(CSS, /\.neon-media-error-glow-stroke[\s\S]*stroke: #ff1744/);
});
