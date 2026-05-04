'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..');
const APP_JS = fs.readFileSync(path.join(ROOT, 'apps', 'api', 'src', 'frontend', 'public', 'app.js'), 'utf8');
const APP_CSS = fs.readFileSync(path.join(ROOT, 'apps', 'api', 'src', 'frontend', 'public', 'app.css'), 'utf8');

function extractFunctionSource(source, functionName) {
  const functionStart = source.indexOf(`function ${functionName}`);
  assert.notStrictEqual(functionStart, -1, `Missing function ${functionName}`);
  const start = source.slice(Math.max(0, functionStart - 6), functionStart) === 'async '
    ? functionStart - 6
    : functionStart;
  const signatureEnd = source.indexOf(')', start);
  assert.notStrictEqual(signatureEnd, -1, `Missing function signature for ${functionName}`);
  const openBrace = source.indexOf('{', signatureEnd);
  assert.notStrictEqual(openBrace, -1, `Missing function body for ${functionName}`);
  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Unclosed function body for ${functionName}`);
}

function extractCssRule(selector) {
  const start = APP_CSS.indexOf(selector);
  assert.notStrictEqual(start, -1, `Missing CSS selector ${selector}`);
  const openBrace = APP_CSS.indexOf('{', start);
  assert.notStrictEqual(openBrace, -1, `Missing CSS rule body for ${selector}`);
  let depth = 0;
  for (let index = openBrace; index < APP_CSS.length; index += 1) {
    const char = APP_CSS[index];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) return APP_CSS.slice(start, index + 1);
  }
  throw new Error(`Unclosed CSS rule for ${selector}`);
}

test('videos library and playlist routes use calm media marks instead of neon icons', () => {
  const mediaMark = extractFunctionSource(APP_JS, 'renderMediaMark');
  const switcher = extractFunctionSource(APP_JS, 'renderVideosViewSwitcher');
  const mediaPage = extractFunctionSource(APP_JS, 'renderMediaPage');
  const playlistsPage = extractFunctionSource(APP_JS, 'renderPlaylistsPage');
  const playlistDetailPage = extractFunctionSource(APP_JS, 'renderPlaylistDetailPage');

  assert.match(mediaMark, /media-mark/);
  assert.match(mediaMark, /MEDIA_MARK_LABELS/);
  assert.match(mediaMark, /MEDIA_MARK_TITLES/);
  assert.match(mediaMark, /title="\$\{escapeAttribute\(title\)\}"/);
  assert.match(APP_JS, /playlist: 'LIST'/);
  assert.match(APP_JS, /storage: 'STO'/);
  assert.match(APP_JS, /clock: 'DUR'/);
  assert.match(switcher, /renderMediaMark\('library', 'tab'/);
  assert.match(switcher, /renderMediaMark\('playlist', 'tab'/);
  assert.match(mediaPage, /Cofre de midia/);
  assert.match(mediaPage, /vaultStatus/);
  assert.match(mediaPage, /media-vault-summary-strip/);
  assert.match(mediaPage, /Entrada de midia/);
  assert.match(mediaPage, /Biblioteca de midia/);
  assert.match(mediaPage, /renderMediaPipelineMark\('thumbnail', 'Capas vinculadas', 'warning'\)/);
  assert.match(playlistsPage, /playlist-media-preview/);
  assert.doesNotMatch(APP_JS, /playlist-neon-preview/);
  assert.doesNotMatch(APP_CSS, /playlist-neon-preview/);
  assert.doesNotMatch(mediaPage, /Upload bay|Upload new media|Library filters|Filter library|Asset library|Media cards|All asset types/);

  for (const source of [switcher, mediaPage, playlistsPage, playlistDetailPage]) {
    assert.doesNotMatch(source, /renderNeonMediaIcon/);
  }
});

test('media vault CSS is translucent and avoids the old harsh neon treatment', () => {
  const hero = extractCssRule('.media-hero-interactive');
  const heroTitle = extractCssRule('.media-hero-title');
  const mediaMarkStart = APP_CSS.indexOf('\n.media-mark {\n');
  assert.notStrictEqual(mediaMarkStart, -1, 'Missing standalone media mark rule');
  const mediaMark = APP_CSS.slice(mediaMarkStart, APP_CSS.indexOf('\n.media-mark::after', mediaMarkStart));
  const activeTab = extractCssRule('.videos-view-tab.is-active');
  const playlistOverrideStart = APP_CSS.lastIndexOf('.playlist-cockpit {');
  assert.notStrictEqual(playlistOverrideStart, -1, 'Missing playlist cockpit override');
  const playlistOverride = APP_CSS.slice(playlistOverrideStart, APP_CSS.indexOf('/* ----- Form right side -----', playlistOverrideStart));

  assert.match(APP_CSS, /--media-display-font/);
  assert.match(APP_CSS, /\.playlist-media-preview/);
  assert.match(APP_CSS, /\.media-vault-summary-strip/);
  assert.match(mediaMark, /backdrop-filter: blur\(12px\) saturate\(1\.1\)/);
  assert.match(hero, /backdrop-filter: blur\(24px\) saturate\(1\.16\)/);
  assert.doesNotMatch(hero, /rgba\(15, 23, 42, 0\.95\)/);
  assert.doesNotMatch(heroTitle, /-webkit-text-fill-color:\s*transparent/);
  assert.doesNotMatch(activeTab, /linear-gradient/);
  assert.match(playlistOverride, /backdrop-filter: blur\(22px\) saturate\(1\.12\)/);
  assert.match(playlistOverride, /\.playlist-cockpit-scan\s*\{\s*display: none;/);
  assert.doesNotMatch(playlistOverride, /box-shadow:\s*0\s+0/);
});
