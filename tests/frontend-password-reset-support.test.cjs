const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const APP_JS = fs.readFileSync(path.join(ROOT, 'apps/api/src/frontend/public/app.js'), 'utf8');
const APP_CSS = fs.readFileSync(path.join(ROOT, 'apps/api/src/frontend/public/app.css'), 'utf8');
const UI_SHELL = fs.readFileSync(path.join(ROOT, 'apps/api/src/frontend/ui-shell.ts'), 'utf8');

test('login exposes password recovery request and confirmation flows', () => {
  assert.match(APP_JS, /\/auth\/password-reset\/request/);
  assert.match(APP_JS, /\/auth\/password-reset\/confirm/);
  assert.match(APP_JS, /Esqueci minha senha/);
  assert.match(APP_JS, /password-reset-confirm-form/);
  assert.match(UI_SHELL, /name="referrer" content="no-referrer"/);
});

test('public and authenticated support surfaces use traceable protocols', () => {
  assert.match(APP_JS, /\/support\/requests/);
  assert.match(APP_JS, /\/api\/service-requests/);
  assert.match(APP_JS, /id="atendimento"/);
  assert.match(APP_JS, /Solicitacoes e protocolos/);
  assert.match(APP_CSS, /\.merchant-protocol-result/);
  assert.match(APP_CSS, /\.settings-request-list/);
});
