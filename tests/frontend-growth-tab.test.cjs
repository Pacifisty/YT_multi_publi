'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..');
const APP_JS = fs.readFileSync(path.join(ROOT, 'apps', 'api', 'src', 'frontend', 'public', 'app.js'), 'utf8');
const APP_CSS = fs.readFileSync(path.join(ROOT, 'apps', 'api', 'src', 'frontend', 'public', 'app.css'), 'utf8');

function extractFunctionSource(source, functionName) {
  const functionStart = source.indexOf(`function ${functionName}`);
  assert.notStrictEqual(functionStart, -1, `Missing function ${functionName}`);
  const start = source.slice(Math.max(0, functionStart - 6), functionStart) === 'async '
    ? functionStart - 6
    : functionStart;
  const signatureEnd = source.indexOf(')', start);
  assert.notStrictEqual(signatureEnd, -1, `Missing function signature for ${functionName}`);
  const openBrace = source.indexOf('{', signatureEnd);
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

function extractGrowthWorkspaceDataSources() {
  return [
    'clampGrowthPercent',
    'normalizeGrowthPlatformKey',
    'formatGrowthShortDate',
    'formatGrowthShortTime',
    'getGrowthCampaignTargets',
    'growthCampaignStatusLabel',
    'getGrowthPrimaryPlatform',
    'buildGrowthPosts',
    'buildGrowthCampaignRows',
    'buildGrowthContentRanking',
    'buildGrowthRecommendations',
    'buildGrowthReports',
    'buildGrowthWorkspaceData',
  ].map((functionName) => extractFunctionSource(APP_JS, functionName)).join('\n');
}

function buildGrowthWorkspaceHarness(extraSources = '') {
  return `
    const GROWTH_PLATFORM_KEYS = ['youtube', 'instagram', 'tiktok'];
    const state = { growthConnectedAccounts: [], growthMetricFilters: { date: 'all', platform: 'all' }, growthWorkspaceData: null };
    function dashboardNumber(value) {
      const parsed = Number(value ?? 0);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    function formatNumber(value) {
      return String(dashboardNumber(value));
    }
    function formatPercent(value) {
      return String(Math.round(dashboardNumber(value))) + '%';
    }
    function formatDate(value) {
      return String(value ?? '');
    }
    function getActiveLocale() {
      return 'en-US';
    }
    function dashboardPlatformLabel(platform) {
      switch (String(platform ?? '').toLowerCase()) {
        case 'youtube':
          return 'YouTube';
        case 'instagram':
          return 'Instagram';
        case 'tiktok':
          return 'TikTok';
        default:
          return platform ? String(platform) : 'Unknown';
      }
    }
    ${extractGrowthWorkspaceDataSources()}
    ${extraSources}
  `;
}

test('workspace shell exposes Growth as a first-class panel option', () => {
  assert.match(APP_JS, /pathname\.startsWith\('\/workspace\/growth'\)\) return 'growth';/);
  assert.match(APP_JS, /\{ id: 'growth', label: 'Growth', href: '\/workspace\/growth' \}/);
  assert.match(APP_JS, /async function renderGrowthPage\(pathname = window\.location\.pathname\)/);
  assert.match(APP_JS, /if \(path === '\/workspace\/growth' \|\| path\.startsWith\('\/workspace\/growth\/'\)\) \{/);
  assert.match(APP_JS, /await renderGrowthPage\(path\)/);
});

test('Growth module exposes the final decision-focused structure', () => {
  for (const route of [
    '/workspace/growth',
    '/workspace/growth/conteudo',
    '/workspace/growth/metricas',
    '/workspace/growth/campanhas',
    '/workspace/growth/relatorios',
  ]) {
    assert.match(APP_JS, new RegExp(route.replaceAll('/', '\\/')));
  }

  assert.match(APP_JS, /\{ id: 'cockpit', label: 'Cockpit', href: '\/workspace\/growth'/);
  assert.match(APP_JS, /\{ id: 'conteudo', label: 'Conteudo', href: '\/workspace\/growth\/conteudo'/);
  assert.match(APP_JS, /const GROWTH_LEGACY_SECTION_MAP = Object\.freeze\(\{/);
  assert.match(APP_JS, /calendario: 'conteudo'/);
  assert.match(APP_JS, /ideias: 'conteudo'/);
  assert.match(APP_JS, /roteiro: 'conteudo'/);
  assert.match(APP_JS, /biblioteca: 'conteudo'/);
  assert.match(APP_JS, /function renderGrowthOverview\(growthData = buildGrowthWorkspaceData\(\)\)/);
  assert.match(APP_JS, /function buildGrowthDecisionActions\(growthData = buildGrowthWorkspaceData\(\)\)/);
  assert.match(APP_JS, /function renderGrowthContentHub\(growthData = buildGrowthWorkspaceData\(\)\)/);
  assert.match(APP_JS, /function renderGrowthScriptComposer\(\)/);
  assert.match(APP_JS, /function renderGrowthMetrics\(growthData = buildGrowthWorkspaceData\(\)\)/);
  assert.match(APP_JS, /function renderGrowthCampaigns\(growthData = buildGrowthWorkspaceData\(\)\)/);
  assert.match(APP_JS, /function renderGrowthReports\(growthData = buildGrowthWorkspaceData\(\)\)/);
  assert.match(APP_JS, /function renderGrowthSettingsPanel\(options = \{\}\)/);
  assert.match(APP_JS, /function bindGrowthInteractions\(\)/);
  assert.match(APP_JS, /data-growth-generate-ideas/);
  assert.match(APP_JS, /data-growth-script-form/);
  assert.match(APP_JS, /data-growth-generate-report/);
  assert.doesNotMatch(APP_JS, /href: '\/workspace\/growth\/calendario'/);
  assert.doesNotMatch(APP_JS, /href: '\/workspace\/growth\/ideias'/);
  assert.doesNotMatch(APP_JS, /href: '\/workspace\/growth\/roteiro'/);
  assert.doesNotMatch(APP_JS, /href: '\/workspace\/growth\/biblioteca'/);
});

test('Growth content actions route to real PMP flows instead of fake local success', () => {
  assert.match(APP_JS, /data-growth-campaign-from-idea/);
  assert.match(APP_JS, /navigate\(buildUrl\('\/workspace\/campanhas\/nova', \{ idea \}\)\);/);
  assert.match(APP_JS, /navigate\(buildUrl\('\/workspace\/growth\/conteudo', \{ idea \}\)\);/);
  assert.match(APP_JS, /href: '\/workspace\/accounts'/);
  assert.match(APP_JS, /Fluxo em tres passos: gere uma ideia, transforme em roteiro e so entao abra campanha real no PMP\./);
  assert.match(APP_JS, /<a class="button button-secondary" data-link href="\/workspace\/growth\/campanhas">Ver campanhas<\/a>/);
  assert.match(APP_JS, /<button class="button button-primary" type="button" data-growth-script-from-idea="\$\{escapeAttribute\(idea\.title\)\}">Gerar roteiro<\/button>/);
  assert.match(APP_JS, /<button class="button button-secondary" type="button" data-growth-campaign-from-idea="\$\{escapeAttribute\(idea\.title\)\}">Criar campanha<\/button>/);
  assert.match(APP_CSS, /\.growth-module \.button \{/);
  assert.match(APP_CSS, /\.growth-page-title-actions > \.button \{/);
  assert.match(APP_CSS, /\.growth-filter-card \.button \{/);
  assert.match(APP_CSS, /\.growth-list-plain \.button \{/);
  assert.match(APP_JS, /function renderGrowthEmptyState\(title, description, action = '', actionHref = ''\)/);
  assert.doesNotMatch(APP_JS, /data-growth-calendar-from-idea/);
  assert.doesNotMatch(APP_JS, /data-growth-connect-platform/);
});

test('Growth script generator uses backend brief and renders the brief used', async () => {
  assert.match(APP_JS, /generateGrowthScript: \(payload\) => apiRequest\('POST', '\/api\/growth\/script\/generate', payload\)/);
  assert.match(APP_JS, /Gerar brief e roteiro/);
  assert.match(APP_JS, /Brief usado para gerar o roteiro/);
  assert.match(APP_JS, /Gerando brief/);
  assert.doesNotMatch(APP_JS, /Pesquisar e gerar roteiro/);
  assert.doesNotMatch(APP_JS, /Pesquisando tema/);
  assert.match(APP_CSS, /\.growth-script-brief \{/);
  assert.match(APP_CSS, /\.growth-script-timeline-row \{/);

  const sources = [
    extractFunctionSource(APP_JS, 'renderGrowthScriptList'),
    extractFunctionSource(APP_JS, 'renderGrowthScriptTimeline'),
    extractFunctionSource(APP_JS, 'renderGrowthScriptResearchResult'),
    extractFunctionSource(APP_JS, 'renderGrowthScriptResult'),
    extractFunctionSource(APP_JS, 'bindGrowthInteractions'),
  ].join('\n');
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const result = await AsyncFunction(`
    const calls = [];
    function escapeHtml(value) { return String(value ?? ''); }
    function renderNeonMediaIcon() { return '<i></i>'; }
    function parseCurrentQuery() { return new Map(); }
    function setGrowthButtonFeedback(button, label) { button.feedback = label; }
    function buildUrl(path) { return path; }
    function navigate(path) { calls.push({ navigate: path }); }
    class HTMLInputElement {}
    class FormData {
      constructor(form) { this.form = form; }
      entries() { return Object.entries(this.form.values); }
    }
    const api = {
      generateGrowthScript: async (payload) => {
        calls.push(payload);
        return {
          ok: true,
          body: {
            brief: {
              summary: 'Brief sobre retencao usando sinais reais.',
              relatedTerms: ['retencao', 'gancho'],
              commonQuestions: ['Como melhorar?'],
              risks: ['Nao prometer views.'],
              currentAngles: ['Checklist operacional.'],
            },
            signals: {
              bestPlatform: 'TikTok',
              bestPlatformReason: '90% de sucesso recente.',
              activeChannels: 2,
              failedTargets: 1,
            },
            script: {
              hooks: ['Gancho 1', 'Gancho 2', 'Gancho 3'],
              promise: 'Promessa clara.',
              timeline: [{ time: '0-3s', speech: 'Abra forte.', onScreen: 'Gancho' }],
              cta: 'Salvar.',
              caption: 'Legenda.',
              hashtags: ['#retencao'],
              platformAdaptation: ['Corte rapido.'],
            },
          },
        };
      },
    };
    const submitButton = { textContent: 'Gerar brief e roteiro', disabled: false, feedback: '' };
    const scriptResult = {
      innerHTML: '',
      offsetWidth: 1,
      classList: { remove() {}, add(value) { this.value = value; } },
    };
    const scriptForm = {
      values: { topic: 'Retencao em videos curtos', platform: 'TikTok', duration: '30 segundos', tone: 'Direto', goal: 'retencao' },
      listeners: {},
      querySelector(selector) {
        if (selector === '[data-growth-script-topic]') return { value: '' };
        if (selector === 'button[type="submit"]') return submitButton;
        return null;
      },
      addEventListener(type, handler) { this.listeners[type] = handler; },
    };
    const rootEl = {
      __growthDelegatedBound: false,
      querySelector(selector) {
        if (selector === '[data-growth-script-form]') return scriptForm;
        if (selector === '[data-growth-script-result]') return scriptResult;
        return null;
      },
      querySelectorAll() { return []; },
      addEventListener() {},
      contains() { return true; },
    };
    const document = { querySelector: (selector) => selector === '.growth-module' ? rootEl : null };
    ${sources}
    bindGrowthInteractions();
    await scriptForm.listeners.submit({ preventDefault() {} });
    return { calls, html: scriptResult.innerHTML, button: submitButton };
  `)();

  assert.equal(result.calls[0].topic, 'Retencao em videos curtos');
  assert.match(result.html, /Brief sobre retencao usando sinais reais/);
  assert.match(result.html, /Gancho 1/);
  assert.equal(result.button.disabled, false);
  assert.equal(result.button.feedback, 'Brief + roteiro gerados');
});

test('Growth visual hierarchy keeps decision labels readable and metrics operational', () => {
  assert.match(APP_JS, /<div class="growth-list growth-decision-list">/);
  assert.match(APP_JS, /<article class="growth-decision-card">/);
  assert.match(APP_JS, /<div class="growth-decision-card-top">/);
  assert.match(APP_JS, /class="growth-decision-action" data-link href="\$\{escapeAttribute\(action\.href\)\}"/);
  assert.match(APP_JS, /<span class="growth-list-marker"><\/span>/);
  assert.match(APP_CSS, /\.growth-list-marker \{/);
  assert.match(APP_CSS, /\.growth-decision-list \.growth-decision-card \{/);
  assert.match(APP_CSS, /\.growth-decision-action \{/);
  assert.match(APP_CSS, /border-radius: 999px;/);
  assert.match(APP_CSS, /\.growth-decision-list \.growth-eyebrow \{/);
  assert.doesNotMatch(APP_CSS, /\.growth-list article span \{/);
  assert.doesNotMatch(APP_JS, /<a class="button button-secondary" data-link href="\$\{escapeAttribute\(action\.href\)\}">\$\{escapeHtml\(action\.action\)\}<\/a>/);
  assert.match(APP_JS, /Ranking de sinais operacionais/);
  assert.match(APP_JS, /\['Conteudo', 'Plataforma', 'Data', 'Sinal', 'Taxa de sucesso', 'Publicados', 'Status'\]/);
  assert.match(APP_JS, /Pulso operacional do workspace/);
  assert.match(APP_JS, /Sem views sincronizadas; exibindo campanhas, destinos, publicados, fila e falhas\./);
  assert.match(APP_JS, /renderGrowthLineChart\(growthData\.monthlyReach, growthData\.trendAriaLabel\)/);
  assert.doesNotMatch(APP_JS, /aria-label="Alcance nos ultimos 30 dias"/);
  assert.doesNotMatch(APP_JS, /\['Conteudo', 'Plataforma', 'Data', 'Alcance', 'Retencao', 'Comentarios', 'Status'\]/);
});

test('Growth generated reports appear in the manual report area and clear the empty state', () => {
  assert.match(APP_JS, /data-growth-manual-reports-grid/);
  assert.match(APP_JS, /data-growth-manual-report-empty/);
  assert.match(APP_JS, /function addGrowthGeneratedReport\(rootEl, report\)/);

  const result = Function(`
    function renderGrowthReportCard(report) {
      return '<article class="growth-card"><h3>' + report.title + '</h3><p>' + report.summary + '</p></article>';
    }
    ${extractFunctionSource(APP_JS, 'addGrowthGeneratedReport')}
    const manualGrid = {
      innerHTML: '',
      firstElementChild: null,
      insertAdjacentHTML(position, html) {
        this.innerHTML = html + this.innerHTML;
        this.firstElementChild = {
          classList: {
            added: [],
            add(value) { this.added.push(value); },
          },
        };
      },
    };
    const emptyState = {
      removed: false,
      remove() { this.removed = true; },
    };
    const rootEl = {
      querySelector(selector) {
        if (selector === '[data-growth-manual-reports-grid]') return manualGrid;
        if (selector === '[data-growth-manual-report-empty]') return emptyState;
        if (selector === '[data-growth-reports-grid]') return null;
        return null;
      },
    };
    const added = addGrowthGeneratedReport(rootEl, { title: 'Relatorio manual', summary: 'Resumo criado agora' });
    return {
      added,
      html: manualGrid.innerHTML,
      isNew: manualGrid.firstElementChild.classList.added.includes('is-new'),
      emptyRemoved: emptyState.removed,
    };
  `)();

  assert.equal(result.added, true);
  assert.match(result.html, /Relatorio manual/);
  assert.equal(result.isNew, true);
  assert.equal(result.emptyRemoved, true);
});

test('Growth dashboards load live PMP workspace data instead of static metrics', () => {
  assert.match(APP_JS, /async function loadGrowthWorkspaceData\(sectionId = 'cockpit'\)/);
  assert.match(APP_JS, /api\.dashboard\(\)/);
  assert.match(APP_JS, /api\.campaigns\(\{ limit: 50, offset: 0 \}\)/);
  assert.match(APP_JS, /api\.accounts\(\)/);
  assert.match(APP_JS, /api\.accountChannels\(account\.id\)/);
  assert.match(APP_JS, /GROWTH_CHANNEL_HYDRATED_SECTIONS\.has\(sectionId\)/);
  assert.match(APP_JS, /channelDataPromise/);
  assert.doesNotMatch(APP_JS, /await Promise\.all\(accounts\.map\(\(account\) => \(\s*api\.accountChannels/);
  assert.match(APP_JS, /buildGrowthWorkspaceData\(\{/);
  assert.match(APP_JS, /renderGrowthBody\(sectionId, growthData\)/);
  assert.doesNotMatch(APP_JS, /GROWTH_DATA/);
  assert.doesNotMatch(APP_JS, /mockad/i);
});

test('Growth provider normalization keeps unknown platforms out of YouTube metrics', () => {
  const normalizeGrowthPlatformKey = Function(`
    ${extractFunctionSource(APP_JS, 'normalizeGrowthPlatformKey')}
    return normalizeGrowthPlatformKey;
  `)();

  assert.equal(normalizeGrowthPlatformKey('youtube'), 'youtube');
  assert.equal(normalizeGrowthPlatformKey('google'), 'youtube');
  assert.equal(normalizeGrowthPlatformKey('instagram'), 'instagram');
  assert.equal(normalizeGrowthPlatformKey('tiktok'), 'tiktok');
  assert.equal(normalizeGrowthPlatformKey('linkedin'), null);
  assert.equal(normalizeGrowthPlatformKey(''), null);
  assert.equal(normalizeGrowthPlatformKey(undefined), null);
});

test('Growth workspace data maps live dashboard, campaign, account, and channel payloads', () => {
  const result = Function(`
    ${buildGrowthWorkspaceHarness()}
    const mapped = buildGrowthWorkspaceData({
      stats: {
        campaigns: { total: 2 },
        targets: { total: 3, byStatus: { publicado: 2, erro: 1 }, successRate: 66 },
        jobs: { byStatus: { queued: 1, processing: 2 } },
        quota: { projectedPercent: 81 },
        channels: [
          { channelLabel: 'Canal Principal', totalViews: 1234, topVideoTitle: 'Video top', topVideoViews: 900, successRate: 75, published: 2 },
        ],
        platformStats: [{ platform: 'youtube', successRate: 88 }],
        destinationStats: [{ destinationLabel: 'Canal A', platform: 'youtube', successRate: 90 }],
      },
      campaigns: [
        {
          id: 'cmp_1',
          title: 'Campanha real',
          status: 'completed',
          createdAt: '2026-05-01T10:00:00.000Z',
          targets: [
            { platform: 'tiktok', status: 'publicado', publishAt: '2026-05-02T11:00:00.000Z' },
            { platform: 'instagram', status: 'erro' },
          ],
        },
      ],
      accounts: [
        { id: 'acct_google', provider: 'google', status: 'connected' },
        { id: 'acct_unknown', provider: 'linkedin', status: 'connected' },
        { id: 'acct_disconnected', provider: 'youtube', status: 'disconnected' },
      ],
      accountChannels: [
        { id: 'ch_1', connectedAccountId: 'acct_google', isActive: true },
        { id: 'ch_2', connectedAccountId: 'acct_google', isActive: false },
        { id: 'ch_disconnected', connectedAccountId: 'acct_disconnected', isActive: true },
      ],
    });
    const unknownOnly = buildGrowthWorkspaceData({
      stats: { platformStats: [{ platform: 'linkedin', successRate: 77 }] },
      accounts: [{ id: 'acct_unknown', provider: 'linkedin', status: 'connected' }],
    });
    return { mapped, unknownOnly };
  `)();

  assert.equal(result.mapped.metrics.find((metric) => metric.label === 'Campanhas reais').value, '2');
  assert.equal(result.mapped.metrics.find((metric) => metric.label === 'Canais ativos').value, '1');
  assert.equal(result.mapped.campaigns[0].platform, 'TikTok');
  assert.equal(result.mapped.contentRanking[0].title, 'Video top');
  assert.equal(result.mapped.trendTitle, 'Alcance observado por canal');
  assert.equal(result.mapped.trendAriaLabel, 'Alcance observado por canal');
  assert.equal(result.unknownOnly.trendTitle, 'Pulso operacional do workspace');
  assert.match(result.unknownOnly.trendDescription, /Sem views sincronizadas/);
  assert.equal(result.mapped.platformGrowth.find((entry) => entry.label === 'YouTube').value, 88);
  assert.deepEqual(result.unknownOnly.platformGrowth.map((entry) => entry.value), [0, 0, 0]);
});

test('Growth metrics filters recalculate dashboard cards and ranking from live data', () => {
  const result = Function(`
    ${buildGrowthWorkspaceHarness(`
      ${extractFunctionSource(APP_JS, 'getGrowthEventDate')}
      ${extractFunctionSource(APP_JS, 'getGrowthCampaignDate')}
      ${extractFunctionSource(APP_JS, 'isGrowthDateInFilter')}
      ${extractFunctionSource(APP_JS, 'getGrowthTargetsForFilters')}
      ${extractFunctionSource(APP_JS, 'buildGrowthStatsFromFilteredCampaigns')}
      ${extractFunctionSource(APP_JS, 'getGrowthFilteredMetricsData')}
    `)}
    const base = buildGrowthWorkspaceData({
      campaigns: [
        {
          id: 'cmp_youtube',
          title: 'Campanha YouTube',
          updatedAt: new Date().toISOString(),
          targets: [{ platform: 'youtube', status: 'publicado' }],
        },
        {
          id: 'cmp_instagram',
          title: 'Campanha Instagram',
          updatedAt: new Date().toISOString(),
          targets: [{ platform: 'instagram', status: 'erro' }],
        },
      ],
      accounts: [{ id: 'acct_1', provider: 'instagram', status: 'connected' }],
      channelSync: { requested: 0, failed: 0, pending: false },
    });
    const filtered = getGrowthFilteredMetricsData(base, { date: 'all', platform: 'instagram' });
    return {
      campaignMetric: filtered.metrics.find((metric) => metric.label === 'Campanhas reais').value,
      publishedMetric: filtered.metrics.find((metric) => metric.label === 'Destinos publicados').value,
      failureMetric: filtered.metrics.find((metric) => metric.label === 'Falhas').value,
      rankingTitles: filtered.contentRanking.map((row) => row.title),
      platformValues: filtered.platformGrowth,
    };
  `)();

  assert.equal(result.campaignMetric, '1');
  assert.equal(result.publishedMetric, '0');
  assert.equal(result.failureMetric, '1');
  assert.deepEqual(result.rankingTitles, ['Campanha Instagram']);
  assert.equal(result.platformValues.find((entry) => entry.label === 'Instagram').value, 0);
});

test('Growth channel sync failures are shown as unavailable instead of zero active channels', () => {
  const result = Function(`
    ${buildGrowthWorkspaceHarness()}
    const mapped = buildGrowthWorkspaceData({
      accounts: [{ id: 'acct_1', provider: 'youtube', status: 'connected' }],
      accountChannels: [],
      channelSync: { requested: 1, failed: 1, pending: false },
    });
    const channelMetric = mapped.metrics.find((metric) => metric.label === 'Canais ativos');
    return { channelMetric, accountReport: mapped.reports.find((report) => report.title === 'Saude das contas') };
  `)();

  assert.equal(result.channelMetric.value, 'Indisponivel');
  assert.match(result.channelMetric.change, /sem canais agora/);
  assert.match(result.accountReport.summary, /nao retornou/);
});

test('Growth page data resolves before slow account channel requests finish', async () => {
  const result = await Function(`
    return (async () => {
      ${buildGrowthWorkspaceHarness(`
        const GROWTH_CHANNEL_HYDRATED_SECTIONS = new Set(['cockpit', 'metricas', 'relatorios']);
        const GROWTH_CHANNEL_LOAD_CONCURRENCY = 2;
        const GROWTH_CHANNEL_LOAD_TIMEOUT_MS = 5;
        const GROWTH_CHANNEL_TIMEOUT_RESULT = Object.freeze({ ok: false, timedOut: true });
        ${extractFunctionSource(APP_JS, 'withGrowthTimeout')}
        ${extractFunctionSource(APP_JS, 'loadGrowthAccountChannels')}
        ${extractFunctionSource(APP_JS, 'loadGrowthWorkspaceData')}
      `)}
      let channelRequests = 0;
      const api = {
        dashboard: async () => ({ ok: true, body: { campaigns: { total: 1 } } }),
        campaigns: async () => ({ ok: true, body: { campaigns: [] } }),
        accounts: async () => ({ ok: true, body: { accounts: [{ id: 'acct_1', provider: 'youtube', status: 'connected' }] } }),
        accountChannels: () => {
          channelRequests += 1;
          return new Promise(() => {});
        },
      };
      let resolvedGrowthResult = null;
      const outcome = await Promise.race([
        loadGrowthWorkspaceData('cockpit').then((growthResult) => {
          resolvedGrowthResult = growthResult;
          return {
          type: 'resolved',
          hasChannelDataPromise: Boolean(growthResult.channelDataPromise),
          activeChannels: growthResult.data.activeChannels,
          channelRequests,
          };
        }),
        new Promise((resolve) => setTimeout(() => resolve({ type: 'blocked', channelRequests }), 25)),
      ]);
      if (resolvedGrowthResult?.channelDataPromise) await resolvedGrowthResult.channelDataPromise;
      return outcome;
    })();
  `)();

  assert.equal(result.type, 'resolved');
  assert.equal(result.hasChannelDataPromise, true);
  assert.equal(result.activeChannels, 0);
  assert.equal(result.channelRequests, 1);
});

test('Growth channel hydration ignores disconnected accounts and their channels', async () => {
  const result = await Function(`
    return (async () => {
      ${buildGrowthWorkspaceHarness(`
        const GROWTH_CHANNEL_HYDRATED_SECTIONS = new Set(['cockpit', 'metricas', 'relatorios']);
        const GROWTH_CHANNEL_LOAD_CONCURRENCY = 2;
        const GROWTH_CHANNEL_LOAD_TIMEOUT_MS = 20;
        const GROWTH_CHANNEL_TIMEOUT_RESULT = Object.freeze({ ok: false, timedOut: true });
        ${extractFunctionSource(APP_JS, 'withGrowthTimeout')}
        ${extractFunctionSource(APP_JS, 'loadGrowthAccountChannels')}
        ${extractFunctionSource(APP_JS, 'loadGrowthWorkspaceData')}
      `)}
      const requestedAccountIds = [];
      const accounts = [
        { id: 'acct_connected', provider: 'youtube', status: 'connected' },
        { id: 'acct_disconnected', provider: 'youtube', status: 'disconnected' },
        { id: 'acct_reauth', provider: 'youtube', status: 'reauth_required' },
      ];
      const api = {
        dashboard: async () => ({ ok: true, body: {} }),
        campaigns: async () => ({ ok: true, body: { campaigns: [] } }),
        accounts: async () => ({ ok: true, body: { accounts } }),
        accountChannels: async (accountId) => {
          requestedAccountIds.push(accountId);
          return {
            ok: true,
            body: {
              channels: [
                { id: 'ch_connected', connectedAccountId: accountId, isActive: true },
                { id: 'ch_stale_disconnected', connectedAccountId: 'acct_disconnected', isActive: true },
              ],
            },
          };
        },
      };
      const growthResult = await loadGrowthWorkspaceData('cockpit');
      const hydrated = await growthResult.channelDataPromise;
      const direct = buildGrowthWorkspaceData({
        accounts,
        accountChannels: [
          { id: 'ch_connected', connectedAccountId: 'acct_connected', isActive: true },
          { id: 'ch_disconnected', connectedAccountId: 'acct_disconnected', isActive: true },
          { id: 'ch_reauth', connectedAccountId: 'acct_reauth', isActive: true },
        ],
      });
      return {
        requestedAccountIds,
        requested: hydrated.channelSync.requested,
        activeChannels: hydrated.activeChannels,
        directActiveChannels: direct.activeChannels,
      };
    })();
  `)();

  assert.deepEqual(result.requestedAccountIds, ['acct_connected']);
  assert.equal(result.requested, 1);
  assert.equal(result.activeChannels, 1);
  assert.equal(result.directActiveChannels, 1);
});

test('Growth skips channel loading for sections that do not hydrate channel data', async () => {
  const result = await Function(`
    return (async () => {
      ${buildGrowthWorkspaceHarness(`
        const GROWTH_CHANNEL_HYDRATED_SECTIONS = new Set(['cockpit', 'metricas', 'relatorios']);
        const GROWTH_CHANNEL_LOAD_CONCURRENCY = 2;
        const GROWTH_CHANNEL_LOAD_TIMEOUT_MS = 5;
        const GROWTH_CHANNEL_TIMEOUT_RESULT = Object.freeze({ ok: false, timedOut: true });
        ${extractFunctionSource(APP_JS, 'withGrowthTimeout')}
        ${extractFunctionSource(APP_JS, 'loadGrowthAccountChannels')}
        ${extractFunctionSource(APP_JS, 'loadGrowthWorkspaceData')}
      `)}
      let channelRequests = 0;
      const api = {
        dashboard: async () => ({ ok: true, body: {} }),
        campaigns: async () => ({ ok: true, body: { campaigns: [] } }),
        accounts: async () => ({ ok: true, body: { accounts: [{ id: 'acct_1', provider: 'youtube', status: 'connected' }] } }),
        accountChannels: async () => {
          channelRequests += 1;
          return { ok: true, body: { channels: [{ id: 'ch_1' }] } };
        },
      };
      const growthResult = await loadGrowthWorkspaceData('conteudo');
      return { hasChannelDataPromise: Boolean(growthResult.channelDataPromise), channelRequests };
    })();
  `)();

  assert.equal(result.hasChannelDataPromise, false);
  assert.equal(result.channelRequests, 0);
});

test('Growth channel hydration preserves metrics filters and generated reports', () => {
  const result = Function(`
    const calls = [];
    function renderGrowthHeader() { return '<section data-growth-header>Header hidratado</section>'; }
    function renderGrowthBody() { calls.push('full-content-replace'); return '<section>Full replace</section>'; }
    function renderGrowthMetricCard(metric) { return '<article>' + metric.label + ':' + metric.value + '</article>'; }
    function renderGrowthChartCard(title) { return '<section class="growth-card">' + title + '</section>'; }
    function renderGrowthLineChart() { return '<svg></svg>'; }
    function renderGrowthBarChart() { return '<div></div>'; }
    function renderGrowthReportCard(report) { return '<article class="growth-card"><h3>' + report.title + '</h3><p>' + report.summary + '</p></article>'; }
    function renderGrowthListPanel(title, items) { return '<section>' + title + ':' + items.join('|') + '</section>'; }
    function formatNumber(value) { return String(value); }
    function escapeHtml(value) { return String(value); }
    function growthPlatformBadge(value) { return String(value); }
    function growthStatusBadge(value) { return String(value); }
    function bindGrowthInteractions() { calls.push('bind'); }
    const state = { growthMetricFilters: { date: 'all', platform: 'all' }, growthWorkspaceData: null };
    function getGrowthFilteredMetricsData(growthData) { return growthData; }
    function makeNode(innerHTML = '') {
      return {
        innerHTML,
        outerHTML: '',
        children: [],
        classList: { contains: () => false },
      };
    }
    function makeModule(sectionId, nodes) {
      return {
        getAttribute: (name) => name === 'data-growth-section' ? sectionId : null,
        querySelector: (selector) => nodes[selector] || null,
      };
    }
    ${extractFunctionSource(APP_JS, 'renderGrowthMetricsGridHtml')}
    ${extractFunctionSource(APP_JS, 'renderGrowthMetricsChartsHtml')}
    ${extractFunctionSource(APP_JS, 'renderGrowthContentRankingRowsHtml')}
    ${extractFunctionSource(APP_JS, 'renderGrowthReportsGridHtml')}
    ${extractFunctionSource(APP_JS, 'renderGrowthReportsChartHtml')}
    ${extractFunctionSource(APP_JS, 'renderGrowthReportsInsightsHtml')}
    ${extractFunctionSource(APP_JS, 'updateGrowthMetricsSection')}
    ${extractFunctionSource(APP_JS, 'updateGrowthReportsSection')}
    ${extractFunctionSource(APP_JS, 'applyGrowthWorkspaceData')}

    const metricNodes = {
      '[data-growth-header]': makeNode(),
      '[data-growth-content]': makeNode('<section class="growth-filter-card"><select><option selected>Ultimos 30 dias</option></select></section>'),
      '[data-growth-metrics-grid]': makeNode('old metrics'),
      '[data-growth-metrics-charts]': makeNode('old charts'),
      '[data-growth-ranking-body]': makeNode('old rows'),
    };
    let moduleEl = makeModule('metricas', metricNodes);
    const document = { querySelector: () => moduleEl };
    applyGrowthWorkspaceData('metricas', {
      metrics: [{ label: 'Canais ativos', value: '2', change: 'sincronizados', icon: 'video', tone: 'info' }],
      monthlyReach: [1, 2],
      platformGrowth: [],
      retentionBars: [],
      projectedQuota: 0,
      contentRanking: [{ title: 'Video top', platform: 'YouTube', date: 'Hoje', reach: '10', retention: '90%', comments: 3, status: 'Maior alcance' }],
    });
    const metricResult = {
      contentPreserved: metricNodes['[data-growth-content]'].innerHTML.includes('Ultimos 30 dias'),
      fullReplaceCalled: calls.includes('full-content-replace'),
      bindCalled: calls.includes('bind'),
      metricsUpdated: metricNodes['[data-growth-metrics-grid]'].innerHTML.includes('Canais ativos:2'),
      rankingUpdated: metricNodes['[data-growth-ranking-body]'].innerHTML.includes('Video top'),
    };

    calls.length = 0;
    const generatedReport = {
      classList: { contains: (name) => name === 'is-new' },
      outerHTML: '<article class="growth-card is-new"><h3>Relatorio manual</h3></article>',
    };
    const staleReport = {
      classList: { contains: () => false },
      outerHTML: '<article class="growth-card"><h3>Relatorio antigo</h3></article>',
    };
    const reportNodes = {
      '[data-growth-header]': makeNode(),
      '[data-growth-content]': makeNode('<section class="growth-page-title"><button>Gerar relatorio</button></section>'),
      '[data-growth-reports-grid]': makeNode('old reports'),
      '[data-growth-reports-chart]': makeNode('old chart'),
      '[data-growth-reports-insights]': makeNode('old insights'),
    };
    reportNodes['[data-growth-reports-grid]'].children = [generatedReport, staleReport];
    moduleEl = makeModule('relatorios', reportNodes);
    applyGrowthWorkspaceData('relatorios', {
      reports: [{ title: 'Saude das contas', summary: '2 canais ativos' }],
      monthlyReach: [3, 4],
      learnings: ['Novo aprendizado'],
      nextSteps: ['Proximo passo'],
    });
    const reportResult = {
      contentPreserved: reportNodes['[data-growth-content]'].innerHTML.includes('Gerar relatorio'),
      fullReplaceCalled: calls.includes('full-content-replace'),
      bindCalled: calls.includes('bind'),
      generatedPreserved: reportNodes['[data-growth-reports-grid]'].innerHTML.includes('Relatorio manual'),
      staleRemoved: !reportNodes['[data-growth-reports-grid]'].innerHTML.includes('Relatorio antigo'),
      serverReportUpdated: reportNodes['[data-growth-reports-grid]'].innerHTML.includes('Saude das contas'),
      insightsUpdated: reportNodes['[data-growth-reports-insights]'].innerHTML.includes('Novo aprendizado'),
    };

    return { metricResult, reportResult };
  `)();

  assert.equal(result.metricResult.contentPreserved, true);
  assert.equal(result.metricResult.fullReplaceCalled, false);
  assert.equal(result.metricResult.bindCalled, false);
  assert.equal(result.metricResult.metricsUpdated, true);
  assert.equal(result.metricResult.rankingUpdated, true);
  assert.equal(result.reportResult.contentPreserved, true);
  assert.equal(result.reportResult.fullReplaceCalled, false);
  assert.equal(result.reportResult.bindCalled, false);
  assert.equal(result.reportResult.generatedPreserved, true);
  assert.equal(result.reportResult.staleRemoved, true);
  assert.equal(result.reportResult.serverReportUpdated, true);
  assert.equal(result.reportResult.insightsUpdated, true);
});

test('main workspace settings merges Growth configuration instead of duplicating it', () => {
  assert.match(APP_JS, /class="growth-module growth-settings-merged settings-growth-compact"/);
  assert.match(APP_JS, /renderGrowthSettingsPanel\(\{ merged: true, compact: true \}\)/);
  assert.match(APP_JS, /Funcoes Growth migradas para Configuracoes PMP/);
  assert.match(APP_JS, /Somente controles acionaveis: plataformas, alertas e exportacao/);
  assert.match(APP_JS, /Contas conectadas/);
  assert.match(APP_JS, /Alertas e exportacao/);
  assert.match(APP_JS, /Controles sensiveis/);
  assert.doesNotMatch(APP_JS, /Perfil compartilhado/);
  assert.doesNotMatch(APP_JS, /Preferencias Growth/);
});

test('Growth no longer exposes its own configuration page', () => {
  assert.doesNotMatch(APP_JS, /href: '\/workspace\/growth\/configuracoes'/);
  assert.doesNotMatch(APP_JS, /function renderGrowthSettings\(\)/);
  assert.doesNotMatch(APP_JS, /sectionId === 'configuracoes'/);
  assert.match(APP_JS, /if \(path === '\/workspace\/growth\/configuracoes'\) \{\s*navigate\('\/workspace\/configuracoes', true\);/);
});

test('Growth profile controls are delegated to the PMP profile page', () => {
  assert.match(APP_JS, /data-link href="\/workspace\/perfil">Perfil e conta/);
  assert.doesNotMatch(APP_JS, /readonly aria-readonly="true"/);
  assert.doesNotMatch(APP_JS, /data-growth-save-profile/);
});

test('Growth preference checkbox persists through the DOM change flow', () => {
  const sources = [
    extractFunctionSource(APP_JS, 'getDefaultGrowthPreferences'),
    extractFunctionSource(APP_JS, 'normalizeGrowthPreferences'),
    extractFunctionSource(APP_JS, 'writeStoredGrowthPreferences'),
    extractFunctionSource(APP_JS, 'bindGrowthInteractions'),
  ].join('\n');
  const result = Function(`
    const GROWTH_PREFERENCES_STORAGE_KEY = 'ytmp-growth-preferences-v1';
    const GROWTH_PREFERENCE_OPTIONS = [
      { id: 'retentionAlerts', label: 'Receber alertas de queda de retencao' },
      { id: 'educationalTips', label: 'Mostrar dicas de conteudo educativo' },
      { id: 'weeklyEmailSummary', label: 'Resumo semanal por e-mail' },
      { id: 'useWorkspaceLocale', label: 'Usar idioma do painel principal' },
    ];
    const state = { growthPreferences: { retentionAlerts: true, educationalTips: true, weeklyEmailSummary: true, useWorkspaceLocale: true } };
    const localStorage = {
      store: {},
      setItem(key, value) { this.store[key] = String(value); },
    };
    class HTMLInputElement {}
    const listeners = {};
    const rootEl = {
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: (type, handler) => { listeners[type] = handler; },
      contains: () => true,
    };
    const document = { querySelector: (selector) => selector === '.growth-module' ? rootEl : null };
    ${sources}
    bindGrowthInteractions();
    const checkbox = new HTMLInputElement();
    checkbox.checked = false;
    checkbox.getAttribute = (name) => name === 'data-growth-preference' ? 'weeklyEmailSummary' : null;
    listeners.change({ target: checkbox });
    return { state, stored: localStorage.store[GROWTH_PREFERENCES_STORAGE_KEY] };
  `)();

  assert.equal(result.state.growthPreferences.weeklyEmailSummary, false);
  assert.deepEqual(JSON.parse(result.stored), {
    retentionAlerts: true,
    educationalTips: true,
    weeklyEmailSummary: false,
    useWorkspaceLocale: true,
  });
});

test('Growth preferences export creates a downloadable JSON payload', () => {
  const sources = [
    extractFunctionSource(APP_JS, 'getDefaultGrowthPreferences'),
    extractFunctionSource(APP_JS, 'normalizeGrowthPreferences'),
    extractFunctionSource(APP_JS, 'buildGrowthPreferencesExportPayload'),
    extractFunctionSource(APP_JS, 'exportGrowthPreferences'),
  ].join('\n');
  const result = Function(`
    const GROWTH_PREFERENCE_OPTIONS = [
      { id: 'retentionAlerts', label: 'Receber alertas de queda de retencao' },
      { id: 'educationalTips', label: 'Mostrar dicas de conteudo educativo' },
      { id: 'weeklyEmailSummary', label: 'Resumo semanal por e-mail' },
      { id: 'useWorkspaceLocale', label: 'Usar idioma do painel principal' },
    ];
    const state = {
      me: { fullName: 'Lucas', email: 'lucas@example.com' },
      account: { email: 'workspace@example.com', plan: 'PRO', planLabel: 'Pro' },
      locale: 'pt-BR',
      backgroundTheme: 'neon',
      fontTheme: 'editorial',
      growthPreferences: { retentionAlerts: true, educationalTips: false, weeklyEmailSummary: true, useWorkspaceLocale: true },
    };
    let payload = '';
    let contentType = '';
    let downloadName = '';
    let clicked = false;
    let revokedUrl = '';
    class Blob {
      constructor(parts, options) {
        payload = parts.join('');
        contentType = options.type;
      }
    }
    const URL = {
      createObjectURL: () => 'blob:growth',
      revokeObjectURL: (url) => { revokedUrl = url; },
    };
    const document = {
      body: { appendChild() {} },
      createElement: () => ({
        style: {},
        set href(value) { this._href = value; },
        get href() { return this._href; },
        set download(value) { downloadName = value; },
        get download() { return downloadName; },
        click() { clicked = true; },
        remove() {},
      }),
    };
    function setTimeout(handler) { handler(); }
    function getPlanVisualConfig() { return { label: 'Pro' }; }
    function getGrowthPlatformSettingsRows() { return [{ key: 'youtube', name: 'YouTube', status: '1 conectado' }]; }
    function setGrowthButtonFeedback(button, label) { button.feedback = label; }
    ${sources}
    const button = { textContent: 'Exportar', classList: { add() {}, remove() {} } };
    exportGrowthPreferences(button);
    return { payload, contentType, downloadName, clicked, revokedUrl, feedback: button.feedback };
  `)();

  const payload = JSON.parse(result.payload);
  assert.equal(result.contentType, 'application/json');
  assert.match(result.downloadName, /^pmp-growth-preferencias-\d{4}-\d{2}-\d{2}\.json$/);
  assert.equal(result.clicked, true);
  assert.equal(result.revokedUrl, 'blob:growth');
  assert.equal(result.feedback, 'Preferencias exportadas');
  assert.equal(payload.profile.email, 'lucas@example.com');
  assert.equal(payload.preferences.educationalTips, false);
  assert.equal(payload.platforms[0].name, 'YouTube');
});

test('Growth report export creates a downloadable HTML report', () => {
  const sources = [
    extractFunctionSource(APP_JS, 'getGrowthReportExportHtml'),
    extractFunctionSource(APP_JS, 'exportGrowthReport'),
  ].join('\n');
  const result = Function(`
    let payload = '';
    let contentType = '';
    let downloadName = '';
    let clicked = false;
    let revokedUrl = '';
    class Blob {
      constructor(parts, options) {
        payload = parts.join('');
        contentType = options.type;
      }
    }
    const URL = {
      createObjectURL: () => 'blob:growth-report',
      revokeObjectURL: (url) => { revokedUrl = url; },
    };
    const reportCard = {
      querySelector: (selector) => selector === 'h3'
        ? { textContent: 'Resumo operacional' }
        : selector === 'p'
          ? { textContent: '2 campanhas carregadas' }
          : null,
    };
    const insight = { textContent: 'Proximo passo real' };
    const rootEl = {
      querySelectorAll: (selector) => {
        if (selector === '[data-growth-manual-reports-grid] .growth-card, [data-growth-reports-grid] .growth-card') return [reportCard];
        if (selector === '[data-growth-reports-insights] p') return [insight];
        return [];
      },
    };
    const document = {
      body: { appendChild() {} },
      querySelector: () => rootEl,
      createElement: () => ({
        style: {},
        set href(value) { this._href = value; },
        get href() { return this._href; },
        set download(value) { downloadName = value; },
        get download() { return downloadName; },
        click() { clicked = true; },
        remove() {},
      }),
    };
    function setTimeout(handler) { handler(); }
    function escapeHtml(value) { return String(value); }
    function setGrowthButtonFeedback(button, label) { button.feedback = label; }
    ${sources}
    const button = { closest: () => rootEl, classList: { add() {}, remove() {} } };
    exportGrowthReport(button);
    return { payload, contentType, downloadName, clicked, revokedUrl, feedback: button.feedback };
  `)();

  assert.equal(result.contentType, 'text/html;charset=utf-8');
  assert.match(result.downloadName, /^pmp-growth-relatorio-\d{4}-\d{2}-\d{2}\.html$/);
  assert.equal(result.clicked, true);
  assert.equal(result.revokedUrl, 'blob:growth-report');
  assert.equal(result.feedback, 'HTML exportado');
  assert.match(result.payload, /Resumo operacional/);
  assert.match(result.payload, /Proximo passo real/);
});

test('Growth module keeps its visual system isolated from the main dashboard', () => {
  assert.match(APP_CSS, /Growth Module/);
  assert.match(APP_CSS, /\.growth-module/);
  assert.match(APP_CSS, /\.growth-settings-merged/);
  assert.match(APP_CSS, /\.growth-nav-link\.active/);
  assert.match(APP_CSS, /\.growth-action-done/);
  assert.match(APP_CSS, /\.growth-calendar-grid/);
  assert.match(APP_CSS, /\.growth-table/);
});
