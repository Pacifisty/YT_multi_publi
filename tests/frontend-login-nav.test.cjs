'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..');
const APP_JS = fs.readFileSync(path.join(ROOT, 'apps', 'api', 'src', 'frontend', 'public', 'app.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'apps', 'api', 'src', 'frontend', 'public', 'app.css'), 'utf8');

test('login page reuses the public SaaS navigation panel with animated PMP brand', () => {
  assert.match(APP_JS, /function renderPublicSaasNav/);
  assert.match(APP_JS, /login-with-public-nav/);
  assert.match(APP_JS, /login-modern-site-nav/);
  assert.match(APP_JS, /renderPublicSaasNav\(\{\s*context: 'login'/);
  assert.match(APP_JS, /class="pmp-logo-ring"/);
  assert.match(APP_JS, /class="pmp-logo-network"/);
  assert.match(APP_JS, /class="pmp-logo-publish"/);
  assert.match(APP_JS, /class="pmp-logo-play"/);
  assert.match(APP_JS, /<div class="public-nav-actions" data-no-i18n>/);
  assert.match(APP_JS, />Login<\/a>/);
  assert.match(APP_JS, /const registerLabel = 'Get started'/);
  assert.match(APP_JS, /Schedule, automate and publish to YouTube, TikTok and Instagram/);
});

test('login navigation keeps the dark background treatment and responsive layout', () => {
  assert.match(CSS, /\.login-modern\.login-with-public-nav/);
  assert.match(CSS, /\.login-with-public-nav \.login-modern-site-nav/);
  assert.match(CSS, /rgba\(11, 16, 32, 0\.88\)/);
  assert.match(CSS, /\.login-modern-brand-compact/);
  assert.match(CSS, /@keyframes login-brand-orb-pulse/);
  assert.match(CSS, /\.pmp-logo-network line/);
  assert.match(CSS, /@keyframes pmp-publish-reveal/);
  assert.match(CSS, /@media \(max-width: 1180px\)[\s\S]*\.public-saas-page \.public-saas-nav[\s\S]*grid-template-columns: 1fr/);
  assert.match(CSS, /\.public-saas-page \.public-shell[\s\S]*overflow-x: hidden/);
});
