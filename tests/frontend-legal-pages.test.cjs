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

function extractFunctionSource(source, functionName) {
  const functionStart = source.indexOf(`function ${functionName}(`);
  assert.notStrictEqual(functionStart, -1, `missing function ${functionName}`);
  const signatureEnd = source.indexOf(')', functionStart);
  assert.notStrictEqual(signatureEnd, -1, `missing signature for ${functionName}`);
  const openBrace = source.indexOf('{', signatureEnd);
  assert.notStrictEqual(openBrace, -1, `missing body for ${functionName}`);
  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) {
      return source.slice(functionStart, index + 1);
    }
  }
  throw new Error(`unclosed function ${functionName}`);
}

test('public legal routes are served by the frontend shell and listed in the sitemap', () => {
  assert.match(UI_SHELL, /PUBLIC_INDEXABLE_PATHS = \['\/', '\/privacy', '\/terms', '\/data-deletion'\]/);
  assert.match(UI_SHELL, /normalizedPath === '\/privacy'/);
  assert.match(UI_SHELL, /normalizedPath === '\/terms'/);
  assert.match(UI_SHELL, /normalizedPath === '\/data-deletion'/);
  assert.match(UI_SHELL, /normalizeFrontendPath/);
  assert.match(UI_SHELL, /LEGAL_DOCUMENTS\[legalDocumentKey\]/);
  assert.match(LEGAL_DOCS, /title: 'Politica de Privacidade'/);
  assert.match(LEGAL_DOCS, /title: 'Termos de Servico'/);
  assert.match(LEGAL_DOCS, /title: 'Exclusao de Dados do Usuario'/);
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
    'PlataformMultiPublisher@gmail.com',
    'Alameda dos Mutuns',
    'Brazil',
    'Cloudflare',
    'Mercado Pago',
    'account deletion requests keep the account active for 24 hours',
    'within 30 days',
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
  assert.match(APP_JS, /href="\/privacy" data-link>Politica de Privacidade/);
  assert.match(APP_JS, /href="\/terms" data-link>Termos de Servico/);
  assert.match(APP_JS, /href="\/data-deletion" data-link>Exclusao de Dados do Usuario/);
  assert.doesNotMatch(APP_JS, /href="\/privacy" data-link>Privacy Policy/);
  assert.doesNotMatch(APP_JS, /href="\/terms" data-link>Terms of Service/);
  assert.doesNotMatch(APP_JS, /href="\/data-deletion" data-link>User Data Deletion/);
  assert.match(APP_JS, /href="\/privacy" data-link \$\{activePage === 'privacy' \? 'aria-current="page"' : ''\}>Privacidade/);
  assert.match(APP_JS, /href="\/terms" data-link \$\{activePage === 'terms' \? 'aria-current="page"' : ''\}>Termos/);
  assert.match(APP_JS, /href="\/data-deletion" data-link \$\{activePage === 'data-deletion' \? 'aria-current="page"' : ''\}>Exclusão de dados/);
  assert.match(CSS, /\.legal-document/);
  assert.match(CSS, /\.public-footer-links/);
});

test('SPA legal navigation reloads when legal documents were not bootstrapped', () => {
  const result = Function(`
    const LEGAL_DOCUMENT_PATHS = Object.freeze({
      privacy: '/privacy',
      terms: '/terms',
      'data-deletion': '/data-deletion',
    });
    const calls = [];
    const sessionStorage = {
      store: {},
      getItem(key) { return this.store[key] ?? null; },
      setItem(key, value) { this.store[key] = String(value); },
      removeItem(key) { delete this.store[key]; },
    };
    const window = {
      __PMP_LEGAL_DOCUMENTS__: {},
      location: {
        assign(path) { calls.push(path); },
      },
    };
    const root = { innerHTML: '' };
    function renderLegalPublicNav() { return '<nav></nav>'; }
    function renderPublicFooter() { return '<footer></footer>'; }
    function escapeAttribute(value) { return String(value ?? ''); }
    function escapeHtml(value) { return String(value ?? ''); }
    ${extractFunctionSource(APP_JS, 'getSharedLegalDocuments')}
    ${extractFunctionSource(APP_JS, 'getLegalDocument')}
    ${extractFunctionSource(APP_JS, 'getLegalReloadStorageKey')}
    ${extractFunctionSource(APP_JS, 'clearLegalReloadAttempt')}
    ${extractFunctionSource(APP_JS, 'reloadMissingLegalDocument')}
    ${extractFunctionSource(APP_JS, 'renderLegalDocumentPage')}
    renderLegalDocumentPage('privacy');
    return { calls, rootHtml: root.innerHTML, stored: sessionStorage.store };
  `)();

  assert.deepEqual(result.calls, ['/privacy']);
  assert.equal(result.rootHtml, '');
  assert.equal(result.stored['pmp-legal-document-reload:/privacy'], '1');
});

test('legal pages keep reviewer hierarchy ahead of conversion actions', () => {
  const legalNav = extractFunctionBody(APP_JS, 'function renderLegalPublicNav', 'function renderLegalShell');
  const legalShell = extractFunctionBody(APP_JS, 'function renderLegalShell', 'function renderLegalDocumentPage');

  assert.doesNotMatch(legalNav, /href="\/login\?mode=register"/);
  assert.doesNotMatch(legalNav, /Começar agora/);
  assert.match(legalShell, /href="\/" data-link>Ver página principal/);
  assert.match(legalShell, /href="#legal-contact">Entrar em contato/);
  assert.match(legalShell, /class="legal-content-shell"/);
  assert.match(legalShell, /class="legal-toc"/);
  assert.doesNotMatch(legalShell, /href="\/login\?mode=register"/);
  assert.doesNotMatch(legalShell, /Comecar agora/);
  assert.doesNotMatch(legalShell, /Começar agora/);
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
