const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const cssPath = path.join(__dirname, '..', 'apps', 'api', 'src', 'frontend', 'public', 'app.css');
const css = fs.readFileSync(cssPath, 'utf8');

test('the complete login page uses the optimized universe artwork with a fixed readability overlay', () => {
  const selector = '.merchant-login[data-initial-section="acesso"] {';
  const start = css.indexOf(selector);
  assert.notEqual(start, -1);
  const rule = css.slice(start, css.indexOf('\n}', start) + 2);

  assert.match(rule, /UNI\.webp/);
  assert.match(rule, /linear-gradient/);
  assert.match(rule, /background-size:\s*cover,[^;]*cover/);
  assert.match(rule, /background-attachment:\s*fixed/);
});

test('the access section keeps a translucent overlay so the page artwork remains visible', () => {
  const selector = '.merchant-login[data-initial-section="acesso"] .merchant-access';
  const start = css.indexOf(selector);
  assert.notEqual(start, -1);
  const rule = css.slice(start, css.indexOf('\n}', start) + 2);

  assert.match(rule, /linear-gradient/);
  assert.doesNotMatch(rule, /UNI\.webp/);
});
