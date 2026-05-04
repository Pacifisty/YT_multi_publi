'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..');
const APP_JS = fs.readFileSync(path.join(ROOT, 'apps', 'api', 'src', 'frontend', 'public', 'app.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'apps', 'api', 'src', 'frontend', 'public', 'app.css'), 'utf8');
const TAKRAM_CSS = CSS.slice(CSS.indexOf('Takram Calm Operations Workspace Layer'));

test('workspace applies Takram calm operations as a scoped visual layer', () => {
  assert.match(CSS, /Takram Calm Operations Workspace Layer/);
  assert.match(TAKRAM_CSS, /\.workspace-page\s*\{[\s\S]*--takram-sage:/);
  assert.match(TAKRAM_CSS, /\.workspace-page \.header-shell-fullwidth\s*\{[\s\S]*backdrop-filter:\s*var\(--takram-blur\)/);
  assert.match(TAKRAM_CSS, /\.workspace-page-platform \.od-shell\s*\{[\s\S]*--od-shell-accent:\s*var\(--takram-sage\)/);
  assert.match(TAKRAM_CSS, /\.workspace-page-dashboard \.od-root\s*\{[\s\S]*--od-accent:\s*var\(--takram-sage\)/);
  assert.match(TAKRAM_CSS, /\.growth-shell-hero,[\s\S]*\.playlist-media-preview\s*\{[\s\S]*var\(--takram-shadow\)/);
  assert.match(TAKRAM_CSS, /\.campaign-command-card:hover,[\s\S]*\.plan-card:hover\s*\{[\s\S]*translateY\(-2px\)/);
});

test('Takram layer stays out of public pages and keeps Motion Lab out of dashboard runtime', () => {
  assert.match(TAKRAM_CSS, /\.workspace-page \.button-primary\s*\{/);
  assert.match(TAKRAM_CSS, /\.workspace-page \.button-secondary\s*\{/);
  assert.doesNotMatch(TAKRAM_CSS, /,\s*\.button-primary\s*\{/);
  assert.doesNotMatch(TAKRAM_CSS, /,\s*\.button-secondary\s*\{/);
  assert.doesNotMatch(APP_JS, /Motion Design Engine|Motion Lab|useSprite|interpolate\(\)/);
});
