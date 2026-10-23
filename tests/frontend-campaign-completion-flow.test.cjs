'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..');
const APP_JS = fs.readFileSync(path.join(ROOT, 'apps', 'api', 'src', 'frontend', 'public', 'app.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'apps', 'api', 'src', 'frontend', 'public', 'app.css'), 'utf8');

test('campaign creation ends in one confirmation step with explicit outcomes', () => {
  const stepsBlock = APP_JS.slice(
    APP_JS.indexOf('const CAMPAIGN_FLOW_STEPS'),
    APP_JS.indexOf('const CAMPAIGN_FLOW_PLATFORMS'),
  );

  assert.equal((stepsBlock.match(/number:/g) || []).length, 5);
  assert.doesNotMatch(stepsBlock, /Etapa6|Salvar'/);
  assert.match(APP_JS, /value: 'publish_now'/);
  assert.match(APP_JS, /buttonLabel: 'Criar como rascunho'/);
  assert.match(APP_JS, /buttonLabel: 'Publicar agora'/);
  assert.match(APP_JS, /buttonLabel: 'Agendar publicacoes'/);
  assert.match(APP_JS, /submit: true/);
});

test('campaign completion keeps a receipt and exposes the three next actions', () => {
  assert.match(APP_JS, /function renderCampaignFlowSuccessPage/);
  assert.match(APP_JS, />Abrir campanha</);
  assert.match(APP_JS, />Acompanhar publicacoes</);
  assert.match(APP_JS, />Criar outra campanha</);
  assert.match(APP_JS, /CAMPAIGN_FLOW_RESULT_KEY/);
});

test('campaign drafts and workspace preferences are isolated by authenticated account', () => {
  assert.match(APP_JS, /function getAccountScopedStorageKey/);
  assert.match(APP_JS, /setAccountStorageScope\(nextUser\?\.email\)/);
  assert.match(APP_JS, /getAccountScopedStorageKey\(CAMPAIGN_FLOW_STORAGE_KEY\)/);
  assert.match(APP_JS, /getAccountScopedStorageKey\(CAMPAIGN_FLOW_RESULT_KEY\)/);
  assert.match(APP_JS, /getAccountScopedStorageKey\(BACKGROUND_THEME_STORAGE_KEY\)/);
  assert.match(APP_JS, /getAccountScopedStorageKey\(GROWTH_PREFERENCES_STORAGE_KEY\)/);
});

test('partial submission can resume without recreating saved campaigns or destinations', () => {
  assert.match(APP_JS, /submissionProgress/);
  assert.match(APP_JS, /Continuar de onde parou/);
  assert.match(APP_JS, /if \(!activeEntry\.campaignId\)/);
  assert.match(APP_JS, /const missingTargets = targets\.filter/);
  assert.match(APP_JS, /api\.campaignById\(campaignId\)/);
});

test('campaign completion layout supports five steps, modes, preview and success states', () => {
  assert.match(CSS, /\.campaign-flow-stepper\s*\{[^}]*repeat\(5,/s);
  assert.match(CSS, /\.campaign-completion-grid/);
  assert.match(CSS, /\.campaign-dispatch-table/);
  assert.match(CSS, /\.campaign-partial-recovery/);
  assert.match(CSS, /\.campaign-flow-success/);
});

test('final validation exposes every issue with a correction link', () => {
  assert.match(APP_JS, /function getCampaignFlowValidationIssues/);
  assert.match(APP_JS, /issues\.push\(\{ id: 'platforms'/);
  assert.match(APP_JS, /issues\.push\(\{ id: 'published-title'/);
  assert.match(APP_JS, /validation\.issues\.map/);
  assert.match(APP_JS, />Corrigir</);
  assert.match(CSS, /\.campaign-validation-checklist/);
});

test('plan incompatibilities are disabled during platform selection', () => {
  assert.match(APP_JS, /const planAllowed = isCampaignFlowPlatformAllowedByPlan/);
  assert.match(APP_JS, /const disabled = count === 0 \|\| !planAllowed/);
  assert.match(APP_JS, /plataformas fora do seu plano ja aparecem bloqueadas aqui/i);
  assert.match(APP_JS, />Ver planos</);
});

test('metadata separates essential platform and advanced decisions', () => {
  assert.match(APP_JS, />Conteudo essencial</);
  assert.match(APP_JS, />Configuracoes por plataforma</);
  assert.match(APP_JS, />Opcoes avancadas</);
  assert.match(APP_JS, />Nome interno da campanha</);
  assert.match(APP_JS, />Titulo que sera publicado</);
  assert.match(APP_JS, />Briefing para criar capa</);
  assert.match(APP_JS, />Extrair um frame do vídeo</);
  assert.match(APP_JS, /Preset do video/);
  assert.match(APP_JS, /data-action="undo-campaign-preset"/);
});

test('review table shows effective settings for each destination', () => {
  assert.match(APP_JS, />Tabela final por destino</);
  assert.match(APP_JS, /<th>Destino<\/th><th>Video<\/th><th>Horario<\/th><th>Privacidade<\/th><th>Playlist do YouTube<\/th><th>Situacao<\/th>/);
  assert.match(APP_JS, /campaignFlowEffectivePrivacy/);
  assert.match(APP_JS, /Horario do destino &gt; padrao automatico &gt; horario geral &gt; publicacao manual/);
  assert.match(APP_JS, /privacy: flowState\.privacy \|\| 'private'/);
});
