'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..');
const APP_JS = fs.readFileSync(path.join(ROOT, 'apps', 'api', 'src', 'frontend', 'public', 'app.js'), 'utf8');
const APP_CSS = fs.readFileSync(path.join(ROOT, 'apps', 'api', 'src', 'frontend', 'public', 'app.css'), 'utf8');
const UI_SHELL = fs.readFileSync(path.join(ROOT, 'apps', 'api', 'src', 'frontend', 'ui-shell.ts'), 'utf8');

test('public root uses the complete login experience without retired landing renderers', () => {
  assert.doesNotMatch(APP_JS, /renderPublicLandingPage(?:Psychedelic|Legacy)?/);
  assert.match(APP_JS, /if \(path === '\/'\) \{[\s\S]*?const me = await ensureAuthenticated\(\)/);
  assert.match(APP_JS, /if \(path === '\/'\) \{[\s\S]*?renderLoginPage\(\{[\s\S]*?accessFirst: false/);
  assert.match(APP_JS, /navigate\(me\.needsPlanSelection \? '\/onboarding\/plan' : '\/workspace\/dashboard', true\)/);
});

test('legacy neon and psychedelic systems are absent from the production bundle', () => {
  assert.doesNotMatch(APP_JS, /renderPlatformLogo3d|renderAnimatedLogoByPlatform|injectLogoStyles|LOGO_STYLES/);
  assert.doesNotMatch(APP_CSS, /\.neon-media-|\.platform-logo-3d|\.public-psychedelic-page|\.psy-/);
  assert.doesNotMatch(APP_CSS, /@keyframes (?:neon-media|psy|login)-/);
  assert.match(APP_JS, /function renderPlatformArtwork\(platform, size = 32, extraClass = ''\)/);
  assert.match(APP_JS, /\/assets\/icons\/YT_youtube\.svg/);
  assert.match(APP_JS, /\/assets\/icons\/TT_tiktok\.svg/);
  assert.match(APP_JS, /\/assets\/icons\/IG_instagram\.svg/);
  assert.equal(fs.existsSync(path.join(ROOT, 'apps', 'api', 'src', 'frontend', 'logo-renderers.js')), false);
  assert.equal(fs.existsSync(path.join(ROOT, 'apps', 'api', 'src', 'frontend', 'public', 'assets', 'neon-icons')), false);
});

test('server-rendered SEO metadata describes the landing conversion goal', () => {
  assert.match(UI_SHELL, /Platform Multi Publisher \| Publique vídeos no YouTube, TikTok e Instagram/);
  assert.match(UI_SHELL, /Planeje, automatize e acompanhe publicações em vídeo no YouTube, TikTok e Instagram/);
  assert.match(UI_SHELL, /Publique vídeos no YouTube, TikTok e Instagram em um só painel/);
  assert.match(UI_SHELL, /Pagina publica com title, meta description, canonical/);
});
