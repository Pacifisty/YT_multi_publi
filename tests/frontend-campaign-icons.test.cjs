'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..');
const APP_JS = fs.readFileSync(path.join(ROOT, 'apps', 'api', 'src', 'frontend', 'public', 'app.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'apps', 'api', 'src', 'frontend', 'public', 'app.css'), 'utf8');

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

function extractCssRule(selector) {
  const start = CSS.indexOf(selector);
  assert.notStrictEqual(start, -1, `Missing CSS selector ${selector}`);
  const openBrace = CSS.indexOf('{', start);
  assert.notStrictEqual(openBrace, -1, `Missing CSS rule body for ${selector}`);
  let depth = 0;
  for (let index = openBrace; index < CSS.length; index += 1) {
    const char = CSS[index];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) return CSS.slice(start, index + 1);
  }
  throw new Error(`Unclosed CSS rule for ${selector}`);
}

test('campaign page uses lightweight CSS marks instead of neon/media icon helpers', () => {
  const statusMeta = extractFunctionSource(APP_JS, 'getCampaignStatusMeta');
  const mark = extractFunctionSource(APP_JS, 'renderCampaignMark');
  const platformMark = extractFunctionSource(APP_JS, 'renderCampaignPlatformMark');
  const platformStack = extractFunctionSource(APP_JS, 'renderCampaignPlatformStack');
  const outcomeChips = extractFunctionSource(APP_JS, 'renderCampaignOutcomeChips');
  const campaignsPage = extractFunctionSource(APP_JS, 'renderCampaignsPage');

  assert.match(statusMeta, /mark: 'RA'/);
  assert.match(statusMeta, /mark: 'OK'/);
  assert.match(mark, /campaign-mark/);
  assert.match(platformMark, /campaign-platform-mark/);
  assert.match(platformMark, /getCampaignPlatformMark/);
  assert.match(platformStack, /campaign-platform-mark-cluster/);
  assert.match(platformStack, /renderCampaignPlatformMark\(platform, 'campaign-platform-mark'\)/);
  assert.match(outcomeChips, /campaign-outcome-mark/);
  assert.match(campaignsPage, /renderCampaignMark\(item\.mark, item\.key, 'campaign-control-status-mark'\)/);
  assert.match(campaignsPage, /renderCampaignMark\(statusMeta\.mark, statusMeta\.tone, 'campaign-command-status-mark'\)/);
  assert.match(campaignsPage, /renderCampaignMark\('NOVO', 'info', 'campaign-control-command-mark'\)/);
  assert.match(campaignsPage, /cc-refresh-indicator/);
  assert.match(campaignsPage, /cc-clear-mark/);

  assert.doesNotMatch(campaignsPage, /renderNeonMediaIcon/);
  assert.doesNotMatch(campaignsPage, /renderPlatformLogo3d/);
  assert.doesNotMatch(campaignsPage, /<svg viewBox="0 0 24 24"/);
  assert.doesNotMatch(APP_JS, /function renderCampaignNeonIcon/);
  assert.doesNotMatch(APP_JS, /function renderCampaignPlatformLogoFrame/);
});

test('campaign creation media step uses campaign marks instead of neon icons', () => {
  const mediaStep = extractFunctionSource(APP_JS, 'renderCampaignFlowMediaStep');

  assert.match(mediaStep, /renderCampaignMark\('MID', 'info', 'campaign-segment-mark'\)/);
  assert.match(mediaStep, /renderCampaignMark\('AUTO', 'processing', 'campaign-segment-mark'\)/);
  assert.doesNotMatch(mediaStep, /renderNeonMediaIcon\('library', 'segment'\)/);
  assert.doesNotMatch(mediaStep, /renderNeonMediaIcon\('playlist', 'segment'\)/);
});

test('campaign CSS defines a restrained non-neon campaign mark system', () => {
  for (const selector of [
    '.campaign-mark,',
    '.campaign-platform-mark {',
    '.campaign-platform-mark-cluster {',
    '.campaign-outcome-mark {',
    '.campaign-command-status-mark {',
    '.campaign-control-command-mark {',
    '.campaign-control-status-mark {',
    '.campaign-control-platform-mark {',
    '.mission-tile-mark,',
  ]) {
    assert.ok(CSS.includes(selector), `Missing CSS selector ${selector}`);
  }

  assert.match(CSS, /\.campaign-mark\[data-tone="success"\]/);
  assert.match(CSS, /\.campaign-mark\[data-tone="danger"\]/);
  assert.match(CSS, /\.campaign-platform-mark\[data-platform="youtube"\]/);
  assert.match(CSS, /background: color-mix\(in srgb, var\(--surface-muted\) 78%, transparent\)/);
  assert.doesNotMatch(CSS, /\.campaign-neon-frame/);
  assert.doesNotMatch(CSS, /\.campaign-platform-logo-frame/);
  assert.doesNotMatch(CSS, /\.campaign-control-command-icon-frame/);
});

test('campaign CSS keeps campaign panels and creation states non-neon', () => {
  const commandCard = extractCssRule('.workspace-page-platform .od-shell-content .campaign-command-card');
  const commandCardHover = extractCssRule('.workspace-page-platform .od-shell-content .campaign-command-card:hover');
  const successValue = extractCssRule('.mission-success-value');
  const countdownValue = extractCssRule('.mission-tile-countdown .mission-tile-value');
  const sparkFill = extractCssRule('.mission-spark-bar-fill');
  const publishedFill = extractCssRule('.campaign-progress-fill.published');
  const failedFill = extractCssRule('.campaign-progress-fill.failed');
  const controlPlatformFill = extractCssRule('.campaign-control-platform-track span,');
  const controlFailedFill = extractCssRule('.campaign-control-target-track .is-failed');
  const pulseLine = extractCssRule('.pulse-line');
  const pulseNow = extractCssRule('.pulse-now');
  const campaignFlowHeader = extractCssRule('.campaign-flow-header');
  const platformSelected = extractCssRule('.campaign-platform-card[data-selected="true"],');
  const youtubeSelected = extractCssRule('.campaign-platform-card[data-tone="youtube"][data-selected="true"]');
  const tiktokSelected = extractCssRule('.campaign-platform-card[data-tone="tiktok"][data-selected="true"]');
  const instagramSelected = extractCssRule('.campaign-platform-card[data-tone="instagram"][data-selected="true"]');

  assert.doesNotMatch(commandCard, /radial-gradient/);
  assert.doesNotMatch(commandCard, /box-shadow:\s*0\s+0/);
  assert.doesNotMatch(commandCardHover, /box-shadow:\s*[^;]*0\s+0/);
  assert.doesNotMatch(successValue, /-webkit-text-fill-color:\s*transparent/);
  assert.doesNotMatch(successValue, /background:\s*linear-gradient/);
  assert.doesNotMatch(countdownValue, /background:\s*linear-gradient/);
  assert.doesNotMatch(sparkFill, /background:\s*linear-gradient/);
  assert.doesNotMatch(publishedFill, /background:\s*linear-gradient/);
  assert.doesNotMatch(publishedFill, /box-shadow/);
  assert.doesNotMatch(failedFill, /background:\s*linear-gradient/);
  assert.doesNotMatch(failedFill, /box-shadow/);
  assert.doesNotMatch(controlPlatformFill, /background:\s*linear-gradient/);
  assert.doesNotMatch(controlPlatformFill, /box-shadow/);
  assert.doesNotMatch(controlFailedFill, /background:\s*linear-gradient/);
  assert.doesNotMatch(controlFailedFill, /box-shadow/);
  assert.match(pulseLine, /filter:\s*none/);
  assert.doesNotMatch(pulseNow, /background:\s*linear-gradient/);
  assert.doesNotMatch(campaignFlowHeader, /radial-gradient/);
  assert.doesNotMatch(platformSelected, /box-shadow/);

  for (const rule of [youtubeSelected, tiktokSelected, instagramSelected]) {
    assert.doesNotMatch(rule, /box-shadow/);
    assert.doesNotMatch(rule, /#ff0033|#25f4ee|#d62976/i);
  }
});

test('accounts cockpit uses Portuguese copy and restrained text marks', () => {
  const accountLogo = extractFunctionSource(APP_JS, 'accountPlatformLogoHtml');
  const accountsPage = extractFunctionSource(APP_JS, 'renderAccountsPage');

  assert.match(accountsPage, /title: 'Contas'/);
  assert.match(accountsPage, /COMANDO DE CONTAS/);
  assert.match(accountsPage, /Conectar YouTube/);
  assert.match(accountsPage, /Sincronizar canais/);
  assert.match(accountsPage, /renderCampaignPlatformMark\('youtube', 'accounts-platform-mark'\)/);
  assert.match(accountsPage, /renderCampaignMark\('FOCO', 'info', 'accounts-cockpit-stat-mark'\)/);
  assert.match(accountsPage, /renderCampaignMark\(reauthCount > 0 \? 'AUTH' : 'OK'/);
  assert.doesNotMatch(accountsPage, /ACCOUNTS COMMAND/);
  assert.doesNotMatch(accountsPage, /Every publishing identity/);
  assert.doesNotMatch(accountsPage, /renderPlatformGlyph\('youtube', 'small'\)/);
  assert.doesNotMatch(accountsPage, /Disconnect<\/button>|Delete<\/button>|Sync channels/);
  assert.match(accountLogo, /renderCampaignPlatformMark\(safePlatform, 'account-platform-mark'\)/);
  assert.doesNotMatch(accountLogo, /renderPlatformGlyph/);

  assert.match(CSS, /\.accounts-platform-mark/);
  assert.match(CSS, /\.accounts-cockpit-stat-mark/);
  assert.match(CSS, /\.account-platform-mark/);
  assert.match(CSS, /\.accounts-cockpit-card-glow,\s*\.accounts-cockpit-card-icon-ring,\s*\.accounts-cockpit-scan/);
});

test('campaign page consolidates filters into the launch board', () => {
  const campaignsPage = extractFunctionSource(APP_JS, 'renderCampaignsPage');

  assert.match(campaignsPage, /campaign-launch-toolbar/);
  assert.match(campaignsPage, /<span class="platform-dashboard-kicker">Painel de lancamento<\/span>/);
  assert.doesNotMatch(campaignsPage, /<span class="platform-dashboard-kicker">Filtros de campanha<\/span>/);
  assert.doesNotMatch(campaignsPage, /<section class="platform-dashboard-stat-grid">\s*\$\{metricsHtml\}\s*<\/section>/);
  assert.match(CSS, /\.campaign-launch-toolbar/);
});
