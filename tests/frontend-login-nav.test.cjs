'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..');
const APP_JS = fs.readFileSync(path.join(ROOT, 'apps', 'api', 'src', 'frontend', 'public', 'app.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'apps', 'api', 'src', 'frontend', 'public', 'app.css'), 'utf8');

test('login page uses the current merchant navigation and one production PMP brand', () => {
  assert.match(APP_JS, /function renderLoginPage\(options = \{\}\)/);
  assert.match(APP_JS, /class="merchant-login"/);
  assert.match(APP_JS, /class="merchant-nav"/);
  assert.match(APP_JS, /class="merchant-brand-mark merchant-brand-mark-animated"/);
  assert.match(APP_JS, /class="merchant-nav-actions"/);
  assert.match(APP_JS, /<span>Login<\/span>/);
  assert.match(APP_JS, /<span>Criar conta<\/span>/);
  assert.match(APP_JS, /data-auth-mode="login"/);
  assert.match(APP_JS, /data-auth-mode="register"/);
  assert.doesNotMatch(APP_JS, /renderPublicSaasNav|login-with-public-nav|login-modern-site-nav/);
});

test('login navigation keeps the dark PMP palette and responsive layout', () => {
  assert.match(CSS, /\.merchant-login\s*\{[\s\S]*--merchant-paper:\s*#07101b/);
  assert.match(CSS, /\.merchant-nav\s*\{[\s\S]*position:\s*sticky/);
  assert.match(CSS, /\.merchant-brand-mark[\s\S]*PMP-logo\.webp/);
  assert.match(CSS, /\.merchant-nav-cta-secondary/);
  assert.match(CSS, /@media \(max-width:\s*760px\)[\s\S]*\.merchant-nav/);
  assert.doesNotMatch(CSS, /\.login-modern|\.login-with-public-nav|@keyframes login-brand-orb-pulse/);
});
