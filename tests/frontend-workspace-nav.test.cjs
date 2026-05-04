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

test('workspace navigation keeps the settings tab fully visible in the header', () => {
  const shellRule = extractCssRule(CSS, '.header-shell-fullwidth {');
  const navRule = extractCssRule(CSS, '.header-shell-fullwidth .header-nav {');
  const linkRule = extractCssRule(CSS, '.header-shell-fullwidth .nav-link {');

  assert.match(shellRule, /minmax\(0, 1\.5fr\)/);
  assert.match(shellRule, /minmax\(430px, auto\)/);
  assert.match(navRule, /margin-left:\s*0/);
  assert.match(navRule, /overflow-x:\s*hidden/);
  assert.match(navRule, /scroll-behavior:\s*smooth/);
  assert.match(linkRule, /flex:\s*0 0 auto/);
  assert.match(linkRule, /min-width:\s*max-content/);
  assert.match(linkRule, /white-space:\s*nowrap/);

  assert.match(APP_JS, /function keepWorkspaceActiveNavVisible\(\)/);
  assert.match(APP_JS, /data-workspace-tab="\$\{tab\.id\}"/);
  assert.match(APP_JS, /aria-current="page"/);
  assert.match(APP_JS, /keepWorkspaceActiveNavVisible\(\);/);
  assert.match(APP_JS, /requestAnimationFrame\(\(\) => keepWorkspaceActiveNavVisible\(\)\)/);
});
