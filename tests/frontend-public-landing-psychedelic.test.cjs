'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..');
const APP_JS = fs.readFileSync(path.join(ROOT, 'apps', 'api', 'src', 'frontend', 'public', 'app.js'), 'utf8');
const APP_CSS = fs.readFileSync(path.join(ROOT, 'apps', 'api', 'src', 'frontend', 'public', 'app.css'), 'utf8');
const UI_SHELL = fs.readFileSync(path.join(ROOT, 'apps', 'api', 'src', 'frontend', 'ui-shell.ts'), 'utf8');

test('public root uses the psychedelic SEO conversion landing', () => {
  assert.match(APP_JS, /async function renderPublicLandingPagePsychedelic\(\)/);
  assert.match(APP_JS, /await renderPublicLandingPagePsychedelic\(\);/);
  assert.match(APP_JS, /Publique vídeos no YouTube, TikTok e Instagram em um só painel/);
  assert.match(APP_JS, /Organize campanhas, conecte suas contas, acompanhe falhas/);
  assert.match(APP_JS, /psy-type-rail/);
  assert.match(APP_JS, /Publicar em três canais/);
  assert.match(APP_JS, /psy-mascot/);
  assert.match(APP_JS, /Conectar contas/);
  assert.match(APP_JS, /Criar campanha/);
  assert.match(APP_JS, /Acompanhar status/);
});

test('public landing keeps the selected psychedelic visual system isolated', () => {
  assert.match(APP_CSS, /\.public-psychedelic-page\s*\{/);
  assert.match(APP_CSS, /\.psy-poster-frame\s*\{/);
  assert.match(APP_CSS, /\.psy-type-rail\s*\{/);
  assert.match(APP_CSS, /\.psy-dot-number\s*\{/);
  assert.match(APP_CSS, /@keyframes psy-mascot-nod/);
  assert.match(APP_CSS, /@keyframes psy-sun-spin/);
  assert.match(APP_CSS, /@keyframes psy-frame-breathe/);
  assert.match(APP_CSS, /@media \(prefers-reduced-motion: reduce\)/);
});

test('server-rendered SEO metadata describes the landing conversion goal', () => {
  assert.match(UI_SHELL, /Platform Multi Publisher \| Publique vídeos no YouTube, TikTok e Instagram/);
  assert.match(UI_SHELL, /Planeje, automatize e acompanhe publicações em vídeo no YouTube, TikTok e Instagram/);
  assert.match(UI_SHELL, /Publique vídeos no YouTube, TikTok e Instagram em um só painel/);
  assert.match(UI_SHELL, /Pagina publica com title, meta description, canonical/);
});
