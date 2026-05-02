'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const APP_JS_PATH = path.join(__dirname, '..', 'apps', 'api', 'src', 'frontend', 'public', 'app.js');
const PLAN_ORDER = ['FREE', 'BASIC', 'PRO', 'PREMIUM'];
const THEMES_PER_PLAN = 4;

function extractConstant(source, name, nextConstName) {
  const startToken = `const ${name} = `;
  const endToken = `\nconst ${nextConstName}`;
  const start = source.indexOf(startToken);
  const end = source.indexOf(endToken, start);

  assert.notStrictEqual(start, -1, `Missing ${name}`);
  assert.notStrictEqual(end, -1, `Missing ${nextConstName} after ${name}`);

  const literal = source.slice(start + startToken.length, end).trim().replace(/;$/, '');
  return Function(`"use strict"; return (${literal});`)();
}

function loadBackgroundConfig() {
  const source = fs.readFileSync(APP_JS_PATH, 'utf8');
  return {
    backgroundThemes: extractConstant(source, 'BACKGROUND_THEME_OPTIONS', 'FONT_THEME_OPTIONS'),
    planThemeMap: extractConstant(source, 'PLAN_BACKGROUND_THEME_MAP', 'PLAN_BACKGROUND_TIER_ORDER'),
  };
}

test('workspace background plans unlock exactly four own sets per plan', () => {
  const { planThemeMap } = loadBackgroundConfig();

  for (const planId of PLAN_ORDER) {
    assert.strictEqual(
      planThemeMap[planId].themeIds.length,
      THEMES_PER_PLAN,
      `${planId} should unlock exactly ${THEMES_PER_PLAN} own background sets`,
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

test('paid workspace background plans include cheaper plan sets cumulatively', () => {
  const { planThemeMap } = loadBackgroundConfig();
  const seen = [];

  PLAN_ORDER.forEach((planId, index) => {
    seen.push(...planThemeMap[planId].themeIds);
    assert.strictEqual(
      new Set(seen).size,
      (index + 1) * THEMES_PER_PLAN,
      `${planId} cumulative unlock count should include cheaper plan backgrounds`,
    );
  });
});

test('free workspace backgrounds are not only neutral white variations', () => {
  const { backgroundThemes, planThemeMap } = loadBackgroundConfig();
  const themesById = new Map(backgroundThemes.map((theme) => [theme.id, theme]));
  const freeThemes = planThemeMap.FREE.themeIds.map((themeId) => themesById.get(themeId));
  const freeTypes = new Set(freeThemes.map((theme) => theme.type));
  const freePrimaryColors = new Set(freeThemes.map((theme) => theme.primary.toLowerCase()));

  assert.ok(freeTypes.size >= 2, 'FREE should mix background families, not only one neutral style');
  assert.ok(freePrimaryColors.size >= 3, 'FREE should include varied accent colors');
});
