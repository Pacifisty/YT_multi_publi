const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..');
const CSS = fs.readFileSync(path.join(ROOT, 'apps', 'api', 'src', 'frontend', 'public', 'app.css'), 'utf8');
const UI_SHELL = fs.readFileSync(path.join(ROOT, 'apps', 'api', 'src', 'frontend', 'ui-shell.ts'), 'utf8');

const marker = 'PMP Mobile Foundation - final cascade';
const markerIndex = CSS.indexOf(marker);
assert.notStrictEqual(markerIndex, -1, 'missing the final mobile foundation');
const MOBILE_CSS = CSS.slice(markerIndex);

test('frontend shell declares a device-width viewport', () => {
  assert.match(UI_SHELL, /<meta name="viewport" content="width=device-width,initial-scale=1" \/>/);
});

test('public navigation reflows instead of masking overflow on mobile', () => {
  assert.match(MOBILE_CSS, /\.merchant-nav\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(MOBILE_CSS, /\.merchant-nav nav\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(MOBILE_CSS, /\.merchant-nav-actions\s*\{[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/);
});

test('hero artwork and copy have a bounded mobile composition', () => {
  assert.match(MOBILE_CSS, /\.merchant-scene\s*\{[\s\S]*?min-height:\s*900px/);
  assert.match(MOBILE_CSS, /\.merchant-copy\s*\{[\s\S]*?left:\s*18px;[\s\S]*?right:\s*18px/);
  assert.match(MOBILE_CSS, /\.merchant-earth-system\s*\{[\s\S]*?--earth-size:\s*min\(70vw, 278px\)/);
});

test('legal navigation, documents and deletion flow collapse to safe columns', () => {
  assert.match(MOBILE_CSS, /\.legal-nav-links,[\s\S]*?grid-template-columns:\s*minmax\(0, 0\.86fr\) minmax\(0, 1fr\) minmax\(0, 1\.45fr\)/);
  assert.match(MOBILE_CSS, /\.legal-content-shell,[\s\S]*?padding-right:\s*18px;[\s\S]*?padding-left:\s*18px/);
  assert.match(MOBILE_CSS, /\.deletion-process\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
});

test('workspace header, controls and dense layouts have mobile contracts', () => {
  assert.match(MOBILE_CSS, /\.workspace-page \.header-shell-fullwidth \.header-actions\s*\{[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(MOBILE_CSS, /\.workspace-page \.header-shell-fullwidth \.header-nav\s*\{[\s\S]*?grid-column:\s*1;[\s\S]*?grid-row:\s*auto/);
  assert.match(MOBILE_CSS, /details\.settings-picker:not\(\[open\]\) > \.settings-panel\s*\{\s*display:\s*none/);
  assert.match(MOBILE_CSS, /\.workspace-page :is\(\.inline-actions,[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(MOBILE_CSS, /\.workspace-page \.pmp-dashboard[\s\S]*?\.workspace-page \.pmp-health-meta[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(MOBILE_CSS, /\.app-modal-card,[\s\S]*?max-height:\s*calc\(100dvh - 20px\)/);
});

test('mobile form controls avoid iOS zoom and tables retain intentional scrolling', () => {
  assert.match(MOBILE_CSS, /:where\(input, textarea, select\)\s*\{[\s\S]*?font-size:\s*16px/);
  assert.match(MOBILE_CSS, /\.table-scroll,[\s\S]*?overflow-x:\s*auto/);
  assert.match(MOBILE_CSS, /-webkit-overflow-scrolling:\s*touch/);
});
