'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..');
const APP_JS = fs.readFileSync(path.join(ROOT, 'apps', 'api', 'src', 'frontend', 'public', 'app.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'apps', 'api', 'src', 'frontend', 'public', 'app.css'), 'utf8');

function extractCssRule(css, selector) {
  const start = css.indexOf(selector);
  assert.notStrictEqual(start, -1, `Missing CSS rule ${selector}`);

  const end = css.indexOf('\n}', start);
  assert.notStrictEqual(end, -1, `Missing CSS rule close for ${selector}`);

  return css.slice(start, end + 2);
}

test('dashboard hero uses a selectable playlist video player instead of an ad slot', () => {
  assert.match(APP_JS, /function buildDashboardPlaylistPlayerData/);
  assert.match(APP_JS, /function bindDashboardPlaylistPlayer/);
  assert.match(APP_JS, /api\.playlists\(\)/);
  assert.match(APP_JS, /const playlistPanelHtml = renderDashboardPlaylistPanel\(playlists, assets\)/);
  assert.match(APP_JS, /class="od-hero-playlist-player od-panel"/);
  assert.match(APP_JS, /data-playlist-player-select/);
  assert.match(APP_JS, /data-playlist-player-video/);
  assert.match(APP_JS, /data-playlist-player-item/);
  assert.match(APP_JS, /Player de playlist/);

  assert.doesNotMatch(APP_JS, /function initDashboardAdSense/);
  assert.doesNotMatch(APP_JS, /adsbygoogle/);
  assert.doesNotMatch(APP_JS, /Google AdSense/);
  assert.doesNotMatch(APP_JS, /Ad slot/);
});

test('dashboard playlist player keeps the enlarged panel without automatic scrolling UI', () => {
  assert.match(CSS, /\.od-command-hero-split[\s\S]*minmax\(390px, 1\.3fr\)/);
  assert.match(CSS, /\.od-playlist-player-video[\s\S]*height: clamp\(234px, 22vw, 330px\)/);
  assert.match(CSS, /\.od-playlist-player-list[\s\S]*max-height: 210px/);
  assert.match(CSS, /\.od-playlist-player-item\.active/);
  assert.match(CSS, /\.od-playlist-player-item\[hidden\]/);

  assert.doesNotMatch(CSS, /od-hero-ad/);
  assert.doesNotMatch(CSS, /adsbygoogle/);
  assert.doesNotMatch(CSS, /playlist-reel/);
  assert.doesNotMatch(CSS, /keyframes od-playlist/);
});

test('dashboard playlist now-playing caption stays outside native video controls', () => {
  assert.match(
    APP_JS,
    /<div class="od-playlist-player-frame">[\s\S]*?<video[\s\S]*?<\/video>\s*<\/div>\s*<div class="od-playlist-player-now">/
  );

  const nowRule = extractCssRule(CSS, '.od-playlist-player-now {');

  assert.match(nowRule, /position:\s*relative/);
  assert.match(nowRule, /pointer-events:\s*none/);
  assert.match(nowRule, /background:\s*transparent/);
  assert.match(nowRule, /border-left:/);
  assert.doesNotMatch(nowRule, /position:\s*absolute/);
  assert.doesNotMatch(nowRule, /backdrop-filter/);
  assert.doesNotMatch(nowRule, /(^|\n)\s*bottom:/);
  assert.doesNotMatch(nowRule, /(^|\n)\s*left:/);
  assert.doesNotMatch(nowRule, /(^|\n)\s*right:/);
});
