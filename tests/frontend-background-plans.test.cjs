'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const ts = require('typescript');

const APP_JS_PATH = path.join(__dirname, '..', 'apps', 'api', 'src', 'frontend', 'public', 'app.js');
const APP_CSS_PATH = path.join(__dirname, '..', 'apps', 'api', 'src', 'frontend', 'public', 'app.css');
const PLAN_ORDER = ['FREE', 'BASIC', 'PRO', 'PREMIUM'];
const PAID_PLAN_IDS = ['BASIC', 'PRO', 'PREMIUM'];
const PREMIUM_THEME_COUNT = 6;

function extractConstant(source, name) {
  const sourceFile = ts.createSourceFile('app.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let initializer = null;
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name) {
        initializer = declaration.initializer?.getText(sourceFile) ?? null;
      }
    }
  }
  assert.ok(initializer, `Missing ${name}`);
  const literal = initializer;
  return Function(`"use strict"; return (${literal});`)();
}

function loadBackgroundConfig() {
  const source = fs.readFileSync(APP_JS_PATH, 'utf8');
  return {
    backgroundThemes: extractConstant(source, 'BACKGROUND_THEME_OPTIONS'),
    planThemeMap: extractConstant(source, 'PLAN_BACKGROUND_THEME_MAP'),
  };
}

test('free workspace uses one fixed theme and every paid plan unlocks six sets', () => {
  const { planThemeMap } = loadBackgroundConfig();

  assert.strictEqual(planThemeMap.FREE.themeIds.length, 1);
  assert.strictEqual(planThemeMap.FREE.defaultTheme, planThemeMap.FREE.themeIds[0]);

  for (const planId of PAID_PLAN_IDS) {
    assert.strictEqual(
      planThemeMap[planId].themeIds.length,
      PREMIUM_THEME_COUNT,
      `${planId} should unlock exactly ${PREMIUM_THEME_COUNT} premium visual sets`,
    );
  }
});

test('workspace background plan ids all point to existing themes', () => {
  const { backgroundThemes, planThemeMap } = loadBackgroundConfig();
  const themeIds = new Set(backgroundThemes.map((theme) => theme.id));

  for (const planId of PLAN_ORDER) {
    for (const themeId of planThemeMap[planId].themeIds) {
      assert.ok(themeIds.has(themeId), `${planId} references missing theme ${themeId}`);
    }
  }
});

test('all paid plans unlock the same curated theme catalog', () => {
  const { planThemeMap } = loadBackgroundConfig();
  const expected = planThemeMap.BASIC.themeIds;
  for (const planId of PAID_PLAN_IDS) {
    assert.deepStrictEqual(planThemeMap[planId].themeIds, expected);
    assert.ok(!planThemeMap[planId].themeIds.includes(planThemeMap.FREE.defaultTheme));
  }
});

test('every visual set owns an accessible text hierarchy', () => {
  const { backgroundThemes, planThemeMap } = loadBackgroundConfig();
  const activeThemeIds = new Set([
    ...planThemeMap.FREE.themeIds,
    ...planThemeMap.BASIC.themeIds,
  ]);
  const activeThemes = backgroundThemes.filter((theme) => activeThemeIds.has(theme.id));

  assert.strictEqual(activeThemes.length, PREMIUM_THEME_COUNT + 1);
  for (const theme of activeThemes) {
    assert.match(theme.text, /^#[0-9a-f]{6}$/i);
    assert.match(theme.textSubtle, /^#[0-9a-f]{6}$/i);
    assert.match(theme.textMuted, /^#[0-9a-f]{6}$/i);
    assert.match(theme.onAccent, /^#[0-9a-f]{6}$/i);
  }
});

test('independent text color selection is removed from the workspace', () => {
  const source = fs.readFileSync(APP_JS_PATH, 'utf8');
  assert.doesNotMatch(source, /data-font-theme-id/);
  assert.doesNotMatch(source, /function applyFontTheme/);
  assert.doesNotMatch(source, />Cor do texto</);
});

test('active visual set propagates to headers and panels on every workspace page', () => {
  const source = fs.readFileSync(APP_JS_PATH, 'utf8');
  const css = fs.readFileSync(APP_CSS_PATH, 'utf8');

  assert.match(source, /setProperty\('--surface', selectedTheme\.surface\)/);
  assert.match(source, /setProperty\('--text', selectedTheme\.text\)/);
  assert.match(source, /setProperty\('--text-on-accent', selectedTheme\.onAccent\)/);
  assert.match(css, /PMP Global Theme Bridge/);
  assert.match(css, /--workspace-panel-bg:/);
  assert.match(css, /\.workspace-page \.header-shell-fullwidth \{/);
  assert.match(css, /--workspace-header-ink: var\(--text\)/);
  assert.match(css, /body \.workspace-page \.pmp-dashboard \{/);
  assert.match(css, /--pmp-surface: var\(--surface\)/);
  assert.match(css, /\.growth-card,/);
  assert.match(css, /\.campaign-flow-panel,/);
  assert.match(css, /\.accounts-cockpit,/);
  assert.match(css, /\.media-vault-summary-strip,/);
  assert.match(css, /\.playlist-cockpit,/);
  assert.match(css, /\.plan-card,/);
  assert.match(css, /\.settings-hub-card,/);
});
