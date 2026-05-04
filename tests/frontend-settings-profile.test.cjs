'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..');
const APP_JS = fs.readFileSync(path.join(ROOT, 'apps', 'api', 'src', 'frontend', 'public', 'app.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'apps', 'api', 'src', 'frontend', 'public', 'app.css'), 'utf8');

function extractFunctionSource(source, functionName) {
  const start = source.indexOf(`async function ${functionName}`);
  assert.notStrictEqual(start, -1, `Missing function ${functionName}`);
  const openBrace = source.indexOf('{', start);
  assert.notStrictEqual(openBrace, -1, `Missing function body for ${functionName}`);
  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Unclosed function body for ${functionName}`);
}

test('settings and profile pages use the new settings mark system', () => {
  const settingsPage = extractFunctionSource(APP_JS, 'renderSettingsPage');
  const profilePage = extractFunctionSource(APP_JS, 'renderProfilePage');

  assert.match(APP_JS, /function renderSettingsMark/);
  assert.match(settingsPage, /renderSettingsMark\('PMP', 'processing', 'settings-hero-mark'\)/);
  assert.match(settingsPage, /settings-essentials-grid/);
  assert.match(settingsPage, /settings-preference-grid/);
  assert.match(profilePage, /settings-profile-avatar-mark/);
  assert.match(profilePage, /settings-action-list/);
  assert.doesNotMatch(settingsPage, /renderNeonMediaIcon/);
  assert.doesNotMatch(profilePage, /renderNeonMediaIcon/);
});

test('settings and profile expose a real account deletion request flow', () => {
  const settingsPage = extractFunctionSource(APP_JS, 'renderSettingsPage');
  const profilePage = extractFunctionSource(APP_JS, 'renderProfilePage');

  assert.match(APP_JS, /sendAccountDeletionConfirmation: \(\) => apiRequest\('POST', '\/auth\/account-deletion\/challenge'\)/);
  assert.match(APP_JS, /requestAccountDeletion: \(confirmation = \{\}\) => apiRequest\('POST', '\/auth\/account-deletion\/request', confirmation\)/);
  assert.match(APP_JS, /function renderAccountDeletionPanel/);
  assert.match(APP_JS, /function bindAccountDeletionRequest/);
  assert.match(APP_JS, /function showAccountDeletionPasswordModal/);
  assert.match(APP_JS, /function showAccountDeletionEmailCodeModal/);
  assert.match(APP_JS, /currentPassword/);
  assert.match(APP_JS, /confirmationCode/);
  assert.match(APP_JS, /type: 'password'/);
  assert.match(APP_JS, /autocomplete: 'one-time-code'/);
  assert.match(APP_JS, /maxLength: 6/);
  assert.doesNotMatch(APP_JS, /window\.prompt/);
  assert.match(APP_JS, /24 horas/);
  assert.match(APP_JS, /30 dias/);
  assert.match(APP_JS, /Esta conta confirma a exclusao/);
  assert.match(settingsPage, /renderAccountDeletionPanel\(\)/);
  assert.match(profilePage, /renderAccountDeletionPanel\(\{ compact: true \}\)/);
});

test('settings CSS defines restrained marks, sections, and deletion timeline', () => {
  for (const selector of [
    '.settings-mark {',
    '.settings-hero-mark {',
    '.settings-profile-avatar-mark {',
    '.settings-hub-section {',
    '.settings-preference-grid {',
    '.settings-action-list {',
    '.settings-deletion-card {',
    '.settings-deletion-timeline {',
    '.app-modal-card.account-deletion-modal-card {',
    '.account-deletion-modal-brief {',
    '.account-deletion-modal-alert {',
  ]) {
    assert.ok(CSS.includes(selector), `Missing selector ${selector}`);
  }

  assert.match(CSS, /\.settings-hub-hero::before\s*\{[\s\S]*display: none;/);
  assert.match(CSS, /\.settings-deletion-card\s*\{[\s\S]*var\(--danger\)/);
});
