'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..');
const APP_JS = fs.readFileSync(path.join(ROOT, 'apps', 'api', 'src', 'frontend', 'public', 'app.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'apps', 'api', 'src', 'frontend', 'public', 'app.css'), 'utf8');
const ERROR_SVG = fs.readFileSync(
  path.join(ROOT, 'apps', 'api', 'src', 'frontend', 'public', 'assets', 'icons', 'ER_erro.svg'),
  'utf8',
);

test('media error mark uses the transparent PMP artwork asset', () => {
  assert.match(APP_JS, /const MEDIA_MARK_KIND_ALIASES = \{/);
  assert.match(APP_JS, /erro: 'error'/);
  assert.match(APP_JS, /falha: 'error'/);
  assert.match(APP_JS, /falhas: 'error'/);
  assert.match(APP_JS, /failed: 'error'/);
  assert.match(APP_JS, /failure: 'error'/);
  assert.match(APP_JS, /error: '\/assets\/icons\/ER_erro\.svg'/);
  assert.match(APP_JS, /const artworkSrc = MEDIA_MARK_ARTWORK\[safeKind\] \?\? ''/);
  assert.match(APP_JS, /class="media-mark-artwork-image"/);
  assert.match(APP_JS, /data-media-kind="\$\{escapeAttribute\(safeKind\)\}"/);

  assert.match(CSS, /\.media-mark-artwork\s*\{[\s\S]*?background: transparent/);
  assert.match(CSS, /\.media-mark-artwork-image\s*\{[\s\S]*?object-fit: contain/);
  assert.match(CSS, /\.media-mark\[data-tone="danger"\]/);

  assert.match(ERROR_SVG, /viewBox="0 0 512 512"/);
  assert.match(ERROR_SVG, /fundo transparente/);
  assert.match(ERROR_SVG, /M220 174l72 72M292 174l-72 72/);
  assert.doesNotMatch(ERROR_SVG, /<rect[^>]+x="0"[^>]+y="0"[^>]+width="512"[^>]+height="512"/);
});
