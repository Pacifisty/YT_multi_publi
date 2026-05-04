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

function extractFunctionSource(source, functionName) {
  const start = source.indexOf(`function ${functionName}`);
  assert.notStrictEqual(start, -1, `Missing function ${functionName}`);
  const openBrace = source.indexOf('{', start);
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

function createClassList(initial = []) {
  const values = new Set(initial);
  return {
    contains: (name) => values.has(name),
    toggle: (name, force) => {
      const enabled = force === undefined ? !values.has(name) : Boolean(force);
      if (enabled) values.add(name);
      else values.delete(name);
      return enabled;
    },
  };
}

function createElement({ attrs = {}, classes = [] } = {}) {
  const attributes = { ...attrs };
  const listeners = {};
  return {
    hidden: false,
    textContent: '',
    classList: createClassList(classes),
    getAttribute: (name) => attributes[name] ?? null,
    setAttribute: (name, value) => { attributes[name] = String(value); },
    removeAttribute: (name) => { delete attributes[name]; },
    addEventListener: (eventName, handler) => { listeners[eventName] = handler; },
    dispatch: (eventName) => listeners[eventName]?.({ type: eventName }),
  };
}

function createVideoElement() {
  const video = createElement({ attrs: { src: '/media/a.mp4' } });
  video.playCount = 0;
  video.pauseCount = 0;
  video.loadCount = 0;
  video.play = () => {
    video.playCount += 1;
    return Promise.resolve();
  };
  video.pause = () => {
    video.pauseCount += 1;
  };
  video.load = () => {
    video.loadCount += 1;
  };
  return video;
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
  assert.match(APP_JS, /data-playlist-player-autoplay/);
  assert.match(APP_JS, /Playlist em reprodução/);

  assert.doesNotMatch(APP_JS, /function initDashboardAdSense/);
  assert.doesNotMatch(APP_JS, /adsbygoogle/);
  assert.doesNotMatch(APP_JS, /Google AdSense/);
  assert.doesNotMatch(APP_JS, /Ad slot/);
});

test('dashboard playlist player keeps the enlarged panel without automatic scrolling UI', () => {
  assert.match(CSS, /\.od-command-hero-split[\s\S]*minmax\(390px, 1\.3fr\)/);
  assert.match(CSS, /\.od-hero-playlist-player[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto/);
  assert.match(CSS, /\.od-playlist-player-video[\s\S]*height: clamp\(210px, 18vw, 280px\)/);
  assert.match(CSS, /\.od-playlist-player-controls/);
  assert.match(CSS, /\.od-playlist-player-auto/);
  assert.match(CSS, /\.od-playlist-player-list[\s\S]*max-height: 208px/);
  assert.match(CSS, /\.od-playlist-player-list[\s\S]*-webkit-mask-image:/);
  assert.match(CSS, /\.od-playlist-player-item[\s\S]*min-height: 64px/);
  assert.match(CSS, /\.od-playlist-player-item\.active/);
  assert.match(CSS, /\.od-playlist-player-item\[hidden\]/);

  assert.doesNotMatch(CSS, /od-hero-ad/);
  assert.doesNotMatch(CSS, /adsbygoogle/);
  assert.doesNotMatch(CSS, /playlist-reel/);
  assert.doesNotMatch(CSS, /keyframes od-playlist/);
});

test('dashboard editorial pulse shows current time without resizing the panel layout', () => {
  assert.match(
    APP_JS,
    /<div class="od-pulse-header">[\s\S]*?<span class="od-kpi-label od-mono">Pulso editorial<\/span>[\s\S]*?<span class="od-pulse-clock od-mono" aria-label="Hora atual">[\s\S]*?<span>Agora<\/span>[\s\S]*?<strong data-dashboard-clock>\$\{escapeHtml\(liveClock\)\}<\/strong>/
  );
  assert.match(APP_JS, /<span class="od-live-dot"><\/span><span data-dashboard-clock>\$\{escapeHtml\(liveClock\)\}<\/span>/);
  assert.match(APP_JS, /function startDashboardClock\(root\)/);
  assert.match(APP_JS, /clearDashboardClockTimer\(\)/);
  assert.match(APP_JS, /setInterval\(updateClock, 1000\)/);
  assert.match(APP_JS, /startDashboardClock\(dashboardRoot\)/);

  const heroRule = extractCssRule(CSS, '.od-hero-copy {');
  const headerRule = extractCssRule(CSS, '.od-pulse-header {');
  const clockRule = extractCssRule(CSS, '.od-pulse-clock {');

  assert.match(heroRule, /gap:\s*14px/);
  assert.doesNotMatch(heroRule, /(^|\n)\s*(min-)?height:/);
  assert.match(headerRule, /position:\s*relative/);
  assert.match(headerRule, /display:\s*block/);
  assert.match(clockRule, /position:\s*absolute/);
  assert.match(clockRule, /box-sizing:\s*border-box/);
  assert.match(clockRule, /height:\s*18px/);
  assert.match(clockRule, /padding:\s*0 7px/);
  assert.match(clockRule, /transform:\s*translateY\(-50%\)/);
  assert.match(clockRule, /white-space:\s*nowrap/);
  assert.doesNotMatch(clockRule, /min-height/);
});

test('dashboard prioritizes three operational decisions above the KPI grid', () => {
  const actionMark = extractFunctionSource(APP_JS, 'renderDashboardActionMark');
  const channelIcon = extractFunctionSource(APP_JS, 'renderChannelKpiIcon');
  const rankBadge = extractFunctionSource(APP_JS, 'renderRankBadge');
  const deltaArrow = extractFunctionSource(APP_JS, 'renderDeltaArrow');

  assert.match(APP_JS, /od-decision-strip/);
  assert.match(APP_JS, /Proxima melhor acao/);
  assert.match(APP_JS, /O que publicar/);
  assert.match(APP_JS, /O que corrigir/);
  assert.match(APP_JS, /O que esta performando/);
  assert.match(APP_JS, /Painel editorial/);
  assert.match(APP_JS, /Contas conectadas/);
  assert.match(actionMark, /renderCampaignMark\(meta\.label, meta\.tone, 'od-hero-action-mark'\)/);
  assert.match(channelIcon, /renderCampaignPlatformMark\(provider, 'od-channel-platform-mark'\)/);
  assert.match(rankBadge, /renderCampaignMark\(rank === 1 \? 'TOP'/);
  assert.match(deltaArrow, /renderCampaignMark\('DN', 'danger', 'od-delta-mark'\)/);
  assert.doesNotMatch(APP_JS, /const CHANNEL_KPI_ICONS\s*=/);
  assert.doesNotMatch(APP_JS, /<div class="od-brand">Editorial Dashboard<\/div>/);
  assert.doesNotMatch(APP_JS, /<button type="button" class="od-refresh-button od-mono" data-action="dashboard-refresh">Refresh<\/button>/);
  assert.doesNotMatch(APP_JS, /function renderEditorialPulseIcon/);
  assert.doesNotMatch(APP_JS, /renderPlatformLogo3d\('youtube', 42, 'od-channel-platform-logo'\)/);

  assert.match(CSS, /\.od-decision-strip/);
  assert.match(CSS, /\.od-decision-grid/);
  assert.match(CSS, /\.od-decision-card/);
  assert.match(CSS, /\.od-hero-action-mark/);
  assert.match(CSS, /\.od-channel-platform-mark/);
  assert.match(CSS, /\.od-rank-mark/);
  assert.match(CSS, /\.od-delta-mark/);
});

test('dashboard editorial pulse clock updates without dashboard re-rendering', () => {
  const clearClockSource = extractFunctionSource(APP_JS, 'clearDashboardClockTimer');
  const startClockSource = extractFunctionSource(APP_JS, 'startDashboardClock');
  const state = { dashboardClockTimer: null };
  let clearCount = 0;
  let intervalHandler = null;
  const labels = ['10:00', '10:01'];
  const nodes = [{ textContent: '' }, { textContent: '' }];
  const root = {
    querySelectorAll: (selector) => (selector === '[data-dashboard-clock]' ? nodes : []),
  };
  const { startDashboardClock } = Function(
    'state',
    'formatClockLabel',
    'setInterval',
    'clearInterval',
    `${clearClockSource}; ${startClockSource}; return { startDashboardClock };`
  )(
    state,
    () => labels.shift() ?? '10:02',
    (handler, delay) => {
      intervalHandler = handler;
      return { delay };
    },
    () => { clearCount += 1; }
  );

  state.dashboardClockTimer = { delay: 1000 };
  startDashboardClock(root);

  assert.equal(clearCount, 1);
  assert.deepEqual(nodes.map((node) => node.textContent), ['10:00', '10:00']);
  assert.equal(state.dashboardClockTimer.delay, 1000);
  assert.equal(typeof intervalHandler, 'function');

  intervalHandler();
  assert.deepEqual(nodes.map((node) => node.textContent), ['10:01', '10:01']);
});

test('dashboard playlist player can advance videos automatically after each video ends', () => {
  assert.match(APP_JS, /const autoButton = panel\.querySelector\('\[data-playlist-player-autoplay\]'\)/);
  assert.match(APP_JS, /let autoplayEnabled = false/);
  assert.match(APP_JS, /const markPlayerEngaged = \(\) => \{/);
  assert.match(APP_JS, /data-playlist-player-engaged/);
  assert.match(APP_JS, /const getVisibleItems = \(\) => items\.filter\(\(item\) => !item\.hidden\)/);
  assert.match(APP_JS, /const getNextVisibleItem = \(\) => \{/);
  assert.match(APP_JS, /activateItem\(activeVisible \?\? firstVisible, \{ autoplay: autoplayEnabled \}\)/);
  assert.match(APP_JS, /autoButton\.addEventListener\('click'/);
  assert.match(APP_JS, /video\.addEventListener\('ended'/);
  assert.match(APP_JS, /if \(!autoplayEnabled\) \{/);
  assert.match(APP_JS, /panel\.removeAttribute\?\.\('data-playlist-player-engaged'\)/);
  assert.match(APP_JS, /activateItem\(nextItem, \{ autoplay: true \}\)/);
  assert.match(APP_JS, /playsinline/);

  const autoRule = extractCssRule(CSS, '.od-playlist-player-auto {');
  assert.match(autoRule, /cursor:\s*pointer/);
  assert.match(CSS, /\.od-playlist-player-auto\.active/);
});

test('dashboard auto-refresh does not interrupt an active playlist video', () => {
  assert.match(APP_JS, /const DASHBOARD_AUTO_REFRESH_RETRY_MS = 3000/);
  assert.match(APP_JS, /function scheduleDashboardAutoRefresh/);
  assert.match(APP_JS, /function isDashboardPlaylistPlayerProtected\(\)/);
  assert.match(APP_JS, /document\.querySelector\('\[data-playlist-player-video\]'\)/);
  assert.match(APP_JS, /dashboardVideo instanceof HTMLVideoElement/);
  assert.match(APP_JS, /dashboardVideo\.closest\?\.\('\[data-playlist-player\]'\)/);
  assert.match(APP_JS, /return Boolean\(dashboardVideo\.closest\?\.\('\[data-playlist-player\]'\)\)/);
  assert.match(APP_JS, /if \(protectPlaylistPlayer && isDashboardPlaylistPlayerProtected\(\)\) \{/);
  assert.match(APP_JS, /scheduleDashboardAutoRefresh\(\{ delayMs: DASHBOARD_AUTO_REFRESH_RETRY_MS, protectPlaylistPlayer \}\)/);
  assert.match(APP_JS, /scheduleDashboardAutoRefresh\(\{ protectPlaylistPlayer: true \}\)/);
});

test('dashboard auto-refresh protects a mounted playlist player even while idle', () => {
  const protectSource = extractFunctionSource(APP_JS, 'isDashboardPlaylistPlayerProtected');
  const document = { querySelector: () => document.currentVideo };
  class FakeVideo {
    constructor({ mounted = true } = {}) {
      this.panel = mounted ? {} : null;
    }

    closest(selector) {
      return selector === '[data-playlist-player]' ? this.panel : null;
    }
  }
  const isDashboardPlaylistPlayerProtected = Function(
    'document',
    'HTMLVideoElement',
    `${protectSource}; return isDashboardPlaylistPlayerProtected;`
  )(document, FakeVideo);

  document.currentVideo = null;
  assert.equal(isDashboardPlaylistPlayerProtected(), false);

  document.currentVideo = new FakeVideo({ mounted: false });
  assert.equal(isDashboardPlaylistPlayerProtected(), false);

  document.currentVideo = new FakeVideo({ mounted: true });
  assert.equal(isDashboardPlaylistPlayerProtected(), true);
});

test('dashboard playlist player DOM flow preserves automatic playback across playlist changes', () => {
  const bindSource = extractFunctionSource(APP_JS, 'bindDashboardPlaylistPlayer');
  const bindDashboardPlaylistPlayer = Function(`${bindSource}; return bindDashboardPlaylistPlayer;`)();
  const video = createVideoElement();
  const title = createElement();
  const meta = createElement();
  const autoLabel = createElement();
  const autoButton = createElement();
  const select = createElement();
  select.value = 'playlist-a';

  const itemA = createElement({
    attrs: {
      'data-playlist-id': 'playlist-a',
      'data-video-src': '/media/a.mp4',
      'data-video-poster': '/media/a.jpg',
      'data-video-title': 'Video A',
      'data-video-meta': 'Playlist A - 1:00',
    },
    classes: ['active'],
  });
  const itemB = createElement({
    attrs: {
      'data-playlist-id': 'playlist-b',
      'data-video-src': '/media/b.mp4',
      'data-video-poster': '/media/b.jpg',
      'data-video-title': 'Video B',
      'data-video-meta': 'Playlist B - 1:00',
    },
  });
  const itemC = createElement({
    attrs: {
      'data-playlist-id': 'playlist-b',
      'data-video-src': '/media/c.mp4',
      'data-video-poster': '/media/c.jpg',
      'data-video-title': 'Video C',
      'data-video-meta': 'Playlist B - 2:00',
    },
  });
  const items = [itemA, itemB, itemC];
  const panel = {
    querySelector: (selector) => ({
      '[data-playlist-player-select]': select,
      '[data-playlist-player-video]': video,
      '[data-playlist-player-title]': title,
      '[data-playlist-player-meta]': meta,
      '[data-playlist-player-autoplay]': autoButton,
      '[data-playlist-player-autoplay-label]': autoLabel,
    })[selector] ?? null,
    querySelectorAll: (selector) => (selector === '[data-playlist-player-item]' ? items : []),
  };
  const root = {
    querySelector: (selector) => (selector === '[data-playlist-player]' ? panel : null),
  };

  bindDashboardPlaylistPlayer(root);

  autoButton.dispatch('click');
  assert.strictEqual(autoButton.getAttribute('aria-pressed'), 'true');
  assert.strictEqual(autoLabel.textContent, 'Automático ligado');
  assert.strictEqual(video.playCount, 1);

  select.value = 'playlist-b';
  select.dispatch('change');
  assert.strictEqual(video.getAttribute('src'), '/media/b.mp4');
  assert.strictEqual(video.playCount, 2);
  assert.strictEqual(title.textContent, 'Video B');

  video.dispatch('ended');
  assert.strictEqual(video.getAttribute('src'), '/media/c.mp4');
  assert.strictEqual(video.playCount, 3);
  assert.strictEqual(title.textContent, 'Video C');
});

test('dashboard playlist now-playing caption stays outside native video controls', () => {
  assert.match(
    APP_JS,
    /<div class="od-playlist-player-frame">[\s\S]*?<video[\s\S]*?<\/video>\s*<\/div>\s*<div class="od-playlist-player-now">/
  );

  const nowRule = extractCssRule(CSS, '.od-playlist-player-now {');

  assert.match(nowRule, /position:\s*relative/);
  assert.match(nowRule, /pointer-events:\s*none/);
  assert.match(nowRule, /grid-column:\s*1 \/ -1/);
  assert.match(nowRule, /border-radius:\s*14px/);
  assert.match(nowRule, /background:\s*color-mix\(in srgb, var\(--surface-muted\) 74%, transparent\)/);
  assert.match(nowRule, /border-left:/);
  assert.doesNotMatch(nowRule, /position:\s*absolute/);
  assert.doesNotMatch(nowRule, /backdrop-filter/);
  assert.doesNotMatch(nowRule, /(^|\n)\s*bottom:/);
  assert.doesNotMatch(nowRule, /(^|\n)\s*left:/);
  assert.doesNotMatch(nowRule, /(^|\n)\s*right:/);
});

test('dashboard panels keep labels and large metrics inside their cards', () => {
  const legacyGridRule = extractCssRule(CSS, '.dash-hero {');
  const legacyCardRule = extractCssRule(CSS, '.dash-hero-card {');
  const legacyValueRule = extractCssRule(CSS, '.dash-hero-value {');
  const modeGridRule = extractCssRule(CSS, '.od-mode-switch {');
  const actionRule = extractCssRule(CSS, '.od-hero-action-btn {');
  const healthGridRule = extractCssRule(CSS, '.od-health-metrics {');
  const healthCardRule = extractCssRule(CSS, '.od-health-metrics div {');
  const channelHeadRule = extractCssRule(CSS, '.od-channel-card-head {');
  const channelNameRule = extractCssRule(CSS, '.od-channel-name {');
  const channelValueRule = extractCssRule(CSS, '.od-channel-total {');
  const kpiValueRule = extractCssRule(CSS, '.od-kpi-card strong {');

  assert.match(legacyGridRule, /repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(legacyCardRule, /min-width:\s*0/);
  assert.match(legacyValueRule, /font-size:\s*clamp/);
  assert.match(legacyValueRule, /overflow-wrap:\s*anywhere/);
  assert.match(modeGridRule, /auto-fit/);
  assert.match(modeGridRule, /minmax\(132px, 1fr\)/);
  assert.match(actionRule, /white-space:\s*normal/);
  assert.match(healthGridRule, /minmax\(124px, 1fr\)/);
  assert.match(healthCardRule, /min-width:\s*0/);
  assert.match(channelHeadRule, /auto minmax\(0, 1fr\) auto/);
  assert.match(channelNameRule, /text-overflow:\s*ellipsis/);
  assert.match(channelNameRule, /white-space:\s*nowrap/);
  assert.match(channelValueRule, /font-size:\s*clamp\(1\.65rem/);
  assert.match(channelValueRule, /overflow-wrap:\s*anywhere/);
  assert.match(CSS, /\.od-kpi-card \{\s*position:\s*relative;[\s\S]*?min-width:\s*0/);
  assert.match(kpiValueRule, /overflow-wrap:\s*anywhere/);
  assert.match(CSS, /@media \(max-width: 1440px\)[\s\S]*?\.od-kpi-grid[\s\S]*?repeat\(3, minmax\(0, 1fr\)\)/);
});
