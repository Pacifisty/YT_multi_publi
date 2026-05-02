'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const APP_JS_PATH = path.join(__dirname, '..', 'apps', 'api', 'src', 'frontend', 'public', 'app.js');

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

test('public landing paid plans include Instagram in supported platforms', () => {
  const source = fs.readFileSync(APP_JS_PATH, 'utf8');
  const plans = extractConstant(source, 'ACCOUNT_PLAN_OPTIONS', 'ACCOUNT_PLAN_LABELS');
  const plansById = new Map(plans.map((plan) => [plan.id, plan]));

  for (const planId of ['PRO', 'PREMIUM']) {
    const plan = plansById.get(planId);

    assert.ok(plan, `Missing ${planId} plan`);
    assert.deepStrictEqual(plan.allowedPlatforms, ['youtube', 'tiktok', 'instagram']);
    assert.match(plan.platformSummary, /Instagram/);
    assert.match(plan.description, /Instagram/);
  }
});

test('public landing ignores unknown API plans instead of merging them into Free', () => {
  const source = fs.readFileSync(APP_JS_PATH, 'utf8');

  assert.match(source, /function parseKnownPlanCode\(value\) \{/);
  assert.match(source, /return ACCOUNT_PLAN_LABELS\[code\] \? code : null;/);
  assert.match(source, /function normalizePlanCode\(value\) \{\s*return parseKnownPlanCode\(value\) \?\? 'FREE';\s*\}/);
  assert.match(
    source,
    /\.map\(\(plan\) => \[parseKnownPlanCode\(plan\?\.code\), plan\]\)\s*\.filter\(\(\[code\]\) => code\)/
  );
  assert.doesNotMatch(source, /\.map\(\(plan\) => \[normalizePlanCode\(plan\?\.code\), plan\]\)/);
});
