'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const I18N_JS = fs.readFileSync(path.join(ROOT, 'apps', 'api', 'src', 'frontend', 'public', 'i18n.js'), 'utf8');
const APP_JS = fs.readFileSync(path.join(ROOT, 'apps', 'api', 'src', 'frontend', 'public', 'app.js'), 'utf8');
const UI_SHELL = fs.readFileSync(path.join(ROOT, 'apps', 'api', 'src', 'frontend', 'ui-shell.ts'), 'utf8');

const CP1252_CODEPOINT_TO_BYTE = new Map([
  [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84], [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87],
  [0x02c6, 0x88], [0x2030, 0x89], [0x0160, 0x8a], [0x2039, 0x8b], [0x0152, 0x8c], [0x017d, 0x8e],
  [0x2018, 0x91], [0x2019, 0x92], [0x201c, 0x93], [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
  [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b], [0x0153, 0x9c], [0x017e, 0x9e], [0x0178, 0x9f],
]);

function decodeCp1252Utf8Mojibake(value) {
  if (!/[\u00c3\u00c2\u00e2\u00f0]/.test(value)) return value;
  const bytes = [];
  for (const char of value) {
    const codePoint = char.codePointAt(0);
    if (codePoint <= 0xff) {
      bytes.push(codePoint);
      continue;
    }
    const byte = CP1252_CODEPOINT_TO_BYTE.get(codePoint);
    if (byte === undefined) return value;
    bytes.push(byte);
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bytes));
  } catch {
    return value;
  }
}

function repairMojibake(value) {
  let current = String(value ?? '');
  for (let index = 0; index < 5; index += 1) {
    const next = decodeCp1252Utf8Mojibake(current);
    if (next === current) break;
    current = next;
  }
  return current;
}

function findRepairableMojibake(source, filename) {
  return source
    .split(/\r?\n/)
    .map((line, index) => ({ filename, lineNumber: index + 1, before: line, after: repairMojibake(line) }))
    .filter((entry) => entry.before !== entry.after);
}

function loadI18n() {
  const context = {
    TextDecoder,
    Uint8Array,
    window: {},
    localStorage: {
      getItem: () => '',
      setItem: () => {},
    },
    document: {
      cookie: '',
      documentElement: { lang: 'pt-BR' },
      body: { dataset: { initialLocale: 'pt-BR' } },
      getElementById: () => null,
    },
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
  };

  vm.runInNewContext(I18N_JS, context, { filename: 'i18n.js' });
  return context.window.PMP_I18N;
}

test('i18n repairs UTF-8/CP1252 mojibake before translating text', () => {
  const i18n = loadI18n();
  const doubleEncoded = 'Sua biblioteca de v\u00c3\u0192\u00c2\u00addeos e organiza\u00c3\u0192\u00c2\u00a7\u00c3\u0192\u00c2\u00a3o de playlists em um s\u00c3\u0192\u00c2\u00b3 lugar.';

  assert.equal(
    i18n.t('pt-BR', doubleEncoded),
    'Sua biblioteca de v\u00eddeos e organiza\u00e7\u00e3o de playlists em um s\u00f3 lugar.'
  );

  assert.equal(
    i18n.t('en', doubleEncoded),
    'Your video library and playlist organization in one place.'
  );
});

test('i18n repairs common corrupted punctuation and emoji sequences', () => {
  const i18n = loadI18n();

  assert.equal(i18n.t('pt-BR', '\u00c3\u00a2\u00e2\u201a\u00ac\u00e2\u20ac\u009d'), '\u2014');
  assert.equal(i18n.t('pt-BR', '\u00c3\u00a2\u00c5\u201c\u00e2\u20ac\u0153'), '\u2713');
  assert.equal(i18n.t('pt-BR', '\u00c3\u00b0\u00c5\u00b8\u00c5\u00a1\u00e2\u201a\u00ac'), '\ud83d\ude80');
});

test('frontend source files do not contain repairable mojibake', () => {
  const findings = [
    ...findRepairableMojibake(APP_JS, 'app.js'),
    ...findRepairableMojibake(UI_SHELL, 'ui-shell.ts'),
  ];

  assert.deepEqual(
    findings.map((entry) => `${entry.filename}:${entry.lineNumber}: ${entry.before.trim()} -> ${entry.after.trim()}`),
    []
  );
});
