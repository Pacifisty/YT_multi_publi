const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..');
const APP_JS = fs.readFileSync(path.join(ROOT, 'apps', 'api', 'src', 'frontend', 'public', 'app.js'), 'utf8');
const UI_SHELL = fs.readFileSync(path.join(ROOT, 'apps', 'api', 'src', 'frontend', 'ui-shell.ts'), 'utf8');
const LEGAL_DOCS = fs.readFileSync(path.join(ROOT, 'apps', 'api', 'src', 'frontend', 'legal-documents.ts'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'apps', 'api', 'src', 'frontend', 'public', 'app.css'), 'utf8');
const REVIEW_NOTES = fs.readFileSync(path.join(ROOT, 'docs', 'PLATFORM_APP_REVIEW_LEGAL_NOTES.md'), 'utf8');

function extractFunctionBody(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  assert.notStrictEqual(start, -1, `missing ${startNeedle}`);
  const end = source.indexOf(endNeedle, start);
  assert.notStrictEqual(end, -1, `missing ${endNeedle}`);
  return source.slice(start, end);
}

test('public legal routes are served by the frontend shell and listed in the sitemap', () => {
  assert.match(UI_SHELL, /PUBLIC_INDEXABLE_PATHS = \['\/', '\/privacy', '\/terms', '\/data-deletion'\]/);
  assert.match(UI_SHELL, /normalizedPath === '\/privacy'/);
  assert.match(UI_SHELL, /normalizedPath === '\/terms'/);
  assert.match(UI_SHELL, /normalizedPath === '\/data-deletion'/);
  assert.match(UI_SHELL, /normalizeFrontendPath/);
  assert.match(UI_SHELL, /LEGAL_DOCUMENTS\[legalDocumentKey\]/);
  assert.match(LEGAL_DOCS, /title: 'Privacy Policy'/);
  assert.match(LEGAL_DOCS, /title: 'Terms of Service'/);
  assert.match(LEGAL_DOCS, /title: 'User Data Deletion'/);
});

test('privacy policy covers TikTok, YouTube, Instagram, data deletion, and reviewer-required topics', () => {
  [
    'TikTok data we collect through TikTok APIs',
    'What we do not do with TikTok data',
    'Data retention',
    'Data security',
    'How users can disconnect TikTok or revoke access',
    'How users can request access, correction, deletion, or export of data',
    "Children's privacy / age restrictions",
    'International data transfers, if applicable',
    'qualified legal professional',
  ].forEach((needle) => assert.ok(LEGAL_DOCS.includes(needle), `missing privacy section: ${needle}`));

  [
    'user.info.basic',
    'video.publish',
    'video.upload',
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.force-ssl',
    'instagram_business_basic',
    'instagram_business_content_publish',
    'Google API Services User Data Policy, including the Limited Use requirements',
  ].forEach((needle) => assert.ok(LEGAL_DOCS.includes(needle), `missing platform scope/disclosure: ${needle}`));

  [
    'Lucas Domingues',
    'Domingues_eu@Hotmail.com',
    'Alameda dos Mutuns',
    'Brazil',
    'Cloudflare',
    'Mercado Pago',
    '90 days after a deletion request',
    'at least 18 years old',
  ].forEach((needle) => assert.ok(LEGAL_DOCS.includes(needle) || UI_SHELL.includes(needle), `missing filled legal value: ${needle}`));

  assert.doesNotMatch(LEGAL_DOCS, /domingues_eu \[at\] hotmail \[dot\] com/i);
});

test('terms of service covers platform authorization and third-party publishing responsibilities', () => {
  [
    'Acceptance of terms',
    'TikTok integration',
    'User authorization and permissions',
    'Prohibited uses',
    'Content ownership and licenses',
    'TikTok content and third-party services',
    'Limitation of liability',
    'Governing law',
  ].forEach((needle) => assert.ok(LEGAL_DOCS.includes(needle), `missing terms section: ${needle}`));

  assert.match(LEGAL_DOCS, /not owned by, endorsed by, sponsored by, or officially operated by TikTok, YouTube, Google, Instagram, Meta/);
});

test('legal links are visible from public website and styled', () => {
  assert.match(APP_JS, /href="\/privacy" data-link>Privacy Policy/);
  assert.match(APP_JS, /href="\/terms" data-link>Terms of Service/);
  assert.match(APP_JS, /href="\/data-deletion" data-link>User Data Deletion/);
  assert.match(APP_JS, /href="\/privacy" data-link>Privacy/);
  assert.match(APP_JS, /href="\/terms" data-link>Terms/);
  assert.match(APP_JS, /href="\/data-deletion" data-link>Data Deletion/);
  assert.match(CSS, /\.legal-document/);
  assert.match(CSS, /\.public-footer-links/);
});

test('legal pages keep reviewer hierarchy ahead of conversion actions', () => {
  const legalShell = extractFunctionBody(APP_JS, 'function renderLegalShell', 'function renderLegalDocumentPage');

  assert.match(legalShell, /href="\/" data-link>Ver pagina principal/);
  assert.match(legalShell, /href="#legal-contact">Entrar em contato/);
  assert.match(legalShell, /class="legal-content-shell"/);
  assert.match(legalShell, /class="legal-toc"/);
  assert.doesNotMatch(legalShell, /href="\/login\?mode=register"/);
  assert.doesNotMatch(legalShell, /Comecar agora/);
  assert.doesNotMatch(legalShell, /Ver demonstracao/);
  assert.doesNotMatch(legalShell, /legal-final-cta/);
});

test('review note and checklist are available for TikTok resubmission', () => {
  assert.match(REVIEW_NOTES, /TikTok Reviewer Note/);
  assert.match(REVIEW_NOTES, /Privacy Policy: https:\/\/www\.plataformmultipublisher\.com\/privacy/);
  assert.match(REVIEW_NOTES, /Terms of Service: https:\/\/www\.plataformmultipublisher\.com\/terms/);
  assert.match(REVIEW_NOTES, /user\.info\.basic/);
  assert.match(REVIEW_NOTES, /video\.publish/);
  assert.match(REVIEW_NOTES, /URL ownership verification is completed/);
});

test('published legal documents do not expose placeholder markers', () => {
  assert.doesNotMatch(APP_JS, /\[INSERT [^\]]+\]/);
  assert.doesNotMatch(UI_SHELL, /\[INSERT [^\]]+\]/);
  assert.doesNotMatch(LEGAL_DOCS, /\[INSERT [^\]]+\]/);
});
