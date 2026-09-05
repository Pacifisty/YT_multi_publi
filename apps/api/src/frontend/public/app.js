const root = document.getElementById('app');

if (!root) {
  throw new Error('Missing app root container.');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getI18nRuntime() {
  return window.PMP_I18N && typeof window.PMP_I18N === 'object' ? window.PMP_I18N : null;
}

function readInitialLocale() {
  const runtime = getI18nRuntime();
  if (runtime?.resolveInitialLocale) {
    return runtime.resolveInitialLocale(document.body?.dataset?.initialLocale);
  }
  const initialLocale = document.body?.dataset?.initialLocale || document.documentElement.lang;
  return initialLocale === 'en' ? 'en' : 'pt-BR';
}

function getActiveLocale() {
  const runtime = getI18nRuntime();
  if (runtime?.getCurrentLocale) {
    return runtime.getCurrentLocale();
  }
  return document.documentElement.lang === 'en' ? 'en' : 'pt-BR';
}

function t(key, values = {}) {
  const runtime = getI18nRuntime();
  const locale = state?.locale ?? getActiveLocale();
  return runtime?.t ? runtime.t(locale, key, values) : String(key ?? '');
}

function applyLocaleTranslations() {
  const runtime = getI18nRuntime();
  const locale = state?.locale ?? getActiveLocale();
  document.documentElement.lang = locale;
  document.body.dataset.initialLocale = locale;
  if (runtime?.applyLocale) {
    runtime.applyLocale(locale, root);
  }
}

function setAppLocale(locale, options = {}) {
  const runtime = getI18nRuntime();
  const normalized = runtime?.normalizeLocale ? runtime.normalizeLocale(locale) : (locale === 'en' ? 'en' : 'pt-BR');
  state.locale = normalized;
  if (runtime?.persistLocale) {
    runtime.persistLocale(normalized);
  }
  applyLocaleTranslations();
  if (options.rerender !== false) {
    void renderRoute();
  }
}

function formatDate(value) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString(getActiveLocale());
}

function formatNumber(value) {
  return Number(value ?? 0).toLocaleString(getActiveLocale());
}

function formatBytes(value) {
  const bytes = Number(value ?? 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let current = bytes;
  let unitIndex = 0;
  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024;
    unitIndex += 1;
  }
  const decimals = current >= 100 || unitIndex === 0 ? 0 : 1;
  return `${current.toFixed(decimals)} ${units[unitIndex]}`;
}

function formatPercent(value, digits = 2) {
  const percent = Number(value ?? 0);
  if (!Number.isFinite(percent)) return '0%';
  const fixed = Number(percent.toFixed(digits));
  return `${fixed}%`;
}

function formatDurationSeconds(value) {
  const total = Math.max(0, Math.round(Number(value ?? 0)));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  }
  return `${seconds}s`;
}

const SHORT_FORM_MAX_DURATION_SECONDS = 180;

function getVideoPublishFormat(asset) {
  const durationSeconds = Number(asset?.duration_seconds ?? 0);
  if (!durationSeconds || durationSeconds <= 0) {
    return 'unknown';
  }
  return durationSeconds <= SHORT_FORM_MAX_DURATION_SECONDS ? 'short' : 'standard';
}

function getVideoPublishFormatLabel(format) {
  if (format === 'unknown') return 'Duração não detectada';
  return format === 'short' ? 'Reels / Shorts' : 'Video normal';
}

function clampPercent(value) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

function isProbablyVideoFile(file) {
  const type = String(file?.type ?? '').toLowerCase();
  const name = String(file?.name ?? '').toLowerCase();
  return type.startsWith('video/')
    || /\.(mp4|mov|m4v|webm|mkv|avi)$/i.test(name);
}

function readVideoDurationSeconds(file) {
  if (!isProbablyVideoFile(file) || typeof document === 'undefined' || typeof window === 'undefined' || typeof URL === 'undefined') {
    return Promise.resolve(undefined);
  }

  return new Promise((resolve) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);
    let settled = false;

    const finish = (durationSeconds) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(objectUrl);
      resolve(durationSeconds);
    };

    const timeoutId = window.setTimeout(() => finish(undefined), 8000);

    video.preload = 'metadata';
    video.muted = true;
    video.addEventListener('loadedmetadata', () => {
      const duration = Number(video.duration);
      finish(Number.isFinite(duration) && duration > 0 ? Math.round(duration) : undefined);
    }, { once: true });
    video.addEventListener('error', () => finish(undefined), { once: true });
    video.src = objectUrl;
    video.load();
  });
}

function readVideoDurationFromUrl(sourceUrl) {
  if (!sourceUrl || typeof document === 'undefined' || typeof window === 'undefined') {
    return Promise.resolve(undefined);
  }

  return new Promise((resolve) => {
    const video = document.createElement('video');
    let settled = false;

    const finish = (durationSeconds) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      video.removeAttribute('src');
      video.load();
      resolve(durationSeconds);
    };

    const timeoutId = window.setTimeout(() => finish(undefined), 8000);

    video.preload = 'metadata';
    video.muted = true;
    video.addEventListener('loadedmetadata', () => {
      const duration = Number(video.duration);
      finish(Number.isFinite(duration) && duration > 0 ? Math.round(duration) : undefined);
    }, { once: true });
    video.addEventListener('error', () => finish(undefined), { once: true });
    video.src = sourceUrl;
    video.load();
  });
}

async function uploadMediaFiles(videoFile, thumbnailFile) {
  const form = new FormData();
  form.append('video', videoFile, videoFile.name);
  if (thumbnailFile) {
    form.append('thumbnail', thumbnailFile, thumbnailFile.name);
  }
  const durationSeconds = await readVideoDurationSeconds(videoFile);
  if (typeof durationSeconds === 'number') {
    form.append('videoDuration', String(durationSeconds));
  }

  const response = await fetch('/api/media', {
    method: 'POST',
    credentials: 'include',
    body: form,
  });

  let payload = null;
  const ct = response.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    payload = await response.json();
  } else {
    payload = await response.text();
  }

  if (!response.ok) {
    return { ok: false, status: response.status, error: payload?.error ?? `Upload failed with ${response.status}`, body: payload };
  }
  return { ok: true, status: response.status, body: payload };
}

const BACKGROUND_THEME_STORAGE_KEY = 'ytmp-workspace-background-theme';
const OAUTH_PROVIDER_STORAGE_KEY = 'ytmp-pending-oauth-provider';
const CAMPAIGN_REAUTH_RETURN_KEY = 'ytmp-campaign-reauth-return';
const MEDIA_PREVIEW_SIZE_STORAGE_KEY = 'ytmp-media-preview-sizes';
const GROWTH_PREFERENCES_STORAGE_KEY = 'ytmp-growth-preferences-v1';
const GROWTH_PREFERENCE_OPTIONS = [
  { id: 'retentionAlerts', label: 'Receber alertas de queda de retencao' },
  { id: 'educationalTips', label: 'Mostrar dicas de conteudo educativo' },
  { id: 'weeklyEmailSummary', label: 'Resumo semanal por e-mail' },
  { id: 'useWorkspaceLocale', label: 'Usar idioma do painel principal' },
];
const DEFAULT_MEDIA_PREVIEW_SIZE = 'medium';
const MEDIA_PREVIEW_SIZE_OPTIONS = [
  { id: 'low', label: 'Baixo' },
  { id: 'medium', label: 'Medio' },
  { id: 'large', label: 'Grande' },
];
const ACCOUNT_PLAN_OPTIONS = [
  {
    id: 'FREE',
    label: 'Free',
    priceBrl: 0,
    tokens: 150,
    dailyVisitTokens: 15,
    campaignPublishCostTokens: 2,
    thumbnailCostTokens: 1,
    durationDays: null,
    allowedPlatforms: ['youtube'],
    priceLabel: 'R$ 0,00',
    description: 'Ideal para conhecer a plataforma e publicar no YouTube sem custo mensal.',
    tokenSummary: '150 tokens mensais',
    visitSummary: '+15 tokens por visita diaria',
    platformSummary: 'YouTube',
    benefits: [
      'Publicacao no YouTube',
      '150 tokens mensais',
      '+15 tokens por visita diaria',
      'Custo de 2 tokens por campanha',
      'Thumbnail custa 1 token',
      'Suporte da comunidade',
    ],
  },
  {
    id: 'BASIC',
    label: 'Basico',
    priceBrl: 19.90,
    tokens: 400,
    dailyVisitTokens: 40,
    campaignPublishCostTokens: 2,
    thumbnailCostTokens: 0,
    durationDays: 30,
    allowedPlatforms: ['youtube'],
    priceLabel: 'R$ 19,90 / mes',
    description: 'Mais folego para operacao recorrente com limite maior de tokens.',
    tokenSummary: '400 tokens mensais',
    visitSummary: '+40 tokens por visita diaria',
    platformSummary: 'YouTube',
    benefits: [
      'Publicacao no YouTube',
      '400 tokens mensais',
      '+40 tokens por visita diaria',
      'Thumbnails incluidas sem custo extra',
      'Custo de 2 tokens por campanha',
      'Suporte por email',
    ],
  },
  {
    id: 'PRO',
    label: 'Pro',
    priceBrl: 49.90,
    tokens: 800,
    dailyVisitTokens: 80,
    campaignPublishCostTokens: 2,
    thumbnailCostTokens: 0,
    durationDays: 30,
    allowedPlatforms: ['youtube', 'tiktok', 'instagram'],
    priceLabel: 'R$ 49,90 / mes',
    description: 'Plano completo para publicar em YouTube, TikTok e Instagram com automacao avancada.',
    tokenSummary: '800 tokens mensais',
    visitSummary: '+80 tokens por visita diaria',
    platformSummary: 'YouTube + TikTok + Instagram',
    featured: true,
    benefits: [
      'Publicacao no YouTube + TikTok + Instagram',
      '800 tokens mensais',
      '+80 tokens por visita diaria',
      'Thumbnails incluidas sem custo extra',
      'Playlists com auto-rotacao',
      'Agendamento aleatorio avancado',
      'Suporte prioritario',
    ],
  },
  {
    id: 'PREMIUM',
    label: 'Premium',
    priceBrl: 99.90,
    tokens: 2000,
    dailyVisitTokens: 200,
    campaignPublishCostTokens: 1,
    thumbnailCostTokens: 0,
    durationDays: 30,
    allowedPlatforms: ['youtube', 'tiktok', 'instagram'],
    priceLabel: 'R$ 99,90 / mes',
    description: 'Potencia maxima para YouTube, TikTok e Instagram com mais tokens, custo reduzido por campanha e suporte dedicado.',
    tokenSummary: '2000 tokens mensais',
    visitSummary: '+200 tokens por visita diaria',
    platformSummary: 'YouTube + TikTok + Instagram',
    benefits: [
      'Publicacao no YouTube + TikTok + Instagram',
      '2000 tokens mensais',
      '+200 tokens por visita diaria',
      'Custo reduzido de 1 token por campanha',
      'Thumbnails incluidas sem custo extra',
      'Playlists ilimitadas com auto-rotacao',
      'Agendamento aleatorio avancado',
      'Geracao de titulos por IA',
      'Suporte dedicado 24/7',
      'Acesso antecipado a novos recursos',
    ],
  },
];
const ACCOUNT_PLAN_LABELS = {
  FREE: 'Free',
  BASIC: 'Basico',
  PRO: 'Pro',
  PREMIUM: 'Premium',
};
const ACCOUNT_PLAN_DESCRIPTIONS = {
  FREE: 'Ideal para conhecer a plataforma e publicar no YouTube sem custo mensal.',
  BASIC: 'Mais folego para operacao recorrente com limite maior de tokens.',
  PRO: 'Plano completo para publicar em YouTube, TikTok e Instagram com automacao avancada.',
  PREMIUM: 'Potencia maxima para YouTube, TikTok e Instagram com mais tokens, custo reduzido por campanha e suporte dedicado.',
};
const PLAN_PLATFORM_LABELS = {
  youtube: 'YouTube',
  tiktok: 'TikTok',
  instagram: 'Instagram',
};
function normalizePlanCode(value) {
  return parseKnownPlanCode(value) ?? 'FREE';
}

function parseKnownPlanCode(value) {
  const code = String(value ?? '').toUpperCase().trim();
  return ACCOUNT_PLAN_LABELS[code] ? code : null;
}

function formatPlanPriceLabel(priceBrl, fallback = '') {
  const price = Number(priceBrl);
  if (!Number.isFinite(price)) return fallback;
  if (price <= 0) return 'R$ 0,00';
  return `R$ ${price.toFixed(2).replace('.', ',')} / mes`;
}

function normalizePlanPlatforms(value) {
  const platforms = Array.isArray(value) ? value : [];
  const normalized = platforms
    .map((platform) => String(platform ?? '').toLowerCase().trim())
    .filter((platform) => PLAN_PLATFORM_LABELS[platform]);
  return normalized.length > 0 ? Array.from(new Set(normalized)) : ['youtube'];
}

function getPlanAllowedPlatforms(option) {
  return normalizePlanPlatforms(option?.allowedPlatforms);
}

function getPlanPlatformSummary(option) {
  return getPlanAllowedPlatforms(option)
    .map((platform) => PLAN_PLATFORM_LABELS[platform] ?? platform)
    .join(' + ');
}

function formatTokenCost(value) {
  const cost = Number(value ?? 0);
  if (!Number.isFinite(cost) || cost <= 0) return 'Sem custo';
  return `${formatNumber(cost)} ${cost === 1 ? 'token' : 'tokens'}`;
}

function buildPlanBenefits(option) {
  const planId = normalizePlanCode(option?.id);
  const platforms = getPlanPlatformSummary(option);
  const tokens = Number(option?.tokens ?? option?.maxTokens ?? 0);
  const dailyVisitTokens = Number(option?.dailyVisitTokens ?? 0);
  const campaignCost = Number(option?.campaignPublishCostTokens ?? 0);
  const thumbnailCost = Number(option?.thumbnailCostTokens ?? 0);
  const benefits = [
    `Publicacao em ${platforms}`,
    `${formatNumber(tokens)} tokens mensais`,
    `+${formatNumber(dailyVisitTokens)} tokens por visita diaria`,
    `Custo de ${formatTokenCost(campaignCost)} por campanha`,
    thumbnailCost > 0 ? `Thumbnail custa ${formatTokenCost(thumbnailCost)}` : 'Thumbnails incluidas sem custo extra',
  ];

  if (planId === 'PRO' || planId === 'PREMIUM') {
    benefits.push('Playlists com auto-rotacao');
    benefits.push('Agendamento aleatorio avancado');
  }
  if (planId === 'PREMIUM') {
    benefits.push('Geracao de titulos por IA');
    benefits.push('Suporte dedicado 24/7');
  } else if (planId === 'PRO') {
    benefits.push('Suporte prioritario');
  } else if (planId === 'BASIC') {
    benefits.push('Suporte por email');
  } else {
    benefits.push('Suporte da comunidade');
  }

  return benefits;
}

function mergePlanDisplayOptions(apiPlans = []) {
  const apiPlansByCode = new Map(
    (Array.isArray(apiPlans) ? apiPlans : [])
      .map((plan) => [parseKnownPlanCode(plan?.code), plan])
      .filter(([code]) => code)
  );

  return ACCOUNT_PLAN_OPTIONS.map((fallbackPlan) => {
    const planId = normalizePlanCode(fallbackPlan.id);
    const apiPlan = apiPlansByCode.get(planId);
    const merged = {
      ...fallbackPlan,
      id: planId,
      label: ACCOUNT_PLAN_LABELS[planId] ?? fallbackPlan.label,
      priceBrl: apiPlan?.priceBrl ?? fallbackPlan.priceBrl,
      tokens: apiPlan?.tokens ?? fallbackPlan.tokens,
      dailyVisitTokens: apiPlan?.dailyVisitTokens ?? fallbackPlan.dailyVisitTokens,
      campaignPublishCostTokens: apiPlan?.campaignPublishCostTokens ?? fallbackPlan.campaignPublishCostTokens,
      thumbnailCostTokens: apiPlan?.thumbnailCostTokens ?? fallbackPlan.thumbnailCostTokens,
      durationDays: apiPlan?.durationDays ?? fallbackPlan.durationDays,
      allowedPlatforms: normalizePlanPlatforms(apiPlan?.allowedPlatforms ?? fallbackPlan.allowedPlatforms),
      active: apiPlan?.active ?? fallbackPlan.active ?? true,
      featured: fallbackPlan.featured,
    };
    merged.priceLabel = formatPlanPriceLabel(merged.priceBrl, fallbackPlan.priceLabel);
    merged.description = ACCOUNT_PLAN_DESCRIPTIONS[planId] ?? fallbackPlan.description;
    merged.platformSummary = getPlanPlatformSummary(merged);
    merged.tokenSummary = `${formatNumber(merged.tokens)} tokens mensais`;
    merged.visitSummary = `+${formatNumber(merged.dailyVisitTokens)} tokens por visita diaria`;
    merged.benefits = buildPlanBenefits(merged);
    return merged;
  }).filter((plan) => plan.active !== false);
}
const BACKGROUND_THEME_OPTIONS = [
  {
    id: 'pmp-essencial',
    label: 'PMP Essencial',
    eyebrow: 'Padrão gratuito',
    type: 'brand',
    appearance: 'dark',
    code: '#06111F · #12D6E4',
    description: 'A identidade PMP em sua forma mais direta, estável e legível.',
    pageBackground: 'radial-gradient(circle at 82% 8%, rgba(18, 214, 228, 0.10) 0%, transparent 30%), linear-gradient(155deg, #06111F 0%, #020914 100%)',
    bg: '#06111f',
    bgSoft: '#091827',
    surface: 'rgba(9, 24, 39, 0.96)',
    surfaceMuted: 'rgba(12, 31, 50, 0.97)',
    border: 'rgba(112, 170, 205, 0.22)',
    primary: '#12d6e4',
    primaryStrong: '#1683ff',
    primarySoft: 'rgba(18, 214, 228, 0.16)',
    iconFilter: 'saturate(1.04) brightness(1.02)',
    text: '#f4fbff',
    textSubtle: '#c4d5e5',
    textMuted: '#91a8bc',
    onAccent: '#02131b',
    danger: '#ff718f',
    warning: '#ffc45c',
    success: '#43deb3',
    info: '#65c9ff',
    shadow: '0 22px 52px rgba(0, 4, 12, 0.46)',
    headerBackground: 'linear-gradient(135deg, rgba(6, 17, 31, 0.98) 0%, rgba(8, 31, 52, 0.97) 64%, rgba(6, 50, 68, 0.96) 100%)',
  },
  {
    id: 'orbita-ciano',
    label: 'Órbita Ciano',
    eyebrow: 'Assinatura PMP',
    type: 'cosmic',
    appearance: 'dark',
    code: '#020B18 · #08E2EF',
    description: 'Profundidade espacial com o ciano luminoso da marca em primeiro plano.',
    pageBackground: 'radial-gradient(circle at 78% 12%, rgba(8, 226, 239, 0.18) 0%, transparent 31%), radial-gradient(circle at 12% 88%, rgba(22, 131, 255, 0.12) 0%, transparent 34%), linear-gradient(150deg, #020B18 0%, #06182B 100%)',
    bg: '#020b18',
    bgSoft: '#061426',
    surface: 'rgba(7, 26, 45, 0.95)',
    surfaceMuted: 'rgba(9, 34, 57, 0.97)',
    border: 'rgba(83, 198, 228, 0.24)',
    primary: '#08e2ef',
    primaryStrong: '#1683ff',
    primarySoft: 'rgba(8, 226, 239, 0.17)',
    iconFilter: 'saturate(1.18) brightness(1.04)',
    text: '#f6fcff',
    textSubtle: '#c9ddec',
    textMuted: '#92aec3',
    onAccent: '#00151c',
    danger: '#ff6f91',
    warning: '#ffc857',
    success: '#38ddb2',
    info: '#6ecbff',
    shadow: '0 24px 56px rgba(0, 4, 14, 0.52)',
    headerBackground: 'linear-gradient(135deg, rgba(2, 11, 24, 0.98) 0%, rgba(6, 30, 52, 0.97) 65%, rgba(5, 67, 84, 0.94) 100%)',
  },
  {
    id: 'eclipse-cobalto',
    label: 'Eclipse Cobalto',
    eyebrow: 'Precisão técnica',
    type: 'cosmic',
    appearance: 'dark',
    code: '#050A1D · #3478FF',
    description: 'Um ambiente analítico de alto foco, guiado por azul elétrico e gelo.',
    pageBackground: 'radial-gradient(circle at 86% 16%, rgba(52, 120, 255, 0.22) 0%, transparent 34%), linear-gradient(145deg, #050A1D 0%, #09142E 58%, #060B1D 100%)',
    bg: '#050a1d',
    bgSoft: '#0a1228',
    surface: 'rgba(12, 21, 49, 0.95)',
    surfaceMuted: 'rgba(16, 29, 62, 0.97)',
    border: 'rgba(126, 173, 255, 0.24)',
    primary: '#5d91ff',
    primaryStrong: '#7ec8ff',
    primarySoft: 'rgba(93, 145, 255, 0.17)',
    iconFilter: 'hue-rotate(18deg) saturate(0.92) brightness(1.08)',
    text: '#f7f9ff',
    textSubtle: '#cdd8f4',
    textMuted: '#9caacc',
    onAccent: '#04112c',
    danger: '#ff7596',
    warning: '#ffd166',
    success: '#49d9b0',
    info: '#7ec8ff',
    shadow: '0 24px 58px rgba(1, 4, 18, 0.54)',
    headerBackground: 'linear-gradient(135deg, rgba(5, 10, 29, 0.99) 0%, rgba(13, 28, 65, 0.97) 70%, rgba(30, 73, 157, 0.92) 100%)',
  },
  {
    id: 'aurora-polar',
    label: 'Aurora Polar',
    eyebrow: 'Fluxo e crescimento',
    type: 'aurora',
    appearance: 'dark',
    code: '#031A1C · #32E6C1',
    description: 'Verde-água e azul polar criam energia sem disputar atenção com os dados.',
    pageBackground: 'radial-gradient(circle at 22% 14%, rgba(50, 230, 193, 0.18) 0%, transparent 34%), radial-gradient(circle at 84% 82%, rgba(83, 191, 255, 0.14) 0%, transparent 35%), linear-gradient(150deg, #031A1C 0%, #08252B 100%)',
    bg: '#031a1c',
    bgSoft: '#072326',
    surface: 'rgba(9, 41, 43, 0.95)',
    surfaceMuted: 'rgba(12, 50, 53, 0.97)',
    border: 'rgba(87, 218, 198, 0.24)',
    primary: '#32e6c1',
    primaryStrong: '#53bfff',
    primarySoft: 'rgba(50, 230, 193, 0.16)',
    iconFilter: 'hue-rotate(-18deg) saturate(0.94) brightness(1.06)',
    text: '#f2fffd',
    textSubtle: '#c6e9e4',
    textMuted: '#8fbab4',
    onAccent: '#01201b',
    danger: '#ff7890',
    warning: '#ffd06b',
    success: '#55e6a5',
    info: '#75d4ff',
    shadow: '0 24px 54px rgba(0, 12, 14, 0.48)',
    headerBackground: 'linear-gradient(135deg, rgba(3, 26, 28, 0.98) 0%, rgba(8, 45, 51, 0.97) 66%, rgba(10, 78, 78, 0.94) 100%)',
  },
  {
    id: 'horizonte-solar',
    label: 'Horizonte Solar',
    eyebrow: 'Calor editorial',
    type: 'editorial',
    appearance: 'dark',
    code: '#17120B · #FFB547',
    description: 'Dourado controlado sobre azul-carvão para campanhas com presença editorial.',
    pageBackground: 'radial-gradient(circle at 80% 10%, rgba(255, 181, 71, 0.19) 0%, transparent 32%), radial-gradient(circle at 10% 90%, rgba(57, 207, 228, 0.10) 0%, transparent 34%), linear-gradient(150deg, #17120B 0%, #101722 100%)',
    bg: '#17120b',
    bgSoft: '#20180e',
    surface: 'rgba(37, 27, 16, 0.95)',
    surfaceMuted: 'rgba(47, 35, 21, 0.97)',
    border: 'rgba(232, 190, 119, 0.24)',
    primary: '#ffb547',
    primaryStrong: '#39cfe4',
    primarySoft: 'rgba(255, 181, 71, 0.17)',
    iconFilter: 'sepia(0.84) saturate(1.9) hue-rotate(350deg) brightness(1.06)',
    text: '#fff9ec',
    textSubtle: '#e8d6b9',
    textMuted: '#bda888',
    onAccent: '#281600',
    danger: '#ff7c83',
    warning: '#ffc75c',
    success: '#62d9a6',
    info: '#72d6e6',
    shadow: '0 24px 56px rgba(12, 7, 2, 0.5)',
    headerBackground: 'linear-gradient(135deg, rgba(23, 18, 11, 0.99) 0%, rgba(47, 32, 16, 0.97) 68%, rgba(97, 61, 19, 0.92) 100%)',
  },
  {
    id: 'nebulosa-indigo',
    label: 'Nebulosa Índigo',
    eyebrow: 'Expressão criativa',
    type: 'nebula',
    appearance: 'dark',
    code: '#100D24 · #8B8CFF',
    description: 'Índigo profundo e lavanda fria para um visual autoral, sem excesso de neon.',
    pageBackground: 'radial-gradient(circle at 18% 20%, rgba(139, 140, 255, 0.20) 0%, transparent 35%), radial-gradient(circle at 82% 76%, rgba(38, 216, 229, 0.12) 0%, transparent 34%), linear-gradient(150deg, #100D24 0%, #181331 100%)',
    bg: '#100d24',
    bgSoft: '#17112f',
    surface: 'rgba(26, 21, 53, 0.95)',
    surfaceMuted: 'rgba(34, 28, 68, 0.97)',
    border: 'rgba(170, 162, 235, 0.24)',
    primary: '#a5a6ff',
    primaryStrong: '#26d8e5',
    primarySoft: 'rgba(165, 166, 255, 0.17)',
    iconFilter: 'hue-rotate(34deg) saturate(0.88) brightness(1.08)',
    text: '#faf8ff',
    textSubtle: '#d7d1ed',
    textMuted: '#a59dbf',
    onAccent: '#15133e',
    danger: '#ff7fa3',
    warning: '#ffd372',
    success: '#5ee0b1',
    info: '#70d9ed',
    shadow: '0 24px 58px rgba(7, 4, 24, 0.52)',
    headerBackground: 'linear-gradient(135deg, rgba(16, 13, 36, 0.99) 0%, rgba(35, 28, 76, 0.97) 68%, rgba(48, 45, 105, 0.92) 100%)',
  },
  {
    id: 'lunar-claro',
    label: 'Lunar Claro',
    eyebrow: 'Clareza luminosa',
    type: 'light',
    appearance: 'light',
    code: '#EAF4FA · #006DCC',
    description: 'Uma opção clara e serena, com azul profundo para preservar hierarquia e contraste.',
    pageBackground: 'radial-gradient(circle at 82% 8%, rgba(0, 158, 172, 0.12) 0%, transparent 30%), linear-gradient(150deg, #EAF4FA 0%, #F7FBFD 58%, #DFEDF5 100%)',
    bg: '#eaf4fa',
    bgSoft: '#dfeef6',
    surface: 'rgba(255, 255, 255, 0.96)',
    surfaceMuted: 'rgba(241, 248, 252, 0.98)',
    border: 'rgba(35, 83, 118, 0.20)',
    primary: '#006dcc',
    primaryStrong: '#007f8d',
    primarySoft: 'rgba(0, 109, 204, 0.12)',
    iconFilter: 'saturate(1.12) brightness(0.82) contrast(1.14)',
    text: '#071c33',
    textSubtle: '#263f57',
    textMuted: '#506a80',
    onAccent: '#ffffff',
    danger: '#a82346',
    warning: '#865100',
    success: '#126743',
    info: '#005e9f',
    shadow: '0 20px 44px rgba(24, 57, 81, 0.14)',
    headerBackground: 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(226, 241, 249, 0.98) 68%, rgba(207, 233, 244, 0.96) 100%)',
  },
];
// Text colors are intentionally not user-selectable. Every visual set owns its
// accessible text hierarchy, preventing combinations that compromise reading.

const PLAN_BACKGROUND_THEME_MAP = {
  FREE: {
    label: 'Free',
    shortLabel: 'Free',
    tone: 'info',
    defaultTheme: 'pmp-essencial',
    themeIds: ['pmp-essencial'],
    summary: 'Identidade PMP fixa, legível e consistente para começar.',
  },
  BASIC: {
    label: 'Básico',
    shortLabel: 'Basic',
    tone: 'success',
    defaultTheme: 'orbita-ciano',
    themeIds: ['orbita-ciano', 'eclipse-cobalto', 'aurora-polar', 'horizonte-solar', 'nebulosa-indigo', 'lunar-claro'],
    summary: 'Os seis ambientes PMP completos, com contraste e tipografia coordenados.',
  },
  PRO: {
    label: 'Pro',
    shortLabel: 'Pro',
    tone: 'warning',
    defaultTheme: 'orbita-ciano',
    themeIds: ['orbita-ciano', 'eclipse-cobalto', 'aurora-polar', 'horizonte-solar', 'nebulosa-indigo', 'lunar-claro'],
    summary: 'Os seis ambientes PMP completos, com contraste e tipografia coordenados.',
  },
  PREMIUM: {
    label: 'Premium',
    shortLabel: 'Premium',
    tone: 'warning',
    defaultTheme: 'orbita-ciano',
    themeIds: ['orbita-ciano', 'eclipse-cobalto', 'aurora-polar', 'horizonte-solar', 'nebulosa-indigo', 'lunar-claro'],
    summary: 'Os seis ambientes PMP completos, com contraste e tipografia coordenados.',
  },
};

function readStoredBackgroundTheme() {
  try {
    const value = localStorage.getItem(BACKGROUND_THEME_STORAGE_KEY);
    return BACKGROUND_THEME_OPTIONS.some((option) => option.id === value) ? value : null;
  } catch {
    return null;
  }
}

function getSystemBackgroundTheme() {
  return PLAN_BACKGROUND_THEME_MAP.FREE.defaultTheme;
}

function getDefaultGrowthPreferences() {
  return Object.fromEntries(GROWTH_PREFERENCE_OPTIONS.map((option) => [option.id, true]));
}

function normalizeGrowthPreferences(value) {
  const defaults = getDefaultGrowthPreferences();
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return Object.fromEntries(
    GROWTH_PREFERENCE_OPTIONS.map((option) => [option.id, typeof input[option.id] === 'boolean' ? input[option.id] : defaults[option.id]])
  );
}

function readStoredGrowthPreferences() {
  try {
    return normalizeGrowthPreferences(JSON.parse(localStorage.getItem(GROWTH_PREFERENCES_STORAGE_KEY) || '{}'));
  } catch {
    return getDefaultGrowthPreferences();
  }
}

function writeStoredGrowthPreferences(preferences = state.growthPreferences) {
  const normalized = normalizeGrowthPreferences(preferences);
  state.growthPreferences = normalized;
  try {
    localStorage.setItem(GROWTH_PREFERENCES_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Ignore storage errors in private/sandboxed browsers.
  }
  return normalized;
}

function readPendingOauthProvider() {
  try {
    const value = localStorage.getItem(OAUTH_PROVIDER_STORAGE_KEY);
    return value === 'youtube' || value === 'google' || value === 'tiktok' || value === 'instagram' ? value : null;
  } catch {
    return null;
  }
}

function writePendingOauthProvider(provider) {
  try {
    if (!provider) {
      localStorage.removeItem(OAUTH_PROVIDER_STORAGE_KEY);
      return;
    }
    localStorage.setItem(OAUTH_PROVIDER_STORAGE_KEY, provider);
  } catch {
    // Ignore storage errors in private/sandboxed browsers.
  }
}

function readCampaignReauthReturnProvider() {
  try {
    const value = localStorage.getItem(CAMPAIGN_REAUTH_RETURN_KEY);
    return value === 'youtube' || value === 'tiktok' || value === 'instagram' ? value : null;
  } catch {
    return null;
  }
}

function writeCampaignReauthReturnProvider(provider) {
  try {
    if (!provider) {
      localStorage.removeItem(CAMPAIGN_REAUTH_RETURN_KEY);
      return;
    }
    localStorage.setItem(CAMPAIGN_REAUTH_RETURN_KEY, provider);
  } catch {
    // Ignore storage errors in private/sandboxed browsers.
  }
}

function statusTone(status) {
  const normalized = String(status ?? '').toLowerCase();
  if (['completed', 'publicado', 'connected'].includes(normalized)) return 'success';
  if (['failed', 'erro', 'reauth_required'].includes(normalized)) return 'danger';
  if (['launching', 'enviando', 'ready', 'processing'].includes(normalized)) return 'warning';
  return 'neutral';
}

function statusPill(status) {
  const tone = statusTone(status);
  return `<span class="pill ${tone}">${escapeHtml(status)}</span>`;
}

function buildUrl(path, query = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

async function apiRequest(method, url, body) {
  const init = {
    method,
    credentials: 'include',
    headers: {},
  };

  if (body !== undefined) {
    init.headers['content-type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const response = await fetch(url, init);
  let payload = null;
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    payload = await response.json();
  } else {
    payload = await response.text();
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: payload?.error ?? `Request failed with ${response.status}`,
      body: payload,
    };
  }

  return {
    ok: true,
    status: response.status,
    body: payload,
  };
}

const api = {
  me: () => apiRequest('GET', '/auth/me'),
  login: (credentials) => apiRequest('POST', '/auth/login', credentials),
  register: (payload) => apiRequest('POST', '/auth/register', payload),
  requestPasswordReset: (email) => apiRequest('POST', '/auth/password-reset/request', { email }),
  confirmPasswordReset: (token, newPassword) => apiRequest('POST', '/auth/password-reset/confirm', { token, newPassword }),
  startAuthGoogleOauth: () => apiRequest('GET', '/auth/google/start'),
  authGoogleCallback: (code, stateParam) => apiRequest('GET', buildUrl('/auth/google/callback', { code, state: stateParam })),
  logout: () => apiRequest('POST', '/auth/logout'),
  sendAccountDeletionConfirmation: () => apiRequest('POST', '/auth/account-deletion/challenge'),
  requestAccountDeletion: (confirmation = {}) => apiRequest('POST', '/auth/account-deletion/request', confirmation),
  createServiceRequest: (payload) => apiRequest('POST', '/support/requests', payload),
  trackServiceRequest: (protocol, key) => apiRequest('GET', `/support/requests/${encodeURIComponent(protocol)}?key=${encodeURIComponent(key)}`),
  serviceRequests: () => apiRequest('GET', '/api/service-requests'),
  createAuthenticatedServiceRequest: (payload) => apiRequest('POST', '/api/service-requests', payload),
  accountPlanSummary: () => apiRequest('GET', '/api/account/plan'),
  listPlans: () => apiRequest('GET', '/api/account/plans'),
  selectAccountPlan: (plan) => apiRequest('POST', '/api/account/plan/select', { plan }),
  checkoutPlan: (plan) => apiRequest('POST', '/api/account/plan/checkout', { plan }),
  claimDailyVisit: () => apiRequest('POST', '/api/account/plan/visit'),
  claimMonthlyGrant: () => apiRequest('POST', '/api/account/plan/monthly'),
  listTokenPacks: () => apiRequest('GET', '/api/account/tokens/packs'),
  buyTokenPack: (packId) => apiRequest('POST', '/api/account/tokens/checkout', { packId }),
  markPaymentPaid: (intentId) => apiRequest('POST', `/api/account/payments/${encodeURIComponent(intentId)}/mark-paid`),
  dashboard: () => apiRequest('GET', '/api/dashboard'),
  campaigns: (filters = {}) => apiRequest('GET', buildUrl('/api/campaigns', filters)),
  campaignById: (id) => apiRequest('GET', `/api/campaigns/${encodeURIComponent(id)}`),
  campaignStatus: (id) => apiRequest('GET', `/api/campaigns/${encodeURIComponent(id)}/status`),
  campaignJobs: (id) => apiRequest('GET', `/api/campaigns/${encodeURIComponent(id)}/jobs`),
  campaignAudit: (id) => apiRequest('GET', `/api/campaigns/${encodeURIComponent(id)}/audit`),
  createCampaign: (data) => apiRequest('POST', '/api/campaigns', data),
  updateCampaign: (id, data) => apiRequest('PATCH', `/api/campaigns/${encodeURIComponent(id)}`, data),
  addTarget: (id, data) => apiRequest('POST', `/api/campaigns/${encodeURIComponent(id)}/targets`, data),
  updateTarget: (campaignId, targetId, data) => apiRequest('PATCH', `/api/campaigns/${encodeURIComponent(campaignId)}/targets/${encodeURIComponent(targetId)}`, data),
  removeTarget: (campaignId, targetId) => apiRequest('DELETE', `/api/campaigns/${encodeURIComponent(campaignId)}/targets/${encodeURIComponent(targetId)}`),
  addTargetsBulk: (id, targets) => apiRequest('POST', `/api/campaigns/${encodeURIComponent(id)}/targets/bulk`, { targets }),
  markReady: (id) => apiRequest('POST', `/api/campaigns/${encodeURIComponent(id)}/ready`),
  launch: (id) => apiRequest('POST', `/api/campaigns/${encodeURIComponent(id)}/launch`),
  clone: (id, title) => apiRequest('POST', `/api/campaigns/${encodeURIComponent(id)}/clone`, title ? { title } : undefined),
  deleteCampaign: (id) => apiRequest('DELETE', `/api/campaigns/${encodeURIComponent(id)}`),
  retryTarget: (campaignId, targetId) => apiRequest('POST', `/api/campaigns/${encodeURIComponent(campaignId)}/targets/${encodeURIComponent(targetId)}/retry`),
  campaignReauthRequired: () => apiRequest('GET', '/api/campaigns/reauth-required'),
  retryReauthRequired: () => apiRequest('POST', '/api/campaigns/reauth-required/retry'),
  accounts: () => apiRequest('GET', '/api/accounts'),
  startGoogleOauth: () => apiRequest('GET', '/api/accounts/oauth/google/start'),
  startYouTubeOauth: () => apiRequest('GET', '/api/accounts/oauth/youtube/start'),
  startTikTokOauth: () => apiRequest('GET', '/api/accounts/oauth/tiktok/start'),
  startInstagramOauth: () => apiRequest('GET', '/api/accounts/oauth/instagram/start'),
  accountOauthCallback: (code, stateParam) => apiRequest('GET', buildUrl('/api/accounts/oauth/google/callback', { code, state: stateParam })),
  accountYouTubeOauthCallback: (code, stateParam) => apiRequest('GET', buildUrl('/api/accounts/oauth/youtube/callback', { code, state: stateParam })),
  accountTikTokOauthCallback: (code, stateParam) => apiRequest('GET', buildUrl('/api/accounts/oauth/tiktok/callback', { code, state: stateParam })),
  accountInstagramOauthCallback: (code, stateParam) => apiRequest('GET', buildUrl('/api/accounts/oauth/instagram/callback', { code, state: stateParam })),
  generateGrowthScript: (payload) => apiRequest('POST', '/api/growth/script/generate', payload),
  accountChannels: (accountId) => apiRequest('GET', `/api/accounts/${encodeURIComponent(accountId)}/channels`),
  syncAccountChannels: (accountId) => apiRequest('POST', `/api/accounts/${encodeURIComponent(accountId)}/channels/sync`),
  toggleChannel: (accountId, channelId, isActive) => apiRequest('PATCH', `/api/accounts/${encodeURIComponent(accountId)}/channels/${encodeURIComponent(channelId)}`, { isActive }),
  disconnectAccount: (accountId) => apiRequest('DELETE', `/api/accounts/${encodeURIComponent(accountId)}`, { confirm: 'DISCONNECT' }),
  deleteAccount: (accountId) => apiRequest('DELETE', `/api/accounts/${encodeURIComponent(accountId)}/permanent`, { confirm: 'DELETE' }),
  media: () => apiRequest('GET', '/api/media'),
  uploadMedia: (payload) => apiRequest('POST', '/api/media', payload),
  updateMediaDuration: (id, durationSeconds) => apiRequest('PATCH', `/api/media/${encodeURIComponent(id)}`, { durationSeconds }),
  deleteMedia: (id) => apiRequest('DELETE', `/api/media/${encodeURIComponent(id)}`),
  // Playlist
  playlists: () => apiRequest('GET', '/api/playlists'),
  getPlaylist: (id) => apiRequest('GET', `/api/playlists/${encodeURIComponent(id)}`),
  createPlaylist: (name, folderPath) => apiRequest('POST', '/api/playlists', { name, folderPath }),
  deletePlaylist: (id) => apiRequest('DELETE', `/api/playlists/${encodeURIComponent(id)}`),
  scanFolderForPlaylists: (rootPath) => apiRequest('POST', '/api/playlists/scan', { rootPath }),
  addPlaylistItem: (playlistId, videoAssetId) => apiRequest('POST', `/api/playlists/${encodeURIComponent(playlistId)}/items`, { videoAssetId }),
  removePlaylistItem: (playlistId, videoAssetId) => apiRequest('DELETE', `/api/playlists/${encodeURIComponent(playlistId)}/items/${encodeURIComponent(videoAssetId)}`),
  nextPlaylistVideo: (playlistId) => apiRequest('GET', `/api/playlists/${encodeURIComponent(playlistId)}/next`),
  // Presets
  getPreset: (videoAssetId) => apiRequest('GET', `/api/media/${encodeURIComponent(videoAssetId)}/preset`),
  upsertPreset: (videoAssetId, data) => apiRequest('PUT', `/api/media/${encodeURIComponent(videoAssetId)}/preset`, data),
  deletePreset: (videoAssetId) => apiRequest('DELETE', `/api/media/${encodeURIComponent(videoAssetId)}/preset`),
};

const state = {
  locale: readInitialLocale(),
  me: null,
  account: null,
  routeInFlight: false,
  rerenderQueued: false,
  backgroundTheme: readStoredBackgroundTheme() ?? getSystemBackgroundTheme(),
  theme: 'light',
  mediaPreviewSizes: readStoredMediaPreviewSizes(),
  growthPreferences: readStoredGrowthPreferences(),
  growthConnectedAccounts: [],
  growthChannelLoadId: 0,
  growthWorkspaceData: null,
  growthMetricFilters: { date: 'all', platform: 'all' },
  mediaDurationBackfillInFlight: new Set(),
  uiNotice: null,
  autoRefreshTimer: null,
  dashboardClockTimer: null,
  pulseRotateTimer: null,
};

function applyBackgroundTheme(backgroundThemeId) {
  const selectedTheme = BACKGROUND_THEME_OPTIONS.find((option) => option.id === backgroundThemeId) ?? BACKGROUND_THEME_OPTIONS[0];
  state.backgroundTheme = selectedTheme.id;
  state.theme = selectedTheme.appearance;
  document.body.setAttribute('data-theme', selectedTheme.appearance);
  document.body.setAttribute('data-background-theme', selectedTheme.id);
  document.body.style.colorScheme = selectedTheme.appearance;
  document.body.style.setProperty('--page-background', selectedTheme.pageBackground);
  document.body.style.setProperty('--bg', selectedTheme.bg);
  document.body.style.setProperty('--bg-soft', selectedTheme.bgSoft);
  document.body.style.setProperty('--surface', selectedTheme.surface);
  document.body.style.setProperty('--surface-muted', selectedTheme.surfaceMuted);
  document.body.style.setProperty('--surface-alt', selectedTheme.surfaceMuted);
  document.body.style.setProperty('--border', selectedTheme.border);
  document.body.style.setProperty('--border-strong', hexToRgba(selectedTheme.primary, selectedTheme.appearance === 'dark' ? 0.38 : 0.30));
  document.body.style.setProperty('--primary', selectedTheme.primary);
  document.body.style.setProperty('--primary-strong', selectedTheme.primaryStrong);
  document.body.style.setProperty('--primary-soft', selectedTheme.primarySoft);
  document.body.style.setProperty('--theme-icon-filter', selectedTheme.iconFilter ?? 'saturate(1)');
  document.body.style.setProperty('--danger', selectedTheme.danger);
  document.body.style.setProperty('--danger-soft', hexToRgba(selectedTheme.danger, selectedTheme.appearance === 'dark' ? 0.16 : 0.12));
  document.body.style.setProperty('--warning', selectedTheme.warning);
  document.body.style.setProperty('--warning-soft', hexToRgba(selectedTheme.warning, selectedTheme.appearance === 'dark' ? 0.16 : 0.13));
  document.body.style.setProperty('--success', selectedTheme.success);
  document.body.style.setProperty('--success-soft', hexToRgba(selectedTheme.success, selectedTheme.appearance === 'dark' ? 0.16 : 0.12));
  document.body.style.setProperty('--info', selectedTheme.info);
  document.body.style.setProperty('--info-soft', hexToRgba(selectedTheme.info, selectedTheme.appearance === 'dark' ? 0.16 : 0.12));
  document.body.style.setProperty('--shadow', selectedTheme.shadow);
  document.body.style.setProperty('--header-background', selectedTheme.headerBackground);
  document.body.style.setProperty('--text', selectedTheme.text);
  document.body.style.setProperty('--text-subtle', selectedTheme.textSubtle);
  document.body.style.setProperty('--text-muted', selectedTheme.textMuted);
  document.body.style.setProperty('--text-on-accent', selectedTheme.onAccent);
  document.body.style.setProperty('--header-text', selectedTheme.text);
  try {
    localStorage.setItem(BACKGROUND_THEME_STORAGE_KEY, selectedTheme.id);
  } catch {
    // noop: storage can be unavailable in hardened browser contexts
  }
}

function normalizeAccountPlanId(planId) {
  const normalized = String(planId ?? '').trim().toUpperCase();
  return PLAN_BACKGROUND_THEME_MAP[normalized] ? normalized : 'FREE';
}

function getCurrentAccountPlanId() {
  return normalizeAccountPlanId(state.account?.plan ?? state.account?.planCode ?? state.account?.planLabel);
}

function getPlanVisualConfig(planId = getCurrentAccountPlanId()) {
  return PLAN_BACKGROUND_THEME_MAP[normalizeAccountPlanId(planId)] ?? PLAN_BACKGROUND_THEME_MAP.FREE;
}

function getBackgroundThemeOption(themeId) {
  return BACKGROUND_THEME_OPTIONS.find((option) => option.id === themeId) ?? null;
}

function getPlanBackgroundThemeIds(planId = getCurrentAccountPlanId(), options = {}) {
  const normalizedPlanId = normalizeAccountPlanId(planId);
  return (PLAN_BACKGROUND_THEME_MAP[normalizedPlanId]?.themeIds ?? [])
    .filter((themeId) => Boolean(getBackgroundThemeOption(themeId)));
}

function isBackgroundThemeAvailableForPlan(themeId, planId = getCurrentAccountPlanId()) {
  return getPlanBackgroundThemeIds(planId).includes(themeId);
}

function getPlanBackgroundThemes(planId = getCurrentAccountPlanId(), options = {}) {
  const normalizedPlanId = normalizeAccountPlanId(planId);
  const themes = getPlanBackgroundThemeIds(normalizedPlanId, options)
    .map((id) => getBackgroundThemeOption(id))
    .filter(Boolean);
  const selectedTheme = getSelectedBackgroundTheme();
  const canIncludeSelected = options.includeSelected === true
    && selectedTheme
    && isBackgroundThemeAvailableForPlan(selectedTheme.id, normalizedPlanId);
  if (canIncludeSelected && !themes.some((theme) => theme.id === selectedTheme.id)) {
    themes.unshift(selectedTheme);
  }
  return themes;
}

function ensurePlanCompatibleBackground(planId = getCurrentAccountPlanId()) {
  const normalizedPlanId = normalizeAccountPlanId(planId);
  if (isBackgroundThemeAvailableForPlan(state.backgroundTheme, normalizedPlanId)) {
    return false;
  }

  const config = getPlanVisualConfig(normalizedPlanId);
  const fallbackThemeId = config.defaultTheme
    ?? getPlanBackgroundThemeIds(normalizedPlanId)[0]
    ?? BACKGROUND_THEME_OPTIONS[0]?.id;
  if (fallbackThemeId) {
    applyBackgroundTheme(fallbackThemeId);
  }
  return true;
}

function applyRecommendedBackgroundForPlan(planId) {
  const config = getPlanVisualConfig(planId);
  if (config.defaultTheme && state.backgroundTheme !== config.defaultTheme) {
    applyBackgroundTheme(config.defaultTheme);
  }
}

function isValidMediaPreviewSize(value) {
  return MEDIA_PREVIEW_SIZE_OPTIONS.some((option) => option.id === value);
}

function readStoredMediaPreviewSizes() {
  try {
    const raw = localStorage.getItem(MEDIA_PREVIEW_SIZE_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).filter((entry) => typeof entry[0] === 'string' && isValidMediaPreviewSize(entry[1])),
    );
  } catch {
    return {};
  }
}

function writeStoredMediaPreviewSizes(previewSizes) {
  try {
    localStorage.setItem(MEDIA_PREVIEW_SIZE_STORAGE_KEY, JSON.stringify(previewSizes));
  } catch {
    // Ignore storage errors in private/sandboxed browsers.
  }
}

function getMediaPreviewSizeLabel(previewSize) {
  return MEDIA_PREVIEW_SIZE_OPTIONS.find((option) => option.id === previewSize)?.label ?? 'Medio';
}

function getMediaPreviewSizeForAsset(assetId) {
  return state.mediaPreviewSizes[assetId] ?? DEFAULT_MEDIA_PREVIEW_SIZE;
}

function updateMediaPreviewSize(assetId, previewSize) {
  if (!assetId || !isValidMediaPreviewSize(previewSize)) {
    return;
  }

  state.mediaPreviewSizes = {
    ...state.mediaPreviewSizes,
    [assetId]: previewSize,
  };
  writeStoredMediaPreviewSizes(state.mediaPreviewSizes);
}

function renderLanguageOptionButtons(extraClass = '') {
  const extraClasses = extraClass ? `${extraClass} ` : '';
  return [
    { locale: 'pt-BR', label: 'Português', shortLabel: 'PT' },
    { locale: 'en', label: 'English', shortLabel: 'EN' },
  ].map((option) => `
    <button
      type="button"
      class="font-theme-button language-option-button ${extraClasses}${state.locale === option.locale ? 'active' : ''}"
      data-locale-option="${option.locale}"
      aria-pressed="${state.locale === option.locale ? 'true' : 'false'}"
      title="${escapeHtml(option.label)}"
    >
      <span class="color-swatch language-swatch" aria-hidden="true">${escapeHtml(option.shortLabel)}</span>
      <span class="color-label">${escapeHtml(option.label)}</span>
    </button>
  `).join('');
}

function isPaidVisualPlan(planId = getCurrentAccountPlanId()) {
  return normalizeAccountPlanId(planId) !== 'FREE';
}

function renderThemePalette(option) {
  return `
    <span class="theme-palette" aria-label="Paleta coordenada do tema">
      <i style="--swatch:${escapeAttribute(option.bg)}"></i>
      <i style="--swatch:${escapeAttribute(option.surfaceMuted)}"></i>
      <i style="--swatch:${escapeAttribute(option.primary)}"></i>
      <i style="--swatch:${escapeAttribute(option.text)}"></i>
    </span>
  `;
}

function renderCompactPlanThemeButtons(planId = getCurrentAccountPlanId(), limit = Number.POSITIVE_INFINITY) {
  const normalizedPlanId = normalizeAccountPlanId(planId);
  const themes = getPlanBackgroundThemes(normalizedPlanId);

  const maxItems = Number.isFinite(limit) ? limit : themes.length;
  return themes.slice(0, maxItems).map((option) => {
    const selectedClass = option.id === state.backgroundTheme ? ' selected' : '';
    return `
      <button
        type="button"
        class="style-preset-button${selectedClass}"
        data-background-theme-option="${option.id}"
        aria-pressed="${option.id === state.backgroundTheme ? 'true' : 'false'}"
        style="--background-preview:${escapeAttribute(option.pageBackground)}; --preset-accent:${escapeAttribute(option.primary)}; --preview-text:${escapeAttribute(option.text)};"
      >
        <span class="style-preset-preview" aria-hidden="true"></span>
        <span class="style-preset-body">
          <strong>${escapeHtml(option.label)}</strong>
          <small>${escapeHtml(option.eyebrow)} · contraste automático</small>
        </span>
      </button>
    `;
  }).join('');
}

function renderPlanBackgroundCards(planId = getCurrentAccountPlanId()) {
  const normalizedPlanId = normalizeAccountPlanId(planId);
  const paid = isPaidVisualPlan(normalizedPlanId);
  const freeTheme = getBackgroundThemeOption(PLAN_BACKGROUND_THEME_MAP.FREE.defaultTheme);
  const premiumThemes = PLAN_BACKGROUND_THEME_MAP.BASIC.themeIds
    .map((themeId) => getBackgroundThemeOption(themeId))
    .filter(Boolean);
  const themes = paid ? premiumThemes : [freeTheme, ...premiumThemes].filter(Boolean);

  return themes.map((option) => {
    const locked = !paid && option.id !== PLAN_BACKGROUND_THEME_MAP.FREE.defaultTheme;
    const selectedClass = option.id === state.backgroundTheme ? ' selected' : '';
    const lockedClass = locked ? ' locked' : '';
    return `
      <button
        type="button"
        class="background-card plan-background-card${selectedClass}${lockedClass}"
        ${locked ? `data-theme-locked="${option.id}" aria-disabled="true"` : `data-background-theme-option="${option.id}"`}
        aria-pressed="${option.id === state.backgroundTheme ? 'true' : 'false'}"
        style="--background-preview:${escapeAttribute(option.pageBackground)}; --preset-accent:${escapeAttribute(option.primary)}; --preview-text:${escapeAttribute(option.text)};"
      >
        <span class="background-card-preview" aria-hidden="true">
          <span class="theme-preview-window"><i></i><i></i><i></i></span>
          ${locked ? '<span class="theme-lock-badge">Plano pago</span>' : ''}
        </span>
        <span class="background-card-body">
          <span class="settings-card-title-row">
            <strong>${escapeHtml(option.label)}</strong>
            <span class="pill ${locked ? 'warning' : 'info'}">${locked ? 'Bloqueado' : (paid ? 'Incluído' : 'Padrão')}</span>
          </span>
          <span class="background-card-type">${escapeHtml(option.eyebrow)} · ${escapeHtml(option.code)}</span>
          <small>${escapeHtml(option.description)}</small>
          ${renderThemePalette(option)}
        </span>
      </button>
    `;
  }).join('');
}

const SETTINGS_MARK_ARTWORK = {
  ACC: '/assets/icons/ACC_contas_vinculadas.svg',
  BG: '/assets/icons/PMP_BG_Aparencia.svg',
  CFG: '/assets/icons/CFG_configuracoes.svg',
  CTA: '/assets/icons/CTA_atalhos_conta.svg',
  EU: '/assets/icons/EU_usuario.svg',
  IDI: '/assets/icons/IDI_idioma.svg',
  OK: '/assets/icons/OK_check.svg',
  PRO: '/assets/icons/PRO_cadeado_coroa.svg',
  RES: '/assets/icons/PMP_RES_Preferencias_Salvas.svg',
  RISCO: '/assets/icons/RISCO_lixeira_alerta.svg',
  TOK: '/assets/icons/TOK_token_raio.svg',
  VIS: '/assets/icons/PMP_VIS_Visibilidade.svg',
};

const CAMPAIGN_MARK_ARTWORK = {
  ACC: '/assets/icons/ACC_contas_vinculadas.svg',
  AT: '/assets/icons/AT_atividade.svg',
  AUTO: '/assets/icons/AUTO_automacao_playlist.svg',
  AU: '/assets/icons/AU_chave_reconectar.svg',
  AUTH: '/assets/icons/AUTH_escudo_autenticacao.svg',
  CAN: '/assets/icons/CAN_canais_ativos.svg',
  COTA: '/assets/icons/COTA_medidor_api.svg',
  CP: '/assets/icons/CP_campanhas.svg',
  'D+': '/assets/icons/D+_calendario_futuro.svg',
  DN: '/assets/icons/DN_queda.svg',
  ER: '/assets/icons/ER_erro.svg',
  FILA: '/assets/icons/FILA_fila_campanhas.svg',
  FOCO: '/assets/icons/FOCO_alvo.svg',
  HJ: '/assets/icons/HJ_hoje.svg',
  MID: '/assets/icons/MID_arquivo_video.svg',
  NEW: '/assets/icons/NEW_adicionar.svg',
  NOVO: '/assets/icons/NOVO_nova_campanha.svg',
  OK: '/assets/icons/OK_sucesso.svg',
  PE: '/assets/icons/PE_pendente.svg',
  PR: '/assets/icons/PR_pronta.svg',
  PUB: '/assets/icons/PUB_publicacao.svg',
  RA: '/assets/icons/RA_rascunho.svg',
  SP: '/assets/icons/SP_sem_plataforma.svg',
  ST: '/assets/icons/ST_estado_generico.svg',
  SYNC: '/assets/icons/SYNC_sincronizacao.svg',
  UP: '/assets/icons/UP_crescimento.svg',
  VIS: '/assets/icons/VIS_olho.svg',
  FL: '/assets/icons/FL_enviando.svg',
};

const CAMPAIGN_PLATFORM_ARTWORK = {
  instagram: '/assets/icons/IG_instagram.svg',
  tiktok: '/assets/icons/TT_tiktok.svg',
  youtube: '/assets/icons/YT_youtube.svg',
};

function renderSettingsMark(label = 'PMP', tone = 'info', className = '') {
  const fullLabel = String(label ?? 'PMP').trim().toUpperCase() || 'PMP';
  const safeLabel = fullLabel.slice(0, 4);
  const artworkSrc = SETTINGS_MARK_ARTWORK[fullLabel] ?? SETTINGS_MARK_ARTWORK[safeLabel] ?? '';
  const classes = [
    'settings-mark',
    safeLabel === 'PMP' ? 'settings-mark-pmp-logo' : '',
    artworkSrc ? 'settings-mark-artwork' : '',
    className,
  ].filter(Boolean).join(' ');
  return `
    <span class="${escapeAttribute(classes)}" data-tone="${escapeAttribute(tone)}" aria-hidden="true">
      ${artworkSrc
        ? `<img class="settings-mark-artwork-image" src="${escapeAttribute(artworkSrc)}" alt="" decoding="async" draggable="false" />`
        : escapeHtml(safeLabel)}
    </span>
  `;
}

function getAccountDeletionSchedule() {
  return state.me?.accountDeletion ?? null;
}

function getAccountDeletionConfirmationMethod() {
  return state.me?.accountDeletionConfirmationMethod === 'email_code' ? 'email_code' : 'password';
}

function getAccountDeletionConfirmationCopy(method = getAccountDeletionConfirmationMethod()) {
  if (method === 'email_code') {
    return {
      short: 'Codigo no e-mail',
      panel: 'Esta conta confirma a exclusao por codigo enviado ao e-mail da conta.',
      detail: 'Enviaremos um codigo de 6 digitos para o e-mail da conta. O codigo expira em 10 minutos.',
    };
  }

  return {
    short: 'Senha atual',
    panel: 'Esta conta confirma a exclusao com a senha atual.',
    detail: 'Digite sua senha atual para provar que voce controla esta sessao antes de agendar a exclusao.',
  };
}

function renderAccountDeletionPanel(options = {}) {
  const schedule = getAccountDeletionSchedule();
  const confirmationCopy = getAccountDeletionConfirmationCopy();
  const compactClass = options.compact ? ' settings-deletion-card-compact' : '';
  const scheduled = Boolean(schedule);
  const statusLabel = schedule?.status === 'deactivated_pending_deletion'
    ? 'Conta em desativacao'
    : scheduled
      ? 'Solicitacao registrada'
      : 'Nao solicitado';
  const timelineItems = scheduled
    ? [
        { label: 'Solicitado', value: formatDate(schedule.requestedAt) },
        { label: 'Desativacao', value: formatDate(schedule.deactivationAt) },
        { label: 'Exclusao definitiva', value: formatDate(schedule.deletionAt) },
      ]
    : [
        { label: 'Confirmacao', value: confirmationCopy.short },
        { label: 'Depois de 24h', value: 'Conta fica desativada' },
        { label: 'Ate 30 dias', value: 'Dados removidos dos sistemas' },
      ];

  return `
    <article class="settings-deletion-card${compactClass}">
      <div class="settings-deletion-head">
        ${renderSettingsMark('RISCO', 'danger', 'settings-deletion-mark')}
        <div>
          <span class="settings-hub-kicker">Zona de risco</span>
          <h3>Exclusao da conta</h3>
          <p class="muted">A conta nao e deletada na hora: ela permanece ativa por 24 horas, depois fica desativada, e a exclusao completa das informacoes ocorre em ate 30 dias. ${escapeHtml(confirmationCopy.panel)}</p>
        </div>
        <span class="pill ${scheduled ? 'warning' : 'info'}">${escapeHtml(statusLabel)}</span>
      </div>
      <div class="settings-deletion-timeline" aria-label="Cronograma de exclusao">
        ${timelineItems.map((item) => `
          <div>
            <span>${escapeHtml(item.label)}</span>
            <strong>${escapeHtml(item.value)}</strong>
          </div>
        `).join('')}
      </div>
      ${scheduled
        ? '<div class="notice warning">Solicitacao registrada. Se precisar interromper o processo, entre em contato antes da janela de exclusao definitiva.</div>'
        : `
          <div class="settings-deletion-actions">
            <button class="button button-danger" type="button" data-action="request-account-deletion">Solicitar exclusao da conta</button>
            <a class="button button-secondary" href="mailto:PlataformMultiPublisher@gmail.com">Falar com suporte</a>
          </div>
        `}
    </article>
  `;
}

function bindAccountDeletionRequest() {
  document.querySelectorAll('[data-action="request-account-deletion"]').forEach((button) => {
    button.addEventListener('click', async () => {
      let errorMessage = '';

      while (true) {
        const confirmation = await showAccountDeletionConfirmationModal({ errorMessage });
        if (!confirmation) return;

        setButtonBusy(button, true, 'Registrando...');
        const result = await api.requestAccountDeletion(confirmation);
        setButtonBusy(button, false);

        if (!result.ok) {
          if (result.status === 401) {
            errorMessage = result.error || 'Confirmacao invalida. Revise os dados e tente novamente.';
            continue;
          }
          setUiNotice('error', 'Nao foi possivel solicitar exclusao', result.error || 'Tente novamente em alguns instantes.');
          return;
        }

        state.me = {
          ...(state.me ?? {}),
          accountDeletion: result.body?.accountDeletion ?? state.me?.accountDeletion ?? null,
        };
        setUiNotice('warning', 'Exclusao agendada', 'A conta segue ativa por 24 horas e depois sera desativada. A exclusao completa ocorre em ate 30 dias.');
        void renderRoute();
        return;
      }
    });
  });
}

async function showAccountDeletionConfirmationModal({ errorMessage = '' } = {}) {
  const method = getAccountDeletionConfirmationMethod();
  return method === 'email_code'
    ? showAccountDeletionEmailCodeModal({ errorMessage })
    : showAccountDeletionPasswordModal({ errorMessage });
}

async function showAccountDeletionPasswordModal({ errorMessage = '' } = {}) {
  const confirmationCopy = getAccountDeletionConfirmationCopy('password');
  const result = await showModal({
    title: 'Confirmar exclusao da conta',
    message: `${confirmationCopy.detail} A conta fica ativa por 24 horas, depois e desativada, e os dados aplicaveis sao removidos em ate 30 dias.`,
    fields: [
      {
        name: 'currentPassword',
        label: 'Senha atual',
        type: 'password',
        required: true,
        placeholder: 'Digite sua senha atual',
        autocomplete: 'current-password',
      },
    ],
    bodyHtml: renderAccountDeletionModalBody(errorMessage),
    confirmLabel: 'Confirmar exclusao',
    cancelLabel: 'Cancelar',
    tone: 'danger',
    cardClassName: 'account-deletion-modal-card',
  });
  const currentPassword = typeof result?.currentPassword === 'string' ? result.currentPassword : '';
  return currentPassword.trim() ? { currentPassword } : null;
}

async function showAccountDeletionEmailCodeModal({ errorMessage = '' } = {}) {
  const confirmationCopy = getAccountDeletionConfirmationCopy('email_code');
  const shouldSendCode = await showModal({
    title: 'Enviar codigo de exclusao',
    message: confirmationCopy.detail,
    bodyHtml: renderAccountDeletionModalBody(errorMessage || 'Depois de enviar, mantenha esta tela aberta e use o codigo recebido para confirmar.'),
    confirmLabel: 'Enviar codigo',
    cancelLabel: 'Cancelar',
    tone: 'danger',
    cardClassName: 'account-deletion-modal-card',
  });
  if (!shouldSendCode) return null;

  const challenge = await api.sendAccountDeletionConfirmation();
  if (!challenge.ok) {
    if (challenge.status === 401) {
      unauthorizedRedirect();
      return null;
    }
    setUiNotice('error', 'Nao foi possivel enviar o codigo', challenge.error || 'Tente novamente em alguns instantes.');
    return null;
  }

  const expiresAt = challenge.body?.expiresAt ? formatDate(challenge.body.expiresAt) : 'em 10 minutos';
  const result = await showModal({
    title: 'Digite o codigo recebido',
    message: `Enviamos um codigo de 6 digitos para ${state.me?.email || 'o e-mail da conta'}. Ele expira ${expiresAt}.`,
    fields: [
      {
        name: 'confirmationCode',
        label: 'Codigo de 6 digitos',
        type: 'text',
        required: true,
        placeholder: '000000',
        autocomplete: 'one-time-code',
        inputMode: 'numeric',
        maxLength: 6,
        pattern: '\\d{6}',
      },
    ],
    bodyHtml: renderAccountDeletionModalBody('Se o codigo falhar, enviaremos um novo codigo para proteger a conta.'),
    confirmLabel: 'Confirmar exclusao',
    cancelLabel: 'Cancelar',
    tone: 'danger',
    cardClassName: 'account-deletion-modal-card',
  });
  const confirmationCode = typeof result?.confirmationCode === 'string' ? result.confirmationCode.trim() : '';
  return confirmationCode ? { confirmationCode } : null;
}

function renderAccountDeletionModalBody(message = '') {
  const errorHtml = message
    ? `<div class="account-deletion-modal-alert">${escapeHtml(message)}</div>`
    : '';
  return `
    <div class="account-deletion-modal-brief">
      <span>24h ativa</span>
      <span>Depois desativada</span>
      <span>30 dias para remover dados</span>
    </div>
    ${errorHtml}
  `;
}

function settingsPickerHtml(prefix) {
  const selectedTheme = getSelectedBackgroundTheme();
  const planId = getCurrentAccountPlanId();
  const planConfig = getPlanVisualConfig(planId);
  const unlockedBackgroundCount = getPlanBackgroundThemeIds(planId).length;
  const cardsHtml = renderCompactPlanThemeButtons(planId);
  const languageOptionsHtml = renderLanguageOptionButtons();

  return `
    <details class="settings-picker compact-settings">
      <summary class="theme-toggle-btn" aria-label="Abrir configurações">
        <span class="header-control-icon">${renderSettingsMark('CFG', 'info', 'settings-picker-mark')}</span>
        <span class="theme-toggle-copy">
          <span class="theme-toggle-label">Configurações</span>
          <span class="background-picker-current">${escapeHtml(selectedTheme.label)}</span>
        </span>
      </summary>
      <div class="settings-panel settings-panel-compact">
        <div
          class="settings-preview-card settings-preview-card-plan"
          style="--background-preview:${escapeAttribute(selectedTheme.pageBackground)}; --preset-accent:${escapeAttribute(selectedTheme.primary)}; --text-preview:${escapeAttribute(selectedTheme.text)};"
        >
          <span>Ambiente visual coordenado</span>
          <strong>${escapeHtml(selectedTheme.label)}</strong>
          <small>${escapeHtml(planConfig.label)} · texto e contraste automáticos</small>
        </div>
        <div class="settings-panel-actions">
          <a class="settings-panel-action" data-link href="/workspace/configuracoes">
            ${renderSettingsMark('CFG', 'info', 'settings-panel-mark')}
            <span>
              <strong>Abrir configurações</strong>
              <small>Perfil, idioma e plataforma</small>
            </span>
          </a>
          <a class="settings-panel-action" data-link href="/workspace/perfil">
            ${renderSettingsMark('EU', 'success', 'settings-panel-mark')}
            <span>
              <strong>Meu perfil</strong>
              <small>Conta e preferências</small>
            </span>
          </a>
        </div>
        <div class="settings-section">
          <div class="settings-section-header">
            <strong>${isPaidVisualPlan(planId) ? 'Seus ambientes visuais' : 'Tema do plano gratuito'}</strong>
            <span class="muted">${unlockedBackgroundCount} ${unlockedBackgroundCount === 1 ? 'set' : 'sets'}</span>
          </div>
          <div class="style-preset-grid style-preset-grid-plan">
            ${cardsHtml}
          </div>
        </div>
        <div class="settings-section">
          <div class="settings-section-header">
            <strong>Idioma</strong>
            <span class="muted">Português / English</span>
          </div>
          <div class="font-theme-grid font-theme-grid-compact language-grid">
            ${languageOptionsHtml}
          </div>
        </div>
      </div>
    </details>
  `;
}

function hexToRgba(hex, alpha) {
  const normalized = String(hex ?? '').replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return `rgba(15, 23, 42, ${alpha})`;
  }
  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function clearAutoRefreshTimer() {
  if (state.autoRefreshTimer) {
    clearTimeout(state.autoRefreshTimer);
    state.autoRefreshTimer = null;
  }
}

function clearDashboardClockTimer() {
  if (state.dashboardClockTimer) {
    clearInterval(state.dashboardClockTimer);
    state.dashboardClockTimer = null;
  }
}

const DASHBOARD_AUTO_REFRESH_MS = 12000;
const DASHBOARD_AUTO_REFRESH_RETRY_MS = 3000;

function scheduleDashboardAutoRefresh({ delayMs = DASHBOARD_AUTO_REFRESH_MS, protectPlaylistPlayer = true } = {}) {
  clearAutoRefreshTimer();
  state.autoRefreshTimer = setTimeout(() => {
    state.autoRefreshTimer = null;
    if (window.location.pathname !== '/workspace/dashboard') return;
    if (typeof document !== 'undefined' && document.hidden) {
      scheduleDashboardAutoRefresh({ delayMs: DASHBOARD_AUTO_REFRESH_RETRY_MS, protectPlaylistPlayer });
      return;
    }
    if (protectPlaylistPlayer && isDashboardPlaylistPlayerProtected()) {
      scheduleDashboardAutoRefresh({ delayMs: DASHBOARD_AUTO_REFRESH_RETRY_MS, protectPlaylistPlayer });
      return;
    }
    void renderPlatformDashboardPage();
  }, delayMs);
}

function clearPulseRotateTimer() {
  if (state.pulseRotateTimer) {
    clearInterval(state.pulseRotateTimer);
    state.pulseRotateTimer = null;
  }
}

function setUiNotice(tone, title, message) {
  state.uiNotice = { tone: tone || 'info', title: title || '', message: message || '' };
}

function clearUiNotice() {
  state.uiNotice = null;
}

function renderUiNotice() {
  if (!state.uiNotice) return '';
  return `
    <div class="notice ${escapeHtml(state.uiNotice.tone)} dismissible-notice">
      <div class="stack">
        ${state.uiNotice.title ? `<h4>${escapeHtml(state.uiNotice.title)}</h4>` : ''}
        ${state.uiNotice.message ? `<p>${escapeHtml(state.uiNotice.message)}</p>` : ''}
      </div>
      <button class="button button-secondary notice-dismiss-btn" type="button" data-action="dismiss-ui-notice">Dismiss</button>
    </div>
  `;
}

function bindUiNoticeDismiss() {
  document.querySelector('[data-action="dismiss-ui-notice"]')?.addEventListener('click', () => {
    clearUiNotice();
    void renderRoute();
  });
}

function setButtonBusy(button, busy, busyLabel = 'Working...') {
  if (!(button instanceof HTMLButtonElement)) return;
  if (busy) {
    if (!button.dataset.originalLabel) {
      button.dataset.originalLabel = button.textContent ?? '';
    }
    button.textContent = busyLabel;
    button.disabled = true;
    return;
  }
  if (button.dataset.originalLabel) {
    button.textContent = button.dataset.originalLabel;
  }
  button.disabled = false;
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('`', '&#96;');
}

function showModal({
  title,
  message = '',
  fields = [],
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'info',
  bodyHtml = '',
  cardClassName = '',
}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'app-modal-backdrop';
    const showCancelButton = typeof cancelLabel === 'string' && cancelLabel.trim().length > 0;
    const showConfirmButton = typeof confirmLabel === 'string' && confirmLabel.trim().length > 0;
    const confirmButtonClass = tone === 'danger' || tone === 'error' ? 'button button-danger' : 'button button-primary';
    const actionsHtml = showCancelButton || showConfirmButton
      ? `
        <div class="inline-actions modal-actions">
          ${showCancelButton ? `<button class="button button-secondary" type="button" data-role="modal-cancel">${escapeHtml(cancelLabel)}</button>` : ''}
          ${showConfirmButton ? `<button class="${confirmButtonClass}" type="submit" data-role="modal-confirm">${escapeHtml(confirmLabel)}</button>` : ''}
        </div>
      `
      : '';
    const fieldsHtml = fields.map((field) => {
      const value = field.value ?? '';
      if (field.type === 'textarea') {
        return `
          <label class="modal-field">
            <span>${escapeHtml(field.label)}</span>
            <textarea name="${escapeAttribute(field.name)}" ${field.required ? 'required' : ''} placeholder="${escapeAttribute(field.placeholder ?? '')}">${escapeHtml(value)}</textarea>
          </label>
        `;
      }
      if (field.type === 'select') {
        const optionsHtml = (field.options ?? []).map((opt) => {
          const optVal = typeof opt === 'string' ? opt : opt.value;
          const optLabel = typeof opt === 'string' ? opt : (opt.label ?? opt.value);
          return `<option value="${escapeAttribute(optVal)}" ${optVal === value ? 'selected' : ''}>${escapeHtml(optLabel)}</option>`;
        }).join('');
        return `
          <label class="modal-field">
            <span>${escapeHtml(field.label)}</span>
            <select name="${escapeAttribute(field.name)}" ${field.required ? 'required' : ''}>${optionsHtml}</select>
          </label>
        `;
      }
      return `
        <label class="modal-field">
          <span>${escapeHtml(field.label)}</span>
          <input
            name="${escapeAttribute(field.name)}"
            type="${escapeAttribute(field.type || 'text')}"
            value="${escapeAttribute(value)}"
            ${field.required ? 'required' : ''}
            placeholder="${escapeAttribute(field.placeholder ?? '')}"
            ${field.autocomplete ? `autocomplete="${escapeAttribute(field.autocomplete)}"` : ''}
            ${field.inputMode ? `inputmode="${escapeAttribute(field.inputMode)}"` : ''}
            ${field.maxLength ? `maxlength="${escapeAttribute(field.maxLength)}"` : ''}
            ${field.pattern ? `pattern="${escapeAttribute(field.pattern)}"` : ''}
          />
        </label>
      `;
    }).join('');

    const toneLabelMap = { info: 'Info', warning: 'Warning', danger: 'Action required', error: 'Error', success: 'Success' };
    const toneLabel = toneLabelMap[tone] ?? tone;
    overlay.innerHTML = `
      <div class="app-modal-card ${escapeAttribute(cardClassName)}">
        <div class="stack">
          <span class="pill ${escapeHtml(tone)}">${escapeHtml(toneLabel)}</span>
          <div class="stack">
            <h3>${escapeHtml(title)}</h3>
            ${message ? `<p class="muted">${escapeHtml(message)}</p>` : ''}
          </div>
          <form class="stack" data-role="modal-form">
            ${fieldsHtml}
            ${bodyHtml}
            ${actionsHtml}
          </form>
        </div>
      </div>
    `;

    const cleanup = (result) => {
      overlay.remove();
      document.removeEventListener('keydown', handleEscape);
      resolve(result);
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        cleanup(null);
      }
    };

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        cleanup(null);
      }
    });

    const form = overlay.querySelector('[data-role="modal-form"]');
    const cancelButton = overlay.querySelector('[data-role="modal-cancel"]');
    cancelButton?.addEventListener('click', () => cleanup(null));
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const values = Object.fromEntries(data.entries());
      cleanup(values);
    });

    document.addEventListener('keydown', handleEscape);
    document.body.appendChild(overlay);
    const firstInput = overlay.querySelector('input, textarea, select');
    if (firstInput instanceof HTMLElement) {
      firstInput.focus();
      if ('select' in firstInput || 'value' in firstInput) {
        firstInput.select?.();
      }
    } else {
      cancelButton?.focus();
    }
  });
}

async function showConfirmDialog({ title, message, confirmLabel = 'Confirm', tone = 'warning' }) {
  const result = await showModal({
    title,
    message,
    confirmLabel,
    cancelLabel: 'Cancel',
    tone,
  });
  return Boolean(result);
}

async function showFormDialog({ title, message = '', fields, confirmLabel = 'Save', tone = 'info' }) {
  return showModal({
    title,
    message,
    fields,
    confirmLabel,
    cancelLabel: 'Cancel',
    tone,
  });
}

function activeTab(pathname) {
  if (pathname.startsWith('/workspace/growth')) return 'growth';
  if (pathname.startsWith('/workspace/accounts')) return 'accounts';
  if (
    pathname.startsWith('/workspace/videos')
    || pathname.startsWith('/workspace/playlists')
    || pathname.startsWith('/workspace/media')
  ) return 'videos';
  if (pathname.startsWith('/workspace/campanhas')) return 'campanhas';
  if (pathname.startsWith('/workspace/planos')) return 'planos';
  if (pathname.startsWith('/workspace/configuracoes') || pathname.startsWith('/workspace/perfil')) return 'settings';
  return 'dashboard';
}

function keepWorkspaceActiveNavVisible() {
  const nav = document.querySelector('.header-nav');
  const activeLink = nav?.querySelector('.nav-link.active');
  if (!nav || !activeLink || !nav.clientWidth || typeof nav.scrollLeft !== 'number') return;

  const safeInset = 12;
  const activeLeft = activeLink.offsetLeft;
  const activeRight = activeLeft + activeLink.offsetWidth;
  const visibleLeft = nav.scrollLeft;
  const visibleRight = visibleLeft + nav.clientWidth;

  if (activeRight + safeInset > visibleRight) {
    nav.scrollLeft = Math.max(0, activeRight - nav.clientWidth + safeInset);
    return;
  }

  if (activeLeft - safeInset < visibleLeft) {
    nav.scrollLeft = Math.max(0, activeLeft - safeInset);
  }
}

function renderWorkspaceShell(options) {
  if (state.account) {
    ensurePlanCompatibleBackground();
  }

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', href: '/workspace/dashboard' },
    { id: 'growth', label: 'Growth', href: '/workspace/growth' },
    { id: 'campanhas', label: 'Campanhas', href: '/workspace/campanhas' },
    { id: 'accounts', label: 'Contas', href: '/workspace/accounts' },
    { id: 'videos', label: 'Videos', href: '/workspace/videos' },
    { id: 'planos', label: 'Planos', href: '/workspace/planos' },
    { id: 'settings', label: 'Configurações', href: '/workspace/configuracoes' },
  ];
  const pathname = window.location.pathname;
  const currentTab = activeTab(pathname);
  const navHtml = tabs.map((tab) => {
    const isActive = tab.id === currentTab;
    return `<a class="nav-link ${isActive ? 'active' : ''}" data-link data-workspace-tab="${tab.id}" href="${tab.href}"${isActive ? ' aria-current="page"' : ''}>${tab.label}</a>`;
  }).join('');
  const settingsPicker = settingsPickerHtml('workspace');
  const combinedNoticeHtml = `${renderUiNotice()}${options.noticeHtml ?? ''}`;

  const account = state.account;
  const planLabel = account?.planLabel ?? '';
  const tokens = account?.tokens ?? 0;
  const dailyClaimed = account?.dailyVisitClaimedToday ?? true;
  const dailyTokens = account?.dailyVisitTokens ?? 0;
  const accountTitle = [
    state.me?.email ?? '',
    planLabel ? `Plano ${planLabel}` : '',
  ].filter(Boolean).join(' - ');

  let tokenState = 'healthy';
  if (tokens <= 5) tokenState = 'critical';
  else if (tokens <= 20) tokenState = 'warning';
  else if (tokens >= 500) tokenState = 'full';

  const claimBtnHtml = dailyClaimed
    ? `<span class="token-capsule-claim done" title="Bonus diario ja coletado. Volte amanha para mais ${dailyTokens} tokens."><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></span>`
    : `<button id="header-claim-btn" class="token-capsule-claim available" type="button" title="Clique para receber +${dailyTokens} tokens de bonus diario. Disponivel uma vez por dia!"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M20 6h-2.18c.11-.31.18-.65.18-1a2.996 2.996 0 0 0-5.5-1.65l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z"/></svg></button>`;

  const tokenHtml = account ? `
    <div class="token-capsule" data-state="${tokenState}" title="Voce tem ${tokens} tokens. ${dailyClaimed ? 'Bonus diario ja coletado hoje.' : 'Clique no presente para ganhar +' + dailyTokens + ' tokens!'}">
      <span class="token-capsule-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>
      </span>
      <span class="token-capsule-count">
        <span class="token-capsule-current">${formatNumber(tokens)}</span>
        <span class="token-capsule-label">tokens</span>
      </span>
      ${claimBtnHtml}
    </div>
  ` : '';

  const isWorkspaceRoute = pathname.startsWith('/workspace');
  const hasPlatformDashboardContent = typeof options.contentHtml === 'string'
    && options.contentHtml.includes('id="od-root"');
  const usePlatformShell = isWorkspaceRoute && !hasPlatformDashboardContent;
  const currentTabLabel = tabs.find((tab) => tab.id === currentTab)?.label ?? 'Workspace';

  const pageClasses = ['page'];
  if (isWorkspaceRoute) {
    pageClasses.push('workspace-page', `workspace-page-${currentTab}`);
  }
  if (usePlatformShell) {
    pageClasses.push('workspace-page-platform');
  }

  const shellHeaderHtml = (options.title || options.subtitle || options.actionsHtml)
    ? `
      <section class="od-shell-head">
        <div class="od-shell-head-main">
          <p class="od-shell-kicker">Platform ${escapeHtml(currentTabLabel)}</p>
          ${options.title ? `<h1 class="route-title">${escapeHtml(options.title)}</h1>` : ''}
          ${options.subtitle ? `<p class="muted">${escapeHtml(options.subtitle)}</p>` : ''}
        </div>
        ${options.actionsHtml ? `<div class="od-shell-actions">${options.actionsHtml}</div>` : ''}
      </section>
    `
    : '';

  const defaultHeaderHtml = (options.title || options.subtitle || options.actionsHtml)
    ? `
      <section class="title-row">
        <div>
          <h1 class="route-title">${escapeHtml(options.title)}</h1>
          ${options.subtitle ? `<p class="muted">${escapeHtml(options.subtitle)}</p>` : ''}
        </div>
        ${options.actionsHtml ?? ''}
      </section>
    `
    : '';

  const mainContentHtml = usePlatformShell
    ? `
      <main class="container stack workspace-main workspace-main-platform">
        <section class="od-shell">
          <div class="od-bracket od-bracket-tl"></div>
          <div class="od-bracket od-bracket-tr"></div>
          <div class="od-bracket od-bracket-bl"></div>
          <div class="od-bracket od-bracket-br"></div>
          <div class="od-bg-globe-field" aria-hidden="true">
            <div class="od-bg-globe od-bg-globe-secondary">${buildOdGlobe()}</div>
            <div class="od-bg-globe">${buildOdGlobe()}</div>
          </div>
          ${shellHeaderHtml}
          ${combinedNoticeHtml}
          <div class="od-shell-content stack">
            ${options.contentHtml}
          </div>
        </section>
      </main>
    `
    : `
      <section class="container stack workspace-main">
        ${defaultHeaderHtml}
        ${combinedNoticeHtml}
        ${options.contentHtml}
      </section>
    `;

  root.innerHTML = `
    <div class="${pageClasses.join(' ')}">
      <header class="header header-fullwidth">
        <div class="header-shell header-shell-fullwidth">
          <a class="header-brand-block pmp-brand" href="/workspace/dashboard" data-link aria-label="Platform Multi Publisher">
            <div class="pmp-logo-mark" aria-hidden="true">
              <svg class="pmp-logo-svg" viewBox="0 0 100 100" role="img">
                <defs>
                  <linearGradient id="pmpRing" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#67e8f9" />
                    <stop offset="52%" stop-color="#22d3ee" />
                    <stop offset="100%" stop-color="#3b82f6" />
                  </linearGradient>
                  <linearGradient id="pmpLetters" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#f8fafc" />
                    <stop offset="42%" stop-color="#67e8f9" />
                    <stop offset="100%" stop-color="#22d3ee" />
                  </linearGradient>
                  <radialGradient id="pmpInnerGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stop-color="rgba(34,211,238,0.28)" />
                    <stop offset="62%" stop-color="rgba(59,130,246,0.05)" />
                    <stop offset="100%" stop-color="transparent" />
                  </radialGradient>
                  <filter id="pmpGlow" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="1.6" result="b" />
                    <feMerge>
                      <feMergeNode in="b" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <rect x="6" y="6" width="88" height="88" rx="24" fill="url(#pmpInnerGlow)" />
                <rect class="pmp-logo-ring" x="8" y="8" width="84" height="84" rx="22" fill="none" stroke="url(#pmpRing)" stroke-width="2.8" />
                <g class="pmp-logo-share" stroke="url(#pmpLetters)" stroke-width="1.8" fill="none" stroke-linecap="round">
                  <circle cx="42" cy="26" r="2.4" fill="url(#pmpLetters)" />
                  <circle cx="58" cy="26" r="2.4" fill="url(#pmpLetters)" />
                  <circle cx="50" cy="34" r="2.4" fill="url(#pmpLetters)" />
                  <line x1="42" y1="26" x2="50" y2="34" />
                  <line x1="58" y1="26" x2="50" y2="34" />
                </g>
                <text class="pmp-logo-text" x="50" y="68" text-anchor="middle"
                  font-family="'Inter', system-ui, sans-serif"
                  font-size="22" font-weight="900"
                  fill="url(#pmpLetters)" filter="url(#pmpGlow)"
                  letter-spacing="-0.5">PMP</text>
                <g class="pmp-logo-bars" stroke="url(#pmpLetters)" stroke-width="1.6" stroke-linecap="round" opacity="0.85">
                  <line x1="44" y1="80" x2="44" y2="76" />
                  <line x1="48" y1="80" x2="48" y2="74" />
                  <line x1="52" y1="80" x2="52" y2="71" />
                  <line x1="56" y1="80" x2="56" y2="73" />
                </g>
              </svg>
              <span class="pmp-logo-pulse" aria-hidden="true"></span>
            </div>
            <div class="pmp-brand-text">
              <span class="pmp-brand-kicker">PLATFORM</span>
              <span class="pmp-brand-name">Multi Publisher</span>
            </div>
          </a>
          <nav class="nav header-nav" aria-label="Workspace">${navHtml}</nav>
          <div class="header-actions">
            ${tokenHtml}
            ${settingsPicker}
            <a class="header-account-chip" data-link href="/workspace/perfil" title="${escapeHtml(accountTitle)}" aria-label="Abrir perfil">
              <div class="header-user-block">
                <span class="user-email">${escapeHtml(state.me?.email ?? '')}</span>
                ${planLabel ? `<span class="header-plan-badge">Plano ${escapeHtml(planLabel)}</span>` : ''}
              </div>
            </a>
            <button id="logout-btn" class="logout-btn" type="button" aria-label="Sair da conta">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M10 17l5-5-5-5" />
                <path d="M15 12H3" />
                <path d="M14 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              </svg>
              <span>Sair</span>
            </button>
          </div>
        </div>
      </header>
      ${mainContentHtml}
    </div>
  `;

  keepWorkspaceActiveNavVisible();
  if (typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(() => keepWorkspaceActiveNavVisible());
  }

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await api.logout();
      state.me = null;
      state.account = null;
      navigate('/login', true);
    });
  }

  const claimBtn = document.getElementById('header-claim-btn');
  if (claimBtn) {
    claimBtn.addEventListener('click', async () => {
      setButtonBusy(claimBtn, true, '...');
      const result = await api.claimDailyVisit();
      setButtonBusy(claimBtn, false);
      if (result.ok) {
        state.account = result.body?.account ?? state.account;
        const granted = result.body?.grantedTokens ?? 0;
        if (granted > 0) {
          setUiNotice('success', 'Bonus diario coletado!', `+${granted} tokens adicionados ao seu saldo.`);
        }
        const refreshed = await api.accountPlanSummary();
        if (refreshed.ok && refreshed.body?.account) {
          state.account = refreshed.body.account;
        }
        state.routeInFlight = false;
        await renderRoute();
      }
    });
  }

  document.querySelectorAll('[data-locale-option]').forEach((button) => {
    button.addEventListener('click', () => {
      const locale = button.getAttribute('data-locale-option');
      if (locale) {
        setAppLocale(locale);
      }
    });
  });

  bindBackgroundPicker(() => {
    void renderRoute();
  });
  bindUiNoticeDismiss();
}

function formatClockLabel(date = new Date()) {
  return date.toLocaleTimeString(getActiveLocale(), {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function renderPlatformArtwork(platform, size = 32, extraClass = '') {
  const requestedPlatform = String(platform ?? '').toLowerCase().trim();
  const platformKey = CAMPAIGN_PLATFORM_ARTWORK[requestedPlatform] ? requestedPlatform : 'youtube';
  const label = platformKey === 'youtube' ? 'YouTube' : platformKey === 'tiktok' ? 'TikTok' : 'Instagram';
  const pixelSize = Math.max(16, Math.min(96, Number(size) || 32));
  const className = ['platform-artwork', `platform-artwork-${platformKey}`, extraClass].filter(Boolean).join(' ');
  return `
    <span class="${escapeAttribute(className)}" style="--platform-artwork-size:${pixelSize}px" role="img" aria-label="${escapeAttribute(label)}" data-platform="${escapeAttribute(platformKey)}">
      <img class="platform-artwork-image" src="${escapeAttribute(CAMPAIGN_PLATFORM_ARTWORK[platformKey])}" alt="" decoding="async" draggable="false" />
    </span>
  `;
}

function renderPlatformGlyph(platform, extraClass = '') {
  const classNames = String(extraClass ?? '').split(/\s+/).filter(Boolean);
  const size = classNames.includes('small') ? 22 : 32;
  return renderPlatformArtwork(platform, size, ['platform-glyph', ...classNames].join(' '));
}

function renderGoogleGlyph(extraClass = '') {
  const className = ['platform-glyph', extraClass].filter(Boolean).join(' ');
  return `
    <span class="${className}" aria-hidden="true">
      <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
        <path fill="#ea4335" d="M24 9.5c3.5 0 6.7 1.2 9.2 3.6l6.8-6.8C35.9 2.4 30.5 0 24 0 14.6 0 6.5 5.4 2.6 13.2l8 6.2C12.4 13.7 17.7 9.5 24 9.5z" />
        <path fill="#4285f4" d="M47 24.6c0-1.6-.2-3.1-.4-4.6H24v9h13c-.6 3-2.3 5.5-4.8 7.2l7.7 6C44.4 38 47 31.8 47 24.6z" />
        <path fill="#fbbc05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.1.8-4.6l-8-6.2C.9 16.5 0 20.1 0 24s.9 7.5 2.5 10.8l8-6.2z" />
        <path fill="#34a853" d="M24 48c6.5 0 12-2.1 15.9-5.8l-7.7-6c-2.2 1.5-5 2.3-8.2 2.3-6.3 0-11.6-4.2-13.5-9.9l-8 6.2C6.5 42.6 14.6 48 24 48z" />
      </svg>
    </span>
  `;
}

function renderLoginPage(options = {}) {
  return renderRichLoginPage(options);
  const mode = options.mode === 'register' ? 'register' : 'login';
  const title = mode === 'register' ? 'Create your account' : 'Sign in to your workspace';
  const subtitle = mode === 'register'
    ? 'Create an account with email and password or continue with Google.'
    : 'Use your email and password or continue with Google to access the publishing workspace.';
  const submitLabel = mode === 'register' ? 'Create account' : 'Sign in';
  const settingsPicker = settingsPickerHtml('login');
  const combinedNoticeHtml = `${renderUiNotice()}${options.error ? `<div class="notice error">${escapeHtml(options.error)}</div>` : ''}`;

  root.innerHTML = `
    <div class="platform-classic-login">
      <div class="platform-classic-panel">
        <p class="platform-classic-brand-name">YT Multi Publi</p>
        <p class="platform-classic-brand-tagline">Publish to every platform in one click.</p>
        <div class="platform-classic-scene">
          <div class="platform-classic-ring platform-classic-ring-outer"></div>
          <div class="platform-classic-ring platform-classic-ring-inner"></div>
          <div class="platform-classic-center">🚀</div>
          <div class="orbit-arm">
            <div class="orbit-icon">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="24" height="24" rx="5" fill="#FF0000"/>
                <path d="M10 8.5l6 3.5-6 3.5V8.5z" fill="#fff"/>
              </svg>
            </div>
          </div>
          <div class="orbit-arm">
            <div class="orbit-icon">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="24" height="24" rx="5" fill="url(#iggrad)"/>
                <rect x="6" y="6" width="12" height="12" rx="3.5" stroke="#fff" stroke-width="1.5"/>
                <circle cx="12" cy="12" r="3" stroke="#fff" stroke-width="1.5"/>
                <circle cx="16.5" cy="7.5" r="1" fill="#fff"/>
                <defs>
                  <linearGradient id="iggrad" x1="0" y1="24" x2="24" y2="0">
                    <stop offset="0%" stop-color="#F58529"/>
                    <stop offset="40%" stop-color="#DD2A7B"/>
                    <stop offset="100%" stop-color="#515BD4"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>
          <div class="orbit-arm">
            <div class="orbit-icon">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="24" height="24" rx="5" fill="#010101"/>
                <path d="M14.7 5h-2.1v9.3a2.2 2.2 0 1 1-2.2-2.3c.2 0 .4 0 .6.1V9.8a4.3 4.3 0 1 0 4.3 4.5V9.6a5.8 5.8 0 0 0 3.3 1V8.5A3.8 3.8 0 0 1 14.7 5z" fill="white"/>
              </svg>
            </div>
          </div>
        </div>
        <div class="platform-classic-labels">
          <span>YouTube</span><span>·</span><span>TikTok</span>
        </div>
      </div>

      <div class="platform-classic-form-panel">
        <div class="platform-classic-toolbar">${settingsPicker}</div>
        <div class="platform-classic-form-wrap">
          ${combinedNoticeHtml}
          <div class="platform-classic-form-header">
            <div class="auth-mode-switch" role="tablist" aria-label="Authentication mode">
              <button class="button ${mode === 'login' ? 'button-primary' : 'button-secondary'}" type="button" data-auth-mode="login">Sign in</button>
              <button class="button ${mode === 'register' ? 'button-primary' : 'button-secondary'}" type="button" data-auth-mode="register">Create account</button>
            </div>
            <h2>${escapeHtml(title)}</h2>
            <p>${escapeHtml(subtitle)}</p>
          </div>
          <form id="login-form" class="form-grid">
            ${mode === 'register' ? `
              <label>
                Full name
                <input name="fullName" type="text" autocomplete="name" />
              </label>
            ` : ''}
            <label>
              Email
              <input name="email" type="email" required autocomplete="username" />
            </label>
            <label>
              Password
              <input name="password" type="password" required autocomplete="${mode === 'register' ? 'new-password' : 'current-password'}" />
            </label>
            <button class="button button-primary" type="submit">${escapeHtml(submitLabel)}</button>
          </form>
          <div class="auth-divider"><span>or</span></div>
          <button id="google-auth-btn" class="button button-secondary" type="button">Continue with Google</button>
          <p class="footnote">${mode === 'register'
            ? 'After the account is created, the next step is choosing the plan for the workspace.'
            : 'If this is your first Google access, the platform will ask you to choose a plan before opening the workspace.'}</p>
        </div>
      </div>
    </div>
  `;

  const form = document.getElementById('login-form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const credentials = {
      email: String(data.get('email') ?? ''),
      password: String(data.get('password') ?? ''),
    };
    const payload = mode === 'register'
      ? {
          ...credentials,
          fullName: String(data.get('fullName') ?? ''),
        }
      : credentials;
    const result = mode === 'register'
      ? await api.register(payload)
      : await api.login(credentials);
    if (!result.ok) {
      renderLoginPage({ error: result.error, mode });
      return;
    }
    handleAuthenticatedNavigation(result.body?.user);
  });

  document.querySelectorAll('[data-auth-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      const nextMode = button.getAttribute('data-auth-mode') === 'register' ? 'register' : 'login';
      navigate(buildUrl('/login', nextMode === 'register' ? { mode: 'register' } : {}), true);
    });
  });

  const googleAuthButton = document.getElementById('google-auth-btn');
  googleAuthButton?.addEventListener('click', async () => {
    const result = await api.startAuthGoogleOauth();
    if (!result.ok || !result.body?.redirectUrl) {
      renderLoginPage({ error: result.error || 'Unable to start Google sign-in.', mode });
      return;
    }
    window.location.assign(result.body.redirectUrl);
  });

  bindBackgroundPicker(() => {
    renderLoginPage({ ...options, mode });
  });
  bindUiNoticeDismiss();
}

function renderRichLoginPage(options = {}) {
  return renderMerchantLoginPage(options);
}

function renderMerchantLegalPanel(documentKey) {
  const documentData = getLegalDocument(documentKey);
  if (!documentData) {
    return `
      <article class="merchant-legal-panel">
        <h3>Documento indisponivel</h3>
        <p>Atualize a pagina para carregar este conteudo legal.</p>
      </article>
    `;
  }

  const sectionsHtml = documentData.sections.slice(0, 5).map((section) => `
    <details class="merchant-legal-item">
      <summary>${escapeHtml(section.heading)}</summary>
      <div>${String(section.html ?? '')}</div>
    </details>
  `).join('');

  return `
    <article class="merchant-legal-panel">
      <div class="merchant-section-kicker">${escapeHtml(documentData.lastUpdated || LEGAL_LAST_UPDATED)}</div>
      <h3>${escapeHtml(documentData.ptTitle || documentData.title)}</h3>
      <p>${escapeHtml(documentData.subtitle)}</p>
      ${sectionsHtml}
      <a class="merchant-text-link" href="${escapeAttribute(LEGAL_DOCUMENT_PATHS[documentKey] || '/')}" data-link>Ver documento completo</a>
    </article>
  `;
}

function renderMerchantLoginPage(options = {}) {
  const mode = options.mode === 'register' ? 'register' : 'login';
  const verifying = options.verifying === true;
  const initialSection = String(options.initialSection ?? '').replace(/[^a-z0-9_-]/gi, '');
  if (!ensureMerchantLegalDocumentsForLogin(mode, initialSection)) {
    return;
  }
  const accessFirst = initialSection === 'acesso' && options.accessFirst !== false;
  const draft = {
    fullName: String(options.draft?.fullName ?? ''),
    email: String(options.draft?.email ?? ''),
    password: String(options.draft?.password ?? ''),
  };
  const publicPlanOptions = mergePlanDisplayOptions();
  const planCardsHtml = publicPlanOptions.map((plan) => renderPublicPlanCard(plan)).join('');
  const errorHtml = options.error ? `<div class="merchant-alert" role="alert">${escapeHtml(options.error)}</div>` : '';
  const query = parseCurrentQuery();
  const resetToken = String(query.get('reset_token') ?? '').trim();
  const authView = resetToken ? 'reset' : query.get('view') === 'forgot' ? 'forgot' : 'credentials';
  const recoveryMessage = options.recoveryMessage
    || (query.get('reset') === 'success' ? 'Senha atualizada com sucesso. Entre com sua nova senha.' : '');
  const recoveryMessageHtml = recoveryMessage
    ? `<div class="merchant-success" role="status">${escapeHtml(recoveryMessage)}</div>`
    : '';
  const authFormHtml = authView === 'forgot'
    ? `
      <form id="password-reset-request-form" class="merchant-form" novalidate>
        <label><span>Email da conta</span><input name="email" type="email" required autocomplete="email" value="${escapeHtml(draft.email)}" placeholder="voce@empresa.com" /></label>
        <button type="submit" class="merchant-primary">Enviar link seguro</button>
        <button type="button" class="merchant-text-button" data-action="back-to-login">Voltar para o login</button>
      </form>`
    : authView === 'reset'
      ? `
        <form id="password-reset-confirm-form" class="merchant-form" novalidate>
          <label><span>Nova senha</span><input name="newPassword" type="password" required autocomplete="new-password" placeholder="8 a 128 caracteres" minlength="8" maxlength="128" /></label>
          <label><span>Confirmar nova senha</span><input name="confirmPassword" type="password" required autocomplete="new-password" placeholder="Repita a nova senha" minlength="8" maxlength="128" /></label>
          <button type="submit" class="merchant-primary">Atualizar senha</button>
          <button type="button" class="merchant-text-button" data-action="back-to-login">Cancelar e voltar</button>
        </form>`
      : `
        <form id="login-modern-form" class="merchant-form" novalidate>
          ${mode === 'register' ? `<label><span>Nome completo</span><input name="fullName" type="text" autocomplete="name" value="${escapeHtml(draft.fullName)}" placeholder="Seu nome" /></label>` : ''}
          <label><span>Email</span><input name="email" type="email" required autocomplete="username" value="${escapeHtml(draft.email)}" placeholder="voce@empresa.com" /></label>
          <label>
            <span>Senha</span>
            <div class="merchant-password-wrap">
              <input name="password" type="password" required autocomplete="${mode === 'register' ? 'new-password' : 'current-password'}" value="${escapeHtml(draft.password)}" placeholder="${mode === 'register' ? 'minimo 6 caracteres' : 'sua senha'}" minlength="6" />
              <button type="button" data-action="toggle-password" aria-label="Mostrar ou ocultar senha">ver</button>
            </div>
          </label>
          ${mode === 'login' ? '<div class="merchant-form-meta"><button type="button" class="merchant-text-button" data-action="forgot-password">Esqueci minha senha</button></div>' : ''}
          <button type="submit" class="merchant-primary">${mode === 'register' ? 'Criar conta' : 'Entrar no workspace'}</button>
        </form>`;
  const authFootnote = authView === 'forgot'
    ? 'Por seguranca, a resposta sera a mesma mesmo que o email nao esteja cadastrado. O link expira em 30 minutos.'
    : authView === 'reset'
      ? 'Este link e individual, expira em 30 minutos e deixa de funcionar depois da alteracao.'
      : mode === 'register'
        ? 'Ao criar uma conta, voce concorda com os termos e politica de privacidade abaixo.'
        : 'Se sua conta comecou pelo Google, use Google para restaurar o workspace correto.';
  const noticeHtml = renderUiNotice();

  root.innerHTML = `
    <div class="merchant-login" data-initial-section="${escapeAttribute(initialSection)}" data-access-first="${accessFirst ? 'true' : 'false'}" data-mode="${escapeAttribute(mode)}" data-auth-view="${escapeAttribute(authView)}">
      <header class="merchant-nav">
        <a class="merchant-brand" href="/" data-link aria-label="Platform Multi Publisher">
          <span class="merchant-brand-mark merchant-brand-mark-animated" aria-hidden="true">
            <span>PMP</span>
          </span>
          <span>
            <strong>Platform Multi Publisher</strong>
            <small>video operations</small>
          </span>
        </a>
        <nav aria-label="Menu principal">
          <a href="#programa">Programa</a>
          <a href="#planos">Planos</a>
          <a href="#terms">Termos</a>
          <a href="#privacy">Privacidade</a>
          <a href="#data-deletion">Exclusao</a>
          <a href="#atendimento">Atendimento</a>
        </nav>
        <div class="merchant-nav-actions" aria-label="Acesso à conta">
          <button class="merchant-nav-cta merchant-nav-cta-secondary" type="button" data-auth-mode="login">
            <span>Login</span><span class="merchant-nav-cta-icon" aria-hidden="true">↗</span>
          </button>
          <button class="merchant-nav-cta" type="button" data-auth-mode="register">
            <span>Criar conta</span><span class="merchant-nav-cta-icon" aria-hidden="true">↗</span>
          </button>
        </div>
      </header>

      <main>
        <section id="programa" class="merchant-hero" aria-label="Demonstracao animada do programa">
          <div class="merchant-scene" aria-hidden="true">
            <div class="merchant-sun"></div>
            <div class="merchant-satellite">
              <span class="satellite-signal signal-one"></span>
              <span class="satellite-signal signal-two"></span>
            </div>
            <div class="merchant-earth-link">
              <span class="earth-link-line"></span>
              <span class="earth-pulse earth-pulse-up pulse-one"></span>
              <span class="earth-pulse earth-pulse-up pulse-two"></span>
              <span class="earth-pulse earth-pulse-down pulse-three"></span>
              <span class="earth-pulse earth-pulse-down pulse-four"></span>
            </div>
            <div class="merchant-earth-system">
              <div class="merchant-moon-orbit">
                <div class="merchant-moon"></div>
              </div>
              <div class="merchant-earth"></div>
            </div>
            <div class="merchant-water"></div>
            <div class="merchant-copy">
              <span>publica&ccedil;&atilde;o multiplataforma</span>
              <h1>Transforme cada v&iacute;deo em uma campanha pronta para crescer.</h1>
              <p>O PMP centraliza m&iacute;dia, contas conectadas, agendamentos e desempenho em um s&oacute; lugar. Planeje, revise e publique no YouTube, TikTok e Instagram com uma opera&ccedil;&atilde;o clara, consistente e preparada para escalar.</p>
            </div>
          </div>

          <aside class="merchant-demo-panel">
            <div class="merchant-section-kicker">como e o programa</div>
            <h2>Uma sala de controle para YouTube, TikTok e Instagram.</h2>
            <div class="merchant-workflow">
              <article><strong>01</strong><span>Conectar contas autorizadas por OAuth</span></article>
              <article><strong>02</strong><span>Subir videos, capas e descricoes</span></article>
              <article><strong>03</strong><span>Montar campanhas por destino</span></article>
              <article><strong>04</strong><span>Acompanhar fila, erros e publicacoes</span></article>
            </div>
            <a class="merchant-primary" href="#planos">Ver planos</a>
          </aside>
        </section>

        <section id="planos" class="merchant-section merchant-plans">
          <div class="merchant-section-head">
            <div class="merchant-section-kicker">segundo painel</div>
            <h2>Escolha o plano antes de abrir o workspace.</h2>
            <p>Esta secao tambem atende o fluxo publico de <a href="/onboarding/plan" data-link>/onboarding/plan</a>. Depois do cadastro, usuarios autenticados escolhem o plano e seguem para o painel.</p>
          </div>
          <div class="public-pricing-grid merchant-pricing-grid">${planCardsHtml}</div>
        </section>

        <section id="acesso" class="merchant-section merchant-access">
          <div class="merchant-access-copy">
            <div class="merchant-section-kicker">acesso seguro</div>
            <h2>${mode === 'register' ? 'Crie sua conta operacional.' : 'Entre no workspace.'}</h2>
            <p>${mode === 'register' ? 'Cadastre seus dados, escolha o plano e prepare um workspace central para toda a operação de vídeo.' : 'Retome campanhas, canais conectados e publicações exatamente de onde parou.'}</p>
            <div class="merchant-access-benefits">
              <article><strong>Operação central</strong><span>Campanhas, mídia, destinos e fila no mesmo ambiente.</span></article>
              <article><strong>Acesso protegido</strong><span>Entre com sua conta PMP ou continue pelo Google OAuth.</span></article>
              <article><strong>Continuidade real</strong><span>Sua sessão restaura o workspace e o plano associados.</span></article>
            </div>
            <div class="merchant-access-flow" aria-label="Etapas para começar">
              <span><b>01</b> Conta</span>
              <i aria-hidden="true"></i>
              <span><b>02</b> Plano</span>
              <i aria-hidden="true"></i>
              <span><b>03</b> Workspace</span>
            </div>
          </div>
          <div class="merchant-login-card">
            ${noticeHtml}
            ${errorHtml}
            ${recoveryMessageHtml}
            <header class="merchant-login-card-head">
              <div class="merchant-login-default-heading">
                <span>Conta PMP</span>
                <h3>${mode === 'register' ? 'Comece sua operação' : 'Bem-vindo de volta'}</h3>
              </div>
              ${authView !== 'credentials' ? `<div class="merchant-recovery-heading"><span>Recuperacao segura</span><h3>${authView === 'reset' ? 'Crie uma nova senha' : 'Recupere seu acesso'}</h3></div>` : ''}
              <span class="merchant-secure-badge"><i aria-hidden="true"></i> Ambiente seguro</span>
            </header>
            <div class="merchant-tabs" role="tablist">
              <button type="button" role="tab" aria-selected="${mode === 'login'}" data-auth-mode="login" class="${mode === 'login' ? 'is-active' : ''}">Entrar</button>
              <button type="button" role="tab" aria-selected="${mode === 'register'}" data-auth-mode="register" class="${mode === 'register' ? 'is-active' : ''}">Criar conta</button>
            </div>
            <button id="google-auth-btn" type="button" class="merchant-google">
              ${renderGoogleGlyph('small')}
              <span>Continuar com Google</span>
            </button>
            <div class="merchant-divider"><span>ou por email</span></div>
            ${authFormHtml}
            <p class="merchant-footnote">${escapeHtml(authFootnote)}</p>
            <div class="merchant-auth-notes" aria-label="Informações de segurança">
              <span>Sessão protegida</span>
              <span>Google OAuth</span>
              <span>Controle de acesso</span>
            </div>
          </div>
        </section>

        <section id="atendimento" class="merchant-section merchant-support-section">
          <div class="merchant-section-head">
            <div class="merchant-section-kicker">atendimento com protocolo</div>
            <h2>Registre e acompanhe sua solicitacao.</h2>
            <p>Use este canal para acesso, problemas tecnicos, cobranca, privacidade ou conta. Ao enviar, voce recebe um protocolo e uma chave privada de acompanhamento.</p>
            <div class="merchant-support-promises" aria-label="Compromissos de atendimento">
              <span>Protocolo imediato</span>
              <span>Confirmacao por email</span>
              <span>Acompanhamento protegido</span>
            </div>
          </div>
          <div class="merchant-support-grid">
            <article class="merchant-support-card">
              <h3>Nova solicitacao</h3>
              ${options.serviceRequestResult ? `
                <div class="merchant-protocol-result" role="status">
                  <span>Solicitacao registrada</span>
                  <strong>${escapeHtml(options.serviceRequestResult.protocol)}</strong>
                  <p>Guarde o protocolo. O link privado de acompanhamento tambem foi enviado para seu email.</p>
                  <a href="${escapeAttribute(options.serviceRequestResult.trackingUrl)}">Acompanhar agora</a>
                </div>
              ` : `
                <form id="merchant-support-form" class="merchant-form" novalidate>
                  <div class="merchant-form-columns">
                    <label><span>Nome</span><input name="requesterName" type="text" autocomplete="name" maxlength="120" placeholder="Seu nome" /></label>
                    <label><span>Email</span><input name="email" type="email" autocomplete="email" required placeholder="voce@empresa.com" /></label>
                  </div>
                  <label>
                    <span>Categoria</span>
                    <select name="category" required>
                      <option value="access">Acesso e senha</option>
                      <option value="technical">Problema tecnico</option>
                      <option value="billing">Cobranca e pagamentos</option>
                      <option value="privacy">Privacidade e dados</option>
                      <option value="account">Conta e plano</option>
                      <option value="other">Outro assunto</option>
                    </select>
                  </label>
                  <label><span>Assunto</span><input name="subject" type="text" required minlength="5" maxlength="140" placeholder="Resuma o que voce precisa" /></label>
                  <label><span>Descricao</span><textarea name="description" required minlength="20" maxlength="4000" rows="5" placeholder="Explique o ocorrido, o resultado esperado e quando aconteceu."></textarea></label>
                  <div class="merchant-form-feedback" data-support-feedback aria-live="polite"></div>
                  <button type="submit" class="merchant-primary">Gerar protocolo</button>
                </form>
              `}
            </article>
            <article class="merchant-support-card merchant-tracking-card">
              <h3>Acompanhar protocolo</h3>
              <p>Informe o protocolo e a chave privada recebida por email.</p>
              <form id="merchant-tracking-form" class="merchant-form" novalidate>
                <label><span>Protocolo</span><input name="protocol" type="text" required value="${escapeHtml(query.get('protocol') ?? '')}" placeholder="PMP-AAAAMMDD-XXXXXXXXXXXX" /></label>
                <label><span>Chave de acompanhamento</span><input name="key" type="password" required value="${escapeHtml(query.get('tracking_key') ?? '')}" placeholder="Chave privada" /></label>
                <button type="submit" class="merchant-secondary-action">Consultar status</button>
              </form>
              <div class="merchant-tracking-result" data-tracking-result aria-live="polite"></div>
            </article>
          </div>
        </section>

        <section id="terms" class="merchant-section merchant-legal-section">
          <div class="merchant-section-head">
            <div class="merchant-section-kicker">/terms</div>
            <h2>Termos de uso na propria pagina principal.</h2>
          </div>
          ${renderMerchantLegalPanel('terms')}
        </section>

        <section id="privacy" class="merchant-section merchant-legal-section">
          <div class="merchant-section-head">
            <div class="merchant-section-kicker">/privacy</div>
            <h2>Privacidade e uso de dados de plataformas conectadas.</h2>
          </div>
          ${renderMerchantLegalPanel('privacy')}
        </section>

        <section id="data-deletion" class="merchant-section merchant-legal-section">
          <div class="merchant-section-head">
            <div class="merchant-section-kicker">/data-deletion</div>
            <h2>Exclusao de dados e revogacao de acesso.</h2>
          </div>
          ${renderMerchantLegalPanel('data-deletion')}
        </section>
      </main>

      <footer class="merchant-footer">
        <strong>Platform Multi Publisher</strong>
        <nav aria-label="Links finais">
          <a href="/login" data-link>Login</a>
          <a href="/terms" data-link>Termos</a>
          <a href="/privacy" data-link>Privacidade</a>
          <a href="/data-deletion" data-link>Exclusao de dados</a>
          <a href="/login#atendimento" data-link>Atendimento</a>
          <a href="/onboarding/plan" data-link>Planos</a>
        </nav>
      </footer>

      ${verifying ? `
        <div class="merchant-loading" role="status" aria-live="polite">
          <div>
            <span></span>
            <strong>Autenticando</strong>
            <small>Preparando seu workspace...</small>
          </div>
        </div>
      ` : ''}
    </div>
  `;

  const form = document.getElementById('login-modern-form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const fullName = String(data.get('fullName') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    const password = String(data.get('password') ?? '');

    if (!email || !email.includes('@')) {
      renderMerchantLoginPage({ error: 'Email must be valid.', mode, draft: { fullName, email, password }, initialSection: 'acesso' });
      return;
    }
    if (!password) {
      renderMerchantLoginPage({ error: 'Password is required.', mode, draft: { fullName, email, password }, initialSection: 'acesso' });
      return;
    }
    if (mode === 'register' && password.length < 6) {
      renderMerchantLoginPage({ error: 'Password must be at least 6 characters.', mode, draft: { fullName, email, password }, initialSection: 'acesso' });
      return;
    }

    renderMerchantLoginPage({ mode, draft: { fullName, email, password }, verifying: true, initialSection: 'acesso' });
    await new Promise((resolve) => window.requestAnimationFrame(() => window.setTimeout(resolve, 90)));

    const result = mode === 'register'
      ? await api.register({ email, password, fullName: fullName || undefined })
      : await api.login({ email, password });

    if (!result.ok) {
      renderMerchantLoginPage({ error: result.error, mode, draft: { fullName, email, password }, initialSection: 'acesso' });
      return;
    }
    handleAuthenticatedNavigation(result.body?.user);
  });

  document.querySelector('[data-action="forgot-password"]')?.addEventListener('click', () => {
    navigate('/login?view=forgot#acesso', true);
  });

  document.querySelector('[data-action="back-to-login"]')?.addEventListener('click', () => {
    navigate('/login#acesso', true);
  });

  const passwordResetRequestForm = document.getElementById('password-reset-request-form');
  passwordResetRequestForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(passwordResetRequestForm);
    const email = String(data.get('email') ?? '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      renderMerchantLoginPage({ error: 'Informe um email valido.', mode: 'login', draft: { email }, initialSection: 'acesso' });
      return;
    }
    const result = await api.requestPasswordReset(email);
    if (!result.ok) {
      renderMerchantLoginPage({ error: result.error, mode: 'login', draft: { email }, initialSection: 'acesso' });
      return;
    }
    renderMerchantLoginPage({
      mode: 'login',
      draft: { email },
      initialSection: 'acesso',
      recoveryMessage: result.body?.message || 'Se a conta existir, o link sera enviado por email.',
    });
  });

  const passwordResetConfirmForm = document.getElementById('password-reset-confirm-form');
  passwordResetConfirmForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(passwordResetConfirmForm);
    const newPassword = String(data.get('newPassword') ?? '');
    const confirmPassword = String(data.get('confirmPassword') ?? '');
    if (newPassword.length < 8 || newPassword.length > 128) {
      renderMerchantLoginPage({ error: 'A nova senha deve ter entre 8 e 128 caracteres.', mode: 'login', initialSection: 'acesso' });
      return;
    }
    if (newPassword !== confirmPassword) {
      renderMerchantLoginPage({ error: 'As senhas nao coincidem.', mode: 'login', initialSection: 'acesso' });
      return;
    }
    const result = await api.confirmPasswordReset(resetToken, newPassword);
    if (!result.ok) {
      renderMerchantLoginPage({ error: result.error, mode: 'login', initialSection: 'acesso' });
      return;
    }
    navigate('/login?reset=success#acesso', true);
  });

  const supportForm = document.getElementById('merchant-support-form');
  supportForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(supportForm);
    const payload = {
      requesterName: String(data.get('requesterName') ?? '').trim(),
      email: String(data.get('email') ?? '').trim(),
      category: String(data.get('category') ?? ''),
      subject: String(data.get('subject') ?? '').trim(),
      description: String(data.get('description') ?? '').trim(),
    };
    const feedback = supportForm.querySelector('[data-support-feedback]');
    if (feedback) feedback.textContent = 'Registrando solicitacao...';
    const result = await api.createServiceRequest(payload);
    if (!result.ok) {
      if (feedback) {
        feedback.dataset.tone = 'error';
        feedback.textContent = result.error;
      }
      return;
    }
    renderMerchantLoginPage({
      mode,
      initialSection: 'atendimento',
      serviceRequestResult: {
        ...result.body?.request,
        trackingUrl: result.body?.trackingUrl,
      },
    });
  });

  const trackingForm = document.getElementById('merchant-tracking-form');
  const submitTrackingForm = async () => {
    if (!trackingForm) return;
    const data = new FormData(trackingForm);
    const protocol = String(data.get('protocol') ?? '').trim();
    const key = String(data.get('key') ?? '').trim();
    const output = document.querySelector('[data-tracking-result]');
    if (!protocol || !key) {
      if (output) output.innerHTML = '<div class="merchant-alert">Informe o protocolo e a chave privada.</div>';
      return;
    }
    if (output) output.textContent = 'Consultando...';
    const result = await api.trackServiceRequest(protocol, key);
    if (!result.ok) {
      if (output) output.innerHTML = `<div class="merchant-alert">${escapeHtml(result.error)}</div>`;
      return;
    }
    const item = result.body?.request;
    if (output && item) {
      const statusLabels = { received: 'Recebida', in_review: 'Em analise', waiting_user: 'Aguardando voce', resolved: 'Resolvida', closed: 'Encerrada' };
      output.innerHTML = `
        <div class="merchant-protocol-result">
          <span>${escapeHtml(statusLabels[item.status] || item.status)}</span>
          <strong>${escapeHtml(item.protocol)}</strong>
          <p>${escapeHtml(item.subject)}</p>
          <small>Atualizada em ${escapeHtml(formatDate(item.updatedAt))}</small>
        </div>`;
    }
  };
  trackingForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    void submitTrackingForm();
  });
  if (query.get('protocol') && query.get('tracking_key')) {
    void submitTrackingForm();
  }

  document.querySelectorAll('[data-auth-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      const nextMode = button.getAttribute('data-auth-mode') === 'register' ? 'register' : 'login';
      const authUrl = buildUrl('/login', nextMode === 'register' ? { mode: 'register' } : {});
      navigate(`${authUrl}#acesso`, true);
    });
  });

  document.getElementById('google-auth-btn')?.addEventListener('click', async () => {
    const result = await api.startAuthGoogleOauth();
    if (!result.ok || !result.body?.redirectUrl) {
      renderMerchantLoginPage({ error: result.error || 'Unable to start Google sign-in.', mode, draft, initialSection: 'acesso' });
      return;
    }
    window.location.assign(result.body.redirectUrl);
  });

  document.querySelector('[data-action="toggle-password"]')?.addEventListener('click', (event) => {
    const wrapper = event.currentTarget.closest('.merchant-password-wrap');
    const input = wrapper?.querySelector('input');
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    event.currentTarget.textContent = input.type === 'password' ? 'ver' : 'ocultar';
  });

  if (initialSection && initialSection !== 'acesso') {
    window.requestAnimationFrame(() => {
      const target = document.getElementById(initialSection);
      if (!target) {
        window.scrollTo(0, 0);
        return;
      }
      const navHeight = document.querySelector('.merchant-nav')?.getBoundingClientRect().height ?? 0;
      const targetTop = target.getBoundingClientRect().top + window.scrollY - navHeight;
      window.scrollTo({ top: Math.max(0, targetTop), left: 0, behavior: 'auto' });
    });
  } else {
    window.scrollTo(0, 0);
  }

  bindUiNoticeDismiss();
}


function animatePlaylistCockpit() {
  const cockpit = document.getElementById('playlist-cockpit');
  if (!cockpit) return;

  const arc = cockpit.querySelector('.playlist-cockpit-ring-arc');
  if (arc) {
    const targetOffset = Number(arc.getAttribute('data-target-offset') ?? 0);
    requestAnimationFrame(() => {
      arc.setAttribute('stroke-dashoffset', String(targetOffset));
    });
  }

  const rateEl = cockpit.querySelector('[data-target-rate]');
  if (rateEl) {
    const target = Number(rateEl.getAttribute('data-target-rate') ?? 0);
    const duration = 1300;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      rateEl.textContent = `${Math.round(target * eased)}%`;
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  cockpit.querySelectorAll('[data-counter]').forEach((el) => {
    const target = Number(el.getAttribute('data-counter') ?? 0);
    const duration = 1100;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = String(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  const fillBar = cockpit.querySelector('.playlist-cockpit-footer-bar-fill');
  if (fillBar) {
    const target = fillBar.style.getPropertyValue('--width');
    fillBar.style.width = '0%';
    requestAnimationFrame(() => {
      fillBar.style.transition = 'width 1.4s cubic-bezier(0.22, 0.61, 0.36, 1)';
      fillBar.style.width = target;
    });
  }

  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    cockpit.addEventListener('mousemove', (event) => {
      const rect = cockpit.getBoundingClientRect();
      const px = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      const py = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
      const orbA = cockpit.querySelector('.playlist-cockpit-orb-a');
      const orbB = cockpit.querySelector('.playlist-cockpit-orb-b');
      if (orbA) orbA.style.transform = `translate(${px * 14}px, ${py * 14}px)`;
      if (orbB) orbB.style.transform = `translate(${px * -10}px, ${py * -10}px)`;
    });
    cockpit.addEventListener('mouseleave', () => {
      const orbA = cockpit.querySelector('.playlist-cockpit-orb-a');
      const orbB = cockpit.querySelector('.playlist-cockpit-orb-b');
      if (orbA) orbA.style.transform = '';
      if (orbB) orbB.style.transform = '';
    });
  }
}


function handleAuthenticatedNavigation(user) {
  state.me = user ?? null;
  if (!user?.email) {
    navigate('/login', true);
    return;
  }

  navigate(user.needsPlanSelection ? '/onboarding/plan' : '/workspace/dashboard', true);
}

function renderPublicPlanCard(plan) {
  const planId = normalizePlanCode(plan.id);
  const isFeatured = planId === 'PRO';
  const isPremium = planId === 'PREMIUM';
  const platforms = getPlanAllowedPlatforms(plan);
  const platformIcons = platforms.map((platform) => `
    <span class="public-plan-platform-icon" title="${escapeAttribute(PLAN_PLATFORM_LABELS[platform] ?? platform)}">
      ${renderPlatformArtwork(platform, 30) || renderPlatformGlyph(platform, 'small')}
    </span>
  `).join('');
  const platformNames = getPlanPlatformSummary(plan);
  const durationLabel = Number(plan.durationDays ?? 0) > 0 ? `${formatNumber(plan.durationDays)} dias` : 'Sem mensalidade';
  const metrics = [
    { label: 'Tokens mensais', value: `${formatNumber(plan.tokens)} tokens` },
    { label: 'Bonus diario', value: `+${formatNumber(plan.dailyVisitTokens)} tokens` },
    { label: 'Custo por campanha', value: formatTokenCost(plan.campaignPublishCostTokens) },
    { label: 'Thumbnail', value: Number(plan.thumbnailCostTokens ?? 0) > 0 ? formatTokenCost(plan.thumbnailCostTokens) : 'Inclusa' },
  ];
  const metricsHtml = metrics.map((metric) => `
    <li>
      <span>${escapeHtml(metric.label)}</span>
      <strong>${escapeHtml(metric.value)}</strong>
    </li>
  `).join('');
  const benefitsHtml = (plan.benefits ?? []).slice(0, 5).map((benefit) => `
    <li><span aria-hidden="true"></span>${escapeHtml(benefit)}</li>
  `).join('');

  return `
    <article class="public-plan-card${isFeatured ? ' public-plan-card-featured' : ''}${isPremium ? ' public-plan-card-premium' : ''}" data-plan="${escapeAttribute(planId)}">
      <div class="public-plan-card-head">
        <p class="public-pricing-tier">${escapeHtml(plan.label)}</p>
        ${isFeatured ? '<span class="public-plan-badge">Mais usado</span>' : ''}
        ${isPremium ? '<span class="public-plan-badge public-plan-badge-premium">Maximo</span>' : ''}
      </div>
      <div class="public-plan-price-row">
        <strong>${escapeHtml(plan.priceLabel)}</strong>
        <span>${escapeHtml(durationLabel)}</span>
      </div>
      <p>${escapeHtml(plan.description)}</p>
      <div class="public-plan-platforms" aria-label="Plataformas liberadas">
        <div>${platformIcons}</div>
        <span>${escapeHtml(platformNames)}</span>
      </div>
      <ul class="public-plan-metrics">
        ${metricsHtml}
      </ul>
      <ul class="public-plan-benefits">
        ${benefitsHtml}
      </ul>
      <a class="public-button" href="/login?mode=register" data-link>${planId === 'FREE' ? 'Comecar gratis' : `Escolher ${escapeHtml(plan.label)}`}</a>
    </article>
  `;
}

async function renderGoogleAuthCallbackPage() {
  renderLoading('Completing Google sign-in...');

  const params = new URLSearchParams(window.location.search);
  const code = params.get('code') ?? '';
  const oauthState = params.get('state') ?? '';

  if (!code || !oauthState) {
    renderLoginPage({
      error: 'Google callback is missing the authorization code or state.',
      mode: 'login',
    });
    return;
  }

  const result = await api.authGoogleCallback(code, oauthState);
  if (!result.ok) {
    renderLoginPage({
      error: result.error,
      mode: 'login',
    });
    return;
  }

  handleAuthenticatedNavigation(result.body?.user);
}

function renderPlanCard(option, selectedPlan) {
  const isSelected = option.id === selectedPlan;
  const isPremium = option.id === 'PREMIUM';
  const platformIcons = getPlanAllowedPlatforms(option)
    .map((platform) => renderPlatformGlyph(platform))
    .join('');
  const benefitsHtml = (option.benefits ?? []).map(
    (b) => `<li class="plan-benefit"><span class="plan-benefit__check">&#10003;</span><span>${escapeHtml(b)}</span></li>`
  ).join('');
  return `
    <article class="plan-card ${option.featured ? 'featured' : ''} ${isPremium ? 'plan-card-premium' : ''} ${isSelected ? 'selected' : ''}">
      <div class="stack">
        <div class="platform-dashboard-chip-row">
          <span class="pill ${isPremium ? 'warning' : option.featured ? 'success' : 'info'}">${escapeHtml(option.label)}</span>
          ${option.featured && !isPremium ? '<span class="pill success">Mais popular</span>' : ''}
          ${isPremium ? '<span class="pill warning">Maximo poder</span>' : ''}
        </div>
        <div class="plan-price">${escapeHtml(option.priceLabel)}</div>
        <p class="muted plan-description">${escapeHtml(option.description)}</p>
      </div>
      <div style="display: flex; gap: 0.4rem; margin-bottom: 0.5rem;">
        ${platformIcons}
      </div>
      <ul class="plan-benefits plan-benefits--compact">
        ${benefitsHtml}
      </ul>
      <button class="button ${option.featured || isPremium ? 'button-primary' : 'button-secondary'}" type="button" data-action="select-onboarding-plan" data-plan-id="${escapeHtml(option.id)}">
        ${isSelected ? 'Plano selecionado' : `Escolher ${escapeHtml(option.label)}`}
      </button>
    </article>
  `;
}

function renderWorkspacePlanCard(option, account) {
  const isCurrentPlan = option.id === account?.plan;
  const canUpgrade = !isCurrentPlan;
  const isFeatured = option.id === 'PRO';
  const isPremium = option.id === 'PREMIUM';

  const platformIcons = getPlanAllowedPlatforms(option)
    .map((platform) => renderPlatformGlyph(platform))
    .join('');

  const benefitsHtml = (option.benefits ?? []).map(
    (b) => `<li class="plan-benefit"><span class="plan-benefit__check">&#10003;</span><span>${escapeHtml(b)}</span></li>`
  ).join('');

  return `
    <article class="plan-card ${isFeatured ? 'featured' : ''} ${isPremium ? 'plan-card-premium' : ''} ${isCurrentPlan ? 'selected' : ''}">
      <div class="stack">
        <div class="platform-dashboard-chip-row">
          <span class="pill ${isPremium ? 'warning' : isFeatured ? 'success' : 'info'}">${escapeHtml(option.label)}</span>
          ${isCurrentPlan ? '<span class="pill warning">Seu plano atual</span>' : ''}
          ${isFeatured && !isCurrentPlan ? '<span class="pill success">Mais popular</span>' : ''}
          ${isPremium && !isCurrentPlan ? '<span class="pill warning">Maximo poder</span>' : ''}
        </div>
        <div class="plan-price">${escapeHtml(option.priceLabel)}</div>
        <p class="muted plan-description">${escapeHtml(option.description)}</p>
      </div>
      <ul class="plan-benefits">
        ${benefitsHtml}
      </ul>
      <div class="plan-platforms">
        Plataformas: ${platformIcons}
      </div>
      ${isCurrentPlan && account ? `
        <div class="plan-account-info">
          <span class="plan-account-info__balance">Saldo atual: <strong>${account.tokens}</strong> tokens</span>
          ${account.dailyVisitClaimedToday
            ? '<span class="pill info">Bonus diario ja coletado hoje</span>'
            : '<span class="pill success">+' + account.dailyVisitTokens + ' tokens disponiveis hoje</span>'}
          ${account.monthlyGrantClaimedThisMonth
            ? '<span class="pill info">Grant mensal ja recebido este mes</span>'
            : '<span class="pill success">Grant mensal pendente este mes</span>'}
        </div>
      ` : ''}
      ${canUpgrade
        ? `<button class="button ${isFeatured || isPremium ? 'button-primary' : 'button-secondary'}" type="button" data-action="upgrade-plan" data-plan-id="${escapeHtml(option.id)}">Assinar ${escapeHtml(option.label)}</button>`
        : '<button class="button button-secondary" type="button" disabled>Plano ativo</button>'}
    </article>
  `;
}

function renderWorkspaceServiceRequestsPanel(requests = []) {
  const statusLabels = { received: 'Recebida', in_review: 'Em analise', waiting_user: 'Aguardando voce', resolved: 'Resolvida', closed: 'Encerrada' };
  const recentHtml = requests.length > 0
    ? requests.slice(0, 5).map((item) => `
      <li>
        <span><strong>${escapeHtml(item.protocol)}</strong><small>${escapeHtml(item.subject)}</small></span>
        <span class="pill info">${escapeHtml(statusLabels[item.status] || item.status)}</span>
      </li>`).join('')
    : '<li class="muted">Nenhuma solicitacao registrada nesta conta.</li>';

  return `
    <section class="settings-hub-section settings-service-requests" aria-label="Central de solicitacoes">
      <div class="settings-hub-section-head">
        <span class="settings-hub-kicker">Atendimento</span>
        <h3>Solicitacoes e protocolos</h3>
        <p class="muted">Registre uma demanda e acompanhe o historico associado ao seu email da conta.</p>
      </div>
      <div class="settings-preference-grid">
        <article class="settings-hub-card">
          <div class="settings-hub-card-head">
            <span class="settings-hub-card-icon">${renderSettingsMark('NEW', 'processing', 'settings-card-mark')}</span>
            <span class="settings-hub-card-copy"><strong>Nova solicitacao</strong><small>O protocolo e gerado imediatamente.</small></span>
          </div>
          <form id="workspace-service-request-form" class="form-grid" novalidate>
            <label>Categoria<select name="category" required><option value="technical">Problema tecnico</option><option value="billing">Cobranca e pagamentos</option><option value="privacy">Privacidade e dados</option><option value="account">Conta e plano</option><option value="access">Acesso e senha</option><option value="other">Outro assunto</option></select></label>
            <label>Assunto<input name="subject" required minlength="5" maxlength="140" placeholder="Resumo da solicitacao" /></label>
            <label>Descricao<textarea name="description" required minlength="20" maxlength="4000" rows="4" placeholder="Explique o que aconteceu e o resultado esperado."></textarea></label>
            <div class="notice" data-workspace-request-feedback hidden></div>
            <button class="button button-primary" type="submit">Gerar protocolo</button>
          </form>
        </article>
        <article class="settings-hub-card">
          <div class="settings-hub-card-head">
            <span class="settings-hub-card-icon">${renderSettingsMark('FILA', 'info', 'settings-card-mark')}</span>
            <span class="settings-hub-card-copy"><strong>Protocolos recentes</strong><small>Ultimas cinco solicitacoes da conta.</small></span>
          </div>
          <ul class="settings-request-list">${recentHtml}</ul>
        </article>
      </div>
    </section>`;
}

function bindWorkspaceServiceRequests() {
  const form = document.getElementById('workspace-service-request-form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const feedback = form.querySelector('[data-workspace-request-feedback]');
    const result = await api.createAuthenticatedServiceRequest({
      category: String(data.get('category') ?? ''),
      subject: String(data.get('subject') ?? '').trim(),
      description: String(data.get('description') ?? '').trim(),
    });
    if (!result.ok) {
      if (feedback) {
        feedback.hidden = false;
        feedback.className = 'notice error';
        feedback.textContent = result.error;
      }
      return;
    }
    state.uiNotice = { tone: 'success', message: `Solicitacao ${result.body?.request?.protocol} registrada com sucesso.` };
    await renderSettingsPage();
  });
}

async function renderSettingsPage() {
  await ensureAccountPlan();
  const growthAccountsResult = await api.accounts().catch(() => null);
  if (growthAccountsResult?.ok && Array.isArray(growthAccountsResult.body?.accounts)) {
    state.growthConnectedAccounts = growthAccountsResult.body.accounts;
  }

  const account = state.account;
  const planId = getCurrentAccountPlanId();
  const planConfig = getPlanVisualConfig(planId);
  const selectedTheme = getSelectedBackgroundTheme();
  const tokenCount = account?.tokens ?? 0;
  const connectedAccountsCount = state.growthConnectedAccounts.filter((item) => item.status === 'connected').length;
  const serviceRequestsResult = await api.serviceRequests().catch(() => null);
  const serviceRequests = serviceRequestsResult?.ok && Array.isArray(serviceRequestsResult.body?.requests)
    ? serviceRequestsResult.body.requests
    : [];

  renderWorkspaceShell({
    title: 'Configuracoes',
    subtitle: 'Centro operacional para conta, aparencia, Growth e seguranca.',
    contentHtml: `
      <section class="settings-hub-hero card">
        <div class="settings-hub-hero-copy">
          <span class="settings-hub-kicker">Centro de operacao</span>
          <h2>Configuracoes do PMP</h2>
          <p class="muted">Tudo que altera a operacao da plataforma fica aqui: identidade, contas conectadas, plano, visual, Growth e seguranca da conta.</p>
          <div class="settings-hub-meta-row">
            <span class="pill ${escapeHtml(planConfig.tone)}">Plano ${escapeHtml(account?.planLabel ?? planConfig.label)}</span>
            <span class="pill info">${formatNumber(tokenCount)} tokens</span>
            <span class="pill info">${formatNumber(connectedAccountsCount)} contas conectadas</span>
            <span class="pill info">${escapeHtml(state.locale)}</span>
          </div>
        </div>
        <div
          class="settings-hub-visual"
          style="--background-preview:${escapeAttribute(selectedTheme.pageBackground)}; --preset-accent:${escapeAttribute(selectedTheme.primary)};"
        >
          ${renderSettingsMark('PMP', 'processing', 'settings-hero-mark')}
          <strong>${escapeHtml(selectedTheme.label)}</strong>
          <small>${escapeHtml(planConfig.label)} · contraste automático</small>
        </div>
      </section>

      <section class="settings-hub-section">
        <div class="settings-hub-section-head">
          <span class="settings-hub-kicker">Essenciais</span>
          <h3>O que o usuario realmente precisa gerenciar</h3>
        </div>
        <div class="settings-hub-grid settings-essentials-grid">
          <a class="settings-hub-card settings-hub-link-card settings-hub-card-priority" data-link href="/workspace/perfil">
            <span class="settings-hub-card-icon">${renderSettingsMark('EU', 'success', 'settings-card-mark')}</span>
            <span class="settings-hub-card-copy">
              <strong>Perfil e identidade</strong>
              <small>Nome, e-mail, plano ativo e resumo das preferencias.</small>
            </span>
          </a>

          <a class="settings-hub-card settings-hub-link-card settings-hub-card-priority" data-link href="/workspace/accounts">
            <span class="settings-hub-card-icon">${renderSettingsMark('ACC', 'info', 'settings-card-mark')}</span>
            <span class="settings-hub-card-copy">
              <strong>Contas conectadas</strong>
              <small>${formatNumber(connectedAccountsCount)} conectada${connectedAccountsCount === 1 ? '' : 's'}; revise canais, OAuth e reconexoes.</small>
            </span>
          </a>

          <a class="settings-hub-card settings-hub-link-card settings-hub-card-priority" data-link href="/workspace/planos">
            <span class="settings-hub-card-icon">${renderSettingsMark('TOK', 'warning', 'settings-card-mark')}</span>
            <span class="settings-hub-card-copy">
              <strong>Plano e tokens</strong>
              <small>${formatNumber(tokenCount)} tokens disponiveis. Gerencie upgrades e pacotes avulsos.</small>
            </span>
          </a>
        </div>
      </section>

      <section class="settings-hub-section settings-preferences-section">
        <div class="settings-hub-section-head">
          <span class="settings-hub-kicker">Preferencias</span>
          <h3>Ajustes visuais e idioma</h3>
          <p class="muted">Controles de interface ficam juntos para evitar duplicacao entre Perfil e Configuracoes.</p>
        </div>
        <div class="settings-preference-grid">
          <article class="settings-hub-card">
            <div class="settings-hub-card-head">
              <span class="settings-hub-card-icon">${renderSettingsMark('IDI', 'info', 'settings-card-mark')}</span>
              <span class="settings-hub-card-copy">
                <strong>Idioma da plataforma</strong>
                <small>Textos visiveis, labels e aria-labels.</small>
              </span>
            </div>
            <div class="font-theme-grid font-theme-grid-compact language-grid language-grid-wide">
              ${renderLanguageOptionButtons()}
            </div>
          </article>

          <article class="settings-hub-card settings-hub-card-wide">
            <div class="settings-hub-card-head">
              <span class="settings-hub-card-icon">${renderSettingsMark('BG', 'processing', 'settings-card-mark')}</span>
              <span class="settings-hub-card-copy">
                <strong>Ambientes visuais PMP</strong>
                <small>Cada conjunto coordena background, superfícies, textos, botões e gráficos.</small>
              </span>
            </div>
            <div class="theme-access-note ${isPaidVisualPlan(planId) ? 'is-unlocked' : 'is-locked'}">
              ${isPaidVisualPlan(planId)
                ? `<span>${renderSettingsMark('OK', 'success', 'theme-access-mark')}</span><div><strong>Seis ambientes liberados</strong><small>Seu plano permite alternar livremente entre todos os conjuntos PMP.</small></div>`
                : `<span>${renderSettingsMark('PRO', 'warning', 'theme-access-mark')}</span><div><strong>PMP Essencial ativo</strong><small>Os seis ambientes abaixo são liberados ao assinar qualquer plano pago.</small></div><a class="button button-secondary" data-link href="/workspace/planos">Ver planos</a>`}
            </div>
            <div class="background-grid background-grid-plan">
              ${renderPlanBackgroundCards(planId)}
            </div>
          </article>
        </div>
      </section>

      <section class="growth-module growth-settings-merged settings-growth-compact" aria-label="Funcoes Growth migradas para Configuracoes PMP">
        ${renderGrowthSettingsPanel({ merged: true, compact: true })}
      </section>

      ${renderWorkspaceServiceRequestsPanel(serviceRequests)}

      ${renderAccountDeletionPanel()}
    `,
  });
  bindGrowthInteractions();
  bindWorkspaceServiceRequests();
  bindAccountDeletionRequest();
}

async function renderProfilePage() {
  await ensureAccountPlan();
  const accountsResult = await api.accounts().catch(() => null);
  if (accountsResult?.ok && Array.isArray(accountsResult.body?.accounts)) {
    state.growthConnectedAccounts = accountsResult.body.accounts;
  }

  const account = state.account;
  const selectedTheme = getSelectedBackgroundTheme();
  const planConfig = getPlanVisualConfig();
  const displayName = state.me?.fullName || state.me?.name || 'Operador';
  const email = state.me?.email || '-';
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 3)
    .toUpperCase() || 'EU';
  const connectedAccountsCount = state.growthConnectedAccounts.filter((item) => item.status === 'connected').length;

  renderWorkspaceShell({
    title: 'Perfil',
    subtitle: 'Identidade, plano e seguranca da sua conta PMP.',
    actionsHtml: '<a class="button button-secondary" data-link href="/workspace/configuracoes">Abrir configuracoes</a>',
    contentHtml: `
      <section class="settings-profile-layout">
        <article class="card settings-profile-card">
          <div class="settings-profile-avatar" aria-hidden="true">
            ${renderSettingsMark(initials, 'success', 'settings-profile-avatar-mark')}
          </div>
          <div class="settings-profile-copy">
            <span class="settings-hub-kicker">Identidade</span>
            <h2>${escapeHtml(displayName)}</h2>
            <p class="muted">${escapeHtml(email)}</p>
          </div>
          <div class="settings-profile-stats">
            <div>
              <span>Plano</span>
              <strong>${escapeHtml(account?.planLabel ?? planConfig.label)}</strong>
            </div>
            <div>
              <span>Tokens</span>
              <strong>${formatNumber(account?.tokens ?? 0)}</strong>
            </div>
            <div>
              <span>Contas</span>
              <strong>${formatNumber(connectedAccountsCount)}</strong>
            </div>
          </div>
        </article>

        <article class="card settings-profile-panel">
          <div class="settings-hub-card-head">
            <span class="settings-hub-card-icon">${renderSettingsMark('CTA', 'info', 'settings-card-mark')}</span>
            <span class="settings-hub-card-copy">
              <strong>Conta e operacao</strong>
              <small>Atalhos reais para gerenciar o que afeta publicacao.</small>
            </span>
          </div>
          <div class="settings-action-list">
            <a data-link href="/workspace/accounts"><strong>Contas conectadas</strong><span>OAuth, canais e reconexoes</span></a>
            <a data-link href="/workspace/planos"><strong>Plano e tokens</strong><span>Saldo, upgrades e pacotes</span></a>
            <a data-link href="/workspace/configuracoes"><strong>Preferencias</strong><span>Idioma, visual e Growth</span></a>
          </div>
        </article>

        <article class="card settings-profile-panel">
          <div class="settings-hub-card-head">
            <span class="settings-hub-card-icon">${renderSettingsMark('VIS', 'processing', 'settings-card-mark')}</span>
            <span class="settings-hub-card-copy">
              <strong>Aparencia atual</strong>
              <small>${escapeHtml(selectedTheme.label)} · tipografia coordenada</small>
            </span>
          </div>
          <div class="settings-current-visual" style="--background-preview:${escapeAttribute(selectedTheme.pageBackground)}; --preset-accent:${escapeAttribute(selectedTheme.primary)};">
            <span></span>
            <strong>${escapeHtml(selectedTheme.label)}</strong>
          </div>
        </article>

        <article class="card settings-profile-panel">
          <div class="settings-hub-card-head">
            <span class="settings-hub-card-icon">${renderSettingsMark('RES', 'success', 'settings-card-mark')}</span>
            <span class="settings-hub-card-copy">
              <strong>Resumo salvo</strong>
              <small>Perfil mostra o estado; edicao fica centralizada em Configuracoes.</small>
            </span>
          </div>
          <ul class="settings-profile-list">
            <li><span>Idioma</span><strong>${escapeHtml(state.locale)}</strong></li>
            <li><span>Background</span><strong>${escapeHtml(selectedTheme.label)}</strong></li>
            <li><span>Legibilidade</span><strong>Automática</strong></li>
          </ul>
        </article>
      </section>

      ${renderAccountDeletionPanel({ compact: true })}
    `,
  });
  bindAccountDeletionRequest();
}

async function renderPlanosPage(options = {}) {
  renderWorkspaceShell({
    title: 'Planos',
    subtitle: 'Gerencie seu plano e acompanhe seus tokens.',
    contentHtml: '<div class="loading">Carregando plano...</div>',
  });

  const result = await api.accountPlanSummary();
  if (!result.ok) {
    if (result.status === 401) { unauthorizedRedirect(); return; }
    renderWorkspaceShell({
      title: 'Planos',
      contentHtml: `<div class="notice error">${escapeHtml(result.error)}</div>`,
    });
    return;
  }

  const account = result.body?.account ?? null;
  const errorHtml = options.error ? `<div class="notice error">${escapeHtml(options.error)}</div>` : '';
  const successHtml = options.success ? `<div class="notice success">${escapeHtml(options.success)}</div>` : '';

  const billingHtml = account?.billingExpiresAt ? `
    <div class="notice ${account.expiresSoon ? 'warning' : 'info'}">
      ${account.expiresSoon ? 'Seu plano expira em breve!' : 'Plano ativo ate:'} <strong>${formatDate(account.billingExpiresAt)}</strong>
      ${account.expiresSoon ? ' - <a data-link href="/workspace/planos">Renovar agora</a>' : ''}
    </div>
  ` : '';

  const plansResult = await api.listPlans();
  const apiPlans = plansResult.ok ? (plansResult.body?.plans ?? []) : [];
  const mergedOptions = mergePlanDisplayOptions(apiPlans);

  const planCardsHtml = mergedOptions.map((option) => renderWorkspacePlanCard(option, account)).join('');

  const packsResult = await api.listTokenPacks();
  const packs = packsResult.ok ? (packsResult.body?.packs ?? []) : [];
  const tokenPacksHtml = packs.length === 0 ? '' : `
    <section class="card stack plan-section">
      <h2>Comprar tokens avulsos</h2>
      <p>Pacotes unicos que somam ao seu saldo. Nao substituem a assinatura mensal.</p>
      <div class="plan-grid">
        ${packs.map((pack) => `
          <article class="plan-card">
            <header>
              <h3>${escapeHtml(pack.label)}</h3>
              <strong>R$ ${pack.priceBrl.toFixed(2).replace('.', ',')}</strong>
            </header>
            <p><strong>${pack.tokens}</strong> tokens</p>
            <button class="button button-primary" data-action="buy-token-pack" data-pack-id="${escapeHtml(pack.id)}">Comprar</button>
          </article>
        `).join('')}
      </div>
    </section>
  `;

  renderWorkspaceShell({
    title: 'Planos',
    subtitle: `Plano atual: ${account?.planLabel ?? '—'} | Saldo: ${account?.tokens ?? 0} tokens`,
    noticeHtml: `${errorHtml}${successHtml}${billingHtml}`,
    contentHtml: `
      <section class="plan-grid">
        ${planCardsHtml}
      </section>
      ${tokenPacksHtml}
      <section class="card stack plan-section">
        <h2>Como funcionam os planos</h2>
        <ul class="stack plan-rules">
          <li>Cada conta conectada para publicar custa tokens por campanha (1 a 2 tokens dependendo do plano).</li>
          <li>Thumbnail custa <strong>1 token</strong> no plano Free. <strong>Gratis</strong> nos planos pagos.</li>
          <li>Ao mudar de plano, voce recebe os tokens mensais do novo plano imediatamente.</li>
          <li>A publicacao so acontece se voce tiver tokens suficientes para todas as contas selecionadas.</li>
          <li>TikTok e Instagram estao disponiveis somente nos planos <strong>PRO</strong> e <strong>Premium</strong>.</li>
          <li>Planos pagos tem duracao de 30 dias e expiram automaticamente para Free.</li>
        </ul>
      </section>
    `,
  });

  document.querySelectorAll('[data-action="upgrade-plan"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const planId = button.getAttribute('data-plan-id');
      if (!planId) return;

      // FREE: troca direta sem pagamento. Pagos: passa pelo checkout do provider.
      if (planId === 'FREE') {
        setButtonBusy(button, true, 'Salvando...');
        const selectResult = await api.selectAccountPlan(planId);
        setButtonBusy(button, false);

        if (!selectResult.ok) {
          await renderPlanosPage({ error: selectResult.error });
          return;
        }

        state.account = selectResult.body?.account ?? state.account;
        await ensureAccountPlan(true);
        applyRecommendedBackgroundForPlan(planId);
        await renderPlanosPage({ success: `Plano ${planId} ativado com sucesso!` });
        return;
      }

      setButtonBusy(button, true, 'Iniciando checkout...');
      const checkoutResult = await api.checkoutPlan(planId);

      if (!checkoutResult.ok) {
        setButtonBusy(button, false);
        await renderPlanosPage({ error: checkoutResult.error });
        return;
      }

      const redirectUrl = checkoutResult.body?.redirectUrl;
      if (redirectUrl) {
        window.location.assign(redirectUrl);
        return;
      }

      // Provider mock (sem URL): marca como pago direto (somente em dev)
      const intentId = checkoutResult.body?.intent?.id;
      if (!intentId) {
        setButtonBusy(button, false);
        await renderPlanosPage({ error: 'Checkout iniciado mas sem URL de redirect.' });
        return;
      }

      setButtonBusy(button, true, 'Confirmando pagamento (mock)...');
      const paidResult = await api.markPaymentPaid(intentId);
      setButtonBusy(button, false);

      if (!paidResult.ok) {
        await renderPlanosPage({ error: paidResult.error });
        return;
      }

      await ensureAccountPlan(true);
      applyRecommendedBackgroundForPlan(planId);
      await renderPlanosPage({ success: `Plano ${planId} ativado com sucesso!` });
    });
  });

  document.querySelectorAll('[data-action="buy-token-pack"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const packId = button.getAttribute('data-pack-id');
      if (!packId) return;

      setButtonBusy(button, true, 'Iniciando checkout...');
      const checkoutResult = await api.buyTokenPack(packId);

      if (!checkoutResult.ok) {
        setButtonBusy(button, false);
        await renderPlanosPage({ error: checkoutResult.error });
        return;
      }

      const redirectUrl = checkoutResult.body?.redirectUrl;
      if (redirectUrl) {
        window.location.assign(redirectUrl);
        return;
      }

      // Mock provider sem redirectUrl: marca como pago direto (somente em dev)
      const intentId = checkoutResult.body?.intent?.id;
      if (!intentId) {
        setButtonBusy(button, false);
        await renderPlanosPage({ error: 'Nao foi possivel iniciar checkout (sem intent).' });
        return;
      }

      setButtonBusy(button, true, 'Confirmando pagamento (mock)...');
      const paidResult = await api.markPaymentPaid(intentId);
      setButtonBusy(button, false);

      if (!paidResult.ok) {
        await renderPlanosPage({ error: paidResult.error });
        return;
      }

      await ensureAccountPlan(true);
      await renderPlanosPage({ success: 'Tokens creditados com sucesso!' });
    });
  });
}

async function renderPlanSelectionPage(options = {}) {
  const result = await api.accountPlanSummary();
  if (!result.ok) {
    if (result.status === 401) {
      unauthorizedRedirect();
      return;
    }

    renderLoginPage({
      error: result.error,
      mode: 'login',
    });
    return;
  }

  const redlineTheme = BACKGROUND_THEME_OPTIONS.find((option) => option.id === 'platform-youtube-redline') ?? BACKGROUND_THEME_OPTIONS[0];
  if (state.backgroundTheme !== redlineTheme.id) {
    applyBackgroundTheme(redlineTheme.id);
  }

  const account = result.body?.account ?? null;
  const selectedPlan = account?.plan ?? 'FREE';
  const combinedNoticeHtml = `${renderUiNotice()}${options.error ? `<div class="notice error">${escapeHtml(options.error)}</div>` : ''}`;
  const planCardsHtml = mergePlanDisplayOptions().map((option) => renderPlanCard(option, selectedPlan)).join('');

  root.innerHTML = `
    <div class="login-wrap">
      <section class="login-card plan-onboarding-card stack">
        ${combinedNoticeHtml}
        <div class="stack">
          <h1>Choose your account plan</h1>
          <p class="muted">Your account has already been created. Pick the plan you want to use before entering the workspace.</p>
          <div class="notice info">
            Logged in as <strong>${escapeHtml(state.me?.fullName || state.me?.email || '')}</strong>.
          </div>
        </div>
        <section class="plan-grid">
          ${planCardsHtml}
        </section>
      </section>
    </div>
  `;

  document.querySelectorAll('[data-action="select-onboarding-plan"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const planId = button.getAttribute('data-plan-id');
      if (!planId) {
        return;
      }

      setButtonBusy(button, true, 'Saving...');
      const selectResult = await api.selectAccountPlan(planId);
      setButtonBusy(button, false);

      if (!selectResult.ok) {
        await renderPlanSelectionPage({ error: selectResult.error });
        return;
      }

      state.me = selectResult.body?.user ?? { ...state.me, needsPlanSelection: false };
      state.account = selectResult.body?.account ?? state.account;
      applyRecommendedBackgroundForPlan(planId);
      setUiNotice('success', 'Plan selected', `The ${planId} plan is now active for your account.`);
      navigate('/workspace/dashboard', true);
    });
  });

  bindUiNoticeDismiss();
}

function bindBackgroundPicker(onSelected) {
  document.querySelectorAll('[data-background-theme-option]').forEach((element) => {
    element.addEventListener('click', (event) => {
      const selectedThemeId = event.currentTarget?.getAttribute('data-background-theme-option');
      if (!selectedThemeId) return;
      if (!isBackgroundThemeAvailableForPlan(selectedThemeId)) {
        setUiNotice('info', 'Tema disponível nos planos pagos', 'Assine qualquer plano para liberar os seis ambientes visuais PMP.');
        navigate('/workspace/planos');
        return;
      }
      applyBackgroundTheme(selectedThemeId);
      onSelected();
    });
  });

  document.querySelectorAll('[data-theme-locked]').forEach((element) => {
    element.addEventListener('click', () => {
      setUiNotice('info', 'Personalização premium', 'Qualquer plano pago libera os seis ambientes completos, com contraste automático.');
      navigate('/workspace/planos');
    });
  });
}

function renderFatal(message) {
  root.innerHTML = `
    <div class="page">
      <main class="container">
        <section class="card stack">
          <h1>Unexpected error</h1>
          <div class="notice error">${escapeHtml(message)}</div>
          <a data-link href="/workspace/dashboard">Back to dashboard</a>
        </section>
      </main>
    </div>
  `;
}

async function ensureAuthenticated() {
  if (state.me?.email) return state.me;
  const meResult = await api.me();
  if (!meResult.ok) return null;
  state.me = meResult.body?.user ?? null;
  return state.me;
}

async function ensureAccountPlan(forceRefresh = false) {
  if (!forceRefresh && state.account) {
    ensurePlanCompatibleBackground();
    return state.account;
  }
  const result = await api.accountPlanSummary();
  if (result.ok) {
    state.account = result.body?.account ?? null;
    if (state.account && !state.account.monthlyGrantClaimedThisMonth) {
      const monthlyResult = await api.claimMonthlyGrant();
      if (monthlyResult.ok && monthlyResult.body?.claimed) {
        state.account = monthlyResult.body?.account ?? state.account;
      }
    }
    if (state.account) {
      ensurePlanCompatibleBackground();
    }
  }
  return state.account;
}

function parseCurrentQuery() {
  return new URLSearchParams(window.location.search);
}

function navigate(path, replace = false) {
  const target = String(path || '/');
  clearAutoRefreshTimer();
  clearDashboardClockTimer();
  if (replace) {
    history.replaceState({}, '', target);
  } else {
    history.pushState({}, '', target);
  }
  if (state.routeInFlight) {
    state.rerenderQueued = true;
    return;
  }
  void renderRoute();
}

function renderLoading(label = 'Loading...') {
  root.innerHTML = `
    <div class="page">
      <main class="container">
        <section class="card">
          <div class="loading-state">
            <div class="spinner"></div>
            <span class="muted">${escapeHtml(label)}</span>
          </div>
        </section>
      </main>
    </div>
  `;
}

function attachGlobalNavigation() {
  document.addEventListener('click', (event) => {
    const anchor = event.target.closest('a[data-link]');
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    if (!href) return;
    event.preventDefault();
    navigate(href);
  });
  window.addEventListener('popstate', () => {
    void renderRoute();
  });
}

const LEGAL_LAST_UPDATED = '4 de setembro de 2026';
const LEGAL_DOCUMENT_PATHS = Object.freeze({
  privacy: '/privacy',
  terms: '/terms',
  'data-deletion': '/data-deletion',
});

function getLegalPagePresentation(activePage, title, subtitle) {
  const base = {
    title,
    subtitle,
    eyebrow: 'Documentos jurídicos',
    badge: 'Conformidade e transparência',
    summary: 'Regras claras para uma operação de vídeo com contas autorizadas, mídia, campanhas, filas e publicações em plataformas de terceiros.',
    accent: 'cyan',
    stats: [
      ['OAuth', 'Conexão autorizada pelo usuário'],
      ['Tokens', 'Proteção e controle de acesso'],
      ['Revogação', 'Usuário pode desconectar contas'],
    ],
  };

  if (activePage === 'privacy') {
    return {
      ...base,
      eyebrow: 'Privacidade e dados',
      badge: 'Dados, APIs e retenção',
      title: 'Política de Privacidade',
      ptTitle: 'Política de Privacidade',
      summary: 'Explica quais dados são tratados, por que são necessários, como são protegidos e como o titular pode exercer seus direitos.',
      accent: 'cyan',
      stats: [
        ['30 dias', 'Eliminação ou anonimização após a confirmação do pedido'],
        ['OAuth', 'YouTube, TikTok e Instagram autorizados pelo usuário'],
        ['Sem anúncios', 'Dados das plataformas não são vendidos para publicidade'],
      ],
    };
  }

  if (activePage === 'terms') {
    return {
      ...base,
      eyebrow: 'Termos de uso',
      badge: 'Responsabilidades e limites',
      title: 'Termos de Uso',
      ptTitle: 'Termos de Uso',
      summary: 'Define regras de uso, autorizações, responsabilidades por conteúdo, limites legais e a relação com plataformas independentes.',
      accent: 'violet',
      stats: [
        ['Usuário', 'Responsável pelo conteúdo, direitos e destinos'],
        ['APIs', 'Publicação depende das regras de terceiros'],
        ['Brasil', 'Lei aplicável e direitos obrigatórios preservados'],
      ],
    };
  }

  return {
    ...base,
    eyebrow: 'Exclusão de dados',
    badge: 'Controle do titular',
    title: 'Exclusão de Dados e Revogação de Acesso',
    ptTitle: 'Exclusão de Dados e Revogação de Acesso',
    summary: 'Explica a diferença entre desconectar uma plataforma, revogar permissões e excluir os dados mantidos pelo PMP.',
    accent: 'green',
    stats: [
      ['30 dias', 'Prazo operacional para eliminar ou anonimizar dados'],
      ['E-mail', 'Solicitação pelo endereço associado à conta'],
      ['Revogação', 'Também disponível nas plataformas conectadas'],
    ],
  };
}

function stripHtml(value) {
  return String(value ?? '').replace(/<[^>]+>/g, '').trim();
}

function getLegalDocumentHeadings(bodyHtml) {
  return Array.from(String(bodyHtml ?? '').matchAll(/<h2>(.*?)<\/h2>/g))
    .map((match) => stripHtml(match[1]))
    .filter(Boolean);
}

function addLegalSectionIds(bodyHtml) {
  let sectionIndex = 0;
  return String(bodyHtml ?? '').replace(/<section>/g, () => `<section id="legal-section-${sectionIndex++}">`);
}

function getSharedLegalDocuments() {
  const documents = window.__PMP_LEGAL_DOCUMENTS__;
  return documents && typeof documents === 'object' ? documents : {};
}

function getLegalDocument(activePage) {
  const document = getSharedLegalDocuments()[activePage];
  return document && Array.isArray(document.sections) ? document : null;
}

function ensureMerchantLegalDocumentsForLogin(mode = 'login', initialSection = 'acesso') {
  const hasAllDocuments = Object.keys(LEGAL_DOCUMENT_PATHS)
    .every((documentKey) => Boolean(getLegalDocument(documentKey)));
  if (hasAllDocuments) return true;

  const currentPath = String(window.location.pathname || '/').replace(/\/+$/, '') || '/';
  const initialPath = String(document.body?.dataset?.initialPath || '/').replace(/\/+$/, '') || '/';

  // A direct /login response already includes the shared legal payload. When
  // /login was reached through the SPA from another server-rendered route,
  // request that complete document once instead of showing empty legal cards.
  if (currentPath === '/login' && initialPath === '/login') {
    return true;
  }

  const safeMode = mode === 'register' ? 'register' : 'login';
  const safeSection = String(initialSection || 'acesso').replace(/[^a-z0-9_-]/gi, '') || 'acesso';
  const query = safeMode === 'register' ? '?mode=register' : '';
  const hash = safeSection === 'acesso' ? '' : `#${safeSection}`;
  window.location.assign(`/login${query}${hash}`);
  return false;
}

function getLegalReloadStorageKey(path) {
  return `pmp-legal-document-reload:${path}`;
}

function clearLegalReloadAttempt(activePage) {
  const path = LEGAL_DOCUMENT_PATHS[activePage];
  if (!path) return;
  try {
    sessionStorage.removeItem(getLegalReloadStorageKey(path));
  } catch {
    // Session storage can be unavailable in hardened browsers.
  }
}

function reloadMissingLegalDocument(activePage) {
  const path = LEGAL_DOCUMENT_PATHS[activePage];
  if (!path) return false;
  const key = getLegalReloadStorageKey(path);

  try {
    if (sessionStorage.getItem(key) === '1') {
      return false;
    }
    sessionStorage.setItem(key, '1');
  } catch {
    // If storage is blocked, still prefer one full navigation over a broken SPA fallback.
  }

  window.location.assign(path);
  return true;
}

function renderLegalDocumentBodyHtml(documentData) {
  return documentData.sections.map((section) => `
    <section>
      <h2>${escapeHtml(section.heading)}</h2>
      ${String(section.html ?? '')}
    </section>
  `).join('');
}

function renderPublicFooter() {
  return `
    <footer class="public-footer legal-saas-footer">
      <div class="public-footer-brand">
        <strong>Platform Multi Publisher</strong>
        <span>Publicação profissional com transparência sobre integrações de terceiros.</span>
      </div>
      <nav class="public-footer-links" aria-label="Links jurídicos e da conta">
        <a href="/privacy" data-link>Política de Privacidade</a>
        <a href="/terms" data-link>Termos de Uso</a>
        <a href="/data-deletion" data-link>Exclusão de Dados</a>
      </nav>
    </footer>
  `;
}

function renderLegalPublicNav(activePage) {
  return `
    <header class="public-nav legal-saas-nav">
      <a class="public-brand pmp-brand" href="/" data-link aria-label="Platform Multi Publisher">
        <span class="public-brand-mark legal-brand-mark">PMP</span>
        <span class="pmp-brand-text">
          <span class="pmp-brand-kicker">PLATFORM</span>
          <span class="pmp-brand-name">Multi Publisher</span>
        </span>
      </a>
      <nav class="public-nav-links" aria-label="Main website links">
        <a href="/#recursos" data-link>Recursos</a>
        <a href="/#como-funciona" data-link>Como funciona</a>
        <a href="/#integracoes" data-link>Integrações</a>
        <a href="/#seguranca" data-link>Segurança</a>
        <a href="/#planos" data-link>Preços</a>
      </nav>
      <nav class="legal-nav-links" aria-label="Legal pages">
        <a href="/privacy" data-link ${activePage === 'privacy' ? 'aria-current="page"' : ''}>Privacidade</a>
        <a href="/terms" data-link ${activePage === 'terms' ? 'aria-current="page"' : ''}>Termos</a>
        <a href="/data-deletion" data-link ${activePage === 'data-deletion' ? 'aria-current="page"' : ''}>Exclusão de dados</a>
      </nav>
      <div class="public-nav-actions">
        <a class="public-link" href="/login" data-link>Entrar</a>
      </div>
    </header>
  `;
}

function renderLegalShell(activePage, title, subtitle, bodyHtml, lastUpdated = LEGAL_LAST_UPDATED, reviewNote = 'Recomenda-se validação por profissional jurídico habilitado antes da publicação definitiva.') {
  const page = getLegalPagePresentation(activePage, title, subtitle);
  const headings = getLegalDocumentHeadings(bodyHtml);
  const decoratedBodyHtml = addLegalSectionIds(bodyHtml);
  const statsHtml = page.stats.map(([value, label]) => `
    <article>
      <strong>${escapeHtml(value)}</strong>
      <span>${escapeHtml(label)}</span>
    </article>
  `).join('');
  const tocHtml = headings.map((heading, index) => `
    <a href="#legal-section-${index}">${escapeHtml(heading)}</a>
  `).join('');

  root.innerHTML = `
    <div class="public-landing legal-page legal-saas-page public-saas-page" data-legal-page="${escapeAttribute(activePage)}" data-legal-accent="${escapeAttribute(page.accent)}">
      <div class="public-ambient-bg" aria-hidden="true">
        <div class="public-ambient-orb public-ambient-orb-1"></div>
        <div class="public-ambient-orb public-ambient-orb-2"></div>
        <div class="public-ambient-grid"></div>
      </div>
      <div class="public-shell">
        ${renderLegalPublicNav(activePage)}
        <main class="legal-main legal-saas-main">
          <section class="legal-hero legal-saas-hero">
            <div class="legal-hero-copy">
              <p class="public-eyebrow">${escapeHtml(page.eyebrow)}</p>
              <span class="legal-hero-badge">${escapeHtml(page.badge)}</span>
              <h1>${escapeHtml(page.ptTitle ?? page.title)}</h1>
              <p>${escapeHtml(page.summary)}</p>
              <div class="legal-meta-row">
                <span>Atualizado em: ${escapeHtml(lastUpdated)}</span>
                <span>Website oficial: plataformmultipublisher.com</span>
                <span>Brasil</span>
              </div>
              <div class="legal-hero-actions">
                <a class="public-button public-button-large" href="/" data-link>Ver página principal</a>
                <a class="public-ghost-button" href="#legal-contact">Entrar em contato</a>
              </div>
            </div>
            <aside class="legal-dashboard-card" aria-label="Resumo visual de segurança e operação">
              <div class="legal-dashboard-top">
                <span>${renderMediaMark('storage', 'stat', { state: 'success' })}</span>
                <div>
                  <strong>Workspace com autorização do usuário</strong>
                  <small>Campanhas, biblioteca, contas conectadas e fila de publicação.</small>
                </div>
              </div>
              <div class="legal-platform-row" aria-label="Plataformas suportadas">
                ${renderPlatformArtwork('youtube', 36)}
                ${renderPlatformArtwork('tiktok', 36)}
                ${renderPlatformArtwork('instagram', 36)}
              </div>
              <div class="legal-status-list">
                <span><b></b> Tokens protegidos</span>
                <span><b></b> Revogação de acesso</span>
                <span><b></b> Logs de publicação</span>
              </div>
              <p>O Platform Multi Publisher não é afiliado, patrocinado nem operado oficialmente por YouTube, TikTok, Instagram, Google ou Meta.</p>
            </aside>
          </section>

          <section class="legal-summary-grid" aria-label="Resumo do documento">
            ${statsHtml}
          </section>

          <p class="legal-review-note">
            ${escapeHtml(reviewNote)}
          </p>

          <section class="legal-content-shell">
            <aside class="legal-toc" aria-label="Índice do documento">
              <strong>Nesta página</strong>
              ${tocHtml}
            </aside>
            <article class="legal-document">
              ${decoratedBodyHtml}
            </article>
          </section>

          <section id="legal-contact" class="legal-contact-card">
            <div>
              <p class="public-eyebrow">Contato</p>
              <h2>Precisa falar sobre privacidade, termos ou exclusão de dados?</h2>
              <p>Use o formulário para preparar uma mensagem ao contato oficial. Para exclusão de dados, envie a solicitação pelo e-mail associado à conta.</p>
            </div>
            <form class="public-contact-form legal-contact-form" data-public-contact-form novalidate>
              <label>Nome<input name="name" autocomplete="name" required /></label>
              <label>Email<input name="email" type="email" autocomplete="email" required /></label>
              <label>Empresa<input name="company" autocomplete="organization" /></label>
              <label class="public-contact-message">Mensagem<textarea name="message" rows="4" required></textarea></label>
              <p class="public-form-feedback" data-contact-feedback aria-live="polite"></p>
              <button class="public-button public-button-large" type="submit">Enviar mensagem</button>
            </form>
          </section>

        </main>
        ${renderPublicFooter()}
      </div>
    </div>
  `;

  window.scrollTo(0, 0);
    bindPublicContactForm();
}

function renderLegalDocumentPage(activePage) {
  const documentData = getLegalDocument(activePage);
  if (!documentData) {
    if (reloadMissingLegalDocument(activePage)) {
      return;
    }
    root.innerHTML = `
      <div class="public-landing legal-page legal-saas-page public-saas-page">
        <div class="public-shell">
          ${renderLegalPublicNav(activePage)}
          <main class="legal-main legal-saas-main">
            <section class="legal-hero legal-saas-hero">
              <div class="legal-hero-copy">
                <p class="public-eyebrow">Documentos legais</p>
                <h1>Documento indisponível</h1>
                <p>Não foi possível carregar o conteúdo jurídico. Atualize a página ou tente novamente.</p>
              </div>
            </section>
          </main>
          ${renderPublicFooter()}
        </div>
      </div>
    `;
    return;
  }

  clearLegalReloadAttempt(activePage);
  renderLegalShell(
    activePage,
    documentData.title,
    documentData.subtitle,
    renderLegalDocumentBodyHtml(documentData),
    documentData.lastUpdated || LEGAL_LAST_UPDATED,
    documentData.reviewNote,
  );
}

function renderPrivacyPolicyPage() {
  renderLegalDocumentPage('privacy');
}

function renderTermsOfServicePage() {
  renderLegalDocumentPage('terms');
}

function renderDataDeletionPage() {
  const documentData = getLegalDocument('data-deletion');
  if (!documentData) {
    renderLegalDocumentPage('data-deletion');
    return;
  }

  clearLegalReloadAttempt('data-deletion');
  const contactEmail = 'PlataformMultiPublisher@gmail.com';
  const mailtoHref = `mailto:${contactEmail}?subject=${encodeURIComponent('Solicitação de exclusão de dados')}&body=${encodeURIComponent('E-mail do workspace:\n\nConta conectada (YouTube, TikTok ou Instagram), se aplicável:\n\nSolicitação: exclusão de dados / revogação de acesso\n\nDetalhes adicionais:\n')}`;
  const bodyHtml = renderLegalDocumentBodyHtml(documentData);
  const documentBody = addLegalSectionIds(bodyHtml);
  const headings = getLegalDocumentHeadings(bodyHtml);
  const tocHtml = headings.map((heading, index) => `
    <a href="#legal-section-${index}">${escapeHtml(heading)}</a>
  `).join('');

  root.innerHTML = `
    <div class="public-landing legal-page legal-saas-page public-saas-page data-deletion-page" data-legal-page="data-deletion" data-legal-accent="green">
      <div class="public-ambient-bg" aria-hidden="true">
        <div class="public-ambient-orb public-ambient-orb-1"></div>
        <div class="public-ambient-grid"></div>
      </div>
      <div class="public-shell">
        ${renderLegalPublicNav('data-deletion')}
        <main class="legal-main legal-saas-main">
          <section class="deletion-hero">
            <div class="deletion-hero-copy">
              <p class="public-eyebrow">/data-deletion</p>
              <span class="legal-hero-badge">Controle do usu&aacute;rio</span>
              <h1>Seus dados.<br />Sua decis&atilde;o.</h1>
              <p>Revogue o acesso de uma plataforma conectada ou solicite a exclus&atilde;o dos dados da sua conta PMP. As duas a&ccedil;&otilde;es s&atilde;o diferentes — e explicamos cada uma sem letras mi&uacute;das.</p>
              <div class="deletion-hero-actions">
                <a class="public-button public-button-large deletion-primary-action" href="${escapeAttribute(mailtoHref)}">Solicitar exclus&atilde;o</a>
                <a class="public-ghost-button" href="#escolha">Entender as op&ccedil;&otilde;es</a>
              </div>
              <div class="deletion-trust-line" aria-label="Resumo do processo">
                <span>Processamento em at&eacute; 30 dias</span>
                <span>Verifica&ccedil;&atilde;o de identidade</span>
                <span>Contato pelo e-mail da conta</span>
              </div>
            </div>
            <aside class="deletion-request-card" aria-label="Dados necessarios para a solicitacao">
              <div class="deletion-request-index">SOLICITA&Ccedil;&Atilde;O / 01</div>
              <h2>Tenha estas informa&ccedil;&otilde;es em m&atilde;os</h2>
              <ol>
                <li><span>01</span><div><strong>E-mail do workspace</strong><small>Envie a mensagem pelo mesmo endere&ccedil;o usado na conta PMP.</small></div></li>
                <li><span>02</span><div><strong>Conta conectada</strong><small>Informe YouTube, TikTok ou Instagram, quando aplic&aacute;vel.</small></div></li>
                <li><span>03</span><div><strong>Escopo do pedido</strong><small>Indique se deseja revogar acesso ou excluir os dados.</small></div></li>
              </ol>
              <a href="${escapeAttribute(mailtoHref)}">Abrir solicita&ccedil;&atilde;o por e-mail <span aria-hidden="true">&rarr;</span></a>
            </aside>
          </section>

          <section id="escolha" class="deletion-choice-section">
            <header class="deletion-section-heading">
              <p class="public-eyebrow">Antes de continuar</p>
              <h2>Escolha a a&ccedil;&atilde;o certa.</h2>
              <p>Revogar acesso interrompe a conex&atilde;o com uma plataforma. Excluir dados remove os registros aplic&aacute;veis mantidos pelo PMP.</p>
            </header>
            <div class="deletion-choice-list">
              <article>
                <div class="deletion-choice-number">A</div>
                <div>
                  <span class="deletion-choice-label">A&ccedil;&atilde;o imediata</span>
                  <h3>Revogar acesso</h3>
                  <p>Desconecte a conta na &aacute;rea de contas do workspace ou revogue o PMP diretamente nas configura&ccedil;&otilde;es da plataforma conectada. O token deixa de ser usado em futuras publica&ccedil;&otilde;es.</p>
                </div>
                <span class="deletion-choice-outcome">Interrompe a conex&atilde;o</span>
              </article>
              <article class="is-destructive">
                <div class="deletion-choice-number">B</div>
                <div>
                  <span class="deletion-choice-label">Pedido permanente</span>
                  <h3>Excluir dados</h3>
                  <p>Solicite a exclus&atilde;o dos dados da conta, tokens OAuth criptografados, registros de m&iacute;dia, campanhas, publica&ccedil;&otilde;es e dados de integra&ccedil;&atilde;o aplic&aacute;veis.</p>
                </div>
                <a href="${escapeAttribute(mailtoHref)}">Iniciar pedido</a>
              </article>
            </div>
          </section>

          <section class="deletion-process-section" aria-labelledby="deletion-process-title">
            <header class="deletion-section-heading">
              <p class="public-eyebrow">Como funciona</p>
              <h2 id="deletion-process-title">Um processo claro, do pedido &agrave; conclus&atilde;o.</h2>
            </header>
            <ol class="deletion-process">
              <li><span>01</span><strong>Envie o pedido</strong><p>Use o e-mail associado &agrave; conta e o assunto “Solicita&ccedil;&atilde;o de exclus&atilde;o de dados”.</p></li>
              <li><span>02</span><strong>Confirme sua identidade</strong><p>Podemos solicitar uma verifica&ccedil;&atilde;o para impedir exclus&otilde;es n&atilde;o autorizadas.</p></li>
              <li><span>03</span><strong>Aguarde o processamento</strong><p>Pedidos v&aacute;lidos s&atilde;o processados em at&eacute; 30 dias, salvo prazo legal diferente.</p></li>
              <li><span>04</span><strong>Receba a confirma&ccedil;&atilde;o</strong><p>O retorno ser&aacute; enviado ao endere&ccedil;o usado para abrir a solicita&ccedil;&atilde;o.</p></li>
            </ol>
            <aside class="deletion-retention-note">
              <strong>O que pode permanecer?</strong>
              <p>Registros limitados podem ser mantidos quando necess&aacute;rios para obriga&ccedil;&otilde;es legais, seguran&ccedil;a, preven&ccedil;&atilde;o a fraude, disputas, recupera&ccedil;&atilde;o de backup, registros financeiros ou depend&ecirc;ncias de campanhas ainda n&atilde;o resolvidas.</p>
            </aside>
          </section>

          <section class="deletion-document-intro">
            <div>
              <p class="public-eyebrow">Documento completo</p>
              <h2>Crit&eacute;rios e condi&ccedil;&otilde;es</h2>
            </div>
            <p>Leia os detalhes oficiais sobre escopo, verifica&ccedil;&atilde;o, prazo de processamento e reten&ccedil;&atilde;o limitada. Atualizado em ${escapeHtml(documentData.lastUpdated || LEGAL_LAST_UPDATED)}.</p>
          </section>
          <section class="legal-content-shell deletion-legal-content">
            <aside class="legal-toc" aria-label="Indice do documento">
              <strong>Nesta p&aacute;gina</strong>
              ${tocHtml}
            </aside>
            <article class="legal-document">${documentBody}</article>
          </section>

          <section class="deletion-final-cta">
            <div>
              <p class="public-eyebrow">Canal oficial</p>
              <h2>Pronto para enviar seu pedido?</h2>
              <p>O bot&atilde;o abre uma mensagem com o assunto e os campos necess&aacute;rios. Envie pelo e-mail associado &agrave; sua conta.</p>
            </div>
            <div class="deletion-final-action">
              <a class="public-button public-button-large" href="${escapeAttribute(mailtoHref)}">Preparar solicita&ccedil;&atilde;o</a>
              <span>${escapeHtml(contactEmail)}</span>
            </div>
          </section>
        </main>
        ${renderPublicFooter()}
      </div>
    </div>
  `;

  window.scrollTo(0, 0);
  }
function unauthorizedRedirect() {
  state.me = null;
  navigate('/login', true);
}

function bindPublicContactForm() {
  const form = document.querySelector('[data-public-contact-form]');
  if (!(form instanceof HTMLFormElement)) return;
  const feedback = form.querySelector('[data-contact-feedback]');
  const setFeedback = (tone, message) => {
    if (!feedback) return;
    feedback.setAttribute('data-tone', tone);
    feedback.textContent = message;
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const name = String(data.get('name') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    const company = String(data.get('company') ?? '').trim();
    const message = String(data.get('message') ?? '').trim();
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (!name || !email || !message) {
      setFeedback('error', 'Preencha nome, email e mensagem para enviar.');
      return;
    }
    if (!emailValid) {
      setFeedback('error', 'Informe um email valido.');
      return;
    }

    const subject = `Contato pelo site - ${name}`;
    const body = [
      `Nome: ${name}`,
      `Email: ${email}`,
      `Empresa: ${company || 'Nao informado'}`,
      '',
      message,
    ].join('\n');

    setFeedback('success', 'Mensagem preparada. Seu aplicativo de email sera aberto para concluir o envio.');
    window.location.href = `mailto:PlataformMultiPublisher@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });
}

function normalizeLabel(value) {
  return String(value ?? '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function parseInteger(value, fallback, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function toDatetimeLocalValue(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const localDate = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function renderEmptyStateCard({ title, message, actionsHtml = '', tone = 'neutral' }) {
  return `
    <section class="card stack empty-state-card">
      <div class="stack">
        <h3>${escapeHtml(title)}</h3>
        <p class="muted">${escapeHtml(message)}</p>
      </div>
      ${actionsHtml ? `<div class="inline-actions">${actionsHtml}</div>` : ''}
    </section>
  `;
}

function getDisplayInitials(value) {
  const words = String(value ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const initials = words.slice(0, 2).map((word) => word[0]).join('').toUpperCase();
  return initials || 'CH';
}

function pickPreviewChannel(channels) {
  if (!Array.isArray(channels) || channels.length === 0) return null;
  return channels.find((channel) => channel.thumbnailUrl)
    ?? channels.find((channel) => channel.title || channel.handle)
    ?? channels[0];
}

function formatVisibleChannelName(channel, account = null) {
  return channel?.title
    ?? channel?.handle
    ?? account?.displayName
    ?? 'Unnamed channel';
}

function channelAvatarHtml(channel, label, className = 'channel-avatar') {
  if (channel?.thumbnailUrl) {
    return `<img class="${escapeAttribute(className)}" src="${escapeAttribute(channel.thumbnailUrl)}" alt="${escapeAttribute(label)}" loading="lazy" decoding="async" />`;
  }
  return `<span class="${escapeAttribute(className)} placeholder" aria-hidden="true">${escapeHtml(getDisplayInitials(label))}</span>`;
}

function getAccountPlatformKey(provider) {
  switch ((provider ?? '').toLowerCase()) {
    case 'tiktok':
      return 'tiktok';
    case 'instagram':
      return 'instagram';
    case 'youtube':
    case 'google':
    default:
      return 'youtube';
  }
}

function accountPlatformLogoHtml(provider, className = 'account-platform-logo') {
  const platformKey = getAccountPlatformKey(provider);
  const safePlatform = CAMPAIGN_FLOW_PLATFORMS.includes(platformKey) ? platformKey : 'youtube';
  return `
    <span class="${escapeAttribute(`${className} ${platformKey}`)}" title="${escapeAttribute(getProviderLabel(platformKey))}">
      ${renderCampaignPlatformMark(safePlatform, 'account-platform-mark')}
    </span>
  `;
}

function getProviderLabel(provider) {
  switch ((provider ?? '').toLowerCase()) {
    case 'youtube':
      return 'YouTube';
    case 'tiktok':
      return 'TikTok';
    case 'instagram':
      return 'Instagram';
    case 'google':
    default:
      return 'Google';
  }
}

function supportsChannels(provider) {
  const normalized = (provider ?? '').toLowerCase();
  return normalized === 'google' || normalized === 'youtube';
}

function isSupportedWorkspaceProvider(provider) {
  const normalized = (provider ?? '').toLowerCase();
  return normalized === 'google' || normalized === 'youtube' || normalized === 'tiktok' || normalized === 'instagram';
}

function buildMediaAssetFileUrl(assetId) {
  return `/media-files/${encodeURIComponent(assetId)}`;
}

function renderMediaPreviewSizePicker(assetId, previewSizeLabel, previewSize) {
  const sizeOptionsHtml = MEDIA_PREVIEW_SIZE_OPTIONS.map((option) => `
    <button
      class="${option.id === previewSize ? 'btn-primary' : 'btn'} media-preview-size-option"
      type="button"
      data-action="set-media-preview-size"
      data-media-id="${escapeHtml(assetId)}"
      data-preview-size="${escapeHtml(option.id)}"
    >
      ${escapeHtml(option.label)}
    </button>
  `).join('');

  return `
    <details class="media-preview-picker">
      <summary class="button button-secondary">Display: ${escapeHtml(previewSizeLabel)}</summary>
      <div class="media-preview-picker-menu">
        ${sizeOptionsHtml}
      </div>
    </details>
  `;
}

function renderMediaFileActionLinks(asset) {
  const fileUrl = buildMediaAssetFileUrl(asset.id);
  const fileName = asset.original_name ?? asset.id;

  return `
    <a class="button button-secondary" href="${escapeAttribute(fileUrl)}" target="_blank" rel="noopener noreferrer">Open</a>
    <a class="button button-secondary" href="${escapeAttribute(fileUrl)}" download="${escapeAttribute(fileName)}">Download</a>
  `;
}

function renderVideoPreviewCell(asset) {
  const previewSize = getMediaPreviewSizeForAsset(asset.id);
  const previewSizeLabel = getMediaPreviewSizeLabel(previewSize);
  const videoUrl = buildMediaAssetFileUrl(asset.id);
  const posterUrl = asset.thumbnail?.id ? buildMediaAssetFileUrl(asset.thumbnail.id) : '';

  return `
    <div class="media-preview-stack">
      <div
        class="media-preview-frame"
        data-action="open-media-preview"
        data-media-id="${escapeHtml(asset.id)}"
        data-media-preview-frame="true"
        data-preview-size="${escapeHtml(previewSize)}"
        tabindex="0"
        role="button"
        aria-label="Preview de video ${escapeHtml(asset.original_name ?? asset.id)}"
      >
        <video
          class="media-preview-video"
          data-preview-video="true"
          muted
          playsinline
          loop
          preload="metadata"
          src="${escapeHtml(videoUrl)}#t=0.5"
          ${posterUrl ? `poster="${escapeHtml(posterUrl)}"` : ''}
        ></video>
        <div class="media-preview-overlay">
          <span class="media-preview-hint">Passe o mouse para preview e clique para abrir</span>
          <span class="media-preview-size-pill">${escapeHtml(previewSizeLabel)}</span>
        </div>
      </div>
      ${renderMediaPreviewSizePicker(asset.id, previewSizeLabel, previewSize)}
    </div>
  `;
}

function renderThumbnailPreviewCell(asset) {
  const previewSize = getMediaPreviewSizeForAsset(asset.id);
  const previewSizeLabel = getMediaPreviewSizeLabel(previewSize);
  const imageUrl = buildMediaAssetFileUrl(asset.id);

  return `
    <div class="media-preview-stack">
      <div
        class="media-preview-frame media-preview-image-frame"
        data-action="open-media-preview"
        data-media-id="${escapeHtml(asset.id)}"
        data-preview-size="${escapeHtml(previewSize)}"
        tabindex="0"
        role="button"
        aria-label="Preview de thumbnail ${escapeHtml(asset.original_name ?? asset.id)}"
      >
        <img
          class="media-preview-image"
          src="${escapeHtml(imageUrl)}"
          alt="${escapeHtml(asset.original_name ?? asset.id)}"
          loading="lazy"
          decoding="async"
        />
        <div class="media-preview-overlay">
          <span class="media-preview-hint">Passe o mouse para ampliar e clique para abrir</span>
          <span class="media-preview-size-pill">${escapeHtml(previewSizeLabel)}</span>
        </div>
      </div>
      ${renderMediaPreviewSizePicker(asset.id, previewSizeLabel, previewSize)}
    </div>
  `;
}

async function backfillMissingMediaDurations(assets) {
  const candidates = assets
    .filter((asset) => asset?.asset_type === 'video' && Number(asset.duration_seconds ?? 0) <= 0 && asset.id)
    .filter((asset) => !state.mediaDurationBackfillInFlight.has(asset.id))
    .slice(0, 6);
  if (candidates.length === 0) {
    return;
  }

  let updatedAny = false;
  await Promise.all(candidates.map(async (asset) => {
    state.mediaDurationBackfillInFlight.add(asset.id);
    try {
      const durationSeconds = await readVideoDurationFromUrl(buildMediaAssetFileUrl(asset.id));
      if (typeof durationSeconds !== 'number' || durationSeconds <= 0) {
        return;
      }
      const updateResult = await api.updateMediaDuration(asset.id, durationSeconds);
      if (updateResult.ok) {
        updatedAny = true;
      }
    } finally {
      state.mediaDurationBackfillInFlight.delete(asset.id);
    }
  }));

  if (updatedAny) {
    const path = window.location.pathname;
    if (path === '/workspace/videos') {
      await renderVideosPage();
    } else if (path === '/workspace/media') {
      await renderMediaPage();
    }
  }
}

function openMediaPreviewDialog(asset) {
  if (!asset?.id) {
    return Promise.resolve(null);
  }

  const previewUrl = buildMediaAssetFileUrl(asset.id);
  const assetName = asset.original_name ?? asset.id;
  const assetTypeLabel = asset.asset_type === 'thumbnail'
    ? 'Thumbnail'
    : asset.asset_type === 'video'
      ? 'Video'
      : asset.asset_type ?? 'Asset';
  const formatLabel = asset.asset_type === 'video'
    ? getVideoPublishFormatLabel(getVideoPublishFormat(asset))
    : null;
  const detailItems = [
    `<span class="pill info">${escapeHtml(assetTypeLabel)}</span>`,
    formatLabel ? `<span class="pill">${escapeHtml(formatLabel)}</span>` : '',
    `<span class="media-preview-modal-meta-item">${escapeHtml(formatBytes(asset.size_bytes))}</span>`,
    asset.duration_seconds ? `<span class="media-preview-modal-meta-item">${escapeHtml(formatDurationSeconds(asset.duration_seconds))}</span>` : '',
    `<span class="media-preview-modal-meta-item"><code>${escapeHtml(asset.id)}</code></span>`,
  ].filter(Boolean).join('');

  const mediaHtml = asset.asset_type === 'video'
    ? `
      <video
        class="media-preview-modal-media"
        controls
        playsinline
        preload="metadata"
        src="${escapeHtml(previewUrl)}"
      ></video>
    `
    : `
      <img
        class="media-preview-modal-media"
        src="${escapeHtml(previewUrl)}"
        alt="${escapeHtml(assetName)}"
        loading="eager"
        decoding="async"
      />
    `;

  return showModal({
    title: assetName,
    message: 'Preview ampliado do asset selecionado.',
    tone: 'info',
    confirmLabel: '',
    cancelLabel: 'Fechar',
    cardClassName: 'media-preview-modal-card',
    bodyHtml: `
      <div class="media-preview-modal-content">
        <div class="media-preview-modal-stage">
          ${mediaHtml}
        </div>
        <div class="media-preview-modal-meta">
          ${detailItems}
        </div>
        <div class="inline-actions media-preview-modal-actions">
          ${renderMediaFileActionLinks(asset)}
        </div>
      </div>
    `,
  });
}

function summarizeCampaignOutcomes(campaign) {
  const targets = Array.isArray(campaign?.targets) ? campaign.targets : [];
  let published = 0;
  let failed = 0;
  let pending = 0;
  let reauthRequired = 0;

  for (const target of targets) {
    if (target.status === 'publicado' && (target.youtubeVideoId || target.externalPublishId)) {
      published += 1;
      continue;
    }
    if (target.status === 'erro' && target.errorMessage) {
      failed += 1;
      if (target.errorMessage === 'REAUTH_REQUIRED' || target.reauthRequired === true) {
        reauthRequired += 1;
      }
      continue;
    }
    pending += 1;
  }

  return {
    total: targets.length,
    published,
    failed,
    pending,
    reauthRequired,
  };
}

function shouldAutoRefreshDashboard(stats) {
  const campaignsByStatus = stats?.campaigns?.byStatus ?? {};
  const jobsByStatus = stats?.jobs?.byStatus ?? {};

  return Number(campaignsByStatus.launching ?? 0) > 0 ||
    Number(jobsByStatus.queued ?? 0) > 0 ||
    Number(jobsByStatus.processing ?? 0) > 0;
}

async function renderDashboardPage() {
  return renderPlatformDashboardPage();
}

const GROWTH_SECTIONS = [
  { id: 'cockpit', label: 'Cockpit', href: '/workspace/growth', eyebrow: 'Centro de decisao' },
  { id: 'conteudo', label: 'Conteudo', href: '/workspace/growth/conteudo', eyebrow: 'Laboratorio' },
  { id: 'metricas', label: 'Metricas', href: '/workspace/growth/metricas', eyebrow: 'Metricas' },
  { id: 'campanhas', label: 'Campanhas', href: '/workspace/growth/campanhas', eyebrow: 'Campanhas' },
  { id: 'relatorios', label: 'Relatorios', href: '/workspace/growth/relatorios', eyebrow: 'Relatorios' },
];

const GROWTH_LEGACY_SECTION_MAP = Object.freeze({
  overview: 'cockpit',
  calendario: 'conteudo',
  ideias: 'conteudo',
  roteiro: 'conteudo',
  biblioteca: 'conteudo',
});

const GROWTH_TEMPLATE_DATA = {
  ideas: [
    { title: '3 erros comuns que iniciantes cometem no seu nicho', platform: 'TikTok', format: 'TikTok', effort: 'Baixo', objective: 'Alcance' },
    { title: 'Antes e depois de um processo real', platform: 'Instagram', format: 'Reels', effort: 'Medio', objective: 'Engajamento real' },
    { title: 'O que ninguem te conta sobre esse assunto', platform: 'YouTube', format: 'Video longo', effort: 'Alto', objective: 'Educacao' },
    { title: 'Checklist rapido para resolver um problema comum', platform: 'Instagram', format: 'Carrossel', effort: 'Baixo', objective: 'Conversao' },
    { title: 'Respondendo uma duvida frequente da audiencia', platform: 'YouTube', format: 'Short', effort: 'Medio', objective: 'Educacao' },
  ],
  library: [
    { title: 'Roteiro: gancho dos 3 segundos', type: 'Roteiro', platform: 'TikTok', status: 'Publicado', date: '01 Mai' },
    { title: 'Legenda para conteudo educativo', type: 'Legenda', platform: 'Instagram', status: 'Rascunho', date: '03 Mai' },
    { title: 'Hashtags para social media', type: 'Hashtags', platform: 'Instagram', status: 'Revisar', date: '05 Mai' },
    { title: 'Modelo de CTA para YouTube', type: 'Modelo de CTA', platform: 'YouTube', status: 'Publicado', date: '07 Mai' },
    { title: 'Briefing de campanha local', type: 'Briefing', platform: 'TikTok', status: 'Agendado', date: '09 Mai' },
  ],
};

function getGrowthSectionFromPath(pathname = window.location.pathname) {
  const match = pathname.match(/^\/workspace\/growth\/([^/?#]+)/);
  const requested = match ? decodeURIComponent(match[1]) : 'cockpit';
  const normalized = GROWTH_LEGACY_SECTION_MAP[requested] ?? requested;
  return GROWTH_SECTIONS.some((section) => section.id === normalized) ? normalized : 'cockpit';
}

function renderGrowthHeader(sectionId, growthData = buildGrowthWorkspaceData()) {
  const active = GROWTH_SECTIONS.find((section) => section.id === sectionId) ?? GROWTH_SECTIONS[0];
  return `
    <section class="growth-shell-hero" data-growth-header>
      <div>
        <span class="growth-eyebrow">${escapeHtml(active.eyebrow)}</span>
        <h2>Growth</h2>
        <p>Centro de decisao do PMP para escolher o que postar, onde publicar, o que corrigir e o que repetir a partir de sinais reais do workspace.</p>
      </div>
      <div class="growth-hero-stack" aria-label="Resumo Growth">
        <strong>${escapeHtml(growthData.heroValue)}</strong>
        <span>${escapeHtml(growthData.heroLabel)}</span>
      </div>
    </section>
  `;
}

function renderGrowthNav(activeSection) {
  return `
    <nav class="growth-nav" aria-label="Growth sections">
      ${GROWTH_SECTIONS.map((section) => `
        <a class="growth-nav-link ${section.id === activeSection ? 'active' : ''}" data-link href="${escapeHtml(section.href)}">
          ${escapeHtml(section.label)}
        </a>
      `).join('')}
    </nav>
  `;
}

function growthPlatformBadge(platform) {
  const key = String(platform ?? '').toLowerCase();
  const tone = key.includes('youtube') ? 'youtube' : key.includes('instagram') ? 'instagram' : key.includes('tiktok') ? 'tiktok' : 'neutral';
  return `<span class="growth-badge growth-platform-${tone}">${escapeHtml(platform)}</span>`;
}

function growthStatusBadge(status) {
  const normalized = String(status ?? '').toLowerCase();
  const tone = normalized.includes('publicado') || normalized.includes('ativa') || normalized.includes('melhor') || normalized.includes('alta') || normalized.includes('completed') || normalized.includes('ready')
    ? 'success'
    : normalized.includes('revisar') || normalized.includes('agendado') || normalized.includes('draft') || normalized.includes('launching')
      ? 'warning'
      : normalized.includes('pausada') || normalized.includes('melhorar') || normalized.includes('failed') || normalized.includes('erro') || normalized.includes('reauth')
        ? 'danger'
        : 'neutral';
  return `<span class="growth-badge growth-status-${tone}">${escapeHtml(status)}</span>`;
}

function renderGrowthMetricCard(metric) {
  return `
    <article class="growth-card growth-metric-card">
      <div class="growth-card-topline">
        <span>${escapeHtml(metric.label)}</span>
        <span class="growth-card-icon">${renderCampaignMark(metric.icon, metric.tone, 'growth-metric-mark')}</span>
      </div>
      <strong>${escapeHtml(metric.value)}</strong>
      <small>${escapeHtml(metric.change)}</small>
    </article>
  `;
}

function renderGrowthBarChart(items) {
  return `
    <div class="growth-bars">
      ${items.map((item) => `
        <div class="growth-bar-row">
          <div><span>${escapeHtml(item.label)}</span><strong>${formatNumber(item.value)}%</strong></div>
          <span class="growth-bar-track"><span class="growth-bar-fill" style="width:${Math.max(0, Math.min(100, Number(item.value) || 0))}%"></span></span>
        </div>
      `).join('')}
    </div>
  `;
}

function renderGrowthLineChart(values, ariaLabel = 'Grafico operacional Growth') {
  const nums = (Array.isArray(values) ? values : []).map((value) => Number(value) || 0);
  const max = Math.max(1, ...nums);
  const points = nums.map((value, index) => {
    const x = nums.length <= 1 ? 0 : (index / (nums.length - 1)) * 100;
    const y = 92 - ((value / max) * 76);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
  return `
    <div class="growth-chart-grid">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="${escapeAttribute(ariaLabel)}">
        <polyline fill="none" points="${escapeAttribute(points)}" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="3"></polyline>
      </svg>
    </div>
  `;
}

function renderGrowthChartCard(title, bodyHtml, description = '') {
  return `
    <section class="growth-card growth-chart-card">
      <div class="growth-card-heading">
        <div>
          <h3>${escapeHtml(title)}</h3>
          ${description ? `<p>${escapeHtml(description)}</p>` : ''}
        </div>
        <span>${renderMediaMark('star', 'chip', 'info')}</span>
      </div>
      ${bodyHtml}
    </section>
  `;
}

function renderGrowthContentCard(post) {
  return `
    <article class="growth-card growth-content-card">
      <div class="growth-badge-row">${growthPlatformBadge(post.platform)}${growthStatusBadge(post.status)}</div>
      <h3>${escapeHtml(post.title)}</h3>
      <p>${escapeHtml(post.date)} as ${escapeHtml(post.time)}</p>
      <small>${escapeHtml(post.caption)}</small>
    </article>
  `;
}

function renderGrowthIdeaCard(idea) {
  return `
    <article class="growth-card growth-idea-card" data-growth-idea-card>
      <div class="growth-badge-row">${growthPlatformBadge(idea.platform)}<span class="growth-badge growth-status-neutral">${escapeHtml(idea.format)}</span></div>
      <h3>${escapeHtml(idea.title)}</h3>
      <div class="growth-mini-grid">
        <span><strong>Esforco:</strong> ${escapeHtml(idea.effort)}</span>
        <span><strong>Objetivo:</strong> ${escapeHtml(idea.objective)}</span>
      </div>
      <div class="growth-action-row">
        <button class="button button-secondary" type="button" data-growth-save-idea>Separar nesta sessao</button>
        <button class="button button-primary" type="button" data-growth-script-from-idea="${escapeAttribute(idea.title)}">Gerar roteiro</button>
      </div>
    </article>
  `;
}

function renderGrowthReportCard(report) {
  return `
    <article class="growth-card">
      <div class="growth-card-heading"><span>${renderMediaMark('library', 'chip', 'info')}</span><h3>${escapeHtml(report.title)}</h3></div>
      <p>${escapeHtml(report.summary)}</p>
    </article>
  `;
}

function renderGrowthScriptList(items) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!list.length) return '<p>Nenhum sinal disponivel ainda.</p>';
  return `<ul>${list.map((item) => `<li>${escapeHtml(String(item))}</li>`).join('')}</ul>`;
}

function renderGrowthScriptCampaignAction(details = {}) {
  if (!details.campaignReady) return '';
  const topic = String(details.topic ?? '').trim();
  if (!topic) return '';
  return `
    <section class="growth-script-next-action">
      <div>
        <strong>Proximo passo operacional</strong>
        <p>Use este roteiro como base para abrir uma campanha real no PMP.</p>
      </div>
      <a class="button button-primary" data-link href="${escapeAttribute(buildUrl('/workspace/campanhas/nova', { idea: topic }))}">Criar campanha com roteiro</a>
    </section>
  `;
}

function renderGrowthScriptTimeline(timeline) {
  const rows = Array.isArray(timeline) ? timeline.filter(Boolean) : [];
  if (!rows.length) return '';
  return rows.map((block) => `
    <div class="growth-script-timeline-row">
      <span>${escapeHtml(block.time ?? '')}</span>
      <p><strong>Fala:</strong> ${escapeHtml(block.speech ?? '')}</p>
      <small>${escapeHtml(block.onScreen ?? '')}</small>
    </div>
  `).join('');
}

function renderGrowthScriptResearchResult(result = {}) {
  const brief = result.brief ?? {};
  const signals = result.signals ?? {};
  const script = result.script ?? {};
  return `
    <section class="growth-script-brief">
      <div class="growth-card-heading">
        <div>
          <h3>Brief usado para gerar o roteiro</h3>
          <p>${escapeHtml(brief.summary ?? 'Brief operacional criado a partir do tema e dos sinais reais do Growth.')}</p>
        </div>
        <span>${renderMediaMark('star', 'chip', 'info')}</span>
      </div>
      <div class="growth-mini-grid growth-script-signal-grid">
        <span><strong>Melhor plataforma</strong><small>${escapeHtml(signals.bestPlatform ?? 'Sem sinal')}</small></span>
        <span><strong>Motivo</strong><small>${escapeHtml(signals.bestPlatformReason ?? 'Sem historico suficiente.')}</small></span>
        <span><strong>Canais ativos</strong><small>${escapeHtml(String(signals.activeChannels ?? 0))}</small></span>
        <span><strong>Falhas</strong><small>${escapeHtml(String(signals.failedTargets ?? 0))} destino(s)</small></span>
      </div>
      <div class="growth-script-brief-grid">
        <div><strong>Termos relacionados</strong>${renderGrowthScriptList(brief.relatedTerms)}</div>
        <div><strong>Duvidas frequentes</strong>${renderGrowthScriptList(brief.commonQuestions)}</div>
        <div><strong>Riscos de informacao</strong>${renderGrowthScriptList(brief.risks)}</div>
        <div><strong>Angulos atuais</strong>${renderGrowthScriptList(brief.currentAngles)}</div>
      </div>
    </section>
    <section class="growth-script-output">
      <div><strong>3 ganchos</strong>${renderGrowthScriptList(script.hooks)}</div>
      <div><strong>Promessa clara</strong><p>${escapeHtml(script.promise ?? '')}</p></div>
      <div><strong>Estrutura por segundos</strong><div class="growth-script-timeline">${renderGrowthScriptTimeline(script.timeline)}</div></div>
      <div><strong>CTA</strong><p>${escapeHtml(script.cta ?? '')}</p></div>
      <div><strong>Legenda</strong><p>${escapeHtml(script.caption ?? '')}</p></div>
      <div><strong>Hashtags</strong><p>${Array.isArray(script.hashtags) ? script.hashtags.map((tag) => escapeHtml(String(tag))).join(' ') : ''}</p></div>
      <div><strong>Adaptacao por plataforma</strong>${renderGrowthScriptList(script.platformAdaptation)}</div>
    </section>
    ${renderGrowthScriptCampaignAction(result)}
  `;
}

function renderGrowthScriptResult(details = {}) {
  if (details?.brief && details?.script) {
    return renderGrowthScriptResearchResult(details);
  }
  const topic = String(details.topic ?? '').trim() || 'Como melhorar retencao em videos curtos';
  const platform = String(details.platform ?? '').trim() || 'YouTube';
  const duration = String(details.duration ?? '').trim() || '30 segundos';
  const tone = String(details.tone ?? '').trim() || 'Direto';
  const goal = String(details.goal ?? '').trim() || 'Educacao e retencao';

  return `
    ${details.error ? `<div class="growth-script-warning"><strong>Fallback local</strong><p>${escapeHtml(details.error)}</p></div>` : ''}
    <section class="growth-script-brief">
      <div class="growth-card-heading">
        <div>
          <h3>Brief usado para gerar o roteiro</h3>
          <p>Previa local. Ao gerar, o backend monta um brief operacional, cruza sinais reais do Growth e substitui este bloco por uma estrutura publicavel.</p>
        </div>
      </div>
      <div class="growth-script-brief-grid">
        <div><strong>Contexto basico</strong><p>${escapeHtml(topic)} deve abrir com problema claro, criterio simples e uma acao repetivel.</p></div>
        <div><strong>Risco principal</strong><p>Evitar promessa de engajamento garantido e separar opiniao de fato verificavel.</p></div>
      </div>
    </section>
    <section class="growth-script-output">
      <div><strong>3 ganchos</strong>${renderGrowthScriptList([
        `${topic}: o erro nao e falta de ideia, e falta de sinal.`,
        `Antes de publicar sobre ${topic}, use este checklist de ${duration}.`,
        `Se voce posta sobre ${topic} no escuro, comece por este criterio.`,
      ])}</div>
      <div><strong>Promessa clara</strong><p>Em ${escapeHtml(duration)}, entregar uma estrutura pratica para ${escapeHtml(goal.toLowerCase())}, sem prometer resultado artificial.</p></div>
      <div><strong>Estrutura por segundos</strong><div class="growth-script-timeline">${renderGrowthScriptTimeline([
        { time: '0-3s', speech: `Abra com a dor central de ${topic}.`, onScreen: `Problema: ${topic}` },
        { time: '3-9s', speech: `Mostre um exemplo rapido para ${platform}.`, onScreen: `Plataforma: ${platform}` },
        { time: '9-20s', speech: 'Entregue um metodo com gancho, teste e sinal observado.', onScreen: 'Gancho > teste > sinal' },
        { time: '20-30s', speech: 'Feche com uma acao simples para a proxima campanha.', onScreen: 'Salve e teste' },
      ])}</div></div>
      <div><strong>Tom e objetivo</strong><p>Tom ${escapeHtml(tone.toLowerCase())}. Objetivo: ${escapeHtml(goal)}.</p></div>
      <div><strong>CTA</strong><p>Salve este roteiro e teste esse formato no proximo conteudo.</p></div>
      <div><strong>Legenda</strong><p>Menos chute. Mais estrategia. Use um sinal de audiencia para ajustar seu proximo post.</p></div>
      <div><strong>Hashtags</strong><p>#conteudodigital #socialmedia #crescimentoorganico #videoscurtos #estrategiadeconteudo</p></div>
    </section>
    ${renderGrowthScriptCampaignAction({ ...details, topic })}
  `;
}

function buildGeneratedGrowthIdeas(topic) {
  const safeTopic = String(topic ?? '').trim() || 'conteudo educativo';
  return [
    {
      title: `3 erros sobre ${safeTopic} que reduzem retencao`,
      platform: 'TikTok',
      format: 'TikTok',
      effort: 'Baixo',
      objective: 'Alcance',
    },
    {
      title: `Checklist rapido de ${safeTopic} para salvar hoje`,
      platform: 'Instagram',
      format: 'Reels',
      effort: 'Baixo',
      objective: 'Engajamento real',
    },
    {
      title: `Como melhorar ${safeTopic} sem atalhos perigosos`,
      platform: 'YouTube',
      format: 'Video longo',
      effort: 'Medio',
      objective: 'Educacao',
    },
  ];
}

function renderGrowthEmptyState(title, description, action = '', actionHref = '') {
  return `
    <section class="growth-empty-state">
      <span>${renderMediaMark('add', 'chip', 'warning')}</span>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(description)}</p>
      ${action && actionHref ? `<a class="button button-primary" data-link href="${escapeAttribute(actionHref)}">${escapeHtml(action)}</a>` : ''}
    </section>
  `;
}

const GROWTH_PLATFORM_KEYS = ['youtube', 'instagram', 'tiktok'];
const GROWTH_CHANNEL_HYDRATED_SECTIONS = new Set(['cockpit', 'metricas', 'relatorios']);
const GROWTH_CHANNEL_LOAD_CONCURRENCY = 4;
const GROWTH_CHANNEL_LOAD_TIMEOUT_MS = 2500;
const GROWTH_CHANNEL_TIMEOUT_RESULT = Object.freeze({ ok: false, timedOut: true });

function clampGrowthPercent(value) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function normalizeGrowthPlatformKey(platform) {
  const normalized = String(platform ?? '').trim().toLowerCase();
  if (normalized === 'youtube' || normalized === 'google') return 'youtube';
  if (normalized === 'instagram') return 'instagram';
  if (normalized === 'tiktok') return 'tiktok';
  return null;
}

function formatGrowthShortDate(value) {
  if (!value) return 'Sem data';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString(getActiveLocale(), { day: '2-digit', month: 'short' });
}

function formatGrowthShortTime(value) {
  if (!value) return '--:--';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '--:--';
  return parsed.toLocaleTimeString(getActiveLocale(), { hour: '2-digit', minute: '2-digit' });
}

function getGrowthEventDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getGrowthCampaignDate(campaign) {
  const firstTarget = getGrowthCampaignTargets(campaign)[0];
  return getGrowthEventDate(campaign?.scheduledAt)
    ?? getGrowthEventDate(firstTarget?.publishAt)
    ?? getGrowthEventDate(campaign?.updatedAt)
    ?? getGrowthEventDate(campaign?.createdAt);
}

function isGrowthDateInFilter(date, filterValue) {
  if (!date || filterValue === 'all') return filterValue === 'all';
  const now = new Date();
  if (filterValue === '7d' || filterValue === '30d') {
    const days = filterValue === '7d' ? 7 : 30;
    const cutoff = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
    return date >= cutoff && date <= now;
  }
  if (filterValue === 'month') {
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }
  return true;
}

function getGrowthCampaignTargets(campaign) {
  return Array.isArray(campaign?.targets) ? campaign.targets : [];
}

function growthCampaignStatusLabel(status) {
  switch (String(status ?? '').toLowerCase()) {
    case 'ready':
      return 'Pronta';
    case 'launching':
      return 'Publicando';
    case 'completed':
      return 'Concluida';
    case 'failed':
      return 'Com falha';
    case 'draft':
    default:
      return 'Rascunho';
  }
}

function getGrowthPrimaryPlatform(campaign) {
  const target = getGrowthCampaignTargets(campaign)[0];
  return dashboardPlatformLabel(normalizeGrowthPlatformKey(target?.platform));
}

function buildGrowthPosts(campaigns) {
  return campaigns.slice(0, 8).map((campaign) => {
    const targets = getGrowthCampaignTargets(campaign);
    const firstTarget = targets[0];
    const dateValue = campaign.scheduledAt ?? firstTarget?.publishAt ?? campaign.createdAt ?? campaign.updatedAt;
    return {
      title: campaign.title || 'Campanha sem titulo',
      platform: getGrowthPrimaryPlatform(campaign),
      date: formatGrowthShortDate(dateValue),
      time: formatGrowthShortTime(dateValue),
      status: growthCampaignStatusLabel(campaign.status),
      caption: targets.length
        ? `${formatNumber(targets.length)} destino${targets.length === 1 ? '' : 's'} conectado${targets.length === 1 ? '' : 's'} nesta campanha.`
        : 'Campanha ainda sem destinos conectados.',
    };
  });
}

function buildGrowthCampaignRows(campaigns) {
  return campaigns.slice(0, 9).map((campaign) => {
    const targets = getGrowthCampaignTargets(campaign);
    const published = targets.filter((target) => target.status === 'publicado').length;
    const failed = targets.filter((target) => target.status === 'erro').length;
    const platform = getGrowthPrimaryPlatform(campaign);
    const periodSource = campaign.scheduledAt ?? campaign.createdAt ?? campaign.updatedAt;
    return {
      id: campaign.id,
      name: campaign.title || 'Campanha sem titulo',
      platform,
      period: campaign.scheduledAt ? `Agendada: ${formatDate(campaign.scheduledAt)}` : `Criada: ${formatGrowthShortDate(periodSource)}`,
      objective: `${formatNumber(targets.length)} destino${targets.length === 1 ? '' : 's'} - ${growthCampaignStatusLabel(campaign.status)}`,
      link: `/workspace/campanhas/${campaign.id}`,
      published,
      failed,
      status: growthCampaignStatusLabel(campaign.status),
    };
  });
}

function buildGrowthContentRanking(channels, campaigns) {
  const channelRows = channels
    .map((channel) => {
      const title = channel.topVideoTitle || channel.channelLabel || channel.channelId || 'Canal conectado';
      const reach = dashboardNumber(channel.topVideoViews || channel.totalViews);
      return {
        rawReach: reach,
        title,
        platform: 'YouTube',
        date: 'Sincronizado',
        reach: formatNumber(reach),
        retention: formatPercent(channel.successRate ?? 0, 0),
        comments: dashboardNumber(channel.published ?? 0),
        status: reach > 0 ? 'Maior alcance' : 'Sem views',
      };
    })
    .filter((row) => row.title);

  if (channelRows.length) {
    return channelRows
      .sort((left, right) => right.rawReach - left.rawReach)
      .slice(0, 8)
      .map(({ rawReach, ...row }) => row);
  }

  return campaigns.slice(0, 8).map((campaign) => {
    const targets = getGrowthCampaignTargets(campaign);
    const published = targets.filter((target) => target.status === 'publicado').length;
    const failed = targets.filter((target) => target.status === 'erro').length;
    const completed = published + failed;
    const successRate = completed > 0 ? (published / completed) * 100 : 0;
    return {
      title: campaign.title || 'Campanha sem titulo',
      platform: getGrowthPrimaryPlatform(campaign),
      date: formatGrowthShortDate(campaign.updatedAt ?? campaign.createdAt),
      reach: formatNumber(targets.length),
      retention: formatPercent(successRate, 0),
      comments: published,
      status: growthCampaignStatusLabel(campaign.status),
    };
  });
}

function buildGrowthRecommendations({ connectedAccounts, activeJobs, failedTargets, successRate, totalViews, campaigns }) {
  const recommendations = [];
  if (!connectedAccounts.length) {
    recommendations.push('Conecte YouTube, TikTok ou Instagram para liberar sinais reais de distribuicao no Growth.');
  }
  if (failedTargets > 0) {
    recommendations.push(`Revise ${formatNumber(failedTargets)} destino${failedTargets === 1 ? '' : 's'} com falha antes de criar novas campanhas.`);
  }
  if (activeJobs > 0) {
    recommendations.push(`${formatNumber(activeJobs)} job${activeJobs === 1 ? '' : 's'} ainda estao na fila ou processando; acompanhe antes de reprogramar.`);
  }
  if (successRate >= 80) {
    recommendations.push(`A taxa de sucesso esta em ${formatPercent(successRate, 0)}. Priorize ampliar campanhas que ja usam destinos estaveis.`);
  }
  if (totalViews > 0) {
    recommendations.push(`O alcance sincronizado soma ${formatNumber(totalViews)} views. Use os canais com maior tracao para os proximos roteiros.`);
  }
  if (campaigns.length > 0) {
    recommendations.push(`Transforme as ${formatNumber(campaigns.length)} campanhas recentes em ideias reutilizaveis para biblioteca e calendario.`);
  }
  return recommendations.slice(0, 5);
}

function buildGrowthReports(data) {
  const channelLabel = data.activeChannels === 1 ? 'canal ativo' : 'canais ativos';
  const connectionText = data.channelSyncStatus === 'partial'
    ? `${formatNumber(data.connectedAccounts.length)} conta${data.connectedAccounts.length === 1 ? '' : 's'} conectada${data.connectedAccounts.length === 1 ? '' : 's'}, mas ${formatNumber(data.channelSync.failed)} conta${data.channelSync.failed === 1 ? '' : 's'} nao retornou${data.channelSync.failed === 1 ? '' : 'aram'} canais agora.`
    : data.channelSyncStatus === 'pending'
      ? `${formatNumber(data.connectedAccounts.length)} conta${data.connectedAccounts.length === 1 ? '' : 's'} conectada${data.connectedAccounts.length === 1 ? '' : 's'}; canais ainda estao sincronizando.`
      : data.connectedAccounts.length
    ? `${formatNumber(data.connectedAccounts.length)} conta${data.connectedAccounts.length === 1 ? '' : 's'} conectada${data.connectedAccounts.length === 1 ? '' : 's'} e ${formatNumber(data.activeChannels)} ${channelLabel}.`
    : 'Nenhuma conta conectada ainda; o Growth esta pronto para usar assim que houver destinos reais.';
  return [
    {
      title: 'Resumo operacional',
      summary: `${formatNumber(data.campaignTotal)} campanha${data.campaignTotal === 1 ? '' : 's'}, ${formatNumber(data.publishedTargets)} destino${data.publishedTargets === 1 ? '' : 's'} publicado${data.publishedTargets === 1 ? '' : 's'} e taxa de sucesso de ${formatPercent(data.successRate, 0)}.`,
    },
    {
      title: 'Saude das contas',
      summary: connectionText,
    },
    {
      title: data.failedTargets > 0 ? 'Risco atual' : 'Proxima oportunidade',
      summary: data.failedTargets > 0
        ? `${formatNumber(data.failedTargets)} falha${data.failedTargets === 1 ? '' : 's'} precisa${data.failedTargets === 1 ? '' : 'm'} de revisao antes de escalar a rotina.`
        : 'Sem falhas recentes nos dados carregados. Use este momento para planejar uma nova rodada de conteudo.',
    },
  ];
}

function buildGrowthWorkspaceData(input = {}) {
  const stats = input.stats && typeof input.stats === 'object' ? input.stats : {};
  const campaigns = Array.isArray(input.campaigns) ? input.campaigns : [];
  const accounts = Array.isArray(input.accounts) ? input.accounts : (Array.isArray(state.growthConnectedAccounts) ? state.growthConnectedAccounts : []);
  const connectedAccounts = accounts.filter((account) => String(account?.status ?? '').toLowerCase() === 'connected');
  const connectedAccountIds = new Set(
    connectedAccounts.map((account) => String(account?.id ?? '')).filter(Boolean)
  );
  const rawAccountChannels = Array.isArray(input.accountChannels) ? input.accountChannels : [];
  const accountChannels = rawAccountChannels.filter((channel) => {
    const accountId = channel?.connectedAccountId ?? channel?.accountId;
    return !accountId || connectedAccountIds.has(String(accountId));
  });
  const activeChannels = accountChannels.filter((channel) => channel?.isActive !== false).length;
  const channels = Array.isArray(stats.channels) ? stats.channels : [];
  const channelSync = input.channelSync && typeof input.channelSync === 'object'
    ? input.channelSync
    : { requested: 0, failed: 0, pending: false };
  const channelSyncStatus = channelSync.pending
    ? 'pending'
    : dashboardNumber(channelSync.failed) > 0
      ? 'partial'
      : 'complete';
  const channelMetricValue = channelSyncStatus === 'pending'
    ? '--'
    : channelSyncStatus === 'partial' && activeChannels === 0
      ? 'Indisponivel'
      : formatNumber(activeChannels);
  const channelMetricChange = channelSyncStatus === 'pending'
    ? 'sincronizando canais'
    : channelSyncStatus === 'partial'
      ? `${formatNumber(channelSync.failed)} conta${channelSync.failed === 1 ? '' : 's'} sem canais agora`
      : 'sincronizados em contas';
  const platformStats = Array.isArray(stats.platformStats) ? stats.platformStats : [];
  const destinationStats = Array.isArray(stats.destinationStats) ? stats.destinationStats : [];
  const campaignTotal = dashboardNumber(stats.campaigns?.total ?? campaigns.length);
  const targetTotal = dashboardNumber(stats.targets?.total ?? campaigns.reduce((sum, campaign) => sum + getGrowthCampaignTargets(campaign).length, 0));
  const publishedTargets = dashboardNumber(stats.targets?.byStatus?.publicado ?? campaigns.reduce((sum, campaign) => (
    sum + getGrowthCampaignTargets(campaign).filter((target) => target.status === 'publicado').length
  ), 0));
  const failedTargets = dashboardNumber(stats.targets?.byStatus?.erro ?? campaigns.reduce((sum, campaign) => (
    sum + getGrowthCampaignTargets(campaign).filter((target) => target.status === 'erro').length
  ), 0));
  const successRate = dashboardNumber(stats.targets?.successRate ?? (publishedTargets + failedTargets > 0 ? (publishedTargets / (publishedTargets + failedTargets)) * 100 : 0));
  const activeJobs = dashboardNumber(stats.jobs?.byStatus?.queued) + dashboardNumber(stats.jobs?.byStatus?.processing);
  const projectedQuota = dashboardNumber(stats.quota?.projectedPercent);
  const totalViews = channels.reduce((sum, channel) => sum + dashboardNumber(channel.totalViews), 0);
  const platformGrowth = GROWTH_PLATFORM_KEYS.map((platform) => {
    const platformStat = platformStats.find((entry) => normalizeGrowthPlatformKey(entry?.platform) === platform);
    const connectedForPlatform = connectedAccounts.filter((account) => normalizeGrowthPlatformKey(account?.provider) === platform).length;
    const value = platformStat
      ? clampGrowthPercent(platformStat.successRate)
      : connectedForPlatform > 0
        ? 100
        : 0;
    return { label: dashboardPlatformLabel(platform), value };
  });
  const reachSeries = channels
    .map((channel) => dashboardNumber(channel.totalViews || channel.topVideoViews))
    .filter((value) => value > 0);
  const hasReachSeries = reachSeries.length > 0;
  const lineValues = hasReachSeries
    ? reachSeries.slice(0, 12)
    : [campaignTotal, targetTotal, publishedTargets, activeJobs, failedTargets].map((value) => Math.max(0, dashboardNumber(value)));
  const trendTitle = hasReachSeries ? 'Alcance observado por canal' : 'Pulso operacional do workspace';
  const trendDescription = hasReachSeries
    ? 'Views sincronizadas dos canais conectados.'
    : 'Sem views sincronizadas; exibindo campanhas, destinos, publicados, fila e falhas.';
  const trendAriaLabel = hasReachSeries
    ? 'Alcance observado por canal'
    : 'Volume operacional por campanhas, destinos, publicados, fila e falhas';
  const destinationHealth = destinationStats.length
    ? destinationStats.slice(0, 4).map((destination) => ({
      label: destination.destinationLabel || dashboardPlatformLabel(destination.platform),
      value: clampGrowthPercent(destination.successRate),
    }))
    : platformGrowth;
  const data = {
    accounts,
    connectedAccounts,
    accountChannels,
    sourceStats: stats,
    sourceCampaigns: campaigns,
    sourceChannels: channels,
    channelSync,
    channelSyncStatus,
    activeChannels,
    campaignTotal,
    targetTotal,
    publishedTargets,
    failedTargets,
    successRate,
    activeJobs,
    projectedQuota,
    totalViews,
    heroValue: targetTotal > 0 ? formatPercent(successRate, 0) : formatNumber(connectedAccounts.length),
    heroLabel: targetTotal > 0 ? 'taxa de sucesso real' : 'contas conectadas',
    overviewSummary: `Campanhas: ${formatNumber(campaignTotal)} - Destinos: ${formatNumber(targetTotal)} - Publicados: ${formatNumber(publishedTargets)} - Falhas: ${formatNumber(failedTargets)} - Contas conectadas: ${formatNumber(connectedAccounts.length)}`,
    metrics: [
      { label: 'Campanhas reais', value: formatNumber(campaignTotal), change: `${formatNumber(campaigns.length)} carregadas`, icon: 'CP', tone: 'info' },
      { label: 'Destinos publicados', value: formatNumber(publishedTargets), change: `${formatPercent(successRate, 0)} sucesso`, icon: 'PUB', tone: 'success' },
      { label: 'Falhas', value: formatNumber(failedTargets), change: failedTargets > 0 ? 'exigem revisao' : 'sem bloqueios recentes', icon: 'ER', tone: failedTargets > 0 ? 'warning' : 'success' },
      { label: 'Contas conectadas', value: formatNumber(connectedAccounts.length), change: `${formatNumber(accounts.length)} cadastradas`, icon: 'ACC', tone: 'success' },
      { label: 'Canais ativos', value: channelMetricValue, change: channelMetricChange, icon: 'CAN', tone: channelSyncStatus === 'partial' ? 'warning' : 'info' },
      { label: 'Alcance observado', value: formatNumber(totalViews), change: totalViews > 0 ? 'views sincronizadas' : 'sem views sincronizadas', icon: 'VIS', tone: 'processing' },
      { label: 'Fila ativa', value: formatNumber(activeJobs), change: 'queued + processing', icon: 'FILA', tone: activeJobs > 0 ? 'warning' : 'success' },
      { label: 'Cota projetada', value: formatPercent(projectedQuota, 0), change: 'uso estimado da API', icon: 'COTA', tone: projectedQuota >= 80 ? 'warning' : 'info' },
    ],
    platformGrowth,
    monthlyReach: lineValues.length ? lineValues : [0, 0, 0],
    trendTitle,
    trendDescription,
    trendAriaLabel,
    retentionBars: destinationHealth,
    posts: buildGrowthPosts(campaigns),
    campaigns: buildGrowthCampaignRows(campaigns),
    contentRanking: buildGrowthContentRanking(channels, campaigns),
  };
  data.recommendations = buildGrowthRecommendations({ connectedAccounts, activeJobs, failedTargets, successRate, totalViews, campaigns });
  data.reports = buildGrowthReports(data);
  data.learnings = [
    `${formatNumber(campaignTotal)} campanha${campaignTotal === 1 ? '' : 's'} registrada${campaignTotal === 1 ? '' : 's'} no workspace.`,
    `${formatPercent(successRate, 0)} de sucesso nos destinos com resultado final.`,
    connectedAccounts.length ? `${formatNumber(connectedAccounts.length)} conta${connectedAccounts.length === 1 ? '' : 's'} conectada${connectedAccounts.length === 1 ? '' : 's'} para alimentar o Growth.` : 'O modulo precisa de contas conectadas para sair do modo operacional basico.',
  ];
  data.nextSteps = [
    failedTargets > 0 ? 'Abrir campanhas com falha e corrigir destinos antes de escalar publicacoes.' : 'Criar uma nova campanha a partir dos destinos que ja estao saudaveis.',
    connectedAccounts.length ? 'Comparar plataformas com melhor taxa de sucesso antes de escolher o proximo formato.' : 'Conectar ao menos uma conta em Contas conectadas.',
    totalViews > 0 ? 'Transformar o video/canal com maior alcance em roteiro reutilizavel.' : 'Sincronizar canais para capturar sinais de alcance.',
  ];
  return data;
}

function buildGrowthDecisionActions(growthData = buildGrowthWorkspaceData()) {
  const actions = [];
  if (!growthData.connectedAccounts?.length) {
    actions.push({
      eyebrow: 'Onde postar',
      title: 'Conectar contas antes de decidir formato.',
      description: 'Sem contas conectadas, o Growth fica limitado a campanha e fila. Conecte plataformas para liberar sinais reais.',
      href: '/workspace/accounts',
      action: 'Conectar contas',
    });
  }
  if (growthData.failedTargets > 0) {
    actions.push({
      eyebrow: 'O que corrigir',
      title: `${formatNumber(growthData.failedTargets)} destino${growthData.failedTargets === 1 ? '' : 's'} com falha.`,
      description: 'Priorize campanhas com erro antes de publicar mais conteudo. Falha operacional reduz consistencia.',
      href: '/workspace/growth/campanhas',
      action: 'Corrigir falhas',
    });
  }
  if (growthData.activeJobs > 0) {
    actions.push({
      eyebrow: 'Fila ativa',
      title: `${formatNumber(growthData.activeJobs)} job${growthData.activeJobs === 1 ? '' : 's'} ainda em andamento.`,
      description: 'Acompanhe a fila antes de reprogramar campanhas para evitar duplicidade ou leitura incompleta.',
      href: '/workspace/dashboard',
      action: 'Abrir dashboard',
    });
  }
  actions.push({
    eyebrow: 'O que repetir',
    title: growthData.totalViews > 0 ? 'Reaproveitar o sinal com maior alcance.' : 'Criar uma campanha para gerar sinal real.',
    description: growthData.totalViews > 0
      ? 'Use Metricas para identificar o canal ou conteudo com tracao e transformar em nova pauta.'
      : 'Sem alcance sincronizado, a melhor decisao e publicar uma campanha controlada e medir o resultado.',
    href: growthData.totalViews > 0 ? '/workspace/growth/metricas' : '/workspace/campanhas/nova',
    action: growthData.totalViews > 0 ? 'Ver metricas' : 'Criar campanha',
  });
  actions.push({
    eyebrow: 'O que postar',
    title: 'Transformar sinal operacional em conteudo.',
    description: 'Use o laboratorio para gerar ideia, roteiro e campanha sem prometer engajamento artificial.',
    href: '/workspace/growth/conteudo',
    action: 'Abrir Conteudo',
  });
  return actions.slice(0, 4);
}

function renderGrowthDecisionAction(action) {
  return `
    <article class="growth-decision-card">
      <div class="growth-decision-card-top">
        <span class="growth-eyebrow">${escapeHtml(action.eyebrow)}</span>
        <a class="growth-decision-action" data-link href="${escapeAttribute(action.href)}">${escapeHtml(action.action)}</a>
      </div>
      <h3>${escapeHtml(action.title)}</h3>
      <p>${escapeHtml(action.description)}</p>
    </article>
  `;
}

function renderGrowthOverview(growthData = buildGrowthWorkspaceData()) {
  const decisionActions = buildGrowthDecisionActions(growthData);
  return `
    <section class="growth-overview-banner">
      <span class="growth-eyebrow">Cockpit</span>
      <h3>O que fazer agora, com base nos sinais do PMP.</h3>
      <p>${escapeHtml(growthData.overviewSummary)}</p>
    </section>
    <section class="growth-metric-grid">
      ${growthData.metrics.map(renderGrowthMetricCard).join('')}
    </section>
    <section class="growth-grid-2">
      <section class="growth-card">
        <div class="growth-card-heading">
          <div><h3>Painel de decisao</h3><p>O que postar, onde postar, o que corrigir e o que repetir.</p></div>
          <span>${renderMediaMark('star', 'chip', 'info')}</span>
        </div>
        <div class="growth-list growth-decision-list">
          ${decisionActions.map(renderGrowthDecisionAction).join('')}
        </div>
      </section>
      ${renderGrowthChartCard(growthData.trendTitle, renderGrowthLineChart(growthData.monthlyReach, growthData.trendAriaLabel), growthData.trendDescription)}
      ${renderGrowthChartCard('Saude por plataforma', renderGrowthBarChart(growthData.platformGrowth))}
      ${renderGrowthChartCard('Saude por destino', renderGrowthBarChart(growthData.retentionBars))}
      <section class="growth-card">
        <div class="growth-card-heading">
          <div><h3>Proxima melhor acao</h3><p>Recomendacoes praticas para consistencia, alcance observado e correcoes.</p></div>
          <span>${renderMediaMark('published', 'chip', 'success')}</span>
        </div>
        <div class="growth-list">
          ${growthData.recommendations.map((item) => `<article><span class="growth-list-marker"></span><p>${escapeHtml(item)}</p></article>`).join('')}
        </div>
      </section>
    </section>
  `;
}

function renderGrowthScriptComposer() {
  return `
    <section class="growth-grid-2 growth-script-grid">
      <form class="growth-card growth-form" data-growth-script-form>
        <label>Tema do conteudo<input name="topic" data-growth-script-topic required placeholder="Ex: Como melhorar retencao em videos curtos" /></label>
        <label>Plataforma<select name="platform"><option>YouTube</option><option>Instagram</option><option>TikTok</option></select></label>
        <label>Duracao estimada<select name="duration"><option>15 segundos</option><option>30 segundos</option><option>60 segundos</option><option>5 minutos</option></select></label>
        <label>Tom<select name="tone"><option>Profissional</option><option>Casual</option><option>Educativo</option><option>Inspirador</option><option>Direto</option></select></label>
        <label>Objetivo do conteudo<input name="goal" placeholder="Ex: Educacao, conversao, alcance" /></label>
        <button class="button button-primary" type="submit">Gerar brief e roteiro</button>
      </form>
      <article class="growth-card">
        <div class="growth-card-heading"><div><h3>Brief + roteiro</h3><p>Brief do tema, sinais reais do Growth e estrutura pronta para adaptar.</p></div></div>
        <div class="growth-script-blocks" data-growth-script-result>
          ${renderGrowthScriptResult()}
        </div>
      </article>
    </section>
  `;
}

function renderGrowthContentHub(growthData = buildGrowthWorkspaceData()) {
  const upcomingPosts = growthData.posts.slice(0, 4);
  return `
    <section class="growth-page-title growth-page-title-actions">
      <div>
        <span class="growth-eyebrow">Conteudo</span>
        <h3>Laboratorio operacional de ideias, roteiros e campanhas.</h3>
        <p>Fluxo em tres passos: gere uma ideia, transforme em roteiro e so entao abra campanha real no PMP.</p>
      </div>
      <a class="button button-secondary" data-link href="/workspace/growth/campanhas">Ver campanhas</a>
    </section>
    <section class="growth-filter-card growth-idea-generator">
      <label>Nicho, sinal ou problema<input data-growth-idea-input value="" placeholder="Ex: falhas em Reels, topico educativo, duvida frequente" /></label>
      <button class="button button-primary" type="button" data-growth-generate-ideas>Gerar ideias</button>
      <a class="button button-secondary" data-link href="/workspace/growth/metricas">Ver sinais reais</a>
    </section>
    <section class="growth-card-grid" data-growth-ideas-grid>
      ${GROWTH_TEMPLATE_DATA.ideas.map(renderGrowthIdeaCard).join('')}
    </section>
    <section class="growth-page-title">
      <span class="growth-eyebrow">Roteiro</span>
      <h3>Transforme a melhor ideia em estrutura publicavel.</h3>
      <p>A previa e local. Para publicar, crie uma campanha real no PMP.</p>
    </section>
    ${renderGrowthScriptComposer()}
    <section class="growth-grid-2">
      <section class="growth-card">
        <div class="growth-card-heading">
          <div><h3>Proximas campanhas do PMP</h3><p>Visualizacao simples de campanhas recentes ou agendadas, sem filtros falsos.</p></div>
          <span>${renderMediaMark('clock', 'chip', 'info')}</span>
        </div>
        ${upcomingPosts.length
          ? `<div class="growth-card-grid">${upcomingPosts.map(renderGrowthContentCard).join('')}</div>`
          : `<div class="growth-list"><article><p>Crie ou agende campanhas no PMP para alimentar esta fila de conteudo.</p><a class="button button-secondary" data-link href="/workspace/campanhas/nova">Criar campanha</a></article></div>`}
      </section>
      <section class="growth-card">
        <div class="growth-card-heading">
          <div><h3>Modelos para reutilizar</h3><p>Templates locais para acelerar roteiro e campanha. Nao substituem biblioteca persistida.</p></div>
          <span>${renderMediaMark('library', 'chip', 'warning')}</span>
        </div>
        <div class="growth-list growth-list-plain">
          ${GROWTH_TEMPLATE_DATA.library.map((item) => `
            <article>
              <p><strong>${escapeHtml(item.title)}</strong> - ${escapeHtml(item.type)} para ${escapeHtml(item.platform)}.</p>
              <a class="button button-secondary" data-link href="${escapeAttribute(buildUrl('/workspace/growth/conteudo', { idea: item.title }))}">Usar no roteiro</a>
            </article>
          `).join('')}
        </div>
      </section>
    </section>
  `;
}

function renderGrowthMetrics(growthData = buildGrowthWorkspaceData()) {
  const filters = state.growthMetricFilters ?? { date: 'all', platform: 'all' };
  return `
    <section class="growth-page-title">
      <span class="growth-eyebrow">Metricas</span>
      <h3>Analise clara para decisoes de conteudo.</h3>
      <p>KPIs carregados do dashboard, campanhas e contas conectadas do workspace.</p>
    </section>
    <section class="growth-filter-card">
      <label>Data<select data-growth-metrics-filter="date">
        ${renderGrowthFilterOption('all', 'Todo periodo', filters.date)}
        ${renderGrowthFilterOption('7d', 'Ultimos 7 dias', filters.date)}
        ${renderGrowthFilterOption('30d', 'Ultimos 30 dias', filters.date)}
        ${renderGrowthFilterOption('month', 'Este mes', filters.date)}
      </select></label>
      <label>Plataforma<select data-growth-metrics-filter="platform">
        ${renderGrowthFilterOption('all', 'Todas', filters.platform)}
        ${renderGrowthFilterOption('youtube', 'YouTube', filters.platform)}
        ${renderGrowthFilterOption('instagram', 'Instagram', filters.platform)}
        ${renderGrowthFilterOption('tiktok', 'TikTok', filters.platform)}
      </select></label>
    </section>
    <section class="growth-metric-grid" data-growth-metrics-grid>${renderGrowthMetricsGridHtml(growthData)}</section>
    <section class="growth-grid-2" data-growth-metrics-charts>
      ${renderGrowthMetricsChartsHtml(growthData)}
    </section>
    <section class="growth-card growth-table-card">
      <div class="growth-card-heading"><div><h3>Ranking de sinais operacionais</h3><p>Dados reais ou proxies operacionais vindos de canais, campanhas e destinos.</p></div></div>
      <div class="growth-table-wrap">
        <table class="growth-table">
          <thead><tr>${['Conteudo', 'Plataforma', 'Data', 'Sinal', 'Taxa de sucesso', 'Publicados', 'Status'].map((header) => `<th>${header}</th>`).join('')}</tr></thead>
          <tbody data-growth-ranking-body>
            ${renderGrowthContentRankingRowsHtml(growthData)}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderGrowthReports(growthData = buildGrowthWorkspaceData()) {
  return `
    <section class="growth-page-title growth-page-title-actions">
      <div>
        <span class="growth-eyebrow">Relatorios</span>
        <h3>Relatorios semanais e mensais.</h3>
        <p>Resuma aprendizados, proximos passos e evolucao sem transformar analise em burocracia.</p>
      </div>
      <div class="growth-action-row">
        <button class="button button-primary" type="button" data-growth-generate-report>Gerar relatorio</button>
        <button class="button button-secondary" type="button" data-growth-export-report>Exportar HTML</button>
      </div>
    </section>
    <section class="growth-card-grid" data-growth-reports-grid>
      ${renderGrowthReportsGridHtml(growthData)}
    </section>
    <section class="growth-page-title">
      <span class="growth-eyebrow">Manuais</span>
      <h3>Relatorios gerados nesta sessao.</h3>
      <p>Os resumos criados manualmente aparecem aqui imediatamente e tambem entram na exportacao HTML.</p>
    </section>
    <section class="growth-card-grid" data-growth-manual-reports-grid></section>
    <div data-growth-manual-report-empty>
      ${renderGrowthEmptyState('Nenhum relatorio gerado manualmente', 'Quando voce gerar um relatorio personalizado, ele aparecera aqui com aprendizados e proximos passos. Use o botao Gerar relatorio acima para criar um resumo local.')}
    </div>
    <div data-growth-reports-chart>
      ${renderGrowthReportsChartHtml(growthData)}
    </div>
    <section class="growth-grid-2" data-growth-reports-insights>
      ${renderGrowthReportsInsightsHtml(growthData)}
    </section>
  `;
}

function renderGrowthFilterOption(value, label, selectedValue) {
  return `<option value="${escapeAttribute(value)}" ${value === selectedValue ? 'selected' : ''}>${escapeHtml(label)}</option>`;
}

function renderGrowthMetricsGridHtml(growthData) {
  return growthData.metrics.map(renderGrowthMetricCard).join('');
}

function renderGrowthMetricsChartsHtml(growthData) {
  return `
      ${renderGrowthChartCard(growthData.trendTitle, renderGrowthLineChart(growthData.monthlyReach, growthData.trendAriaLabel), growthData.trendDescription)}
      ${renderGrowthChartCard('Saude entre plataformas', renderGrowthBarChart(growthData.platformGrowth))}
      ${renderGrowthChartCard('Saude por destino', renderGrowthBarChart(growthData.retentionBars))}
      ${renderGrowthChartCard('Uso de cota projetado', renderGrowthBarChart([{ label: 'Cota', value: growthData.projectedQuota }]))}
  `;
}

function renderGrowthContentRankingRowsHtml(growthData) {
  return growthData.contentRanking.map((row) => `
              <tr>
                <td><strong>${escapeHtml(row.title)}</strong></td>
                <td>${growthPlatformBadge(row.platform)}</td>
                <td>${escapeHtml(row.date)}</td>
                <td>${escapeHtml(row.reach)}</td>
                <td>${escapeHtml(row.retention)}</td>
                <td>${formatNumber(row.comments)}</td>
                <td>${growthStatusBadge(row.status)}</td>
              </tr>
            `).join('');
}

function renderGrowthReportsGridHtml(growthData) {
  return growthData.reports.map(renderGrowthReportCard).join('');
}

function renderGrowthReportsChartHtml(growthData) {
  return renderGrowthChartCard(growthData.trendTitle, renderGrowthLineChart(growthData.monthlyReach, growthData.trendAriaLabel), growthData.trendDescription);
}

function renderGrowthReportsInsightsHtml(growthData) {
  return `
      ${renderGrowthListPanel('Aprendizados', growthData.learnings)}
      ${renderGrowthListPanel('Proximos passos', growthData.nextSteps)}
  `;
}

function getGrowthMetricsFilters(rootEl = document.querySelector('.growth-module')) {
  const dateValue = rootEl?.querySelector?.('[data-growth-metrics-filter="date"]')?.value ?? state.growthMetricFilters?.date ?? 'all';
  const platformValue = rootEl?.querySelector?.('[data-growth-metrics-filter="platform"]')?.value ?? state.growthMetricFilters?.platform ?? 'all';
  return {
    date: ['all', '7d', '30d', 'month'].includes(dateValue) ? dateValue : 'all',
    platform: ['all', ...GROWTH_PLATFORM_KEYS].includes(platformValue) ? platformValue : 'all',
  };
}

function getGrowthTargetsForFilters(campaign, platformFilter) {
  const targets = getGrowthCampaignTargets(campaign);
  if (platformFilter === 'all') return targets;
  return targets.filter((target) => normalizeGrowthPlatformKey(target?.platform) === platformFilter);
}

function buildGrowthStatsFromFilteredCampaigns(campaigns, sourceStats, platformFilter) {
  const targets = campaigns.flatMap((campaign) => getGrowthTargetsForFilters(campaign, platformFilter));
  const published = targets.filter((target) => target.status === 'publicado').length;
  const failed = targets.filter((target) => target.status === 'erro').length;
  const terminal = published + failed;
  const platformMap = new Map();
  const destinationMap = new Map();

  targets.forEach((target) => {
    const platform = normalizeGrowthPlatformKey(target?.platform);
    if (!platform) return;
    if (!platformMap.has(platform)) {
      platformMap.set(platform, { platform, totalTargets: 0, published: 0, failed: 0 });
    }
    const platformEntry = platformMap.get(platform);
    platformEntry.totalTargets += 1;
    if (target.status === 'publicado') platformEntry.published += 1;
    if (target.status === 'erro') platformEntry.failed += 1;

    const destinationId = target.destinationId || target.channelId || target.id || platform;
    const destinationKey = `${platform}:${destinationId}`;
    if (!destinationMap.has(destinationKey)) {
      destinationMap.set(destinationKey, {
        destinationId,
        destinationLabel: target.destinationLabel ?? dashboardPlatformLabel(platform),
        platform,
        totalTargets: 0,
        published: 0,
        failed: 0,
      });
    }
    const destinationEntry = destinationMap.get(destinationKey);
    destinationEntry.totalTargets += 1;
    if (target.status === 'publicado') destinationEntry.published += 1;
    if (target.status === 'erro') destinationEntry.failed += 1;
  });

  const platformStats = Array.from(platformMap.values()).map((entry) => {
    const entryTerminal = entry.published + entry.failed;
    return {
      ...entry,
      successRate: entryTerminal > 0 ? (entry.published / entryTerminal) * 100 : 0,
    };
  });
  const destinationStats = Array.from(destinationMap.values()).map((entry) => {
    const entryTerminal = entry.published + entry.failed;
    return {
      ...entry,
      successRate: entryTerminal > 0 ? (entry.published / entryTerminal) * 100 : 0,
    };
  });

  return {
    jobs: sourceStats.jobs,
    quota: sourceStats.quota,
    channels: [],
    platformStats,
    destinationStats,
    campaigns: { total: campaigns.length },
    targets: {
      total: targets.length,
      byStatus: { publicado: published, erro: failed },
      successRate: terminal > 0 ? (published / terminal) * 100 : 0,
    },
  };
}

function getGrowthFilteredMetricsData(growthData, filters = state.growthMetricFilters ?? { date: 'all', platform: 'all' }) {
  if (!growthData || (filters.date === 'all' && filters.platform === 'all')) return growthData;
  const sourceCampaigns = Array.isArray(growthData.sourceCampaigns) ? growthData.sourceCampaigns : [];
  const sourceStats = growthData.sourceStats && typeof growthData.sourceStats === 'object' ? growthData.sourceStats : {};
  const filteredCampaigns = sourceCampaigns.filter((campaign) => {
    const dateMatches = isGrowthDateInFilter(getGrowthCampaignDate(campaign), filters.date);
    const platformMatches = filters.platform === 'all' || getGrowthTargetsForFilters(campaign, filters.platform).length > 0;
    return dateMatches && platformMatches;
  });
  const stats = buildGrowthStatsFromFilteredCampaigns(filteredCampaigns, sourceStats, filters.platform);
  const includeAccountChannels = filters.platform === 'all' || filters.platform === 'youtube';
  return buildGrowthWorkspaceData({
    stats,
    campaigns: filteredCampaigns,
    accounts: growthData.accounts,
    accountChannels: includeAccountChannels ? growthData.accountChannels : [],
    channelSync: includeAccountChannels ? growthData.channelSync : { requested: 0, failed: 0, pending: false },
  });
}

function applyGrowthMetricsFilters(rootEl = document.querySelector('.growth-module'), growthData = state.growthWorkspaceData) {
  if (!rootEl || !growthData) return;
  state.growthMetricFilters = getGrowthMetricsFilters(rootEl);
  updateGrowthMetricsSection(rootEl, growthData);
}

function renderGrowthListPanel(title, items) {
  return `
    <section class="growth-card">
      <div class="growth-card-heading"><div><h3>${escapeHtml(title)}</h3></div></div>
      <div class="growth-list growth-list-plain">
        ${items.map((item) => `<article><p>${escapeHtml(item)}</p></article>`).join('')}
      </div>
    </section>
  `;
}

function renderGrowthCampaigns(growthData = buildGrowthWorkspaceData()) {
  return `
    <section class="growth-page-title growth-page-title-actions">
      <div>
        <span class="growth-eyebrow">Campanhas</span>
        <h3>Campanhas com links rastreaveis.</h3>
        <p>Use campanhas reais do PMP para ver destinos, publicacoes e falhas sem manipular engajamento.</p>
      </div>
      <a class="button button-primary" data-link href="/workspace/campanhas/nova">Nova campanha</a>
    </section>
    <section class="growth-card-grid">
      ${growthData.campaigns.map((campaign) => `
        <article class="growth-card growth-campaign-card">
          <div class="growth-badge-row">${growthPlatformBadge(campaign.platform)}${growthStatusBadge(campaign.status)}</div>
          <h3>${escapeHtml(campaign.name)}</h3>
          <p>${escapeHtml(campaign.period)} - ${escapeHtml(campaign.objective)}</p>
          <div class="growth-link-pill">${escapeHtml(campaign.link)}</div>
          <div class="growth-mini-grid">
            <span><strong>${formatNumber(campaign.published)}</strong><small>publicados</small></span>
            <span><strong>${formatNumber(campaign.failed)}</strong><small>falhas</small></span>
          </div>
          <div class="growth-action-row"><button class="button button-secondary" type="button">Copiar link</button><a class="button button-primary" data-link href="${escapeAttribute(campaign.link)}">Ver desempenho</a></div>
        </article>
      `).join('')}
    </section>
    ${growthData.campaigns.length ? '' : renderGrowthEmptyState('Nenhuma campanha criada no PMP', 'Crie uma campanha para alimentar Growth com dados reais de publicacao.', 'Criar nova campanha', '/workspace/campanhas/nova')}
  `;
}

function getGrowthPlatformSettingsRows() {
  const allowedPlatforms = new Set(
    (state.account?.allowedPlatforms ?? []).map((platform) => String(platform).toLowerCase())
  );
  const connectedAccounts = Array.isArray(state.growthConnectedAccounts) ? state.growthConnectedAccounts : [];
  const hasPlanContext = Boolean(state.account);
  const rows = [
    { key: 'youtube', name: 'YouTube' },
    { key: 'instagram', name: 'Instagram' },
    { key: 'tiktok', name: 'TikTok' },
  ];

  return rows.map((row) => {
    const allowedByPlan = !hasPlanContext
      || allowedPlatforms.has(row.key)
      || (row.key === 'youtube' && allowedPlatforms.has('google'));
    const matchingAccounts = connectedAccounts.filter((account) => normalizeGrowthPlatformKey(account?.provider) === row.key);
    const connectedCount = matchingAccounts.filter((account) => String(account?.status ?? '').toLowerCase() === 'connected').length;
    const reauthCount = matchingAccounts.filter((account) => String(account?.status ?? '').toLowerCase() === 'reauth_required').length;
    const status = !allowedByPlan
      ? 'exige PRO ou Premium'
      : connectedCount > 0
        ? `${formatNumber(connectedCount)} conectado${connectedCount === 1 ? '' : 's'}`
        : reauthCount > 0
          ? 'reautorizacao necessaria'
          : 'sem conta conectada';
    return {
      ...row,
      status,
      href: allowedByPlan ? '/workspace/accounts' : '/workspace/planos',
      action: allowedByPlan ? (connectedCount > 0 || reauthCount > 0 ? 'Gerenciar' : 'Conectar') : 'Ver planos',
    };
  });
}

function renderGrowthSettingsPanel(options = {}) {
  const merged = options.merged === true;
  const platformRows = getGrowthPlatformSettingsRows();
  const growthPreferences = normalizeGrowthPreferences(state.growthPreferences);

  return `
    <section class="growth-page-title growth-page-title-actions growth-settings-title">
      <div>
        <span class="growth-eyebrow">${merged ? 'Growth operacional' : 'Configuracoes'}</span>
        <h3>${merged ? 'Growth integrado ao painel principal.' : 'Conta, seguranca, plataformas e preferencias.'}</h3>
        <p>${merged
          ? 'Somente controles acionaveis: plataformas, alertas e exportacao. Perfil, contas e plano ficam nos atalhos essenciais acima.'
          : 'Growth usa as mesmas configuracoes do painel principal para evitar duplicidade entre produtos.'}</p>
      </div>
      ${merged
        ? '<a class="button button-secondary" data-link href="/workspace/growth">Abrir Growth</a>'
        : '<a class="button button-secondary" data-link href="/workspace/configuracoes">Configuracoes principais</a>'}
    </section>
    <section class="growth-grid-2 growth-settings-grid-compact">
      <section class="growth-card">
        <div class="growth-card-heading"><div><h3>Plataformas</h3><p>Leitura direta do plano e das contas conectadas.</p></div></div>
        <div class="growth-platform-list">
          ${platformRows.map((platform) => `
            <article>
              ${growthPlatformBadge(platform.name)}
              <span>${escapeHtml(platform.status)}</span>
              <a class="button button-secondary" data-link href="${escapeAttribute(platform.href)}">${escapeHtml(platform.action)}</a>
            </article>
          `).join('')}
        </div>
      </section>
      <section class="growth-card">
        <div class="growth-card-heading"><div><h3>Alertas e exportacao</h3><p>Preferencias operacionais do modulo Growth.</p></div></div>
        <div class="growth-check-list">
          ${GROWTH_PREFERENCE_OPTIONS.map((item) => `
            <label><input type="checkbox" data-growth-preference="${escapeAttribute(item.id)}" ${growthPreferences[item.id] ? 'checked' : ''} />${escapeHtml(item.label)}</label>
          `).join('')}
        </div>
        <div class="growth-action-row">
          <button class="button button-secondary" type="button" data-growth-export-preferences>Exportar preferencias</button>
        </div>
      </section>
      <section class="growth-card growth-settings-actions">
        <div class="growth-card-heading"><div><h3>Controles sensiveis</h3><p>Sem duplicidade: perfil, contas e plano continuam sendo configurados nas areas principais.</p></div></div>
        <div class="growth-settings-grid">
          <a data-link href="/workspace/perfil">Perfil e conta</a>
          <a data-link href="/workspace/accounts">Contas conectadas</a>
          <a data-link href="/workspace/planos">Plano e tokens</a>
        </div>
      </section>
    </section>
  `;
}

function renderGrowthBody(sectionId, growthData = buildGrowthWorkspaceData()) {
  if (sectionId === 'conteudo') return renderGrowthContentHub(growthData);
  if (sectionId === 'metricas') return renderGrowthMetrics(growthData);
  if (sectionId === 'campanhas') return renderGrowthCampaigns(growthData);
  if (sectionId === 'relatorios') return renderGrowthReports(growthData);
  return renderGrowthOverview(growthData);
}

function setGrowthButtonFeedback(button, label, restoreDelay = 1600) {
  if (!button) return;
  const original = button.textContent;
  button.textContent = label;
  button.classList.add('growth-action-done');
  if (restoreDelay <= 0) return;
  setTimeout(() => {
    button.textContent = original;
    button.classList.remove('growth-action-done');
  }, restoreDelay);
}

function buildGrowthPreferencesExportPayload() {
  return {
    exportedAt: new Date().toISOString(),
    profile: {
      name: state.me?.fullName || state.me?.name || null,
      email: state.me?.email || state.account?.email || null,
    },
    workspace: {
      locale: state.locale,
      plan: state.account?.plan ?? null,
      planLabel: state.account?.planLabel ?? getPlanVisualConfig().label,
      backgroundTheme: state.backgroundTheme,
    },
    platforms: getGrowthPlatformSettingsRows().map((platform) => ({
      key: platform.key,
      name: platform.name,
      status: platform.status,
    })),
    preferences: normalizeGrowthPreferences(state.growthPreferences),
  };
}

function exportGrowthPreferences(button) {
  const payload = JSON.stringify(buildGrowthPreferencesExportPayload(), null, 2);
  const fileName = `pmp-growth-preferencias-${new Date().toISOString().slice(0, 10)}.json`;

  try {
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setGrowthButtonFeedback(button, 'Preferencias exportadas');
  } catch {
    try {
      void navigator.clipboard?.writeText(payload);
      setGrowthButtonFeedback(button, 'Preferencias copiadas');
    } catch {
      setGrowthButtonFeedback(button, 'Exportacao indisponivel');
    }
  }
}

function getGrowthReportExportHtml(rootEl = document.querySelector('.growth-module')) {
  const cards = Array.from(rootEl?.querySelectorAll?.('[data-growth-manual-reports-grid] .growth-card, [data-growth-reports-grid] .growth-card') ?? [])
    .map((card) => ({
      title: card.querySelector('h3')?.textContent?.trim() || 'Relatorio Growth',
      summary: card.querySelector('p')?.textContent?.trim() || '',
    }));
  const insights = Array.from(rootEl?.querySelectorAll?.('[data-growth-reports-insights] p') ?? [])
    .map((item) => item.textContent?.trim())
    .filter(Boolean);
  const generatedAt = new Date().toISOString();

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Relatorio Growth PMP</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #172033; background: #f8fbff; }
    main { max-width: 880px; margin: 0 auto; }
    h1 { margin-bottom: 4px; }
    article, section { background: #fff; border: 1px solid #d8e3f0; border-radius: 18px; padding: 20px; margin: 16px 0; }
    small { color: #64748b; }
  </style>
</head>
<body>
  <main>
    <h1>Relatorio Growth PMP</h1>
    <small>Gerado em ${escapeHtml(generatedAt)}</small>
    ${cards.map((card) => `<article><h2>${escapeHtml(card.title)}</h2><p>${escapeHtml(card.summary)}</p></article>`).join('')}
    ${insights.length ? `<section><h2>Aprendizados e proximos passos</h2><ul>${insights.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section>` : ''}
  </main>
</body>
</html>`;
}

function exportGrowthReport(button) {
  const rootEl = button?.closest?.('.growth-module') ?? document.querySelector('.growth-module');
  const payload = getGrowthReportExportHtml(rootEl);
  const fileName = `pmp-growth-relatorio-${new Date().toISOString().slice(0, 10)}.html`;

  try {
    const blob = new Blob([payload], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setGrowthButtonFeedback(button, 'HTML exportado');
  } catch {
    try {
      void navigator.clipboard?.writeText(payload);
      setGrowthButtonFeedback(button, 'Relatorio copiado');
    } catch {
      setGrowthButtonFeedback(button, 'Exportacao indisponivel');
    }
  }
}

function addGrowthGeneratedReport(rootEl, report) {
  const manualReportsGrid = rootEl?.querySelector?.('[data-growth-manual-reports-grid]');
  const reportsGrid = rootEl?.querySelector?.('[data-growth-reports-grid]');
  const targetGrid = manualReportsGrid || reportsGrid;
  if (!targetGrid) return false;
  targetGrid.insertAdjacentHTML('afterbegin', renderGrowthReportCard(report));
  targetGrid.firstElementChild?.classList?.add('is-new');
  rootEl?.querySelector?.('[data-growth-manual-report-empty]')?.remove?.();
  return true;
}

function bindGrowthInteractions() {
  const rootEl = document.querySelector('.growth-module');
  if (!rootEl) return;

  const ideaInput = rootEl.querySelector('[data-growth-idea-input]');
  const ideasGrid = rootEl.querySelector('[data-growth-ideas-grid]');
  const generateIdeasButton = rootEl.querySelector('[data-growth-generate-ideas]');
  if (generateIdeasButton && ideasGrid) {
    generateIdeasButton.addEventListener('click', () => {
      const ideas = buildGeneratedGrowthIdeas(ideaInput?.value ?? '');
      ideasGrid.insertAdjacentHTML('afterbegin', ideas.map(renderGrowthIdeaCard).join(''));
      ideasGrid.querySelectorAll('[data-growth-idea-card]').forEach((card, index) => {
        card.classList.toggle('is-new', index < ideas.length);
      });
      setGrowthButtonFeedback(generateIdeasButton, 'Ideias geradas');
    });
  }

  if (!rootEl.__growthDelegatedBound) {
    rootEl.addEventListener('click', (event) => {
      const saveButton = event.target.closest('[data-growth-save-idea]');
      if (saveButton && rootEl.contains(saveButton)) {
        saveButton.setAttribute('disabled', 'disabled');
        setGrowthButtonFeedback(saveButton, 'Separado nesta sessao', 0);
        return;
      }

      const scriptButton = event.target.closest('[data-growth-script-from-idea]');
      if (scriptButton && rootEl.contains(scriptButton)) {
        const idea = scriptButton.getAttribute('data-growth-script-from-idea') || '';
        navigate(buildUrl('/workspace/growth/conteudo', { idea }));
      }
    });

    rootEl.addEventListener('change', (event) => {
      const target = event.target;
      if (target?.matches?.('[data-growth-metrics-filter]')) {
        applyGrowthMetricsFilters(rootEl);
        return;
      }
      if (!(target instanceof HTMLInputElement)) return;
      const preferenceId = target.getAttribute('data-growth-preference');
      if (!preferenceId) return;
      writeStoredGrowthPreferences({
        ...state.growthPreferences,
        [preferenceId]: target.checked,
      });
    });

    rootEl.__growthDelegatedBound = true;
  }

  const scriptForm = rootEl.querySelector('[data-growth-script-form]');
  const scriptResult = rootEl.querySelector('[data-growth-script-result]');
  if (scriptForm && scriptResult) {
    const queryIdea = parseCurrentQuery().get('idea');
    const topicInput = scriptForm.querySelector('[data-growth-script-topic]');
    if (queryIdea && topicInput) {
      topicInput.value = queryIdea;
    }

    scriptForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(scriptForm);
      const details = Object.fromEntries(formData.entries());
      const submitButton = scriptForm.querySelector('button[type="submit"]');
      const originalLabel = submitButton?.textContent ?? 'Gerar brief e roteiro';
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Gerando brief...';
      }

      try {
        const response = await api.generateGrowthScript(details);
        if (!response.ok) {
          throw new Error(response.error || response.body?.error || 'Nao foi possivel gerar o brief.');
        }
        scriptResult.innerHTML = renderGrowthScriptResult({ ...details, ...response.body, campaignReady: true });
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = originalLabel;
        }
        setGrowthButtonFeedback(submitButton, 'Brief + roteiro gerados');
      } catch (error) {
        scriptResult.innerHTML = renderGrowthScriptResult({
          ...details,
          campaignReady: true,
          error: error?.message || 'Backend indisponivel; usando roteiro local sem brief do workspace.',
        });
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = originalLabel;
        }
        setGrowthButtonFeedback(submitButton, 'Fallback local');
      }
      scriptResult.classList.remove('is-updated');
      void scriptResult.offsetWidth;
      scriptResult.classList.add('is-updated');
    });
  }

  rootEl.querySelectorAll('[data-growth-generate-report]').forEach((button) => {
    button.addEventListener('click', () => {
      const report = {
        title: `Relatorio rapido - ${formatClockLabel()}`,
        summary: 'Resumo criado a partir dos sinais atuais: manter conteudo educativo, testar ganchos diretos e acompanhar retencao nos primeiros segundos.',
      };
      addGrowthGeneratedReport(rootEl, report);
      setGrowthButtonFeedback(button, 'Relatorio gerado');
    });
  });

  rootEl.querySelectorAll('[data-growth-export-report]').forEach((button) => {
    button.addEventListener('click', () => exportGrowthReport(button));
  });

  rootEl.querySelectorAll('[data-growth-export-preferences]').forEach((button) => {
    button.addEventListener('click', () => exportGrowthPreferences(button));
  });

  rootEl.querySelectorAll('.growth-campaign-card .growth-action-row button:first-child').forEach((button) => {
    button.addEventListener('click', async () => {
      const link = button.closest('.growth-campaign-card')?.querySelector('.growth-link-pill')?.textContent?.trim() ?? '';
      try {
        if (navigator.clipboard && link) await navigator.clipboard.writeText(link);
      } catch {
        // Clipboard permission is optional; visual feedback still confirms the user action.
      }
      setGrowthButtonFeedback(button, 'Link copiado');
    });
  });
}

function withGrowthTimeout(promise, timeoutMs = GROWTH_CHANNEL_LOAD_TIMEOUT_MS) {
  if (!timeoutMs || timeoutMs <= 0) return promise;
  let timeoutId;
  const timeoutPromise = new Promise((resolve) => {
    timeoutId = setTimeout(() => resolve(GROWTH_CHANNEL_TIMEOUT_RESULT), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

async function loadGrowthAccountChannels(accounts, options = {}) {
  const validAccounts = Array.isArray(accounts)
    ? accounts.filter((account) => account?.id)
    : [];
  if (!validAccounts.length) return { channels: [], requested: 0, failed: 0 };

  const concurrency = Math.max(1, Math.min(
    Number(options.concurrency ?? GROWTH_CHANNEL_LOAD_CONCURRENCY) || GROWTH_CHANNEL_LOAD_CONCURRENCY,
    validAccounts.length
  ));
  const timeoutMs = Number(options.timeoutMs ?? GROWTH_CHANNEL_LOAD_TIMEOUT_MS) || GROWTH_CHANNEL_LOAD_TIMEOUT_MS;
  const channels = [];
  let failed = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < validAccounts.length) {
      const account = validAccounts[cursor];
      cursor += 1;
      const response = await withGrowthTimeout(
        api.accountChannels(account.id).catch(() => null),
        timeoutMs
      );
      if (response?.ok && Array.isArray(response.body?.channels)) {
        channels.push(...response.body.channels);
      } else {
        failed += 1;
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return { channels, requested: validAccounts.length, failed };
}

async function loadGrowthWorkspaceData(sectionId = 'cockpit') {
  let dashboardResult;
  let campaignsResult;
  let accountsResult;

  try {
    [dashboardResult, campaignsResult, accountsResult] = await Promise.all([
      api.dashboard(),
      api.campaigns({ limit: 50, offset: 0 }),
      api.accounts(),
    ]);
  } catch (error) {
    return {
      data: buildGrowthWorkspaceData(),
      error: error?.message ?? 'Nao foi possivel carregar dados reais do Growth.',
    };
  }

  const authFailure = [dashboardResult, campaignsResult, accountsResult]
    .find((entry) => entry && !entry.ok && entry.status === 401);
  if (authFailure) {
    return { unauthorized: true, data: buildGrowthWorkspaceData(), error: authFailure.error };
  }

  const accounts = accountsResult?.ok && Array.isArray(accountsResult.body?.accounts)
    ? accountsResult.body.accounts
    : [];
  const connectedAccounts = accounts.filter((account) => String(account?.status ?? '').toLowerCase() === 'connected');
  state.growthConnectedAccounts = accounts;

  const baseInput = {
    stats: dashboardResult?.ok ? dashboardResult.body : {},
    campaigns: campaignsResult?.ok && Array.isArray(campaignsResult.body?.campaigns) ? campaignsResult.body.campaigns : [],
    accounts,
    accountChannels: [],
    channelSync: {
      requested: connectedAccounts.length,
      failed: 0,
      pending: GROWTH_CHANNEL_HYDRATED_SECTIONS.has(sectionId) && connectedAccounts.length > 0,
    },
  };
  const shouldHydrateChannels = GROWTH_CHANNEL_HYDRATED_SECTIONS.has(sectionId);
  const channelDataPromise = shouldHydrateChannels && connectedAccounts.length
    ? loadGrowthAccountChannels(connectedAccounts)
      .then((channelResult) => buildGrowthWorkspaceData({
        ...baseInput,
        accountChannels: channelResult.channels,
        channelSync: { requested: channelResult.requested, failed: channelResult.failed, pending: false },
      }))
      .catch(() => buildGrowthWorkspaceData({
        ...baseInput,
        channelSync: { requested: connectedAccounts.length, failed: connectedAccounts.length, pending: false },
      }))
    : null;

  const failures = [dashboardResult, campaignsResult, accountsResult]
    .filter((entry) => entry && !entry.ok);
  return {
    data: buildGrowthWorkspaceData(baseInput),
    channelDataPromise,
    error: failures.length
      ? failures.map((entry) => entry.error).filter(Boolean).join(' | ') || 'Dados parciais carregados.'
      : '',
  };
}

function renderGrowthShellContent(sectionId, growthData) {
  return `
      ${renderGrowthHeader(sectionId, growthData)}
      ${renderGrowthNav(sectionId)}
      <section class="growth-content" data-growth-content>
        ${renderGrowthBody(sectionId, growthData)}
      </section>
  `;
}

function updateGrowthMetricsSection(moduleEl, growthData) {
  const metricsData = getGrowthFilteredMetricsData(growthData, state.growthMetricFilters ?? { date: 'all', platform: 'all' });
  const metricsGrid = moduleEl.querySelector('[data-growth-metrics-grid]');
  if (metricsGrid) {
    metricsGrid.innerHTML = renderGrowthMetricsGridHtml(metricsData);
  }

  const chartsGrid = moduleEl.querySelector('[data-growth-metrics-charts]');
  if (chartsGrid) {
    chartsGrid.innerHTML = renderGrowthMetricsChartsHtml(metricsData);
  }

  const rankingBody = moduleEl.querySelector('[data-growth-ranking-body]');
  if (rankingBody) {
    rankingBody.innerHTML = renderGrowthContentRankingRowsHtml(metricsData);
  }
}

function updateGrowthReportsSection(moduleEl, growthData) {
  const reportsGrid = moduleEl.querySelector('[data-growth-reports-grid]');
  if (reportsGrid) {
    const generatedReportsHtml = Array.from(reportsGrid.children)
      .filter((card) => card.classList?.contains('is-new'))
      .map((card) => card.outerHTML)
      .join('');
    reportsGrid.innerHTML = `${generatedReportsHtml}${renderGrowthReportsGridHtml(growthData)}`;
  }

  const chartSlot = moduleEl.querySelector('[data-growth-reports-chart]');
  if (chartSlot) {
    chartSlot.innerHTML = renderGrowthReportsChartHtml(growthData);
  }

  const insightsSlot = moduleEl.querySelector('[data-growth-reports-insights]');
  if (insightsSlot) {
    insightsSlot.innerHTML = renderGrowthReportsInsightsHtml(growthData);
  }
}

function applyGrowthWorkspaceData(sectionId, growthData) {
  const moduleEl = document.querySelector('.growth-module');
  if (!moduleEl || moduleEl.getAttribute('data-growth-section') !== sectionId) return false;
  state.growthWorkspaceData = growthData;

  const headerEl = moduleEl.querySelector('[data-growth-header]');
  if (headerEl) {
    headerEl.outerHTML = renderGrowthHeader(sectionId, growthData);
  }

  if (sectionId === 'metricas') {
    updateGrowthMetricsSection(moduleEl, growthData);
    return true;
  }

  if (sectionId === 'relatorios') {
    updateGrowthReportsSection(moduleEl, growthData);
    return true;
  }

  const contentEl = moduleEl.querySelector('[data-growth-content]');
  if (contentEl) {
    contentEl.innerHTML = renderGrowthBody(sectionId, growthData);
  }

  bindGrowthInteractions();
  return true;
}

async function hydrateGrowthAccountChannels(sectionId, channelDataPromise) {
  if (!channelDataPromise || !GROWTH_CHANNEL_HYDRATED_SECTIONS.has(sectionId)) return;
  const loadId = ++state.growthChannelLoadId;
  const growthData = await channelDataPromise;
  if (!growthData || loadId !== state.growthChannelLoadId) return;
  if (getGrowthSectionFromPath(window.location.pathname) !== sectionId) return;
  applyGrowthWorkspaceData(sectionId, growthData);
}

async function renderGrowthPage(pathname = window.location.pathname) {
  const sectionId = getGrowthSectionFromPath(pathname);
  const growthResult = await loadGrowthWorkspaceData(sectionId);
  if (growthResult.unauthorized) {
    unauthorizedRedirect();
    return;
  }
  const growthData = growthResult.data;
  state.growthWorkspaceData = growthData;
  const contentHtml = `
    <div class="growth-module" data-growth-section="${escapeAttribute(sectionId)}">
      ${renderGrowthShellContent(sectionId, growthData)}
    </div>
  `;

  renderWorkspaceShell({
    title: '',
    noticeHtml: growthResult.error ? `<div class="notice warning">${escapeHtml(growthResult.error)}</div>` : '',
    contentHtml,
  });
  bindGrowthInteractions();
  void hydrateGrowthAccountChannels(sectionId, growthResult.channelDataPromise);
}


// ─── Platform Dashboard design system ────────────────────────────────────────

function withAlpha(color, alpha, fallback = `rgba(100, 116, 139, ${alpha})`) {
  if (typeof color !== 'string' || !color.trim()) {
    return fallback;
  }

  return color.startsWith('#') ? hexToRgba(color, alpha) : color;
}

function getSelectedBackgroundTheme() {
  return BACKGROUND_THEME_OPTIONS.find((option) => option.id === state.backgroundTheme) ?? BACKGROUND_THEME_OPTIONS[0];
}

function buildOdThemeFromSettings() {
  const selected = getSelectedBackgroundTheme();
  const appearance = selected.appearance === 'dark' ? 'dark' : 'light';
  const accent = selected.primary ?? '#40e0d0';
  const accent2 = selected.primaryStrong ?? selected.info ?? accent;
  const textHi = selected.text;
  const textMd = selected.textSubtle;
  const textLo = selected.textMuted;
  const border = withAlpha(selected.border, appearance === 'dark' ? 0.32 : 0.26);
  const borderDim = withAlpha(selected.border, appearance === 'dark' ? 0.2 : 0.18);
  const panel = `linear-gradient(180deg, ${selected.surface} 0%, ${selected.surfaceMuted} 100%)`;
  const glow = withAlpha(accent, appearance === 'dark' ? 0.26 : 0.2);
  const chart = [
    accent,
    accent2,
    selected.info ?? accent,
    selected.warning ?? accent2,
    selected.success ?? accent,
    selected.danger ?? accent2,
  ];

  return {
    name: selected.label,
    appearance,
    bg: selected.pageBackground,
    accent,
    accent2,
    textHi,
    textMd,
    textLo,
    border,
    borderDim,
    panel,
    glow,
    chart,
  };
}

function applyOdThemeFromSettings() {
  const theme = buildOdThemeFromSettings();
  const root = document.getElementById('od-root');
  if (!root) return;
  const dashboardPage = root.closest('.workspace-page-dashboard');

  const isDarkTheme = theme.appearance === 'dark';
  root.style.background = theme.bg;
  if (dashboardPage) {
    dashboardPage.style.setProperty('--dashboard-page-background', theme.bg);
  }
  root.style.setProperty('--od-accent',     theme.accent);
  root.style.setProperty('--od-accent2',    theme.accent2);
  root.style.setProperty('--od-text-hi',    theme.textHi);
  root.style.setProperty('--od-text-md',    theme.textMd);
  root.style.setProperty('--od-text-lo',    theme.textLo);
  root.style.setProperty('--od-border',     theme.border);
  root.style.setProperty('--od-border-dim', theme.borderDim);
  root.style.setProperty('--od-panel-bg',   theme.panel);
  root.style.setProperty('--od-panel',      theme.panel);
  root.style.setProperty('--od-glow',       theme.glow);
  root.style.setProperty('--od-bg-globe-a', withAlpha(theme.accent, isDarkTheme ? 0.2 : 0.14));
  root.style.setProperty('--od-bg-globe-b', withAlpha(theme.accent2, isDarkTheme ? 0.18 : 0.12));
  root.style.setProperty('--od-bg-globe-shadow-a', withAlpha(theme.accent, isDarkTheme ? 0.32 : 0.2));
  root.style.setProperty('--od-bg-globe-shadow-b', withAlpha(theme.accent2, isDarkTheme ? 0.26 : 0.16));
  for (let i = 0; i < 6; i++) root.style.setProperty(`--od-chart-${i}`, theme.chart[i] ?? theme.chart[0]);

  const nameEl = document.getElementById('od-theme-name');
  if (nameEl) nameEl.textContent = 'THEME: ' + theme.name;

  // update SVG donut slices
  root.querySelectorAll('.od-donut-slice').forEach(sl => {
    const idx = parseInt(sl.getAttribute('data-cidx') ?? '0');
    const colors = [theme.accent, theme.accent2 ?? theme.accent, theme.chart[2] ?? theme.accent, theme.textMd, theme.chart[3] ?? theme.textLo];
    sl.setAttribute('stroke', colors[Math.min(idx, colors.length - 1)]);
  });
  root.querySelectorAll('.od-donut-dot').forEach(dot => {
    const idx = parseInt(dot.getAttribute('data-cidx') ?? '0');
    const colors = [theme.accent, theme.accent2 ?? theme.accent, theme.chart[2] ?? theme.accent, theme.textMd, theme.chart[3] ?? theme.textLo];
    dot.style.background = colors[Math.min(idx, colors.length - 1)];
  });
}

let _odGlobeCache = null;
function buildOdGlobe() {
  if (_odGlobeCache) return _odGlobeCache;
  const LAT = 20, LON = 40;
  const dots = [];
  for (let i = 1; i < LAT; i++) {
    const phi = (i / LAT) * Math.PI;
    for (let j = 0; j < LON; j++) {
      const theta = (j / LON) * Math.PI * 2;
      const x = (Math.sin(phi) * Math.cos(theta)).toFixed(3);
      const y = (Math.cos(phi)).toFixed(3);
      const z = Math.sin(phi) * Math.sin(theta);
      if ((i * 131 + j * 17) % 100 < 45) continue;
      const alpha = Math.min(1, 0.2 + Math.max(0, z) * 0.8).toFixed(2);
      dots.push(`<circle cx="${x}" cy="${y}" r="0.012" fill="var(--od-accent)" opacity="${alpha}"/>`);
    }
  }
  const latLines = [-0.7, -0.35, 0, 0.35, 0.7].map(yv => {
    const rx = Math.sqrt(Math.max(0, 1 - yv * yv)).toFixed(3);
    const ry = (Math.sqrt(Math.max(0, 1 - yv * yv)) * 0.15).toFixed(3);
    return `<ellipse cx="0" cy="${yv}" rx="${rx}" ry="${ry}" fill="none" stroke="var(--od-accent)" stroke-opacity="0.12" stroke-width="0.005"/>`;
  }).join('');
  _odGlobeCache = `<svg viewBox="-1.1 -1.1 2.2 2.2" class="od-globe-svg">${latLines}${dots.join('')}</svg>`;
  return _odGlobeCache;
}

function dashboardNumber(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dashboardPlatformLabel(platform) {
  switch ((platform ?? '').toLowerCase()) {
    case 'youtube':
      return 'YouTube';
    case 'tiktok':
      return 'TikTok';
    case 'instagram':
      return 'Instagram';
    default:
      return normalizeLabel(platform || 'Unknown');
  }
}

function getDashboardChannelLabel(channel) {
  return String(channel?.channelLabel ?? '').trim() || 'Conta conectada';
}

function renderRankBadge(index) {
  const rank = index + 1;
  const tier = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : 'standard';
  return `
    <span class="od-rank-badge" data-rank-tier="${tier}" aria-label="Rank ${rank}">
      ${renderCampaignMark(rank === 1 ? 'TOP' : `#${rank}`, rank === 1 ? 'success' : rank <= 3 ? 'warning' : 'info', 'od-rank-mark')}
      <span class="od-rank-number">${String(rank).padStart(2, '0')}</span>
    </span>
  `;
}

function renderChannelKpiIcon(provider) {
  return ['youtube', 'tiktok', 'instagram'].includes(provider)
    ? renderCampaignPlatformMark(provider, 'od-channel-platform-mark')
    : '';
}

function renderDeltaArrow(direction) {
  return direction === 'down'
    ? renderCampaignMark('DN', 'danger', 'od-delta-mark')
    : renderCampaignMark('UP', 'success', 'od-delta-mark');
}

function buildChannelKpiSlots(channelsByProvider) {
  const slots = {};
  ['youtube', 'tiktok', 'instagram'].forEach((provider) => {
    const list = (channelsByProvider?.[provider] ?? []).filter(Boolean);
    const individual = list.map((channel) => {
      const totalViews = Number(channel?.totalViews ?? 0);
      const topVideoViews = Number(channel?.topVideoViews ?? 0);
      const successRate = Number(channel?.successRate ?? 0);
      const hasStats = Boolean(channel?.hasStats) && totalViews > 0;
      const todayViews = hasStats ? Math.max(0, Math.round(topVideoViews * 0.18)) : 0;
      const baseline = hasStats ? Math.max(1, Math.round((totalViews - todayViews) / 30)) : 1;
      const growth = hasStats ? Math.round(((todayViews - baseline) / baseline) * 100) : 0;
      const meta = hasStats
        ? (successRate > 0 ? `${successRate.toFixed(1)}% de entrega` : 'Em crescimento')
        : 'Aguardando primeira publicacao';
      return {
        kind: 'account',
        label: getDashboardChannelLabel(channel),
        totalViews,
        todayViews,
        growth,
        meta,
        hasStats,
      };
    });
    let aggregate = null;
    if (individual.length >= 2) {
      const aggTotal = individual.reduce((sum, item) => sum + item.totalViews, 0);
      const aggToday = individual.reduce((sum, item) => sum + item.todayViews, 0);
      const aggBaseline = Math.max(1, Math.round((aggTotal - aggToday) / 30));
      const aggGrowth = aggTotal > 0 ? Math.round(((aggToday - aggBaseline) / aggBaseline) * 100) : 0;
      aggregate = {
        kind: 'aggregate',
        label: 'Todas as contas',
        totalViews: aggTotal,
        todayViews: aggToday,
        growth: aggGrowth,
        meta: `${individual.length} contas combinadas`,
      };
    }
    slots[provider] = { individual, aggregate };
  });
  return slots;
}

function renderChannelKpiCard(provider, slot) {
  const platformLabel = dashboardPlatformLabel(provider);
  const icon = renderChannelKpiIcon(provider);
  const hasData = slot && (slot.individual.length > 0 || slot.aggregate);
  if (!hasData) {
    return `
      <article class="od-channel-card od-channel-card-empty" data-channel="${escapeAttribute(provider)}">
        <div class="od-channel-card-stripe" aria-hidden="true"></div>
        <header class="od-channel-card-head">
          <div class="od-channel-icon" aria-hidden="true">${icon}</div>
          <div class="od-channel-meta">
            <span class="od-kpi-label od-mono">Canal</span>
            <strong class="od-channel-name">${escapeHtml(platformLabel)}</strong>
          </div>
        </header>
        <div class="od-channel-card-body">
          <span class="od-kpi-label od-mono">Sem contas conectadas</span>
          <strong class="od-channel-total od-channel-total-empty">—</strong>
        </div>
        <footer class="od-channel-card-foot">
          <small class="od-muted od-mono">Conecte uma conta do ${escapeHtml(platformLabel)} para acompanhar visualizacoes.</small>
        </footer>
      </article>
    `;
  }
  return `
    <article class="od-channel-card" data-channel="${escapeAttribute(provider)}" data-cycle data-active-index="0">
      <div class="od-channel-card-stripe" aria-hidden="true"></div>
      <span class="od-channel-card-progress" aria-hidden="true"><span class="od-channel-card-progress-fill"></span></span>
      <header class="od-channel-card-head">
        <div class="od-channel-icon" aria-hidden="true">${icon}</div>
        <div class="od-channel-meta">
          <span class="od-kpi-label od-mono">${escapeHtml(platformLabel)}</span>
          <strong class="od-channel-name" data-bind="label">—</strong>
        </div>
        <span class="od-channel-delta od-mono" data-bind="delta-chip" data-direction="up">
          <span class="od-channel-delta-icon" data-bind="delta-arrow"></span>
          <span data-bind="delta-text">+0%</span>
        </span>
      </header>
      <div class="od-channel-card-body">
        <span class="od-kpi-label od-mono" data-bind="kind-label">Visualizacoes totais da conta</span>
        <strong class="od-channel-total" data-bind="total">0</strong>
      </div>
      <footer class="od-channel-card-foot">
        <div class="od-channel-today">
          <span class="od-kpi-label od-mono">Hoje</span>
          <strong data-bind="today">+0</strong>
        </div>
        <div class="od-channel-trend od-muted od-mono">
          <span class="od-channel-trend-dot"></span>
          <span data-bind="trend-text">—</span>
        </div>
      </footer>
      <div class="od-channel-card-pager" aria-hidden="true">
        <span class="od-channel-card-counter od-mono" data-bind="counter">1/${slot.individual.length}</span>
        <span class="od-channel-card-aggregate-flag" data-bind="agg-flag" hidden>Todas as contas</span>
      </div>
    </article>
  `;
}

function renderChannelKpiCards(channelsByProvider) {
  const slots = buildChannelKpiSlots(channelsByProvider);
  if (typeof window !== 'undefined') window.__channelKpiSlots = slots;
  return ['youtube', 'tiktok', 'instagram']
    .map((provider) => renderChannelKpiCard(provider, slots[provider]))
    .join('');
}

function renderLeadershipRows(rankedChannels, emptyLabel) {
  if (!rankedChannels.length) {
    return `<div class="od-muted" style="padding:1rem 0">${escapeHtml(emptyLabel)}</div>`;
  }
  const visible = rankedChannels.slice(0, 6);
  const maxViews = Math.max(1, ...visible.map((c) => Number(c?.topVideoViews ?? 0)));
  const tierByIndex = ['gold', 'silver', 'bronze'];
  return visible.map((channel, index) => {
    const topVideoViews = Number(channel?.topVideoViews ?? 0);
    const topVideoLabel = channel?.topVideoTitle ?? 'Untitled video';
    const topVideoId = String(channel?.topVideoId ?? '').trim();
    const accountLabel = getDashboardChannelLabel(channel);
    const thumbnailUrl = topVideoId ? `https://i.ytimg.com/vi/${encodeURIComponent(topVideoId)}/hqdefault.jpg` : '';
    const performancePct = clampPercent((topVideoViews / maxViews) * 100);
    const tier = tierByIndex[index] || 'base';
    const performanceLabel = index === 0
      ? 'Leader'
      : `${Math.round(performancePct)}% of leader`;
    return `
      <div class="od-leader-row" data-rank-tier="${tier}">
        <span class="od-leader-rank">${renderRankBadge(index)}</span>
        <div class="od-leader-main">
          ${thumbnailUrl
            ? `<img class="od-leader-thumb" src="${escapeAttribute(thumbnailUrl)}" alt="${escapeAttribute(topVideoLabel)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" />`
            : '<div class="od-leader-thumb od-leader-thumb-empty" aria-hidden="true"></div>'}
          <div class="od-leader-copy">
            <small class="od-leader-account">${escapeHtml(accountLabel)}</small>
            <small class="od-leader-sub">${escapeHtml(topVideoLabel)}</small>
            <div class="od-leader-perf" aria-label="${escapeAttribute(`Performance: ${Math.round(performancePct)}% of leader`)}">
              <div class="od-leader-bar-track">
                <span class="od-leader-bar-fill" style="width:${performancePct}%"></span>
              </div>
              <span class="od-leader-perf-label od-mono">${escapeHtml(performanceLabel)}</span>
            </div>
          </div>
        </div>
        <span class="od-leader-pub od-mono">${formatNumber(topVideoViews)} views</span>
      </div>
    `;
  }).join('');
}

function renderViewsPerformancePanel(rankedChannels) {
  const visibleChannels = rankedChannels.slice(0, 6);
  if (!visibleChannels.length) {
    return '<div class="od-muted" style="padding:1rem 0">Conecte contas para liberar a analise de desempenho.</div>';
  }
  const totalViews = visibleChannels.reduce((sum, channel) => sum + Number(channel?.totalViews ?? 0), 0);
  const averageSuccess = visibleChannels.reduce((sum, channel) => sum + Number(channel?.successRate ?? 0), 0) / visibleChannels.length;
  const topChannel = visibleChannels[0];
  const maxViews = Math.max(1, ...visibleChannels.map((channel) => Number(channel?.totalViews ?? 0)));
  const rows = visibleChannels.map((channel) => {
    const channelViews = Number(channel?.totalViews ?? 0);
    const topVideoViews = Number(channel?.topVideoViews ?? 0);
    const totalPct = clampPercent((channelViews / maxViews) * 100);
    const topVideoPct = channelViews > 0 ? clampPercent((topVideoViews / channelViews) * 100) : 0;
    return `
      <div class="od-views-row">
        <div class="od-views-row-head">
          <span>${escapeHtml(getDashboardChannelLabel(channel))}</span>
          <strong class="od-mono">${formatNumber(channelViews)}</strong>
        </div>
        <div class="od-views-track" aria-label="${escapeAttribute(`${getDashboardChannelLabel(channel)} total views`)}">
          <span class="od-views-fill" style="width:${totalPct}%">
            <span class="od-views-top-video" style="width:${topVideoPct}%"></span>
          </span>
        </div>
        <div class="od-views-row-foot od-muted">
          <span>${formatNumber(topVideoViews)} top video views</span>
          <span>${formatPercent(channel?.successRate ?? 0)} delivery</span>
        </div>
      </div>
    `;
  }).join('');
  return `
    <div class="od-views-summary">
      <div class="od-views-total">
        <span class="od-kpi-label od-mono">Visualizacoes totais</span>
        <strong>${formatNumber(totalViews)}</strong>
      </div>
      <div class="od-views-chip">
        <span>Lider</span>
        <strong>${escapeHtml(getDashboardChannelLabel(topChannel))}</strong>
      </div>
      <div class="od-views-chip">
        <span>Entrega media</span>
        <strong>${formatPercent(averageSuccess)}</strong>
      </div>
    </div>
    <div class="od-views-chart">${rows}</div>
  `;
}

function startChannelKpiCarousel(root) {
  if (state.channelKpiTimers) {
    state.channelKpiTimers.forEach((id) => clearTimeout(id));
  }
  state.channelKpiTimers = [];
  const slots = (typeof window !== 'undefined' && window.__channelKpiSlots) || null;
  if (!slots) return;
  const TICK_MS = 7000;

  const cards = root.querySelectorAll('[data-channel-kpi-grid] [data-cycle]');
  cards.forEach((card) => {
    const provider = card.getAttribute('data-channel') || '';
    const slot = slots[provider];
    if (!slot || (!slot.individual.length && !slot.aggregate)) return;
    const individual = slot.individual;
    const hasAggregate = Boolean(slot.aggregate) && individual.length >= 2;
    const cycleLength = hasAggregate ? individual.length + 1 : Math.max(1, individual.length);

    const elements = {
      label: card.querySelector('[data-bind="label"]'),
      kindLabel: card.querySelector('[data-bind="kind-label"]'),
      total: card.querySelector('[data-bind="total"]'),
      today: card.querySelector('[data-bind="today"]'),
      deltaChip: card.querySelector('[data-bind="delta-chip"]'),
      deltaArrow: card.querySelector('[data-bind="delta-arrow"]'),
      deltaText: card.querySelector('[data-bind="delta-text"]'),
      trendText: card.querySelector('[data-bind="trend-text"]'),
      counter: card.querySelector('[data-bind="counter"]'),
      aggFlag: card.querySelector('[data-bind="agg-flag"]'),
      progressFill: card.querySelector('.od-channel-card-progress-fill'),
    };

    const dataAt = (idx) => {
      if (hasAggregate && idx === cycleLength - 1) return slot.aggregate;
      return individual[idx % individual.length];
    };

    const paint = (idx, animate = true) => {
      const data = dataAt(idx);
      if (!data) return;
      const direction = data.growth < 0 ? 'down' : 'up';
      const swap = () => {
        if (elements.label) elements.label.textContent = data.label;
        if (elements.kindLabel) {
          elements.kindLabel.textContent = data.kind === 'aggregate'
            ? 'Visualizacoes totais da plataforma'
            : 'Visualizacoes totais da conta';
        }
        if (elements.total) elements.total.textContent = formatNumber(data.totalViews);
        if (elements.today) elements.today.textContent = `+${formatNumber(data.todayViews)}`;
        if (elements.deltaChip) elements.deltaChip.setAttribute('data-direction', direction);
        if (elements.deltaArrow) elements.deltaArrow.innerHTML = renderDeltaArrow(direction);
        if (elements.deltaText) {
          const sign = data.growth > 0 ? '+' : '';
          elements.deltaText.textContent = `${sign}${data.growth}%`;
        }
        if (elements.trendText) elements.trendText.textContent = data.meta || (direction === 'up' ? 'Em crescimento' : 'Em queda');
        if (elements.counter) elements.counter.textContent = `${(idx % individual.length) + 1}/${individual.length}`;
        if (elements.aggFlag) elements.aggFlag.hidden = data.kind !== 'aggregate';
        card.setAttribute('data-trend', direction);
        card.setAttribute('data-active-kind', data.kind);
        card.setAttribute('data-active-index', String(idx));
      };
      if (!animate) {
        swap();
        return;
      }
      card.classList.add('is-swapping');
      const swapTimer = setTimeout(() => {
        swap();
        card.classList.remove('is-swapping');
        card.classList.add('is-swap-in');
        const settleTimer = setTimeout(() => card.classList.remove('is-swap-in'), 320);
        state.channelKpiTimers.push(settleTimer);
      }, 180);
      state.channelKpiTimers.push(swapTimer);
    };

    const restartProgress = () => {
      if (!elements.progressFill) return;
      elements.progressFill.style.transition = 'none';
      elements.progressFill.style.transform = 'scaleX(0)';
      void elements.progressFill.offsetWidth;
      elements.progressFill.style.transition = `transform ${TICK_MS}ms linear`;
      elements.progressFill.style.transform = 'scaleX(1)';
    };

    let activeIndex = 0;
    paint(activeIndex, false);
    if (cycleLength <= 1) return;
    restartProgress();

    let paused = false;
    const tick = () => {
      if (paused) return;
      activeIndex = (activeIndex + 1) % cycleLength;
      paint(activeIndex, true);
      restartProgress();
    };
    const interval = setInterval(tick, TICK_MS);
    state.channelKpiTimers.push(interval);

    card.addEventListener('mouseenter', () => {
      paused = true;
      if (elements.progressFill) {
        const computed = getComputedStyle(elements.progressFill).transform;
        elements.progressFill.style.transition = 'none';
        elements.progressFill.style.transform = computed;
      }
    });
    card.addEventListener('mouseleave', () => {
      paused = false;
      restartProgress();
    });
  });
}

function buildDashboardPlaylistPlayerData(playlists, assets) {
  const assetById = new Map(
    (Array.isArray(assets) ? assets : [])
      .filter((asset) => asset?.id)
      .map((asset) => [String(asset.id), asset])
  );

  return (Array.isArray(playlists) ? playlists : [])
    .map((playlist, playlistIndex) => {
      const items = Array.isArray(playlist?.items) ? [...playlist.items] : [];
      const videos = items
        .sort((left, right) => Number(left?.position ?? 0) - Number(right?.position ?? 0))
        .map((item, index) => {
          const asset = assetById.get(String(item?.videoAssetId ?? ''));
          const durationLabel = Number(asset?.duration_seconds ?? 0) > 0
            ? formatDurationSeconds(asset.duration_seconds)
            : 'sem duracao';
          return {
            id: `${playlist?.id ?? `playlist-${playlistIndex}`}-${item?.id ?? item?.videoAssetId ?? index}`,
            item,
            asset,
            title: asset?.original_name ?? item?.videoAssetId ?? 'Video da playlist',
            durationLabel,
            sourceUrl: asset?.id ? buildMediaAssetFileUrl(asset.id) : '',
            posterUrl: asset?.thumbnail?.id ? buildMediaAssetFileUrl(asset.thumbnail.id) : '',
          };
        })
        .filter((video) => video.sourceUrl && video.asset?.asset_type !== 'thumbnail');
      return {
        id: String(playlist?.id ?? `playlist-${playlistIndex}`),
        name: playlist?.name ?? 'Playlist',
        updatedAt: playlist?.updatedAt ?? '',
        videos,
      };
    })
    .filter((playlist) => playlist.videos.length > 0)
    .sort((left, right) => {
      const leftUpdated = Date.parse(left.updatedAt ?? '') || 0;
      const rightUpdated = Date.parse(right.updatedAt ?? '') || 0;
      return rightUpdated - leftUpdated;
    });
}

function renderDashboardPlaylistPlayerItem(playlist, video, isActive = false) {
  const stateLabel = video.item?.usedAt ? 'usado' : 'disponível';
  const metaLabel = `${playlist.name} - ${video.durationLabel}`;

  return `
    <button
      type="button"
      class="od-playlist-player-item${isActive ? ' active' : ''}"
      data-playlist-player-item
      data-playlist-id="${escapeAttribute(playlist.id)}"
      data-video-src="${escapeAttribute(video.sourceUrl)}"
      data-video-poster="${escapeAttribute(video.posterUrl)}"
      data-video-title="${escapeAttribute(video.title)}"
      data-video-meta="${escapeAttribute(metaLabel)}"
      data-used="${video.item?.usedAt ? 'true' : 'false'}"
    >
      <div class="od-playlist-player-thumb">
        ${video.posterUrl
          ? `<img src="${escapeAttribute(video.posterUrl)}" alt="${escapeAttribute(video.title)}" loading="lazy" decoding="async" />`
          : renderMediaMark('video', 'tile', { state: video.item?.usedAt ? 'success' : 'processing' })}
        <span class="od-playlist-player-play" aria-hidden="true"></span>
      </div>
      <div class="od-playlist-player-copy">
        <strong>${escapeHtml(video.title)}</strong>
        <span>${escapeHtml(video.durationLabel)}</span>
      </div>
      <span class="od-playlist-player-state od-mono">${escapeHtml(stateLabel)}</span>
    </button>
  `;
}

function renderDashboardPlaylistPanel(playlists, assets) {
  const playerPlaylists = buildDashboardPlaylistPlayerData(playlists, assets);
  const playlistCount = playerPlaylists.length;
  const videoCount = playerPlaylists.reduce((sum, playlist) => sum + playlist.videos.length, 0);
  const selectedPlaylist = playerPlaylists[0] ?? null;
  const selectedVideo = selectedPlaylist?.videos?.[0] ?? null;
  const playlistLabel = playlistCount === 1 ? '1 playlist' : `${formatNumber(playlistCount)} playlists`;
  const videoLabel = videoCount === 1 ? '1 vídeo' : `${formatNumber(videoCount)} vídeos`;
  const selectedMeta = selectedPlaylist && selectedVideo ? `${selectedPlaylist.name} - ${selectedVideo.durationLabel}` : '';
  const playlistOptionsHtml = playerPlaylists.map((playlist) => `
    <option value="${escapeAttribute(playlist.id)}">${escapeHtml(playlist.name)} (${formatNumber(playlist.videos.length)})</option>
  `).join('');
  const playlistItemsHtml = playerPlaylists
    .flatMap((playlist, playlistIndex) => playlist.videos.map((video, videoIndex) => (
      renderDashboardPlaylistPlayerItem(playlist, video, playlistIndex === 0 && videoIndex === 0)
    )))
    .join('');

  return `
    <aside class="od-hero-playlist-player od-panel" aria-label="Player de vídeos das playlists" data-playlist-player>
      <div class="od-hero-playlist-player-head">
        <span class="od-kpi-label od-mono">Playlist em reprodução</span>
        <span class="od-panel-meta od-muted od-mono">${escapeHtml(videoLabel)} - ${escapeHtml(playlistLabel)}</span>
      </div>
      ${selectedPlaylist && selectedVideo
            ? `
            <label class="od-playlist-player-select-wrap">
              <span class="od-mono">Escolher playlist</span>
              <select data-playlist-player-select>
                ${playlistOptionsHtml}
              </select>
            </label>
            <div class="od-playlist-player-controls">
              <button type="button" class="od-playlist-player-auto" data-playlist-player-autoplay aria-pressed="false">
                <span class="od-playlist-player-auto-dot" aria-hidden="true"></span>
                <span data-playlist-player-autoplay-label>Automático desligado</span>
              </button>
            </div>
            <div class="od-playlist-player-frame">
              <video
                class="od-playlist-player-video"
                data-playlist-player-video
                controls
                playsinline
                preload="metadata"
                src="${escapeAttribute(selectedVideo.sourceUrl)}"
                ${selectedVideo.posterUrl ? `poster="${escapeAttribute(selectedVideo.posterUrl)}"` : ''}
                aria-label="Player do video ${escapeAttribute(selectedVideo.title)}"
              ></video>
            </div>
            <div class="od-playlist-player-now">
              <strong data-playlist-player-title>${escapeHtml(selectedVideo.title)}</strong>
              <span data-playlist-player-meta>${escapeHtml(selectedMeta)}</span>
            </div>
            <div class="od-playlist-player-list" data-playlist-player-list aria-label="Fila de vídeos da playlist">
              ${playlistItemsHtml}
            </div>
          `
          : `
            <div class="od-playlist-player-empty">
              ${renderMediaMark('playlist', 'stat', { state: 'processing' })}
              <strong>Nenhuma playlist com vídeos prontos</strong>
              <span>Crie uma playlist com vídeos da biblioteca para reproduzir aqui.</span>
              <a class="button button-secondary" data-link href="/workspace/videos?view=playlists">Abrir playlists</a>
            </div>
          `}
      <small class="od-hero-playlist-player-disclaimer od-muted od-mono">Modo automático avança para o próximo vídeo da playlist</small>
    </aside>
  `;
}

function bindDashboardPlaylistPlayer(root) {
  const panel = root.querySelector('[data-playlist-player]');
  if (!panel) return;
  const select = panel.querySelector('[data-playlist-player-select]');
  const video = panel.querySelector('[data-playlist-player-video]');
  const titleTarget = panel.querySelector('[data-playlist-player-title]');
  const metaTarget = panel.querySelector('[data-playlist-player-meta]');
  const autoButton = panel.querySelector('[data-playlist-player-autoplay]');
  const autoLabel = panel.querySelector('[data-playlist-player-autoplay-label]');
  const items = Array.from(panel.querySelectorAll('[data-playlist-player-item]'));
  if (!items.length) return;
  let autoplayEnabled = false;

  const markPlayerEngaged = () => {
    panel.setAttribute?.('data-playlist-player-engaged', 'true');
  };

  const getVisibleItems = () => items.filter((item) => !item.hidden);

  const getActiveItem = () => items.find((item) => item.classList.contains('active')) ?? null;

  const getNextVisibleItem = () => {
    const visibleItems = getVisibleItems();
    if (!visibleItems.length) return null;
    const activeItem = getActiveItem();
    const activeIndex = visibleItems.indexOf(activeItem);
    return visibleItems[(activeIndex + 1 + visibleItems.length) % visibleItems.length] ?? visibleItems[0];
  };

  const syncAutoplayButton = () => {
    if (!autoButton) return;
    autoButton.classList.toggle('active', autoplayEnabled);
    autoButton.setAttribute('aria-pressed', autoplayEnabled ? 'true' : 'false');
    if (autoLabel) {
      autoLabel.textContent = autoplayEnabled ? 'Automático ligado' : 'Automático desligado';
    }
  };

  const activateItem = (item, { autoplay = false } = {}) => {
    if (!item || !video) return;
    const sourceUrl = item.getAttribute('data-video-src') || '';
    if (!sourceUrl) return;

    items.forEach((candidate) => candidate.classList.toggle('active', candidate === item));
    const posterUrl = item.getAttribute('data-video-poster') || '';
    const nextTitle = item.getAttribute('data-video-title') || 'Video da playlist';
    const nextMeta = item.getAttribute('data-video-meta') || '';

    if (titleTarget) titleTarget.textContent = nextTitle;
    if (metaTarget) metaTarget.textContent = nextMeta;
    if (video.getAttribute('src') !== sourceUrl) {
      video.pause();
      video.setAttribute('src', sourceUrl);
      if (posterUrl) {
        video.setAttribute('poster', posterUrl);
      } else {
        video.removeAttribute('poster');
      }
      video.load();
    }
    if (autoplay) {
      markPlayerEngaged();
      const playResult = video.play();
      if (playResult && typeof playResult.catch === 'function') playResult.catch(() => {});
    }
  };

  const setPlaylist = (playlistId) => {
    let firstVisible = null;
    let activeVisible = null;
    items.forEach((item) => {
      const visible = item.getAttribute('data-playlist-id') === playlistId;
      item.hidden = !visible;
      if (!visible) return;
      if (!firstVisible) firstVisible = item;
      if (item.classList.contains('active')) activeVisible = item;
    });
    activateItem(activeVisible ?? firstVisible, { autoplay: autoplayEnabled });
  };

  items.forEach((item) => {
    item.addEventListener('click', () => {
      markPlayerEngaged();
      activateItem(item, { autoplay: true });
    });
  });

  if (select) {
    select.addEventListener('change', () => {
      markPlayerEngaged();
      setPlaylist(select.value);
    });
    setPlaylist(select.value);
  } else {
    activateItem(items[0]);
  }

  if (autoButton) {
    autoButton.addEventListener('click', () => {
      markPlayerEngaged();
      autoplayEnabled = !autoplayEnabled;
      syncAutoplayButton();
      if (autoplayEnabled) {
        activateItem(getActiveItem() ?? getVisibleItems()[0], { autoplay: true });
      }
    });
    syncAutoplayButton();
  }

  if (video) {
    ['play', 'playing', 'seeking', 'timeupdate'].forEach((eventName) => {
      video.addEventListener(eventName, markPlayerEngaged);
    });
    video.addEventListener('ended', () => {
      if (!autoplayEnabled) {
        panel.removeAttribute?.('data-playlist-player-engaged');
        return;
      }
      const nextItem = getNextVisibleItem();
      if (nextItem) activateItem(nextItem, { autoplay: true });
    });
  }
}

function isDashboardPlaylistPlayerProtected() {
  const dashboardVideo = document.querySelector('[data-playlist-player-video]');
  if (!(dashboardVideo instanceof HTMLVideoElement)) return false;
  return Boolean(dashboardVideo.closest?.('[data-playlist-player]'));
}

function startDashboardClock(root) {
  clearDashboardClockTimer();
  const clockTargets = Array.from(root?.querySelectorAll?.('[data-dashboard-clock]') ?? []);
  if (!clockTargets.length) return;

  const updateClock = () => {
    const clockLabel = formatClockLabel();
    clockTargets.forEach((target) => {
      target.textContent = clockLabel;
    });
  };

  updateClock();
  state.dashboardClockTimer = setInterval(updateClock, 1000);
}

function bindDashboardInteractions() {
  const dashboardRoot = document.getElementById('od-root');
  if (!dashboardRoot) return;
  clearPulseRotateTimer();
  startDashboardClock(dashboardRoot);
  startChannelKpiCarousel(dashboardRoot);
  bindDashboardPlaylistPlayer(dashboardRoot);

  dashboardRoot.querySelectorAll('[data-dashboard-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      const mode = button.getAttribute('data-dashboard-mode') || 'overview';
      dashboardRoot.setAttribute('data-mode', mode);
      dashboardRoot.querySelectorAll('[data-dashboard-mode]').forEach((item) => {
        item.classList.toggle('active', item.getAttribute('data-dashboard-mode') === mode);
      });
    });
  });

  dashboardRoot.querySelectorAll('[data-action="dashboard-refresh"]').forEach((button) => {
    button.addEventListener('click', () => {
      setButtonBusy(button, true, '...');
      void renderPlatformDashboardPage();
    });
  });

  const pulseLines = Array.from(dashboardRoot.querySelectorAll('[data-pulse-line]'));
  if (pulseLines.length > 1) {
    let activeIndex = 0;
    state.pulseRotateTimer = setInterval(() => {
      activeIndex = (activeIndex + 1) % pulseLines.length;
      pulseLines.forEach((line, index) => {
        line.classList.toggle('active', index === activeIndex);
      });
    }, 5000);
  }
}

async function renderPlatformDashboardPage() {
  let result;
  let campaignsResult;
  let mediaResult;
  let accountsResult;
  let destinationsResult;
  let playlistsResult;

  try {
    [result, campaignsResult, mediaResult, accountsResult, destinationsResult, playlistsResult] = await Promise.all([
      api.dashboard(),
      api.campaigns({ limit: 12, offset: 0 }),
      api.media(),
      api.accounts(),
      loadConnectedPublishDestinations(),
      api.playlists(),
    ]);
  } catch (error) {
    renderWorkspaceShell({
      title: 'Dashboard',
      subtitle: 'Campaign health and operational summaries.',
      noticeHtml: `<div class="notice error">${escapeHtml(error?.message ?? 'Dashboard request failed')}</div>`,
      contentHtml: '<section class="card">Unable to load dashboard data.</section>',
    });
    return;
  }

  const authFailure = [result, campaignsResult, mediaResult, accountsResult, destinationsResult, playlistsResult]
    .find((entry) => entry && !entry.ok && entry.status === 401);
  if (authFailure) {
    unauthorizedRedirect();
    return;
  }
  if (!result.ok) {
    renderWorkspaceShell({
      title: 'Dashboard',
      subtitle: 'Campaign health and operational summaries.',
      noticeHtml: `<div class="notice error">${escapeHtml(result.error)}</div>`,
      contentHtml: '<section class="card">Unable to load dashboard data.</section>',
    });
    return;
  }

  const stats = result.body ?? {};
  const campaigns = campaignsResult?.ok && Array.isArray(campaignsResult.body?.campaigns) ? campaignsResult.body.campaigns : [];
  const assets = mediaResult?.ok && Array.isArray(mediaResult.body?.assets) ? mediaResult.body.assets : [];
  const accounts = accountsResult?.ok && Array.isArray(accountsResult.body?.accounts) ? accountsResult.body.accounts : [];
  const destinations = destinationsResult?.ok && Array.isArray(destinationsResult.destinations) ? destinationsResult.destinations : [];
  const playlists = playlistsResult?.ok && Array.isArray(playlistsResult.body?.playlists) ? playlistsResult.body.playlists : [];
  const channels = Array.isArray(stats?.channels) ? [...stats.channels] : [];

  const channelsByProvider = { youtube: [], tiktok: [], instagram: [] };
  if (accounts.length) {
    const accountChannelResponses = await Promise.all(
      accounts.map((account) => api.accountChannels(account.id).catch(() => null))
    );
    const statsByChannelId = new Map();
    channels.forEach((channel) => {
      const id = String(channel?.channelId ?? '').trim();
      if (id) statsByChannelId.set(id, channel);
    });
    accounts.forEach((account, index) => {
      const providerRaw = String(account?.provider ?? '').toLowerCase();
      const provider = providerRaw === 'google' ? 'youtube' : providerRaw;
      if (!channelsByProvider[provider]) return;
      const isConnected = String(account?.status ?? '').toLowerCase() === 'connected';
      if (!isConnected) return;
      const response = accountChannelResponses[index];
      const accountChannels = response?.ok && Array.isArray(response.body?.channels) ? response.body.channels : [];

      if (provider === 'youtube' && accountChannels.length > 0) {
        accountChannels.forEach((ch) => {
          const channelId = String(ch?.id ?? ch?.channelId ?? '').trim();
          const stat = channelId ? statsByChannelId.get(channelId) : null;
          channelsByProvider.youtube.push({
            channelId,
            channelLabel: ch?.title ?? ch?.label ?? account?.displayName ?? 'YouTube channel',
            totalViews: Number(stat?.totalViews ?? 0),
            topVideoViews: Number(stat?.topVideoViews ?? 0),
            topVideoId: stat?.topVideoId ?? null,
            topVideoTitle: stat?.topVideoTitle ?? null,
            successRate: Number(stat?.successRate ?? 0),
            hasStats: Boolean(stat),
          });
        });
      } else {
        const fallbackId = String(account?.id ?? '').trim();
        const stat = fallbackId ? statsByChannelId.get(fallbackId) : null;
        channelsByProvider[provider].push({
          channelId: fallbackId,
          channelLabel: account?.displayName ?? account?.email ?? dashboardPlatformLabel(provider),
          totalViews: Number(stat?.totalViews ?? 0),
          topVideoViews: Number(stat?.topVideoViews ?? 0),
          topVideoId: stat?.topVideoId ?? null,
          topVideoTitle: stat?.topVideoTitle ?? null,
          successRate: Number(stat?.successRate ?? 0),
          hasStats: Boolean(stat),
        });
      }
    });
  }
  const rankedChannels = [...channels].sort((left, right) => {
    const leftTopViews = Number(left?.topVideoViews ?? 0);
    const rightTopViews = Number(right?.topVideoViews ?? 0);
    if (rightTopViews !== leftTopViews) return rightTopViews - leftTopViews;
    return String(left?.channelId ?? '').localeCompare(String(right?.channelId ?? ''));
  });
  const liveClock = formatClockLabel();
  const nextCampaign = campaigns.find((campaign) => campaign.scheduledAt) ?? null;

  const campaignTotal = dashboardNumber(stats?.campaigns?.total ?? campaignsResult?.body?.total ?? campaigns.length);
  const targetTotal = dashboardNumber(stats?.targets?.total);
  const publishedTargets = dashboardNumber(stats?.targets?.byStatus?.publicado);
  const failedTargets = dashboardNumber(stats?.targets?.byStatus?.erro);
  const projectedQuota = dashboardNumber(stats?.quota?.projectedPercent);
  const successRate = dashboardNumber(stats?.targets?.successRate);
  const activeJobs = dashboardNumber(stats?.jobs?.byStatus?.queued) + dashboardNumber(stats?.jobs?.byStatus?.processing);
  const campaignHeadlineCorpus = campaigns
    .map((campaign) => String(campaign?.title ?? ''))
    .join(' ')
    .toLowerCase();
  const profileTag = /tutorial|how to|guide|aula/.test(campaignHeadlineCorpus)
    ? 'tutorial'
    : /podcast|interview|talk/.test(campaignHeadlineCorpus)
      ? 'podcast'
      : /game|gaming|playthrough/.test(campaignHeadlineCorpus)
        ? 'gaming'
        : /music|song|cover|beat/.test(campaignHeadlineCorpus)
          ? 'music'
          : /review|tech|ai|software/.test(campaignHeadlineCorpus)
            ? 'tech'
            : 'creator';
  const pulseAdsByProfile = {
    tutorial: [
      'Tutoriais estao criando consistencia. Transforme a proxima aula em campanha.',
      'Cada explicacao pode virar distribuicao multi-plataforma em um fluxo.',
      'Publique com fila, agenda e revisao antes de cada tutorial ir ao ar.',
    ],
    podcast: [
      'Cortes de podcast sustentam ritmo. Mantenha a cadencia semanal.',
      'Do episodio longo ao destaque curto, publique sem perder controle.',
      'Cadencia editorial para criadores que vencem por consistencia.',
    ],
    gaming: [
      'Melhores momentos de gameplay podem alimentar varios canais.',
      'Empilhe lancamentos, mantenha o ciclo de hype e publique mais rapido.',
      'Um controle unico para shorts, recaps e videos com maior sinal.',
    ],
    music: [
      'Lancamentos musicais precisam de repeticao planejada, nao improviso.',
      'Publique cortes, visuais e versoes completas com sincronia.',
      'Do teaser a estreia, o fluxo fica pronto para lancar.',
    ],
    tech: [
      'Videos de tecnologia pedem precisao editorial e repeticao inteligente.',
      'Publique reviews, explicacoes e updates com controle de campanha.',
      'Controle de alto ritmo para criadores que publicam com frequencia.',
    ],
    creator: [
      'Seu perfil esta pronto para distribuicao multi-plataforma.',
      'Escalone alcance com um fluxo alinhado ao seu ritmo de publicacao.',
      'Da ideia ao post publicado, cada lancamento fica organizado.',
    ],
  };
  const pulseAds = pulseAdsByProfile[profileTag];
  const leadershipHtml = renderLeadershipRows(rankedChannels, 'Nenhum video ranqueado ainda.');
  const viewsPerformanceHtml = renderViewsPerformancePanel(rankedChannels);
  const playlistPanelHtml = renderDashboardPlaylistPanel(playlists, assets);
  const reauthAccounts = accounts.filter((account) => String(account?.status ?? '').toLowerCase() === 'reauth_required').length;
  const topSignal = rankedChannels[0] ?? null;
  const dashboardDecisionCards = [
    {
      label: 'O que publicar',
      title: nextCampaign ? 'Acompanhar proxima campanha' : 'Criar proxima campanha',
      detail: nextCampaign
        ? `${nextCampaign.title ?? 'Campanha sem titulo'} - ${formatDate(nextCampaign.scheduledAt)}`
        : assets.length > 0
          ? 'Use uma midia pronta e escolha destinos ativos.'
          : 'Envie uma midia antes de criar a proxima campanha.',
      href: nextCampaign?.id ? `/workspace/campanhas/${encodeURIComponent(nextCampaign.id)}` : '/workspace/campanhas/nova',
      cta: nextCampaign ? 'Abrir campanha' : 'Criar campanha',
      tone: 'info',
      mark: 'POST',
    },
    {
      label: 'O que corrigir',
      title: failedTargets > 0 ? `${formatNumber(failedTargets)} falhas de publicacao` : reauthAccounts > 0 ? `${formatNumber(reauthAccounts)} conta precisa OAuth` : 'Operacao sem bloqueio critico',
      detail: failedTargets > 0
        ? 'Priorize destinos com erro antes de criar novos lancamentos.'
        : reauthAccounts > 0
          ? 'Reconecte contas para recuperar campanhas travadas.'
          : 'Mantenha a fila saudavel revisando destinos e canais.',
      href: failedTargets > 0 ? '/workspace/campanhas?status=failed' : reauthAccounts > 0 ? '/workspace/accounts?status=reauth_required' : '/workspace/accounts',
      cta: failedTargets > 0 ? 'Ver falhas' : reauthAccounts > 0 ? 'Reconectar' : 'Ver contas',
      tone: failedTargets > 0 || reauthAccounts > 0 ? 'danger' : 'success',
      mark: failedTargets > 0 || reauthAccounts > 0 ? 'FIX' : 'OK',
    },
    {
      label: 'O que esta performando',
      title: topSignal?.topVideoTitle ? String(topSignal.topVideoTitle).slice(0, 54) : 'Sem ranking consolidado ainda',
      detail: topSignal
        ? `${formatNumber(Number(topSignal.topVideoViews ?? 0))} views no melhor sinal.`
        : 'Publique e conecte canais para gerar leitura de performance.',
      href: '/workspace/growth/metricas',
      cta: 'Ver sinais',
      tone: topSignal ? 'success' : 'warning',
      mark: topSignal ? 'TOP' : 'SINAL',
    },
  ];

  const primaryDecision = dashboardDecisionCards[0];
  const secondaryDecisions = dashboardDecisionCards.slice(1);
  const operationTone = failedTargets > 0 || reauthAccounts > 0 ? 'attention' : activeJobs > 0 ? 'active' : 'healthy';
  const operationLabel = operationTone === 'attention'
    ? 'Atencao necessaria'
    : operationTone === 'active'
      ? 'Publicacoes em andamento'
      : 'Operacao saudavel';

  const contentHtml = `
    <div id="od-root" class="od-root od-dashboard-pro pmp-dashboard" data-mode="overview">
      <header class="pmp-dashboard-header">
        <div class="pmp-dashboard-title">
          <span class="pmp-eyebrow">Central de operacao</span>
          <h1>Visao geral</h1>
          <p>Acompanhe publicacoes, identifique bloqueios e escolha a proxima acao sem perder o contexto.</p>
        </div>
        <div class="pmp-dashboard-header-actions">
          <span class="pmp-updated od-mono"><span class="od-live-dot"></span> Atualizado <strong data-dashboard-clock>${escapeHtml(liveClock)}</strong></span>
          <button type="button" class="pmp-button pmp-button-quiet" data-action="dashboard-refresh">Atualizar</button>
          <a class="pmp-button pmp-button-primary" data-link href="/workspace/campanhas/nova">Criar campanha</a>
        </div>
      </header>

      <section class="pmp-command" aria-label="Prioridade operacional">
        <article class="pmp-priority-panel" data-tone="${escapeHtml(operationTone)}">
          <div class="pmp-priority-status">
            <span class="pmp-status-dot" aria-hidden="true"></span>
            <span>${escapeHtml(operationLabel)}</span>
          </div>
          <div class="pmp-priority-copy">
            <span class="pmp-section-kicker">Proxima melhor acao</span>
            <h2>${escapeHtml(primaryDecision.title)}</h2>
            <p>${escapeHtml(primaryDecision.detail)}</p>
          </div>
          <div class="pmp-priority-actions">
            <a class="pmp-button pmp-button-primary" data-link href="${escapeAttribute(primaryDecision.href)}">${escapeHtml(primaryDecision.cta)}</a>
            <a class="pmp-text-link" data-link href="/workspace/campanhas">Ver todas as campanhas</a>
          </div>
          <div class="pmp-priority-context">
            <span>Proxima publicacao</span>
            <strong>${escapeHtml(nextCampaign ? `${nextCampaign.title ?? 'Sem titulo'} - ${formatDate(nextCampaign.scheduledAt)}` : 'Nenhuma campanha agendada')}</strong>
          </div>
        </article>

        <aside class="pmp-health-panel" aria-label="Saude da operacao">
          <div class="pmp-panel-heading">
            <div>
              <span class="pmp-section-kicker">Saude da operacao</span>
              <h2>Fluxo de publicacao</h2>
            </div>
            <span class="pmp-health-score">${formatPercent(successRate)}</span>
          </div>
          <div class="pmp-health-list">
            <div class="pmp-health-item">
              <div><span>Taxa de sucesso</span><strong>${formatPercent(successRate)}</strong></div>
              <span class="pmp-health-track"><span style="width:${clampPercent(successRate)}%"></span></span>
            </div>
            <div class="pmp-health-item" data-tone="${projectedQuota >= 80 ? 'danger' : projectedQuota >= 60 ? 'warning' : 'info'}">
              <div><span>Uso projetado da cota</span><strong>${formatPercent(projectedQuota)}</strong></div>
              <span class="pmp-health-track"><span style="width:${clampPercent(projectedQuota)}%"></span></span>
            </div>
          </div>
          <div class="pmp-health-meta">
            <div><strong>${formatNumber(accounts.length)}</strong><span>contas</span></div>
            <div><strong>${formatNumber(destinations.length)}</strong><span>canais</span></div>
            <div><strong>${formatNumber(targetTotal)}</strong><span>destinos</span></div>
          </div>
        </aside>
      </section>

      <section class="pmp-metrics-section" aria-labelledby="pmp-metrics-title">
        <div class="pmp-section-heading">
          <div>
            <span class="pmp-section-kicker">Resumo de hoje</span>
            <h2 id="pmp-metrics-title">O que esta acontecendo agora</h2>
          </div>
          <span class="pmp-section-note">Dados consolidados do workspace</span>
        </div>
        <div class="pmp-metric-board">
          <article class="pmp-metric"><span>Publicacoes concluidas</span><strong>${formatNumber(publishedTargets)}</strong><small>${formatPercent(successRate)} de sucesso</small></article>
          <article class="pmp-metric"><span>Campanhas</span><strong>${formatNumber(campaignTotal)}</strong><small>Total no workspace</small></article>
          <article class="pmp-metric" data-tone="${activeJobs > 0 ? 'active' : 'neutral'}"><span>Em processamento</span><strong>${formatNumber(activeJobs)}</strong><small>Fila e jobs ativos</small></article>
          <article class="pmp-metric" data-tone="${failedTargets > 0 ? 'danger' : 'healthy'}"><span>Exigem atencao</span><strong>${formatNumber(failedTargets)}</strong><small>${failedTargets > 0 ? 'Falhas para revisar' : 'Nenhum bloqueio'}</small></article>
        </div>
      </section>

      <section class="pmp-action-section" aria-labelledby="pmp-actions-title">
        <div class="pmp-section-heading">
          <div>
            <span class="pmp-section-kicker">Decisoes rapidas</span>
            <h2 id="pmp-actions-title">Mantenha a operacao em movimento</h2>
          </div>
        </div>
        <div class="pmp-secondary-actions">
          ${secondaryDecisions.map((card) => `
            <article class="pmp-secondary-action" data-tone="${escapeAttribute(card.tone)}">
              <div class="pmp-secondary-action-copy">
                <span>${escapeHtml(card.label)}</span>
                <h3>${escapeHtml(card.title)}</h3>
                <p>${escapeHtml(card.detail)}</p>
              </div>
              <a class="pmp-text-link" data-link href="${escapeAttribute(card.href)}">${escapeHtml(card.cta)}</a>
            </article>
          `).join('')}
        </div>
      </section>

      <section class="pmp-channel-section" aria-labelledby="pmp-channel-title">
        <div class="pmp-section-heading">
          <div>
            <span class="pmp-section-kicker">Canais conectados</span>
            <h2 id="pmp-channel-title">Desempenho por plataforma</h2>
          </div>
          <a class="pmp-text-link" data-link href="/workspace/accounts">Gerenciar contas</a>
        </div>
        <div class="od-channel-kpi-grid pmp-channel-grid" data-channel-kpi-grid>
          ${renderChannelKpiCards(channelsByProvider)}
        </div>
      </section>

      <section class="pmp-performance-section" aria-labelledby="pmp-performance-title">
        <div class="pmp-section-heading">
          <div>
            <span class="pmp-section-kicker">Analise de crescimento</span>
            <h2 id="pmp-performance-title">Conteudos e canais com maior sinal</h2>
          </div>
          <a class="pmp-text-link" data-link href="/workspace/growth/metricas">Abrir metricas</a>
        </div>
        <div class="pmp-performance-grid">
          <article class="od-panel od-leader-panel pmp-data-panel">
            <div class="pmp-data-panel-head">
              <h3>Melhores conteudos</h3>
              <span>Por visualizacoes</span>
            </div>
            ${leadershipHtml}
          </article>
          <article class="od-panel od-views-panel pmp-data-panel">
            <div class="pmp-data-panel-head">
              <h3>Visualizacoes por canal</h3>
              <span>Comparativo consolidado</span>
            </div>
            ${viewsPerformanceHtml}
          </article>
        </div>
      </section>

      <section class="pmp-library-section" aria-labelledby="pmp-library-title">
        <div class="pmp-section-heading">
          <div>
            <span class="pmp-section-kicker">Biblioteca</span>
            <h2 id="pmp-library-title">Conteudo pronto para publicar</h2>
          </div>
          <div class="pmp-library-meta"><strong>${formatNumber(assets.length)}</strong><span>midias disponiveis</span></div>
        </div>
        <div class="pmp-library-player">${playlistPanelHtml}</div>
      </section>
    </div>
  `;

  renderWorkspaceShell({ title: '', contentHtml });
  applyOdThemeFromSettings();
  if (typeof bindDashboardInteractions === 'function') bindDashboardInteractions();
  clearAutoRefreshTimer();

  if (typeof shouldAutoRefreshDashboard === 'function' && shouldAutoRefreshDashboard(stats)) {
    scheduleDashboardAutoRefresh({ protectPlaylistPlayer: true });
  }
}

async function renderAccountsOauthCallbackPage() {
  const query = parseCurrentQuery();
  const code = query.get('code') ?? '';
  const stateParam = query.get('state') ?? '';
  const provider = (query.get('provider') ?? readPendingOauthProvider() ?? 'google').trim().toLowerCase();
  const providerLabel = getProviderLabel(provider);
  let callbackRequest;
  switch (provider) {
    case 'youtube':
      callbackRequest = api.accountYouTubeOauthCallback(code, stateParam);
      break;
    case 'tiktok':
      callbackRequest = api.accountTikTokOauthCallback(code, stateParam);
      break;
    case 'instagram':
      callbackRequest = api.accountInstagramOauthCallback(code, stateParam);
      break;
    case 'google':
    default:
      callbackRequest = api.accountOauthCallback(code, stateParam);
      break;
  }

  if (!code || !stateParam) {
    renderWorkspaceShell({
      title: 'Contas',
      subtitle: `${providerLabel} OAuth callback`,
      noticeHtml: '<div class="notice error">Parametros OAuth ausentes (code/state).</div>',
      contentHtml: '<section class="card"><a class="button button-secondary" data-link href="/workspace/accounts">Voltar para contas</a></section>',
    });
    return;
  }

  renderWorkspaceShell({
    title: 'Contas',
    subtitle: `Finalizando conexao ${providerLabel}...`,
    contentHtml: `<section class="card">Conectando sua conta ${providerLabel}...</section>`,
  });

  const callbackResult = await callbackRequest;
  writePendingOauthProvider(null);
  if (!callbackResult.ok) {
    if (callbackResult.status === 401) {
      unauthorizedRedirect();
      return;
    }

    navigate(buildUrl('/workspace/accounts', {
      oauth: 'error',
      provider,
      oauthMessage: callbackResult.error ?? 'OAuth callback failed.',
    }), true);
    return;
  }

  navigate(buildUrl('/workspace/accounts', {
    oauth: 'success',
    provider,
    syncChannels: callbackResult.body?.sync?.channelCount ?? '',
    syncMessage: callbackResult.body?.sync?.message ?? '',
  }), true);
}

async function renderAccountsPage() {
  const listResult = await api.accounts();
  if (!listResult.ok) {
    if (listResult.status === 401) {
      unauthorizedRedirect();
      return;
    }
    renderWorkspaceShell({
      title: 'Contas',
      subtitle: 'Contas sociais conectadas e canais de publicacao.',
      noticeHtml: `<div class="notice error">${escapeHtml(listResult.error)}</div>`,
      contentHtml: '<section class="card">Nao foi possivel carregar as contas.</section>',
    });
    return;
  }

  const accounts = Array.isArray(listResult.body?.accounts)
    ? listResult.body.accounts.filter((account) => isSupportedWorkspaceProvider(account.provider))
    : [];
  const query = parseCurrentQuery();
  const search = (query.get('search') ?? '').trim();
  const statusFilter = (query.get('status') ?? '').trim();
  const oauth = (query.get('oauth') ?? '').trim();
  const oauthProvider = (query.get('provider') ?? 'google').trim().toLowerCase();
  const oauthMessage = (query.get('oauthMessage') ?? '').trim();
  const syncChannelsCount = query.get('syncChannels');
  const syncMessage = (query.get('syncMessage') ?? '').trim();
  const oauthProviderLabel = getProviderLabel(oauthProvider);
  const reauthReturnProvider = readCampaignReauthReturnProvider();

  const channelResponses = await Promise.all(accounts.map((account) => api.accountChannels(account.id)));
  const channelsByAccountId = new Map();
  const channelErrors = [];
  let totalChannels = 0;
  let activeChannels = 0;

  accounts.forEach((account, index) => {
    const channelResponse = channelResponses[index];
    if (!channelResponse?.ok) {
      if (channelResponse?.error) {
        channelErrors.push(`${account.displayName ?? account.email ?? getProviderLabel(account.provider)}: ${channelResponse.error}`);
      }
      channelsByAccountId.set(account.id, []);
      return;
    }
    const channels = Array.isArray(channelResponse.body?.channels) ? channelResponse.body.channels : [];
    channelsByAccountId.set(account.id, channels);
    totalChannels += channels.length;
    activeChannels += channels.filter((channel) => channel.isActive).length;
  });

  const normalizedSearch = search.toLowerCase();
  const filteredAccounts = accounts.filter((account) => {
    const accountChannels = channelsByAccountId.get(account.id) ?? [];
    if (statusFilter && account.status !== statusFilter) {
      return false;
    }
    if (!normalizedSearch) {
      return true;
    }
    const haystack = [
      account.displayName,
      account.email,
      account.id,
      account.googleSubject,
      account.providerSubject,
      ...accountChannels.flatMap((channel) => [
        channel.title,
        channel.handle,
      ]),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(normalizedSearch);
  });

  const selectedQueryAccountId = query.get('account');
  const selectedAccountId = selectedQueryAccountId && filteredAccounts.some((account) => account.id === selectedQueryAccountId)
    ? selectedQueryAccountId
    : filteredAccounts[0]?.id ?? accounts[0]?.id ?? null;
  const selectedAccount = selectedAccountId ? accounts.find((account) => account.id === selectedAccountId) ?? null : null;
  const channels = selectedAccountId ? (channelsByAccountId.get(selectedAccountId) ?? []) : [];
  const selectedPreviewChannel = pickPreviewChannel(channels);
  const selectedAccountDisplayLabel = selectedAccount
    ? formatVisibleChannelName(selectedPreviewChannel, selectedAccount)
    : 'Select a channel';
  const selectedAccountSupportsChannels = supportsChannels(selectedAccount?.provider);
  const selectedAccountChannelSummary = selectedAccountId
    ? {
        total: channels.length,
        active: channels.filter((channel) => channel.isActive).length,
      }
    : null;
  const allChannels = accounts.flatMap((account) => {
    const accountChannels = channelsByAccountId.get(account.id) ?? [];
    if (accountChannels.length > 0) {
      return accountChannels.map((channel) => ({
        ...channel,
        connectedAccountLabel: account.displayName ?? getProviderLabel(account.provider),
        connectedAccountId: account.id,
      }));
    }
    if (!supportsChannels(account.provider)) {
      return [{
        id: account.id,
        title: account.displayName ?? account.email ?? account.id,
        handle: account.email ?? '-',
        isActive: account.status === 'connected',
        connectedAccountLabel: getProviderLabel(account.provider),
        connectedAccountId: account.id,
        provider: account.provider,
      }];
    }
    return [];
  });

  const connectedCount = accounts.filter((account) => account.status === 'connected').length;
  const reauthCount = accounts.filter((account) => account.status === 'reauth_required').length;
  const disconnectedCount = accounts.filter((account) => account.status === 'disconnected').length;
  const liveClock = formatClockLabel();
  const providerBreakdown = [
    {
      key: 'youtube',
      label: 'YouTube',
      count: accounts.filter((account) => ['google', 'youtube'].includes((account.provider ?? '').toLowerCase())).length,
      detail: 'Sincronia de canais e publicacao',
    },
    {
      key: 'tiktok',
      label: 'TikTok',
      count: accounts.filter((account) => (account.provider ?? '').toLowerCase() === 'tiktok').length,
      detail: 'Publicacao short-form',
    },
    {
      key: 'instagram',
      label: 'Instagram',
      count: accounts.filter((account) => (account.provider ?? '').toLowerCase() === 'instagram').length,
      detail: 'Publicacao em Reels',
    },
  ];
  const providerBreakdownHtml = providerBreakdown.map((provider) => `
    <article class="platform-page-provider-card ${escapeHtml(provider.key)}">
      <div class="platform-page-provider-card-head">
        <span class="platform-chip">${renderPlatformGlyph(provider.key, 'small')} ${escapeHtml(provider.label)}</span>
        <strong>${formatNumber(provider.count)}</strong>
      </div>
      <span>${escapeHtml(provider.detail)}</span>
    </article>
  `).join('');
  const metricsCards = [
    { label: 'Conectadas', value: connectedCount, hint: 'Contas prontas para publicar', tone: 'success' },
    { label: 'Reconectar', value: reauthCount, hint: 'Contas que precisam de OAuth', tone: 'warning' },
    { label: 'Desconectadas', value: disconnectedCount, hint: 'Contas removidas manualmente', tone: 'danger' },
    { label: 'Canais ativos', value: activeChannels, hint: `${formatNumber(totalChannels)} canais no total`, tone: 'info' },
  ];

  const metricsHtml = metricsCards.map((card) => `
    <article class="platform-dashboard-stat" data-tone="${escapeHtml(card.tone)}">
      <span class="platform-dashboard-stat-label">${escapeHtml(card.label)}</span>
      <strong>${formatNumber(card.value)}</strong>
      <span class="platform-dashboard-stat-detail">${escapeHtml(card.hint)}</span>
    </article>
  `).join('');
  const accountCardsHtml = filteredAccounts.length === 0
    ? '<p class="muted">No connected accounts found.</p>'
    : filteredAccounts.map((account) => {
        const isSelected = account.id === selectedAccountId;
        const href = buildUrl('/workspace/accounts', { account: account.id, search, status: statusFilter });
        const accountChannels = channelsByAccountId.get(account.id) ?? [];
        const activeCount = accountChannels.filter((ch) => ch.isActive).length;
        const previewChannel = pickPreviewChannel(accountChannels);
        const visibleChannelName = formatVisibleChannelName(previewChannel, account);
        const platformKey = getAccountPlatformKey(account.provider);
        return `
          <div class="account-card-wrap">
            <a class="account-chip ${isSelected ? 'selected' : ''}" data-link href="${escapeHtml(href)}" title="${escapeAttribute(visibleChannelName)}">
              <div class="account-chip-channel">
                ${channelAvatarHtml(previewChannel, visibleChannelName, 'channel-avatar account-channel-avatar')}
                <div class="account-chip-main">
                  <strong>${escapeHtml(visibleChannelName)}</strong>
                <small>${previewChannel ? 'Canal do YouTube' : escapeHtml(getProviderLabel(platformKey))}</small>
                </div>
                ${accountPlatformLogoHtml(platformKey)}
              </div>
              <div class="account-chip-bottom">
                ${statusPill(account.status)}
                <small>${formatNumber(activeCount)} / ${formatNumber(accountChannels.length)} canais</small>
              </div>
            </a>
            <div class="account-chip-footer-actions inline-actions">
              <button class="button button-secondary button-sm" data-action="disconnect-account" data-account-id="${escapeHtml(account.id)}" type="button">Desconectar</button>
              <button class="button button-danger button-sm" data-action="delete-account" data-account-id="${escapeHtml(account.id)}" type="button">Excluir</button>
            </div>
          </div>
        `;
      }).join('');

  const channelsRows = !selectedAccountId
    ? '<tr><td colspan="4" class="muted">Selecione uma conta para ver os canais.</td></tr>'
    : channels.length === 0
      ? '<tr><td colspan="4" class="muted">Nenhum canal retornado para esta conta.</td></tr>'
      : channels.map((channel) => {
          const channelName = formatVisibleChannelName(channel);
          return `
            <tr>
              <td>
                <div class="channel-cell">
                  ${channelAvatarHtml(channel, channelName)}
                  <div>
                    <strong>${escapeHtml(channelName)}</strong>
                  </div>
                </div>
              </td>
              <td>${escapeHtml(channel.handle ?? '-')}</td>
              <td>${statusPill(channel.isActive ? 'active' : 'inactive')}</td>
              <td>
                <button class="button button-secondary button-sm" data-action="toggle-channel" data-account-id="${escapeHtml(selectedAccountId)}" data-channel-id="${escapeHtml(channel.id)}" data-next-active="${channel.isActive ? 'false' : 'true'}" type="button">
                  ${channel.isActive ? 'Desativar' : 'Ativar'}
                </button>
              </td>
            </tr>
          `;
        }).join('');
  const allChannelsRows = allChannels.length === 0
    ? '<tr><td colspan="4" class="muted">Nenhum canal encontrado nas contas conectadas ainda.</td></tr>'
    : allChannels.map((channel) => {
        const channelName = formatVisibleChannelName(channel);
        return `
          <tr>
            <td>
              <div class="channel-cell">
                ${channelAvatarHtml(channel, channelName)}
                <div>
                  <strong>${escapeHtml(channelName)}</strong>
                </div>
              </div>
            </td>
            <td>${escapeHtml(channel.connectedAccountLabel)}</td>
            <td>${escapeHtml(channel.handle ?? '-')}</td>
            <td>${statusPill(channel.isActive ? 'active' : 'inactive')}</td>
          </tr>
        `;
      }).join('');

  const notices = [];
  if (oauth === 'success') {
    notices.push(`
      <div class="notice info">
        <h4>Conta ${escapeHtml(oauthProviderLabel)} conectada</h4>
        <p>${escapeHtml(syncMessage || 'OAuth concluido com sucesso.')}</p>
      </div>
    `);
    if (reauthReturnProvider) {
      notices.push(`
        <div class="notice success">
          <h4>Conta pronta para recuperar campanhas</h4>
          <p>Volte para Campanhas e execute o retry em lote dos destinos que estavam em REAUTH_REQUIRED.</p>
          <div class="inline-actions">
            <a class="button button-primary" data-link href="/workspace/campanhas?reauth=resume">Reprocessar campanhas</a>
          </div>
        </div>
      `);
    }
  }
  if (oauth === 'error') {
    notices.push(`
      <div class="notice error">
        <h4>OAuth ${escapeHtml(oauthProviderLabel)} falhou</h4>
        <p>${escapeHtml(oauthMessage || 'Nao foi possivel concluir o OAuth.')}</p>
      </div>
    `);
  }
  if (selectedAccount && selectedAccountSupportsChannels && channels.length === 0) {
    notices.push(`
      <div class="notice warning">
        <h4>Nenhum canal do YouTube encontrado</h4>
        <p>Esta conta Google esta conectada, mas nenhum canal do YouTube foi retornado. Tente <strong>Sincronizar canais</strong> ou entre com o perfil Google dono do canal ou Brand Account.</p>
      </div>
    `);
  }
  if (selectedAccount && !selectedAccountSupportsChannels) {
    notices.push(`
      <div class="notice info">
        <h4>${escapeHtml(getProviderLabel(selectedAccount.provider))} conectado</h4>
        <p>Este provedor esta salvo no workspace. Sincronia por canal esta disponivel apenas para conexoes do YouTube.</p>
      </div>
    `);
  }
  if (syncChannelsCount === '0' && syncMessage && oauth !== 'success') {
    notices.push(`
      <div class="notice warning">
        <h4>Channel sync completed with 0 results</h4>
        <p>${escapeHtml(syncMessage)}</p>
      </div>
    `);
  }
  if (channelErrors.length > 0) {
    notices.push(`
      <div class="notice warning">
        <h4>Some channel lists failed to load</h4>
        <p>${escapeHtml(channelErrors[0])}${channelErrors.length > 1 ? ` (+${channelErrors.length - 1} more)` : ''}</p>
      </div>
    `);
  }

  const accountsSetupCard = accounts.length === 0
    ? renderEmptyStateCard({
        title: 'Nenhuma conta conectada ainda',
        message: 'Conecte YouTube, TikTok ou Instagram para centralizar a publicacao do workspace.',
        tone: 'info',
        actionsHtml: `
          <button class="button button-primary" type="button" data-action="start-youtube-oauth">Conectar YouTube</button>
          <button class="button button-secondary" type="button" data-action="start-tiktok-oauth">Conectar TikTok</button>
          <button class="button button-secondary" type="button" data-action="start-instagram-oauth">Conectar Instagram</button>
        `,
      })
    : filteredAccounts.length === 0
      ? renderEmptyStateCard({
          title: 'Nenhuma conta nos filtros atuais',
          message: 'Limpe a busca ou o status para ver as contas conectadas novamente.',
          actionsHtml: '<a class="button button-secondary" data-link href="/workspace/accounts">Limpar filtros</a>',
        })
      : '';
  const channelsOverviewCard = accounts.length > 0 && allChannels.length === 0
    ? renderEmptyStateCard({
        title: 'Canais ainda nao encontrados',
        message: 'A conta esta conectada, mas nenhum canal foi retornado. Sincronize canais ou reconecte usando o perfil Google dono do canal ou Brand Account.',
        tone: 'warning',
        actionsHtml: selectedAccountId
          ? `<button class="button button-secondary" type="button" data-action="sync-channels" data-account-id="${escapeHtml(selectedAccountId)}">Sincronizar canais</button>`
          : '',
      })
    : '';
  const selectedAccountLabel = selectedAccountDisplayLabel;

  renderWorkspaceShell({
    title: 'Contas',
    subtitle: 'Contas de publicacao conectadas ao YouTube, TikTok e Instagram.',
    actionsHtml: `
      <div class="inline-actions">
        <button class="button button-primary" type="button" data-action="start-youtube-oauth">Conectar YouTube</button>
        <button class="button button-secondary" type="button" data-action="start-tiktok-oauth">Conectar TikTok</button>
        <button class="button button-secondary" type="button" data-action="start-instagram-oauth">Conectar Instagram</button>
        <a class="button button-secondary" data-link href="${escapeHtml(buildUrl('/workspace/accounts', { search, status: statusFilter }))}">Atualizar</a>
      </div>
    `,
    noticeHtml: notices.join(''),
    contentHtml: `
      <section class="accounts-cockpit" id="accounts-cockpit">
        <div class="accounts-cockpit-bg" aria-hidden="true">
          <div class="accounts-cockpit-orb-a"></div>
          <div class="accounts-cockpit-orb-b"></div>
          <div class="accounts-cockpit-grid"></div>
          <div class="accounts-cockpit-scan"></div>
        </div>

        <header class="accounts-cockpit-header">
          <div class="accounts-cockpit-title-block">
            <span class="accounts-cockpit-kicker">
              <span class="accounts-cockpit-pulse-dot"></span>
              COMANDO DE CONTAS
            </span>
            <h2 class="accounts-cockpit-title">Todas as identidades de publicacao, <span class="accounts-cockpit-title-accent">um cockpit.</span></h2>
            <p class="accounts-cockpit-subtitle">Revise saude, reconecte provedores e direcione campanhas sem sair do workspace.</p>
          </div>
          <div class="accounts-cockpit-sync">
            <span class="accounts-cockpit-sync-status"><span class="accounts-cockpit-sync-dot"></span>SINCRONIZADO</span>
            <strong class="accounts-cockpit-sync-time">${escapeHtml(liveClock)}</strong>
            <span class="accounts-cockpit-sync-label">${formatNumber(activeChannels)} rotas ativas</span>
          </div>
        </header>

        <div class="accounts-cockpit-grid-cards">
          <article class="accounts-cockpit-card accounts-cockpit-card-platform" data-platform="youtube" tabindex="0" role="button" aria-label="YouTube — ${formatNumber(providerBreakdown[0].count)} accounts">
            <div class="accounts-cockpit-card-icon-wrap">
              <span class="accounts-cockpit-card-icon">${renderCampaignPlatformMark('youtube', 'accounts-platform-mark')}</span>
            </div>
            <div class="accounts-cockpit-card-info">
              <span class="accounts-cockpit-card-label">YouTube</span>
              <strong class="accounts-cockpit-card-value" data-counter="${providerBreakdown[0].count}">0</strong>
              <span class="accounts-cockpit-card-detail">Sincronia de canais e publicacao</span>
            </div>
            <div class="accounts-cockpit-card-arrow" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12 5 19 12 12 19"/>
              </svg>
            </div>
          </article>

          <article class="accounts-cockpit-card accounts-cockpit-card-platform" data-platform="tiktok" tabindex="0" role="button" aria-label="TikTok — ${formatNumber(providerBreakdown[1].count)} accounts">
            <div class="accounts-cockpit-card-icon-wrap">
              <span class="accounts-cockpit-card-icon">${renderCampaignPlatformMark('tiktok', 'accounts-platform-mark')}</span>
            </div>
            <div class="accounts-cockpit-card-info">
              <span class="accounts-cockpit-card-label">TikTok</span>
              <strong class="accounts-cockpit-card-value" data-counter="${providerBreakdown[1].count}">0</strong>
              <span class="accounts-cockpit-card-detail">Publicacao short-form</span>
            </div>
            <div class="accounts-cockpit-card-arrow" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12 5 19 12 12 19"/>
              </svg>
            </div>
          </article>

          <article class="accounts-cockpit-card accounts-cockpit-card-platform" data-platform="instagram" tabindex="0" role="button" aria-label="Instagram — ${formatNumber(providerBreakdown[2].count)} accounts">
            <div class="accounts-cockpit-card-icon-wrap">
              <span class="accounts-cockpit-card-icon">${renderCampaignPlatformMark('instagram', 'accounts-platform-mark')}</span>
            </div>
            <div class="accounts-cockpit-card-info">
              <span class="accounts-cockpit-card-label">Instagram</span>
              <strong class="accounts-cockpit-card-value" data-counter="${providerBreakdown[2].count}">0</strong>
              <span class="accounts-cockpit-card-detail">Publicacao em Reels</span>
            </div>
            <div class="accounts-cockpit-card-arrow" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12 5 19 12 12 19"/>
              </svg>
            </div>
          </article>

          <article class="accounts-cockpit-stat" data-tone="info">
            <div class="accounts-cockpit-stat-icon">${renderCampaignMark('FOCO', 'info', 'accounts-cockpit-stat-mark')}</div>
            <div class="accounts-cockpit-stat-info">
              <span class="accounts-cockpit-stat-label">Foco</span>
              <strong class="accounts-cockpit-stat-value">${escapeHtml(selectedAccountLabel.length > 14 ? selectedAccountLabel.slice(0, 13) + '…' : selectedAccountLabel)}</strong>
              <span class="accounts-cockpit-stat-detail">Conta selecionada</span>
            </div>
          </article>

          <article class="accounts-cockpit-stat" data-tone="${reauthCount > 0 ? 'warning' : 'success'}">
            <div class="accounts-cockpit-stat-icon">${renderCampaignMark(reauthCount > 0 ? 'AUTH' : 'OK', reauthCount > 0 ? 'warning' : 'success', 'accounts-cockpit-stat-mark')}</div>
            <div class="accounts-cockpit-stat-info">
              <span class="accounts-cockpit-stat-label">OAuth</span>
              <strong class="accounts-cockpit-stat-value" data-counter="${reauthCount}">0</strong>
              <span class="accounts-cockpit-stat-detail">${reauthCount > 0 ? 'Precisa reconectar' : 'Saudavel'}</span>
            </div>
          </article>

          <article class="accounts-cockpit-stat" data-tone="info">
            <div class="accounts-cockpit-stat-icon">${renderCampaignMark('VIS', 'info', 'accounts-cockpit-stat-mark')}</div>
            <div class="accounts-cockpit-stat-info">
              <span class="accounts-cockpit-stat-label">Visiveis</span>
              <strong class="accounts-cockpit-stat-value" data-counter="${filteredAccounts.length}">0</strong>
              <span class="accounts-cockpit-stat-detail">Contas filtradas</span>
            </div>
          </article>

          <article class="accounts-cockpit-stat" data-tone="primary">
            <div class="accounts-cockpit-stat-icon">${renderCampaignMark('SYNC', 'processing', 'accounts-cockpit-stat-mark')}</div>
            <div class="accounts-cockpit-stat-info">
              <span class="accounts-cockpit-stat-label">Canais</span>
              <strong class="accounts-cockpit-stat-value" data-counter="${totalChannels}">0</strong>
              <span class="accounts-cockpit-stat-detail">Sincronizados</span>
            </div>
          </article>
        </div>

        <div class="accounts-cockpit-footer">
          <div class="accounts-cockpit-footer-bar">
            <div class="accounts-cockpit-footer-bar-label">
              <span>Saude do workspace</span>
              <strong>${accounts.length === 0 ? 0 : Math.round(((accounts.length - reauthCount) / accounts.length) * 100)}%</strong>
            </div>
            <div class="accounts-cockpit-footer-bar-track">
              <div class="accounts-cockpit-footer-bar-fill" style="--width:${accounts.length === 0 ? 0 : Math.round(((accounts.length - reauthCount) / accounts.length) * 100)}%"></div>
            </div>
          </div>
          <div class="accounts-cockpit-footer-meta">
            <span>${formatNumber(accounts.length)} contas</span>
            <span aria-hidden="true">·</span>
            <span>${formatNumber(totalChannels)} canais</span>
            <span aria-hidden="true">·</span>
            <span>${formatNumber(activeChannels)} ativos</span>
          </div>
        </div>
      </section>

      <section class="platform-dashboard-stat-grid">
        ${metricsHtml}
      </section>

      ${accountsSetupCard}
      <section class="platform-surface platform-dashboard-panel">
        <div class="platform-dashboard-panel-head">
          <div>
            <span class="platform-dashboard-kicker">Contas conectadas</span>
            <h3>Lista de identidades</h3>
          </div>
          <span class="platform-dashboard-panel-meta">${formatNumber(filteredAccounts.length)} visiveis de ${formatNumber(accounts.length)}</span>
        </div>
        <form id="account-filter-form" class="filter-bar">
          <label>
            Buscar
            <input name="search" value="${escapeHtml(search)}" placeholder="Canal ou conta..." />
          </label>
          <label>
            Status
            <select name="status">
              <option value="">Todos</option>
              <option value="connected" ${statusFilter === 'connected' ? 'selected' : ''}>Conectada</option>
              <option value="reauth_required" ${statusFilter === 'reauth_required' ? 'selected' : ''}>Reconectar</option>
              <option value="disconnected" ${statusFilter === 'disconnected' ? 'selected' : ''}>Desconectada</option>
            </select>
          </label>
          <div class="inline-actions">
            <button class="button button-primary" type="submit">Aplicar</button>
            <a class="button button-secondary" data-link href="/workspace/accounts">Limpar</a>
          </div>
        </form>
        <div class="account-grid">${accountCardsHtml}</div>
      </section>
      <section class="platform-surface platform-dashboard-panel">
        <h3>Canais - ${escapeHtml(selectedAccountDisplayLabel)}</h3>
        <div class="platform-dashboard-chip-row">
          ${selectedAccount ? `<span class="platform-dashboard-inline-stat">${escapeHtml(getProviderLabel(selectedAccount.provider))}</span>` : ''}
          ${selectedAccount ? `<span class="platform-dashboard-inline-stat">${formatNumber(selectedAccountChannelSummary?.active ?? 0)} ativos / ${formatNumber(selectedAccountChannelSummary?.total ?? 0)} total</span>` : ''}
          <button class="button button-secondary" data-action="sync-channels" data-account-id="${escapeHtml(selectedAccountId ?? '')}" type="button" ${selectedAccountId && selectedAccountSupportsChannels ? '' : 'disabled'}>
            Sincronizar canais
          </button>
        </div>
        ${selectedAccount && !selectedAccountSupportsChannels ? `
          <div class="table-scroll platform-page-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Conta</th>
                  <th>Identificador</th>
                  <th>Estado</th>
                  <th>Acao</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <div class="channel-cell">
                      <strong>${escapeHtml(selectedAccount.displayName ?? selectedAccount.email ?? selectedAccount.id)}</strong>
                      <small class="muted">${escapeHtml(getProviderLabel(selectedAccount.provider))}</small>
                    </div>
                  </td>
                  <td>${escapeHtml(selectedAccount.email ?? '-')}</td>
                  <td><span class="status-pill ${selectedAccount.status === 'connected' ? 'connected' : 'warn'}">${escapeHtml(selectedAccount.status ?? '')}</span></td>
                  <td><span class="muted">Conta = destino</span></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="notice info" style="margin-top:12px">
            <p>Para ${escapeHtml(getProviderLabel(selectedAccount.provider))}, a propria conta conectada e o destino de publicacao. Nao existe conceito de canal separado como no YouTube.</p>
          </div>
        ` : `
          <div class="table-scroll platform-page-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Canal</th>
                  <th>Identificador</th>
                  <th>Estado</th>
                  <th>Acao</th>
                </tr>
              </thead>
              <tbody>${channelsRows}</tbody>
            </table>
          </div>
        `}
      </section>
      <section class="platform-surface platform-dashboard-panel">
        <div class="platform-dashboard-panel-head">
          <div>
            <span class="platform-dashboard-kicker">Diretorio de canais</span>
            <h3>Todos os destinos vinculados</h3>
          </div>
          <span class="platform-dashboard-panel-meta">${formatNumber(allChannels.length)} canais encontrados</span>
        </div>
        <div class="platform-page-summary-grid">
          <article class="platform-page-summary-card">
            <span>Contas conectadas</span>
            <strong>${formatNumber(accounts.length)}</strong>
          </article>
          <article class="platform-page-summary-card">
            <span>Total encontrado</span>
            <strong>${formatNumber(allChannels.length)}</strong>
          </article>
          <article class="platform-page-summary-card">
            <span>Conta em foco</span>
            <strong>${escapeHtml(selectedAccount ? selectedAccountDisplayLabel : 'Nenhuma')}</strong>
          </article>
        </div>
        ${channelsOverviewCard}
        <div class="table-scroll platform-page-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Canal</th>
                <th>Conta</th>
                <th>Identificador</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>${allChannelsRows}</tbody>
          </table>
        </div>
      </section>
    `,
  });

  const accountChannelHeading = Array.from(document.querySelectorAll('.platform-surface.platform-dashboard-panel > h3'))
    .find((heading) => heading.textContent?.trim().startsWith('Canais'));
  if (accountChannelHeading) {
    accountChannelHeading.textContent = `Canais - ${selectedAccountDisplayLabel}`;
  }

  const accountFilterForm = document.getElementById('account-filter-form');
  accountFilterForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(accountFilterForm);
    const href = buildUrl('/workspace/accounts', {
      search: String(data.get('search') ?? ''),
      status: String(data.get('status') ?? ''),
      account: selectedAccountId ?? '',
    });
    navigate(href);
  });

  const cockpit = document.getElementById('accounts-cockpit');
  if (cockpit) {
    cockpit.querySelectorAll('[data-counter]').forEach((el) => {
      const target = Number(el.getAttribute('data-counter') ?? 0);
      const duration = 1100;
      const start = performance.now();
      const tick = (now) => {
        const progress = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = String(Math.round(target * eased));
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    const fillBar = cockpit.querySelector('.accounts-cockpit-footer-bar-fill');
    if (fillBar) {
      const target = fillBar.style.getPropertyValue('--width');
      fillBar.style.width = '0%';
      requestAnimationFrame(() => {
        fillBar.style.transition = 'width 1.4s cubic-bezier(0.22, 0.61, 0.36, 1)';
        fillBar.style.width = target;
      });
    }

    cockpit.querySelectorAll('.accounts-cockpit-card-platform').forEach((card) => {
      card.addEventListener('click', () => {
        const platform = card.getAttribute('data-platform');
        if (!platform) return;
        navigate(buildUrl('/workspace/accounts', {
          search: platform === 'youtube' ? 'youtube' : 'tiktok',
        }));
      });
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          card.click();
        }
      });
    });

    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      cockpit.addEventListener('mousemove', (event) => {
        const rect = cockpit.getBoundingClientRect();
        const px = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
        const py = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
        const orbA = cockpit.querySelector('.accounts-cockpit-orb-a');
        const orbB = cockpit.querySelector('.accounts-cockpit-orb-b');
        if (orbA) orbA.style.transform = `translate(${px * 14}px, ${py * 14}px)`;
        if (orbB) orbB.style.transform = `translate(${px * -10}px, ${py * -10}px)`;
      });
      cockpit.addEventListener('mouseleave', () => {
        const orbA = cockpit.querySelector('.accounts-cockpit-orb-a');
        const orbB = cockpit.querySelector('.accounts-cockpit-orb-b');
        if (orbA) orbA.style.transform = '';
        if (orbB) orbB.style.transform = '';
      });
    }
  }

  document.querySelectorAll('[data-action="start-youtube-oauth"]').forEach((button) => {
    button.addEventListener('click', async () => {
      clearUiNotice();
      setButtonBusy(button, true, 'Conectando...');
      const result = await api.startYouTubeOauth();
      setButtonBusy(button, false);

      if (!result.ok) {
        setUiNotice('error', 'Conexao com YouTube indisponivel', result.error);
        await renderAccountsPage();
        return;
      }

      const redirectUrl = result.body?.redirectUrl;
      if (!redirectUrl) {
        setUiNotice('error', 'Conexao com YouTube indisponivel', 'A API nao retornou a URL segura de autorizacao do Google.');
        await renderAccountsPage();
        return;
      }
      writePendingOauthProvider('youtube');
      window.location.assign(redirectUrl);
    });
  });

  document.querySelectorAll('[data-action="start-tiktok-oauth"]').forEach((button) => {
    button.addEventListener('click', async () => {
      clearUiNotice();
      setButtonBusy(button, true, 'Connecting...');
      const result = await api.startTikTokOauth();
      setButtonBusy(button, false);

      if (!result.ok) {
        setUiNotice('error', 'TikTok OAuth failed', result.error);
        await renderAccountsPage();
        return;
      }

      const redirectUrl = result.body?.redirectUrl;
      if (!redirectUrl) {
        setUiNotice('error', 'TikTok OAuth failed', 'OAuth redirect URL not returned by API.');
        await renderAccountsPage();
        return;
      }

      writePendingOauthProvider('tiktok');
      window.location.assign(redirectUrl);
    });
  });

  document.querySelectorAll('[data-action="start-instagram-oauth"]').forEach((button) => {
    button.addEventListener('click', async () => {
      clearUiNotice();
      setButtonBusy(button, true, 'Connecting...');
      const result = await api.startInstagramOauth();
      setButtonBusy(button, false);

      if (!result.ok) {
        setUiNotice('error', 'Instagram OAuth failed', result.error);
        await renderAccountsPage();
        return;
      }

      const redirectUrl = result.body?.redirectUrl;
      if (!redirectUrl) {
        setUiNotice('error', 'Instagram OAuth failed', 'OAuth redirect URL not returned by API.');
        await renderAccountsPage();
        return;
      }

      writePendingOauthProvider('instagram');
      window.location.assign(redirectUrl);
    });
  });

  document.querySelectorAll('[data-action="disconnect-account"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const accountId = button.getAttribute('data-account-id');
      if (!accountId) return;
      const confirmed = await showConfirmDialog({
        title: 'Disconnect account',
        message: 'This account will be removed from the workspace until you connect it again.',
        confirmLabel: 'Disconnect',
        tone: 'warning',
      });
      if (!confirmed) return;
      setButtonBusy(button, true, 'Disconnecting...');
      const result = await api.disconnectAccount(accountId);
      setButtonBusy(button, false);
      if (!result.ok) {
        setUiNotice('error', 'Unable to disconnect account', result.error);
        await renderAccountsPage();
        return;
      }
      setUiNotice('success', 'Account disconnected', 'The selected account was disconnected successfully.');
      await renderAccountsPage();
    });
  });

  document.querySelectorAll('[data-action="delete-account"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const accountId = button.getAttribute('data-account-id');
      if (!accountId) return;
      const confirmed = await showConfirmDialog({
        title: 'Delete connected account',
        message: 'This will permanently remove the connected account and its channels from the workspace. If a channel is already used in campaigns, deletion will be blocked.',
        confirmLabel: 'Delete account',
        tone: 'warning',
      });
      if (!confirmed) return;
      setButtonBusy(button, true, 'Deleting...');
      const result = await api.deleteAccount(accountId);
      setButtonBusy(button, false);
      if (!result.ok) {
        setUiNotice('error', 'Unable to delete account', result.error);
        await renderAccountsPage();
        return;
      }

      const removedChannels = Number(result.body?.removedChannels ?? 0);
      setUiNotice(
        'success',
        'Account deleted',
        `The account was removed successfully with ${formatNumber(removedChannels)} channel${removedChannels === 1 ? '' : 's'} deleted.`,
      );

      if (selectedAccountId === accountId) {
        navigate(buildUrl('/workspace/accounts', { search, status: statusFilter }));
        return;
      }

      await renderAccountsPage();
    });
  });

  document.querySelectorAll('[data-action="toggle-channel"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const accountId = button.getAttribute('data-account-id');
      const channelId = button.getAttribute('data-channel-id');
      const nextActive = button.getAttribute('data-next-active') === 'true';
      if (!accountId || !channelId) return;
      setButtonBusy(button, true, nextActive ? 'Activating...' : 'Deactivating...');
      const result = await api.toggleChannel(accountId, channelId, nextActive);
      setButtonBusy(button, false);
      if (!result.ok) {
        setUiNotice('error', 'Channel update failed', result.error);
        await renderAccountsPage();
        return;
      }
      setUiNotice('success', 'Channel updated', `Channel is now ${nextActive ? 'active' : 'inactive'}.`);
      await renderAccountsPage();
    });
  });

  document.querySelectorAll('[data-action="sync-channels"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const accountId = button.getAttribute('data-account-id');
      if (!accountId) return;
      button.setAttribute('disabled', 'true');
      setButtonBusy(button, true, 'Syncing...');
      const result = await api.syncAccountChannels(accountId);
      setButtonBusy(button, false);
      if (!result.ok) {
        setUiNotice('error', 'Channel sync failed', result.error);
        await renderAccountsPage();
        return;
      }
      setUiNotice('success', 'Channel sync completed', result.body?.sync?.message ?? 'Channels were synced successfully.');
      const sync = result.body?.sync;
      const nextUrl = buildUrl('/workspace/accounts', {
        search,
        status: statusFilter,
        account: accountId,
        syncChannels: sync?.channelCount ?? '',
        syncMessage: sync?.message ?? '',
      });
      navigate(nextUrl, true);
      await renderAccountsPage();
    });
  });
}

function attachVideoPreviewListeners(assetMap) {
  document.querySelectorAll('[data-media-preview-frame]').forEach((frame) => {
    const video = frame.querySelector('[data-preview-video]');
    if (!(video instanceof HTMLVideoElement)) return;
    const startPreview = () => {
      frame.setAttribute('data-preview-playing', 'true');
      const p = video.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    };
    const stopPreview = () => {
      frame.setAttribute('data-preview-playing', 'false');
      video.pause();
      if (video.currentTime > 0) video.currentTime = 0;
    };
    frame.addEventListener('mouseenter', startPreview);
    frame.addEventListener('mouseleave', stopPreview);
    frame.addEventListener('focusin', startPreview);
    frame.addEventListener('focusout', stopPreview);
  });

  document.querySelectorAll('[data-action="open-media-preview"]').forEach((frame) => {
    const openPreview = async () => {
      const mediaId = frame.getAttribute('data-media-id');
      if (!mediaId) return;
      const asset = assetMap.get(mediaId);
      if (!asset) return;
      const previewVideo = frame.querySelector('[data-preview-video]');
      if (previewVideo instanceof HTMLVideoElement) {
        frame.setAttribute('data-preview-playing', 'false');
        previewVideo.pause();
        if (previewVideo.currentTime > 0) previewVideo.currentTime = 0;
      }
      await openMediaPreviewDialog(asset);
    };
    frame.addEventListener('click', openPreview);
    frame.addEventListener('keydown', async (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      await openPreview();
    });
  });
}

const MEDIA_MARK_KIND_ALIASES = {
  assets: 'library',
  asset: 'library',
  thumb: 'thumbnail',
  image: 'thumbnail',
  folder: 'folder',
  directory: 'folder',
  used: 'published',
  ready: 'available',
  plus: 'add',
  erro: 'error',
  falha: 'error',
  falhas: 'error',
  failed: 'error',
  failure: 'error',
};

const MEDIA_MARK_LABELS = {
  library: 'LIB',
  playlist: 'LIST',
  video: 'VID',
  thumbnail: 'IMG',
  storage: 'STO',
  clock: 'DUR',
  folder: 'DIR',
  available: 'OK',
  published: 'PUB',
  star: 'TOP',
  add: 'ADD',
  error: 'ER',
  warning: 'ALR',
  processing: 'SYNC',
  disabled: 'BLOQ',
};

const MEDIA_MARK_ARTWORK = {
  add: '/assets/icons/ADD_adicionar.svg',
  clock: '/assets/icons/DUR_relogio.svg',
  folder: '/assets/icons/DIR_pasta.svg',
  library: '/assets/icons/LIB_biblioteca.svg',
  playlist: '/assets/icons/LIST_playlist.svg',
  published: '/assets/icons/PUB_publicacao.svg',
  star: '/assets/icons/TOP_estrela.svg',
  storage: '/assets/icons/STO_armazenamento.svg',
  thumbnail: '/assets/icons/IMG_imagem.svg',
  video: '/assets/icons/VID_video.svg',
  available: '/assets/icons/OK_check.svg',
  error: '/assets/icons/ER_erro.svg',
  warning: '/assets/icons/ALERTA_aviso.svg',
  processing: '/assets/icons/SYNC_sincronizacao.svg',
  disabled: '/assets/icons/BLOQ_cadeado.svg',
};

const MEDIA_MARK_TITLES = {
  library: 'Biblioteca de midia',
  playlist: 'Playlist',
  video: 'Video',
  thumbnail: 'Capa vinculada',
  storage: 'Armazenamento',
  clock: 'Duracao',
  folder: 'Pasta local',
  available: 'Disponivel',
  published: 'Publicado',
  star: 'Destaque',
  add: 'Adicionar',
  error: 'Erro',
  warning: 'Aviso',
  processing: 'Processando',
  disabled: 'Bloqueado',
};

const MEDIA_MARK_TONES = new Set(['info', 'success', 'warning', 'danger', 'processing', 'disabled']);

function normalizeMediaMarkKind(kind) {
  const requestedKind = String(kind ?? '').toLowerCase().trim();
  const aliasedKind = MEDIA_MARK_KIND_ALIASES[requestedKind] ?? requestedKind;
  return Object.prototype.hasOwnProperty.call(MEDIA_MARK_LABELS, aliasedKind) ? aliasedKind : 'library';
}

function normalizeMediaMarkTone(kind, tone) {
  const normalizedTone = String(tone ?? '').toLowerCase().trim();
  if (MEDIA_MARK_TONES.has(normalizedTone)) return normalizedTone;
  if (['ready', 'completed', 'available', 'published', 'active', 'connected', 'ok'].includes(normalizedTone)) return 'success';
  if (['danger', 'error', 'errors', 'failed', 'failure', 'erro', 'erros', 'falha', 'falhas'].includes(normalizedTone)) return 'danger';
  if (['warn', 'attention', 'pending', 'queued', 'draft', 'aguardando'].includes(normalizedTone)) return 'warning';
  if (['loading', 'launching', 'syncing', 'enviando', 'running'].includes(normalizedTone)) return 'processing';
  if (['inactive', 'locked', 'blocked', 'unavailable', 'indisponivel'].includes(normalizedTone)) return 'disabled';
  if (['available', 'published', 'star'].includes(kind)) return 'success';
  if (['clock', 'thumbnail'].includes(kind)) return 'warning';
  return 'info';
}

function renderMediaMark(kind = 'library', size = 'md', options = {}, className = '') {
  const safeKind = normalizeMediaMarkKind(kind);
  const artworkSrc = MEDIA_MARK_ARTWORK[safeKind] ?? '';
  const requestedTone = typeof options === 'string' ? options : options?.tone ?? options?.state;
  const safeTone = normalizeMediaMarkTone(safeKind, requestedTone);
  const safeSize = String(size ?? 'md').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'md';
  const extraClasses = String(className ?? '').trim().split(/\s+/).filter(Boolean);
  const classes = ['media-mark', artworkSrc ? 'media-mark-artwork' : '', `media-mark-${safeSize}`, ...extraClasses].filter(Boolean).join(' ');
  const title = MEDIA_MARK_TITLES[safeKind] ?? MEDIA_MARK_LABELS[safeKind];
  return `<span class="${escapeAttribute(classes)}" data-media-kind="${escapeAttribute(safeKind)}" data-tone="${escapeAttribute(safeTone)}" title="${escapeAttribute(title)}" aria-hidden="true">${artworkSrc
    ? `<img class="media-mark-artwork-image" src="${escapeAttribute(artworkSrc)}" alt="" decoding="async" draggable="false" />`
    : `<span>${escapeHtml(MEDIA_MARK_LABELS[safeKind])}</span>`}</span>`;
}

function renderMediaPipelineMark(kind, label, tone = 'info') {
  return `${renderMediaMark(kind, 'chip', tone, 'media-pipeline-mark')} ${escapeHtml(label)}`;
}

function renderVideosViewSwitcher({ activeView, libraryHref, playlistsHref, libraryCount, playlistsCount }) {
  const libraryActive = activeView === 'library';
  const playlistsActive = activeView === 'playlists';
  const libCountHtml = Number.isFinite(libraryCount) ? `<span class="videos-view-tab-count">${formatNumber(libraryCount)}</span>` : '';
  const plCountHtml = Number.isFinite(playlistsCount) ? `<span class="videos-view-tab-count">${formatNumber(playlistsCount)}</span>` : '';

  return `
    <nav class="videos-view-switcher" role="tablist" aria-label="Visualizacao de videos">
      <a class="videos-view-tab ${libraryActive ? 'is-active' : ''}" role="tab" aria-selected="${libraryActive ? 'true' : 'false'}" data-link href="${escapeHtml(libraryHref)}">
        <span class="videos-view-tab-icon" aria-hidden="true">${renderMediaMark('library', 'tab', 'info')}</span>
        <span class="videos-view-tab-label">Biblioteca</span>
        ${libCountHtml}
      </a>
      <a class="videos-view-tab ${playlistsActive ? 'is-active' : ''}" role="tab" aria-selected="${playlistsActive ? 'true' : 'false'}" data-link href="${escapeHtml(playlistsHref)}">
        <span class="videos-view-tab-icon" aria-hidden="true">${renderMediaMark('playlist', 'tab', 'info')}</span>
        <span class="videos-view-tab-label">Playlists</span>
        ${plCountHtml}
      </a>
    </nav>
  `;
}

async function renderVideosPage() {
  const query = parseCurrentQuery();
  const view = query.get('view') === 'playlists' ? 'playlists' : 'library';
  const videosCtx = { view };
  if (view === 'playlists') {
    await renderPlaylistsPage({ videosCtx });
  } else {
    await renderMediaPage({ videosCtx });
  }
}

async function renderMediaPage(options = {}) {
  const videosCtx = options.videosCtx ?? null;
  const reRender = () => renderMediaPage(options);
  const baseHref = videosCtx ? '/workspace/videos' : '/workspace/media';
  const libraryHref = videosCtx ? '/workspace/videos?view=library' : '/workspace/media';
  const playlistsHref = videosCtx ? '/workspace/videos?view=playlists' : '/workspace/playlists';
  const pageTitle = videosCtx ? 'Videos' : 'Media';
  const pageSubtitle = videosCtx
    ? 'Sua biblioteca de videos e organizacao de playlists em um so lugar.'
    : 'Uploaded reusable assets.';

  const result = await api.media();
  if (!result.ok) {
    if (result.status === 401) {
      unauthorizedRedirect();
      return;
    }
    renderWorkspaceShell({
      title: pageTitle,
      subtitle: pageSubtitle,
      noticeHtml: `<div class="notice error">${escapeHtml(result.error)}</div>`,
      contentHtml: '<section class="card">Unable to load media assets.</section>',
    });
    return;
  }

  const assets = Array.isArray(result.body?.assets) ? result.body.assets : [];
  const query = parseCurrentQuery();
  const searchInput = (query.get('search') ?? '').trim();
  const search = searchInput.toLowerCase();
  const typeFilter = (query.get('type') ?? 'all').trim();

  const filteredAssets = assets.filter((asset) => {
    if (typeFilter !== 'all' && asset.asset_type !== typeFilter) {
      return false;
    }
    if (!search) {
      return true;
    }
    const haystack = [
      asset.original_name,
      asset.mime_type,
      asset.id,
      asset.storage_path,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(search);
  });

  const totalSize = filteredAssets.reduce((sum, asset) => sum + Number(asset.size_bytes ?? 0), 0);
  const totalDurationSeconds = filteredAssets.reduce((sum, asset) => sum + Number(asset.duration_seconds ?? 0), 0);
  const linkedThumbnailAssets = filteredAssets.filter((asset) => asset.thumbnail || asset.linked_video_asset_id).length;
  const videoAssetsCount = filteredAssets.filter((asset) => asset.asset_type === 'video').length;
  const thumbnailAssetsCount = filteredAssets.filter((asset) => asset.asset_type === 'thumbnail').length;
  const liveClock = formatClockLabel();
  const allVideoAssetsCount = assets.filter((asset) => asset.asset_type === 'video').length;
  const allLinkedThumbnailAssets = assets.filter((asset) => asset.thumbnail || asset.linked_video_asset_id).length;
  const missingThumbnailVideos = Math.max(0, allVideoAssetsCount - allLinkedThumbnailAssets);
  const typeFilterLabel = typeFilter === 'video' ? 'Videos' : typeFilter === 'thumbnail' ? 'Capas' : 'Todos os tipos';
  const vaultStatus = assets.length === 0
    ? { label: 'Cofre vazio', detail: 'Envie seu primeiro video para iniciar campanhas.', tone: 'warning' }
    : missingThumbnailVideos > 0
      ? { label: 'Precisa organizar', detail: `${formatNumber(missingThumbnailVideos)} videos sem capa vinculada.`, tone: 'warning' }
      : { label: 'Cofre pronto', detail: 'Videos e capas preparados para campanha.', tone: 'success' };

  const metricsHtml = [
    { icon: 'library', label: 'Midias', value: formatNumber(filteredAssets.length), hint: `${formatNumber(assets.length)} no total`, tone: 'info' },
    { icon: 'storage', label: 'Armazenamento', value: formatBytes(totalSize), hint: `${formatNumber(totalSize)} bytes`, tone: 'info' },
    { icon: 'clock', label: 'Duracao', value: formatDurationSeconds(totalDurationSeconds), hint: 'Tempo total da midia', tone: 'info' },
    { icon: 'thumbnail', label: 'Capas vinculadas', value: formatNumber(linkedThumbnailAssets), hint: 'Videos com capa ou capas vinculadas', tone: 'success' },
  ].map((card) => `
    <article class="platform-dashboard-stat" data-tone="${escapeHtml(card.tone)}">
      <span class="platform-dashboard-stat-icon">${renderMediaMark(card.icon, 'stat-chip', card.tone, 'media-stat-mark')}</span>
      <span class="platform-dashboard-stat-label">${escapeHtml(card.label)}</span>
      <strong>${escapeHtml(card.value)}</strong>
      <span class="platform-dashboard-stat-detail">${escapeHtml(card.hint)}</span>
    </article>
  `).join('');

  const rows = filteredAssets.length === 0
    ? '<tr><td colspan="5" class="muted">No media assets found.</td></tr>'
    : filteredAssets.map((asset) => {
      const formatPill = asset.asset_type === 'video'
        ? statusPill(getVideoPublishFormatLabel(getVideoPublishFormat(asset)))
        : '';
      const linkedPill = asset.thumbnail || asset.linked_video_asset_id ? statusPill('linked') : '';
      return `
      <tr>
        <td>
          <strong>${escapeHtml(asset.original_name)}</strong>
          <div class="inline-actions" style="margin-top:4px;flex-wrap:wrap;">
            ${statusPill(asset.asset_type ?? 'video')}
            ${formatPill}
            ${linkedPill}
          </div>
          <div class="muted" style="margin-top:4px;font-size:0.8rem;">${escapeHtml(asset.mime_type ?? '')} &middot; ${escapeHtml(formatDate(asset.created_at))}</div>
          <code style="font-size:0.75rem;">${escapeHtml(asset.id)}</code>
        </td>
        <td>${asset.asset_type === 'video'
          ? renderVideoPreviewCell(asset)
          : asset.asset_type === 'thumbnail'
            ? renderThumbnailPreviewCell(asset)
            : '<span class="muted">—</span>'}</td>
        <td>${escapeHtml(formatBytes(asset.size_bytes))}</td>
        <td>${escapeHtml(formatDurationSeconds(asset.duration_seconds))}</td>
        <td>
          <div class="inline-actions">
            ${renderMediaFileActionLinks(asset)}
            <button class="button button-secondary button-sm" type="button" data-action="copy-media-id" data-media-id="${escapeHtml(asset.id)}">Copiar ID</button>
            <button class="button button-danger" type="button" data-action="delete-media" data-media-id="${escapeHtml(asset.id)}">Excluir</button>
          </div>
        </td>
      </tr>
    `;
    }).join('');
  const mediaEmptyState = assets.length === 0
    ? renderEmptyStateCard({
        title: 'Sua biblioteca de midia esta vazia',
        message: 'Envie pelo menos um video antes de criar campanhas. Voce tambem pode anexar uma capa e reutilizar depois.',
        tone: 'info',
      })
    : filteredAssets.length === 0
      ? renderEmptyStateCard({
          title: 'Nenhuma midia encontrada com estes filtros',
          message: 'Limpe a busca ou altere o tipo para voltar a ver a biblioteca.',
          actionsHtml: `<a class="button button-secondary" data-link href="${escapeHtml(libraryHref)}">Limpar filtros</a>`,
        })
      : '';
  const mediaCardsHtml = filteredAssets.map((asset) => {
    const assetIconKind = asset.asset_type === 'thumbnail' ? 'thumbnail' : asset.asset_type === 'video' ? 'video' : 'storage';
    const formatPill = asset.asset_type === 'video'
      ? statusPill(getVideoPublishFormatLabel(getVideoPublishFormat(asset)))
      : '';
    const linkedPill = asset.thumbnail || asset.linked_video_asset_id ? statusPill('linked') : '';
    const previewHtml = asset.asset_type === 'video'
      ? renderVideoPreviewCell(asset)
      : asset.asset_type === 'thumbnail'
        ? renderThumbnailPreviewCell(asset)
        : '<span class="muted">Preview indisponivel.</span>';
    return `
      <article class="platform-media-card">
        <div class="platform-media-card-head">
          <div class="platform-media-card-titleline">
            <span class="platform-media-card-kind-icon">${renderMediaMark(assetIconKind, 'chip', asset.asset_type === 'thumbnail' ? 'warning' : 'info', 'platform-media-card-kind-mark')}</span>
            <div>
              <span class="platform-dashboard-kicker">${escapeHtml(asset.asset_type ?? 'asset')}</span>
              <h3>${escapeHtml(asset.original_name)}</h3>
              <p>${escapeHtml(asset.mime_type ?? 'Formato desconhecido')} · ${escapeHtml(formatDate(asset.created_at))}</p>
            </div>
          </div>
          <div class="inline-actions">
            ${statusPill(asset.asset_type ?? 'video')}
            ${formatPill}
            ${linkedPill}
          </div>
        </div>
        <div class="platform-media-card-body">
          <div class="platform-media-card-preview">
            ${previewHtml}
          </div>
          <div class="platform-media-card-meta">
            <div>
              <span>ID da midia</span>
              <strong><code>${escapeHtml(asset.id)}</code></strong>
            </div>
            <div>
              <span>Tamanho</span>
              <strong>${escapeHtml(formatBytes(asset.size_bytes))}</strong>
            </div>
            <div>
              <span>Duracao</span>
              <strong>${escapeHtml(formatDurationSeconds(asset.duration_seconds))}</strong>
            </div>
            <div>
              <span>Caminho</span>
              <strong>${escapeHtml(asset.storage_path ?? 'Biblioteca do workspace')}</strong>
            </div>
          </div>
        </div>
        <div class="platform-media-card-actions inline-actions">
          ${renderMediaFileActionLinks(asset)}
          <button class="button button-secondary" type="button" data-action="copy-media-id" data-media-id="${escapeHtml(asset.id)}">Copiar ID</button>
          <button class="button button-danger" type="button" data-action="delete-media" data-media-id="${escapeHtml(asset.id)}">Excluir</button>
        </div>
      </article>
    `;
  }).join('');

  const viewSwitcherHtml = videosCtx ? renderVideosViewSwitcher({
    activeView: 'library',
    libraryHref: buildUrl('/workspace/videos', { view: 'library', search: searchInput, type: typeFilter }),
    playlistsHref: '/workspace/videos?view=playlists',
    libraryCount: assets.length,
  }) : '';

  renderWorkspaceShell({
    title: pageTitle,
    subtitle: pageSubtitle,
    actionsHtml: `
      <div class="inline-actions">
        <a class="button button-secondary" data-link href="${escapeHtml(buildUrl(baseHref, videosCtx ? { view: 'library', search: searchInput, type: typeFilter } : { search: searchInput, type: typeFilter }))}">Atualizar</a>
      </div>
    `,
    contentHtml: `
      ${viewSwitcherHtml}
      <section class="media-hero-interactive" id="media-hero-interactive">
        <div class="media-hero-bg">
          <div class="media-hero-orb media-hero-orb-1"></div>
          <div class="media-hero-orb media-hero-orb-2"></div>
          <div class="media-hero-orb media-hero-orb-3"></div>
          <div class="media-hero-grid-overlay"></div>
        </div>
        <div class="media-hero-content">
          <div class="media-hero-header">
            <div class="platform-dashboard-kicker-row">
              <span class="platform-dashboard-kicker">Cofre de midia</span>
              <span class="platform-dashboard-live"><span class="platform-login-live-dot"></span> Sincronizado ${escapeHtml(liveClock)}</span>
            </div>
            <h2 class="media-hero-title">Videos prontos sem peso visual.</h2>
            <p class="media-hero-subtitle">Um painel translucido que mistura sua biblioteca com o fundo ativo, sem brilho agressivo.</p>
          </div>
          <div class="media-hero-status-stage" data-tone="${escapeHtml(vaultStatus.tone)}">
            <div class="media-hero-status-main">
              ${renderMediaMark('library', 'hero', vaultStatus.tone, 'media-hero-mark')}
              <div class="media-hero-status-copy">
                <span>DIAGNOSTICO DO COFRE</span>
                <strong>${escapeHtml(vaultStatus.label)}</strong>
                <small>${escapeHtml(vaultStatus.detail)}</small>
              </div>
            </div>
            <div class="media-hero-pipeline">
              <span>Entrada</span>
              <i></i>
              <span>Preview</span>
              <i></i>
              <span>Campanha</span>
            </div>
          </div>
          <div class="media-hero-tiles">
            <button type="button" class="media-hero-tile" data-media-filter="all" data-active="${typeFilter === 'all' ? 'true' : 'false'}">
              <div class="media-hero-tile-icon">${renderMediaMark('library', 'tile', 'info', 'media-hero-tile-mark')}</div>
              <div class="media-hero-tile-info">
                <span class="media-hero-tile-label">Todas</span>
                <strong class="media-hero-tile-value" data-counter="${filteredAssets.length}">0</strong>
              </div>
            </button>
            <button type="button" class="media-hero-tile" data-media-filter="video" data-active="${typeFilter === 'video' ? 'true' : 'false'}">
              <div class="media-hero-tile-icon">${renderMediaMark('video', 'tile', 'info', 'media-hero-tile-mark')}</div>
              <div class="media-hero-tile-info">
                <span class="media-hero-tile-label">Videos</span>
                <strong class="media-hero-tile-value" data-counter="${videoAssetsCount}">0</strong>
              </div>
            </button>
            <button type="button" class="media-hero-tile" data-media-filter="thumbnail" data-active="${typeFilter === 'thumbnail' ? 'true' : 'false'}">
              <div class="media-hero-tile-icon">${renderMediaMark('thumbnail', 'tile', 'warning', 'media-hero-tile-mark')}</div>
              <div class="media-hero-tile-info">
                <span class="media-hero-tile-label">Capas</span>
                <strong class="media-hero-tile-value" data-counter="${thumbnailAssetsCount}">0</strong>
              </div>
            </button>
            <div class="media-hero-tile media-hero-tile-static">
              <div class="media-hero-tile-icon">${renderMediaMark('storage', 'tile', 'info', 'media-hero-tile-mark')}</div>
              <div class="media-hero-tile-info">
                <span class="media-hero-tile-label">Armazenamento</span>
                <strong class="media-hero-tile-value-static">${formatBytes(totalSize)}</strong>
              </div>
            </div>
            <div class="media-hero-tile media-hero-tile-static">
              <div class="media-hero-tile-icon">${renderMediaMark('clock', 'tile', 'warning', 'media-hero-tile-mark')}</div>
              <div class="media-hero-tile-info">
                <span class="media-hero-tile-label">Duracao</span>
                <strong class="media-hero-tile-value-static">${escapeHtml(formatDurationSeconds(totalDurationSeconds))}</strong>
              </div>
            </div>
          </div>
          <div class="media-vault-summary-strip">
            ${metricsHtml}
          </div>
        </div>
      </section>

      ${mediaEmptyState}
      <section class="platform-dashboard-main-grid">
        <section class="platform-surface platform-dashboard-panel">
          <div class="platform-dashboard-panel-head">
            <div>
              <span class="platform-dashboard-kicker">Entrada de midia</span>
              <h3>Enviar nova midia</h3>
            </div>
            <span class="platform-dashboard-panel-meta">MP4, MOV, JPG ou PNG</span>
          </div>
          <form id="media-upload-form">
            <div class="media-upload-zone">
              <div class="media-upload-zone-header">
                <span class="media-upload-zone-icon">${renderMediaMark('folder', 'upload', 'info', 'media-upload-mark')}</span>
                <div>
                  <p class="media-upload-zone-title">Adicionar video a biblioteca</p>
                  <p class="media-upload-zone-sub">MP4 ou MOV - capa opcional</p>
                </div>
              </div>
              <div class="media-upload-pipeline" aria-hidden="true">
                <span>${renderMediaPipelineMark('folder', 'Envio')}</span>
                <span>${renderMediaPipelineMark('video', 'Video')}</span>
                <span>${renderMediaPipelineMark('thumbnail', 'Capa', 'warning')}</span>
                <span>${renderMediaPipelineMark('clock', 'Campanha', 'warning')}</span>
              </div>
              <div class="form-grid">
                <label>
                  Arquivo de video <em style="font-style:normal;font-size:0.78rem;color:var(--danger)">*obrigatorio</em>
                  <input name="video" type="file" accept="video/mp4,video/quicktime" required />
                </label>
                <label>
                  Capa <em style="font-style:normal;font-size:0.78rem;color:var(--text-subtle)">opcional</em>
                  <input name="thumbnail" type="file" accept="image/jpeg,image/png" />
                </label>
              </div>
            </div>
            <div class="inline-actions">
              <button class="button button-primary" type="submit">Enviar midia</button>
            </div>
          </form>
        </section>
        <section class="platform-surface platform-dashboard-panel">
          <div class="platform-dashboard-panel-head">
            <div>
              <span class="platform-dashboard-kicker">Filtros da biblioteca</span>
              <h3>Filtrar biblioteca</h3>
            </div>
            <span class="platform-dashboard-panel-meta">${formatNumber(filteredAssets.length)} midias visiveis</span>
          </div>
          <form id="media-filter-form" class="filter-bar">
            <label>
              Buscar
              <input name="search" value="${escapeHtml(searchInput)}" placeholder="Nome, formato, id..." />
            </label>
            <label>
              Tipo
              <select name="type">
                <option value="all" ${typeFilter === 'all' ? 'selected' : ''}>Todas</option>
                <option value="video" ${typeFilter === 'video' ? 'selected' : ''}>Video</option>
                <option value="thumbnail" ${typeFilter === 'thumbnail' ? 'selected' : ''}>Capa</option>
              </select>
            </label>
            <div class="inline-actions">
              <button class="button button-primary" type="submit">Aplicar</button>
              <a class="button button-secondary" data-link href="${escapeHtml(libraryHref)}">Limpar</a>
            </div>
          </form>
          <div class="media-filter-signal-row">
            <span>${renderMediaPipelineMark('library', 'Biblioteca indexada')}</span>
            <span>${renderMediaPipelineMark('storage', 'Arquivos organizados')}</span>
            <span>${renderMediaPipelineMark('thumbnail', 'Capas vinculadas', 'warning')}</span>
          </div>
          <div class="platform-page-summary-grid">
            <article class="platform-page-summary-card">
              <span>Videos</span>
              <strong>${formatNumber(videoAssetsCount)}</strong>
            </article>
            <article class="platform-page-summary-card">
              <span>Capas</span>
              <strong>${formatNumber(thumbnailAssetsCount)}</strong>
            </article>
            <article class="platform-page-summary-card">
              <span>Vinculadas</span>
              <strong>${formatNumber(linkedThumbnailAssets)}</strong>
            </article>
          </div>
        </section>
      </section>
      <section class="platform-surface platform-dashboard-panel">
        <div class="platform-dashboard-panel-head">
          <div>
            <span class="platform-dashboard-kicker">Biblioteca de midia</span>
            <h3>Midias (${formatNumber(filteredAssets.length)})</h3>
          </div>
          <span class="platform-dashboard-panel-meta">${escapeHtml(typeFilterLabel)}</span>
        </div>
        ${mediaCardsHtml ? `<div class="platform-media-grid">${mediaCardsHtml}</div>` : '<p class="muted">Nenhuma midia encontrada.</p>'}
      </section>
    `,
  });

  void backfillMissingMediaDurations(assets);

  const mediaUploadZoneSub = document.querySelector('.media-upload-zone-sub');
  if (mediaUploadZoneSub) {
    mediaUploadZoneSub.textContent = 'MP4 ou MOV - capa opcional';
  }

  const mediaUploadForm = document.getElementById('media-upload-form');
  mediaUploadForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const videoInput = mediaUploadForm.querySelector('input[name="video"]');
    const thumbnailInput = mediaUploadForm.querySelector('input[name="thumbnail"]');
    const submitButton = mediaUploadForm.querySelector('button[type="submit"]');
    if (!(videoInput instanceof HTMLInputElement)) return;
    if (!(thumbnailInput instanceof HTMLInputElement)) return;
    if (!(submitButton instanceof HTMLButtonElement)) return;

    const videoFile = videoInput.files?.[0];
    const thumbnailFile = thumbnailInput.files?.[0];
    if (!videoFile) {
      setUiNotice('warning', 'Video obrigatorio', 'Selecione um video antes de enviar a midia.');
      await reRender();
      return;
    }

    setButtonBusy(submitButton, true, 'Enviando...');
    try {
      const uploadResult = await uploadMediaFiles(videoFile, thumbnailFile ?? null);
      if (!uploadResult.ok) {
        setUiNotice('error', 'Falha no envio', uploadResult.error);
        await reRender();
        return;
      }

      setUiNotice('success', 'Midia enviada', 'O novo arquivo foi adicionado a biblioteca.');
      await reRender();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha no envio.';
      setUiNotice('error', 'Falha no envio', message);
      await reRender();
    } finally {
      setButtonBusy(submitButton, false);
    }
  });

  const mediaFilterForm = document.getElementById('media-filter-form');
  mediaFilterForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(mediaFilterForm);
    const params = videosCtx
      ? { view: 'library', search: String(data.get('search') ?? ''), type: String(data.get('type') ?? 'all') }
      : { search: String(data.get('search') ?? ''), type: String(data.get('type') ?? 'all') };
    const href = buildUrl(baseHref, params);
    navigate(href);
  });

  document.querySelectorAll('.media-hero-tile[data-media-filter]').forEach((tile) => {
    tile.addEventListener('click', () => {
      const filterValue = tile.getAttribute('data-media-filter');
      if (!filterValue) return;
      const params = videosCtx
        ? { view: 'library', search: searchInput, type: filterValue }
        : { search: searchInput, type: filterValue };
      navigate(buildUrl(baseHref, params));
    });
  });

  document.querySelectorAll('.media-hero-tile-value[data-counter]').forEach((el) => {
    const target = Number(el.getAttribute('data-counter') ?? 0);
    if (!Number.isFinite(target) || target <= 0) {
      el.textContent = String(target);
      return;
    }
    const duration = 900;
    const start = performance.now();
    const tick = (now) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = String(Math.floor(target * eased));
      if (progress < 1) requestAnimationFrame(tick);
      else el.textContent = String(target);
    };
    requestAnimationFrame(tick);
  });

  const heroEl = document.getElementById('media-hero-interactive');
  if (heroEl && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    heroEl.addEventListener('mousemove', (event) => {
      const rect = heroEl.getBoundingClientRect();
      const px = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      const py = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
      heroEl.style.setProperty('--media-hero-px', String(px));
      heroEl.style.setProperty('--media-hero-py', String(py));
      const orbs = heroEl.querySelectorAll('.media-hero-orb');
      orbs.forEach((orb, idx) => {
        const factor = (idx + 1) * 8;
        orb.style.transform = `translate(${px * factor}px, ${py * factor}px)`;
      });
    });
    heroEl.addEventListener('mouseleave', () => {
      heroEl.querySelectorAll('.media-hero-orb').forEach((orb) => {
        orb.style.transform = '';
      });
    });
  }

  document.querySelectorAll('[data-action="copy-media-id"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const mediaId = button.getAttribute('data-media-id');
      if (!mediaId) return;
      try {
        await navigator.clipboard.writeText(mediaId);
        setUiNotice('success', 'ID copiado', 'O ID da midia foi copiado para a area de transferencia.');
        await reRender();
      } catch {
        setUiNotice('error', 'Falha ao copiar', 'Nao foi possivel copiar o ID da midia.');
        await reRender();
      }
    });
  });

  document.querySelectorAll('[data-action="set-media-preview-size"]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      const mediaId = button.getAttribute('data-media-id');
      const previewSize = button.getAttribute('data-preview-size');
      if (!mediaId || !isValidMediaPreviewSize(previewSize)) {
        return;
      }

      updateMediaPreviewSize(mediaId, previewSize);
      await reRender();
    });
  });

  attachVideoPreviewListeners(new Map(assets.map((asset) => [asset.id, asset])));

  document.querySelectorAll('[data-action="delete-media"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const mediaId = button.getAttribute('data-media-id');
      if (!mediaId) return;
      const confirmed = await showConfirmDialog({
        title: 'Excluir midia?',
        message: 'Isso removera a midia selecionada da biblioteca.',
        confirmLabel: 'Excluir midia',
        tone: 'warning',
      });
      if (!confirmed) return;
      setButtonBusy(button, true, 'Deleting...');
      const deleteResult = await api.deleteMedia(mediaId);
      setButtonBusy(button, false);
      if (!deleteResult.ok) {
        setUiNotice('error', 'Falha ao excluir', deleteResult.error);
        await reRender();
        return;
      }
      setUiNotice('success', 'Midia excluida', 'A midia selecionada foi removida da biblioteca.');
      await reRender();
    });
  });
}

function campaignActionButtons(campaign) {
  const targetCount = Number(campaign.targetCount ?? campaign.targets?.length ?? 0);
  const buttons = [
    `<a class="button button-secondary" data-link href="/workspace/campanhas/${encodeURIComponent(campaign.id)}">Abrir</a>`,
    `<button class="button button-secondary" type="button" data-action="clone-campaign" data-campaign-id="${escapeHtml(campaign.id)}">Duplicar</button>`,
  ];
  if (campaign.status === 'draft' && targetCount > 0) {
    buttons.push(`<button class="button button-secondary" type="button" data-action="mark-ready" data-campaign-id="${escapeHtml(campaign.id)}">Marcar pronta</button>`);
  }
  if (campaign.status === 'ready' && targetCount > 0) {
    buttons.push(`<button class="button button-primary" type="button" data-action="launch-campaign" data-campaign-id="${escapeHtml(campaign.id)}">Lancar</button>`);
  }
  if (campaign.status === 'draft' || campaign.status === 'ready') {
    buttons.push(`<button class="button button-danger" type="button" data-action="delete-campaign" data-campaign-id="${escapeHtml(campaign.id)}">Excluir</button>`);
  }
  return `<div class="inline-actions campaign-action-group">${buttons.join('')}</div>`;
}

function getCampaignStatusMeta(status) {
  const normalized = String(status ?? 'draft').toLowerCase();
  const map = {
    draft: { label: 'Rascunho', detail: 'Ainda editavel', tone: 'draft', mark: 'RA' },
    ready: { label: 'Pronta', detail: 'Pode lancar', tone: 'ready', mark: 'PR' },
    launching: { label: 'Enviando', detail: 'Na fila agora', tone: 'launching', mark: 'FL' },
    completed: { label: 'Concluida', detail: 'Publicada', tone: 'completed', mark: 'OK' },
    failed: { label: 'Falhou', detail: 'Precisa revisar', tone: 'failed', mark: 'ER' },
  };
  return map[normalized] ?? { label: normalizeLabel(normalized), detail: 'Status da campanha', tone: 'draft', mark: 'ST' };
}

function getCampaignPlatformList(campaign) {
  const platforms = new Set();
  (Array.isArray(campaign?.targets) ? campaign.targets : []).forEach((target) => {
    const platform = String(target?.platform ?? '').toLowerCase();
    if (CAMPAIGN_FLOW_PLATFORMS.includes(platform)) platforms.add(platform);
  });
  return Array.from(platforms);
}

function getCampaignSignalTone(tone) {
  const normalized = String(tone ?? 'info').toLowerCase().trim();
  if (['success', 'completed', 'published', 'available', 'ready', 'ok'].includes(normalized)) return 'success';
  if (['danger', 'error', 'failed', 'failure', 'erro', 'falha', 'reauth'].includes(normalized)) return 'danger';
  if (['warning', 'launching', 'pending', 'queued', 'draft', 'attention'].includes(normalized)) return 'warning';
  if (['processing', 'running', 'syncing', 'enviando'].includes(normalized)) return 'processing';
  if (['disabled', 'blocked', 'locked', 'unavailable'].includes(normalized)) return 'disabled';
  return 'info';
}

function renderCampaignMark(label = 'ST', tone = 'info', className = 'campaign-mark') {
  const toneKey = getCampaignSignalTone(tone);
  const safeLabel = String(label ?? 'ST').slice(0, 4).toUpperCase();
  const artworkSrc = CAMPAIGN_MARK_ARTWORK[safeLabel] ?? '';
  const classes = [
    'campaign-mark',
    artworkSrc ? 'campaign-mark-artwork' : '',
    ...String(className ?? '').split(/\s+/).filter((name) => name && name !== 'campaign-mark'),
  ].join(' ');
  return `
    <span class="${escapeAttribute(classes)}" data-tone="${escapeAttribute(toneKey)}" aria-hidden="true">
      ${artworkSrc
        ? `<img class="campaign-mark-artwork-image" src="${escapeAttribute(artworkSrc)}" alt="" decoding="async" draggable="false" />`
        : `<span>${escapeHtml(safeLabel)}</span>`}
    </span>
  `;
}

function getCampaignPlatformMark(platform) {
  const platformKey = CAMPAIGN_FLOW_PLATFORMS.includes(String(platform ?? '').toLowerCase())
    ? String(platform).toLowerCase()
    : 'unknown';
  if (platformKey === 'youtube') return 'YT';
  if (platformKey === 'tiktok') return 'TT';
  if (platformKey === 'instagram') return 'IG';
  return 'SP';
}

function renderCampaignPlatformMark(platform, className = 'campaign-platform-mark') {
  const platformKey = CAMPAIGN_FLOW_PLATFORMS.includes(String(platform ?? '').toLowerCase())
    ? String(platform).toLowerCase()
    : 'unknown';
  const artworkSrc = CAMPAIGN_PLATFORM_ARTWORK[platformKey] ?? '';
  const classes = [
    'campaign-platform-mark',
    artworkSrc ? 'campaign-platform-mark-artwork' : '',
    ...String(className ?? '').split(/\s+/).filter((name) => name && name !== 'campaign-platform-mark'),
  ].join(' ');
  return `
    <span class="${escapeAttribute(classes)}" data-platform="${escapeAttribute(platformKey)}" title="${escapeAttribute(getCampaignFlowPlatformLabel(platformKey))}" aria-label="${escapeAttribute(getCampaignFlowPlatformLabel(platformKey))}">
      ${artworkSrc
        ? `<img class="campaign-platform-mark-artwork-image" src="${escapeAttribute(artworkSrc)}" alt="" decoding="async" draggable="false" />`
        : escapeHtml(getCampaignPlatformMark(platformKey))}
    </span>
  `;
}

function renderCampaignPlatformStack(campaign) {
  const platforms = getCampaignPlatformList(campaign);
  if (platforms.length === 0) {
    return `<span class="campaign-platform-stack is-empty">${renderCampaignMark('SP', 'info', 'campaign-platform-empty-mark')}<span class="campaign-platform-stack-label">Sem plataforma</span></span>`;
  }
  return `
    <span class="campaign-platform-stack" aria-label="Plataformas da campanha">
      <span class="campaign-platform-mark-cluster">${platforms.map((platform) => renderCampaignPlatformMark(platform, 'campaign-platform-mark')).join('')}</span>
      <span class="campaign-platform-stack-label">${platforms.map(getCampaignFlowPlatformLabel).join(', ')}</span>
    </span>
  `;
}

function renderCampaignOutcomeChips(summary) {
  return `
    <div class="campaign-outcome-chips">
      <span data-state="published">${renderCampaignMark('OK', 'success', 'campaign-outcome-mark')}<strong>${formatNumber(summary.published)}</strong> publicados</span>
      <span data-state="failed">${renderCampaignMark('ER', 'danger', 'campaign-outcome-mark')}<strong>${formatNumber(summary.failed)}</strong> erros</span>
      <span data-state="pending">${renderCampaignMark('PE', 'warning', 'campaign-outcome-mark')}<strong>${formatNumber(summary.pending)}</strong> pendentes</span>
      ${summary.reauthRequired > 0 ? `<span data-state="reauth">${renderCampaignMark('AU', 'danger', 'campaign-outcome-mark')}<strong>${formatNumber(summary.reauthRequired)}</strong> reconectar</span>` : ''}
    </div>
  `;
}

function renderCampaignProgress(summary) {
  const total = Math.max(1, Number(summary.total ?? 0));
  const publishedPct = Math.min(100, (Number(summary.published ?? 0) / total) * 100);
  const failedPct = Math.min(100, (Number(summary.failed ?? 0) / total) * 100);
  return `
    <div class="campaign-progress">
      <div class="campaign-progress-label">
        <span>Progresso de destinos</span>
        <strong>${formatNumber(summary.published)} / ${formatNumber(summary.total)}</strong>
      </div>
      <div class="campaign-progress-track" aria-hidden="true">
        <span class="campaign-progress-fill published" style="--w:${publishedPct}%"></span>
        <span class="campaign-progress-fill failed" style="--w:${failedPct}%"></span>
      </div>
    </div>
  `;
}

function normalizeCampaignReauthOverview(rawOverview, fallbackTotal = 0) {
  const overview = rawOverview && typeof rawOverview === 'object' ? rawOverview : {};
  const platforms = Array.isArray(overview.platforms)
    ? overview.platforms
        .map((item) => ({
          platform: String(item.platform ?? '').toLowerCase(),
          targets: Number(item.targets ?? 0),
          campaigns: Number(item.campaigns ?? 0),
          accounts: Number(item.accounts ?? 0),
        }))
        .filter((item) => CAMPAIGN_FLOW_PLATFORMS.includes(item.platform) && item.targets > 0)
    : [];
  const targets = Array.isArray(overview.targets) ? overview.targets : [];
  return {
    totalTargets: Number(overview.totalTargets ?? fallbackTotal ?? 0),
    totalCampaigns: Number(overview.totalCampaigns ?? 0),
    platforms,
    targets,
  };
}

function renderCampaignReauthPanel(overview, options = {}) {
  if (!overview || Number(overview.totalTargets ?? 0) <= 0) {
    return '';
  }

  const resumeProvider = options.resumeProvider ?? null;
  const platformRows = overview.platforms.length > 0
    ? overview.platforms.map((item) => {
        const label = getCampaignFlowPlatformLabel(item.platform);
        return `
          <article class="campaign-reauth-platform-card" data-platform="${escapeHtml(item.platform)}">
            <div class="campaign-reauth-platform-main">
              ${renderCampaignPlatformMark(item.platform, 'campaign-reauth-platform-mark campaign-platform-mark')}
              <div>
                <strong>${escapeHtml(label)}</strong>
                <span>${formatNumber(item.targets)} destinos em ${formatNumber(item.campaigns)} campanhas</span>
              </div>
            </div>
            <button class="button button-secondary button-sm" type="button" data-action="campaign-reauth-oauth" data-platform="${escapeHtml(item.platform)}">
              Reconectar ${escapeHtml(label)}
            </button>
          </article>
        `;
      }).join('')
    : `
      <article class="campaign-reauth-platform-card">
        <div class="campaign-reauth-platform-main">
          ${renderCampaignMark('ER', 'danger', 'campaign-reauth-mini-mark')}
          <div>
            <strong>Destinos bloqueados</strong>
            <span>${formatNumber(overview.totalTargets)} precisam de reconexao</span>
          </div>
        </div>
      </article>
    `;

  const firstTargets = overview.targets.slice(0, 3);
  const targetsPreview = firstTargets.length > 0
    ? `
      <div class="campaign-reauth-target-preview">
        ${firstTargets.map((target) => `
          <span>
            ${renderCampaignPlatformMark(target.platform, 'campaign-reauth-mini-mark campaign-platform-mark')}
            ${escapeHtml(target.destinationLabel ?? target.destinationId ?? target.targetId)}
          </span>
        `).join('')}
        ${overview.targets.length > firstTargets.length ? `<span>+${formatNumber(overview.targets.length - firstTargets.length)} outros</span>` : ''}
      </div>
    `
    : '';

  return `
    <section class="campaign-reauth-panel" data-state="${resumeProvider ? 'resume' : 'pending'}">
      <div class="campaign-reauth-head">
        <div class="campaign-reauth-icon" aria-hidden="true">${renderCampaignMark('AUTH', 'danger', 'campaign-reauth-status-mark')}</div>
        <div>
          <span class="campaign-reauth-kicker">${resumeProvider ? 'CONTA RECONECTADA' : 'RECUPERACAO DE CONTAS'}</span>
          <h3>${formatNumber(overview.totalTargets)} destinos pedem reauth</h3>
          <p>${resumeProvider
            ? `A reconexao de ${getCampaignFlowPlatformLabel(resumeProvider)} foi iniciada. Use o retry em lote para voltar esses destinos para a fila.`
            : 'Reconecte a plataforma afetada e depois reenvie todos os destinos que estavam bloqueados por REAUTH_REQUIRED.'}</p>
        </div>
      </div>
      <div class="campaign-reauth-body">
        <div class="campaign-reauth-platform-grid">
          ${platformRows}
        </div>
        <div class="campaign-reauth-summary">
          <div class="campaign-reauth-summary-row">
            <span>Campanhas afetadas</span>
            <strong>${formatNumber(overview.totalCampaigns)}</strong>
          </div>
          <div class="campaign-reauth-summary-row">
            <span>Destinos bloqueados</span>
            <strong>${formatNumber(overview.totalTargets)}</strong>
          </div>
          ${targetsPreview}
          <button class="button button-primary" type="button" data-action="retry-reauth-required">
            Tentar novamente todos reconectados
          </button>
        </div>
      </div>
    </section>
  `;
}

function buildPulseChart(statusTotals) {
  const total = Math.max(1, Object.values(statusTotals).reduce((a, b) => a + (Number(b) || 0), 0));
  const pts = [];
  const baseline = 70;
  const width = 600;
  const steps = 30;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const seed = (i * 9301 + 49297) % 233280;
    const noise = (seed / 233280) * 2 - 1;
    const launchingWeight = (Number(statusTotals.launching ?? 0) / total) * 40;
    const readyWeight = (Number(statusTotals.ready ?? 0) / total) * 25;
    const y = baseline - Math.sin(t * Math.PI * 3) * (launchingWeight + 10) - Math.cos(t * Math.PI * 2) * readyWeight - noise * 8;
    const x = t * width;
    pts.push([x, Math.max(10, Math.min(130, y))]);
  }
  const path = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
  const areaPath = `${path} L${width},140 L0,140 Z`;
  return `
    <path class="pulse-area" d="${areaPath}" fill="url(#pulseFill)" />
    <path class="pulse-line" d="${path}" fill="none" stroke="url(#pulseStroke)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
    ${pts.filter((_, i) => i % 5 === 0).map(([x, y]) => `<circle class="pulse-dot" cx="${x}" cy="${y}" r="2.5"><animate attributeName="r" values="2.5;4;2.5" dur="1.8s" repeatCount="indefinite" /></circle>`).join('')}
  `;
}

function animateCampaignControl() {
  const panel = document.getElementById('campaign-control-panel');
  if (!panel) return;
  panel.querySelectorAll('[data-target]').forEach((el) => {
    const target = Number(el.getAttribute('data-target') ?? 0);
    const duration = 900;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = String(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  panel.querySelectorAll('.pulse-tick-fill').forEach((el) => {
    const cs = getComputedStyle(el);
    el.style.width = '0';
    requestAnimationFrame(() => {
      el.style.transition = 'width 1.2s cubic-bezier(0.22, 0.61, 0.36, 1)';
      el.style.width = cs.getPropertyValue('--fill');
    });
  });
  panel.querySelectorAll('[data-legend]').forEach((el) => {
    el.addEventListener('mouseenter', () => {
      const status = el.getAttribute('data-legend');
      panel.querySelectorAll('.radar-dot').forEach((d) => {
        d.classList.toggle('radar-dot-active', d.getAttribute('data-status') === status);
      });
      panel.querySelectorAll('.campaign-control-status-card').forEach((card) => {
        card.classList.toggle('is-highlighted', card.getAttribute('data-status') === status);
      });
    });
    el.addEventListener('mouseleave', () => {
      panel.querySelectorAll('.radar-dot').forEach((d) => d.classList.remove('radar-dot-active'));
      panel.querySelectorAll('.campaign-control-status-card').forEach((card) => card.classList.remove('is-highlighted'));
    });
  });

  animateMissionInsights();
}

function animateMissionInsights() {
  const panel = document.getElementById('mission-insights');
  if (!panel) return;

  const arc = panel.querySelector('.mission-success-arc');
  if (arc) {
    const targetOffset = Number(arc.getAttribute('data-target-offset') ?? 0);
    requestAnimationFrame(() => {
      arc.setAttribute('stroke-dashoffset', String(targetOffset));
    });
  }

  const rateEl = panel.querySelector('[data-target-rate]');
  if (rateEl) {
    const target = Number(rateEl.getAttribute('data-target-rate') ?? 0);
    const duration = 1200;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      rateEl.textContent = `${Math.round(target * eased)}%`;
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  panel.querySelectorAll('[data-counter]').forEach((el) => {
    const target = Number(el.getAttribute('data-counter') ?? 0);
    const duration = 900;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = String(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  const countdownEl = panel.querySelector('#mission-countdown');
  if (countdownEl) {
    const ms = Number(countdownEl.getAttribute('data-countdown-ms'));
    if (Number.isFinite(ms) && ms > 0) {
      const startedAt = Date.now();
      const initial = ms;
      const tickCountdown = () => {
        const remaining = Math.max(0, initial - (Date.now() - startedAt));
        const totalSec = Math.floor(remaining / 1000);
        const d = Math.floor(totalSec / 86400);
        const h = Math.floor((totalSec % 86400) / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        let label;
        if (d > 0) label = `${d}d ${h}h`;
        else if (h > 0) label = `${h}h ${m}m`;
        else if (m > 0) label = `${m}m ${String(s).padStart(2, '0')}s`;
        else label = `${s}s`;
        countdownEl.textContent = label;
        if (remaining > 0 && document.body.contains(countdownEl)) {
          setTimeout(tickCountdown, 1000);
        }
      };
      tickCountdown();
    }
  }

  panel.querySelectorAll('.mission-tile[data-link-href]').forEach((tile) => {
    tile.addEventListener('click', () => {
      const href = tile.getAttribute('data-link-href');
      if (href) navigate(href);
    });
  });
}

async function renderPlaylistsPage(options = {}) {
  const videosCtx = options.videosCtx ?? null;
  const reRender = () => renderPlaylistsPage(options);
  const baseHref = videosCtx ? '/workspace/videos' : '/workspace/playlists';
  const playlistsHref = videosCtx ? '/workspace/videos?view=playlists' : '/workspace/playlists';
  const libraryHref = videosCtx ? '/workspace/videos?view=library' : '/workspace/media';
  const pageTitle = videosCtx ? 'Videos' : 'Playlists';
  const pageSubtitle = videosCtx
    ? 'Sua biblioteca de videos e organizacao de playlists em um so lugar.'
    : 'Organize videos em playlists a partir de pastas locais.';

  const [playlistsResult, mediaResult] = await Promise.all([api.playlists(), api.media()]);
  if (!playlistsResult.ok) {
    if (playlistsResult.status === 401) { unauthorizedRedirect(); return; }
    renderWorkspaceShell({ title: pageTitle, subtitle: pageSubtitle, noticeHtml: `<div class="notice error">${escapeHtml(playlistsResult.error)}</div>`, contentHtml: '' });
    return;
  }

  const playlists = Array.isArray(playlistsResult.body?.playlists) ? playlistsResult.body.playlists : [];
  const allAssets = Array.isArray(mediaResult.body?.assets) ? mediaResult.body.assets : [];
  const totalVideos = playlists.reduce((sum, pl) => sum + (pl.items?.length ?? 0), 0);
  const totalUsed = playlists.reduce((sum, pl) => sum + (pl.items?.filter((i) => i.usedAt).length ?? 0), 0);
  const liveClock = formatClockLabel();
  const totalAvailable = totalVideos - totalUsed;
  const usagePct = totalVideos === 0 ? 0 : Math.round((totalUsed / totalVideos) * 100);
  const avgPerPlaylist = playlists.length === 0 ? 0 : Math.round((totalVideos / playlists.length) * 10) / 10;
  const libraryAssets = allAssets.filter((a) => a.asset_type === 'video').length;
  const playlistsWithAvailable = playlists.filter((pl) => (pl.items?.length ?? 0) - (pl.items?.filter((i) => i.usedAt).length ?? 0) > 0).length;
  const playlistsExhausted = playlists.length - playlistsWithAvailable;
  const largestPlaylist = playlists.slice().sort((a, b) => (b.items?.length ?? 0) - (a.items?.length ?? 0))[0] ?? null;
  const mostDepleted = playlists.slice().sort((a, b) => {
    const usedA = (a.items?.filter((i) => i.usedAt).length ?? 0) / Math.max(1, (a.items?.length ?? 0));
    const usedB = (b.items?.filter((i) => i.usedAt).length ?? 0) / Math.max(1, (b.items?.length ?? 0));
    return usedB - usedA;
  })[0] ?? null;
  const ringCircumference = 2 * Math.PI * 50;
  const ringOffset = ringCircumference * (1 - usagePct / 100);

  const metricsHtml = [
    { icon: 'playlist', label: 'Playlists', value: formatNumber(playlists.length), hint: 'Total de playlists criadas', tone: 'info' },
    { icon: 'video', label: 'Videos', value: formatNumber(totalVideos), hint: 'Videos distribuidos em playlists', tone: 'info' },
    { icon: 'clock', label: 'Ja usados', value: formatNumber(totalUsed), hint: 'Videos que ja foram postados via Auto', tone: 'success' },
    { icon: 'folder', label: 'Disponiveis', value: formatNumber(totalVideos - totalUsed), hint: 'Ainda nao postados', tone: totalVideos - totalUsed > 0 ? 'info' : 'warning' },
  ].map((card) => `
    <article class="platform-dashboard-stat" data-tone="${escapeHtml(card.tone)}">
      <span class="platform-dashboard-stat-icon">${renderMediaMark(card.icon, 'stat-chip', card.tone, 'media-stat-mark')}</span>
      <span class="platform-dashboard-stat-label">${escapeHtml(card.label)}</span>
      <strong>${escapeHtml(card.value)}</strong>
      <span class="platform-dashboard-stat-detail">${escapeHtml(card.hint)}</span>
    </article>
  `).join('');

  const playlistCardsHtml = playlists.length === 0
    ? ''
    : playlists.map((pl) => {
        const itemCount = pl.items?.length ?? 0;
        const usedCount = pl.items?.filter((i) => i.usedAt).length ?? 0;
        const availCount = itemCount - usedCount;
        const usedPct = itemCount > 0 ? Math.round((usedCount / itemCount) * 100) : 0;
        return `
          <article class="platform-media-card">
            <div class="platform-media-card-head">
              <div class="platform-media-card-titleline">
                <span class="platform-media-card-kind-icon">${renderMediaMark('playlist', 'chip', 'info', 'platform-media-card-kind-mark')}</span>
                <div>
                  <span class="platform-dashboard-kicker">playlist</span>
                  <h3>${escapeHtml(pl.name)}</h3>
                  <p>${escapeHtml(pl.folderPath || 'Pasta manual')} · ${escapeHtml(formatDate(pl.createdAt))}</p>
                </div>
              </div>
              <div class="inline-actions">
                ${statusPill(`${formatNumber(itemCount)} videos`)}
                ${availCount > 0 ? statusPill(`${formatNumber(availCount)} disp`) : statusPill('esgotada')}
              </div>
            </div>
            <div class="platform-media-card-body">
              <div class="platform-media-card-preview playlist-media-preview">
                ${renderMediaMark('playlist', 'card', 'info', 'playlist-preview-mark')}
                <div class="playlist-media-preview-count">
                  <strong>${formatNumber(itemCount)}</strong>
                  <span>videos</span>
                </div>
              </div>
              <div class="platform-media-card-meta">
                <div><span>Total</span><strong>${formatNumber(itemCount)}</strong></div>
                <div><span>Usados</span><strong>${formatNumber(usedCount)}</strong></div>
                <div><span>Disponiveis</span><strong>${formatNumber(availCount)}</strong></div>
                <div><span>Progresso</span><strong>${usedPct}%</strong></div>
              </div>
            </div>
            <div class="platform-media-card-actions inline-actions">
              <a class="button button-secondary" data-link href="/workspace/playlists/${encodeURIComponent(pl.id)}?from=videos">Abrir</a>
              <button class="button button-danger" type="button" data-action="delete-playlist" data-playlist-id="${escapeHtml(pl.id)}">Excluir</button>
            </div>
          </article>
        `;
      }).join('');

  const emptyState = playlists.length === 0
    ? renderEmptyStateCard({
        title: 'Nenhuma playlist ainda',
        message: 'Escaneie uma pasta local — cada subpasta vira uma playlist com seus videos importados automaticamente.',
        tone: 'info',
      })
    : '';

  const viewSwitcherHtml = videosCtx ? renderVideosViewSwitcher({
    activeView: 'playlists',
    libraryHref: '/workspace/videos?view=library',
    playlistsHref: '/workspace/videos?view=playlists',
    libraryCount: allAssets.length,
    playlistsCount: playlists.length,
  }) : '';

  renderWorkspaceShell({
    title: pageTitle,
    subtitle: pageSubtitle,
    actionsHtml: `
      <div class="inline-actions">
        <a class="button button-secondary" data-link href="${escapeHtml(playlistsHref)}">Atualizar</a>
      </div>
    `,
    contentHtml: `
      ${viewSwitcherHtml}
      <section class="playlist-cockpit" id="playlist-cockpit">
        <div class="playlist-cockpit-bg" aria-hidden="true">
          <div class="playlist-cockpit-orb-a"></div>
          <div class="playlist-cockpit-orb-b"></div>
          <div class="playlist-cockpit-grid"></div>
          <div class="playlist-cockpit-scan"></div>
        </div>

        <header class="playlist-cockpit-header">
          <div class="playlist-cockpit-title-block">
            <span class="playlist-cockpit-kicker">
              <span class="playlist-cockpit-pulse-dot"></span>
              COFRE DE PLAYLISTS
            </span>
            <h2 class="playlist-cockpit-title">Organize, automatize, <span class="playlist-cockpit-title-accent">nao repita.</span></h2>
            <p class="playlist-cockpit-subtitle">Pastas locais viram playlists. Cada video e publicado uma vez e o sistema escolhe o proximo automaticamente.</p>
          </div>
          <div class="playlist-cockpit-sync">
            <span class="playlist-cockpit-sync-status"><span class="playlist-cockpit-sync-dot"></span>LIVE SYNC</span>
            <strong class="playlist-cockpit-sync-time">${escapeHtml(liveClock)}</strong>
            <span class="playlist-cockpit-sync-label">${formatNumber(playlists.length)} playlists ativas</span>
          </div>
        </header>

        <div class="playlist-cockpit-hero-row">
          <article class="playlist-cockpit-ring-card">
            <svg class="playlist-cockpit-ring" viewBox="0 0 120 120" aria-hidden="true">
              <circle cx="60" cy="60" r="50" fill="none" stroke="currentColor" stroke-opacity="0.12" stroke-width="9" />
              <circle class="playlist-cockpit-ring-arc" cx="60" cy="60" r="50" fill="none"
                stroke="url(#playlistRingGrad)" stroke-width="9" stroke-linecap="round"
                stroke-dasharray="${ringCircumference}"
                stroke-dashoffset="${ringCircumference}"
                data-target-offset="${ringOffset}"
                transform="rotate(-90 60 60)" />
              <defs>
                <linearGradient id="playlistRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="var(--cc-accent)" />
                  <stop offset="100%" stop-color="var(--cc-accent2)" />
                </linearGradient>
              </defs>
            </svg>
            <div class="playlist-cockpit-ring-info">
              <span class="playlist-cockpit-ring-label">UTILIZAÇÃO</span>
              <strong class="playlist-cockpit-ring-value" data-target-rate="${usagePct}">0%</strong>
              <span class="playlist-cockpit-ring-detail">${formatNumber(totalUsed)} de ${formatNumber(totalVideos)} usados</span>
            </div>
          </article>

          <article class="playlist-cockpit-stat-big" data-tone="primary">
            <div class="playlist-cockpit-stat-big-icon">${renderMediaMark('playlist', 'stat', 'info', 'playlist-cockpit-stat-mark')}</div>
            <div class="playlist-cockpit-stat-big-info">
              <span class="playlist-cockpit-stat-big-label">Playlists</span>
              <strong class="playlist-cockpit-stat-big-value" data-counter="${playlists.length}">0</strong>
              <span class="playlist-cockpit-stat-big-detail">${formatNumber(playlistsWithAvailable)} com vídeos · ${formatNumber(playlistsExhausted)} esgotadas</span>
            </div>
          </article>

          <article class="playlist-cockpit-stat-big" data-tone="success">
            <div class="playlist-cockpit-stat-big-icon">${renderMediaMark('video', 'stat', 'success', 'playlist-cockpit-stat-mark')}</div>
            <div class="playlist-cockpit-stat-big-info">
              <span class="playlist-cockpit-stat-big-label">Videos</span>
              <strong class="playlist-cockpit-stat-big-value" data-counter="${totalVideos}">0</strong>
              <span class="playlist-cockpit-stat-big-detail">${avgPerPlaylist} media por playlist</span>
            </div>
          </article>
        </div>

        <div class="playlist-cockpit-mini-row">
          <article class="playlist-cockpit-mini" data-tone="info">
            <div class="playlist-cockpit-mini-icon">${renderMediaMark('available', 'mini', 'success', 'playlist-cockpit-mini-mark')}</div>
            <div class="playlist-cockpit-mini-info">
              <span class="playlist-cockpit-mini-label">Disponiveis</span>
              <strong class="playlist-cockpit-mini-value" data-counter="${totalAvailable}">0</strong>
              <span class="playlist-cockpit-mini-detail">prontos para publicar</span>
            </div>
          </article>
          <article class="playlist-cockpit-mini" data-tone="warning">
            <div class="playlist-cockpit-mini-icon">${renderMediaMark('published', 'mini', 'warning', 'playlist-cockpit-mini-mark')}</div>
            <div class="playlist-cockpit-mini-info">
              <span class="playlist-cockpit-mini-label">Ja publicados</span>
              <strong class="playlist-cockpit-mini-value" data-counter="${totalUsed}">0</strong>
              <span class="playlist-cockpit-mini-detail">via Auto-mode</span>
            </div>
          </article>
          <article class="playlist-cockpit-mini" data-tone="info">
            <div class="playlist-cockpit-mini-icon">${renderMediaMark('library', 'mini', 'info', 'playlist-cockpit-mini-mark')}</div>
            <div class="playlist-cockpit-mini-info">
              <span class="playlist-cockpit-mini-label">Biblioteca</span>
              <strong class="playlist-cockpit-mini-value" data-counter="${libraryAssets}">0</strong>
              <span class="playlist-cockpit-mini-detail">midias de video</span>
            </div>
          </article>
          <article class="playlist-cockpit-mini" data-tone="success">
            <div class="playlist-cockpit-mini-icon">${renderMediaMark('star', 'mini', 'success', 'playlist-cockpit-mini-mark')}</div>
            <div class="playlist-cockpit-mini-info">
              <span class="playlist-cockpit-mini-label">Maior playlist</span>
              <strong class="playlist-cockpit-mini-value playlist-cockpit-mini-text">${escapeHtml((largestPlaylist?.name ?? '—').slice(0, 14) + ((largestPlaylist?.name ?? '').length > 14 ? '…' : ''))}</strong>
              <span class="playlist-cockpit-mini-detail">${largestPlaylist ? `${formatNumber(largestPlaylist.items?.length ?? 0)} vídeos` : 'sem dados'}</span>
            </div>
          </article>
          <article class="playlist-cockpit-mini" data-tone="warning">
            <div class="playlist-cockpit-mini-icon">${renderMediaMark('published', 'mini', 'warning', 'playlist-cockpit-mini-mark')}</div>
            <div class="playlist-cockpit-mini-info">
              <span class="playlist-cockpit-mini-label">Mais usada</span>
              <strong class="playlist-cockpit-mini-value playlist-cockpit-mini-text">${escapeHtml((mostDepleted?.name ?? '—').slice(0, 14) + ((mostDepleted?.name ?? '').length > 14 ? '…' : ''))}</strong>
              <span class="playlist-cockpit-mini-detail">${mostDepleted && (mostDepleted.items?.length ?? 0) > 0 ? Math.round(((mostDepleted.items?.filter((i) => i.usedAt).length ?? 0) / (mostDepleted.items?.length ?? 1)) * 100) + '% consumida' : 'sem dados'}</span>
            </div>
          </article>
        </div>

        <div class="playlist-cockpit-footer">
          <div class="playlist-cockpit-footer-bar">
            <div class="playlist-cockpit-footer-bar-label">
              <span>Distribuicao global</span>
              <strong>${100 - usagePct}% disponivel</strong>
            </div>
            <div class="playlist-cockpit-footer-bar-track">
              <div class="playlist-cockpit-footer-bar-fill" style="--width:${100 - usagePct}%"></div>
            </div>
          </div>
          <div class="playlist-cockpit-footer-meta">
            <span>${formatNumber(playlists.length)} playlists</span>
            <span aria-hidden="true">·</span>
            <span>${formatNumber(totalVideos)} videos</span>
            <span aria-hidden="true">·</span>
            <span>${formatNumber(libraryAssets)} midias na biblioteca</span>
            <span aria-hidden="true">·</span>
            <span class="playlist-cockpit-status-badge ${playlists.length > 0 ? 'active' : 'inactive'}">${playlists.length > 0 ? '● ATIVO' : '○ VAZIO'}</span>
          </div>
        </div>
      </section>

      <section class="platform-dashboard-stat-grid">
        ${metricsHtml}
      </section>

      <section class="platform-dashboard-main-grid">
        <section class="platform-surface platform-dashboard-panel">
          <div class="platform-dashboard-panel-head">
            <div>
              <span class="platform-dashboard-kicker">Entrada de playlists</span>
              <h3>Escanear pasta local</h3>
            </div>
            <span class="platform-dashboard-panel-meta">Subpastas → Playlists</span>
          </div>
          <div class="media-upload-zone">
            <div class="media-upload-zone-header">
              <span class="media-upload-zone-icon">${renderMediaMark('folder', 'upload', 'info', 'media-upload-mark')}</span>
              <div>
                <p class="media-upload-zone-title">Importar da pasta do servidor</p>
                <p class="media-upload-zone-sub">Cada subpasta vira uma playlist automaticamente</p>
              </div>
            </div>
            <div class="media-upload-pipeline" aria-hidden="true">
              <span>${renderMediaPipelineMark('folder', 'Pasta')}</span>
              <span>${renderMediaPipelineMark('playlist', 'Playlist')}</span>
              <span>${renderMediaPipelineMark('video', 'Videos')}</span>
              <span>${renderMediaPipelineMark('clock', 'Auto', 'warning')}</span>
            </div>
            <form id="scan-folder-form" class="form-grid">
              <label>
                Caminho da pasta raiz <em style="font-style:normal;font-size:0.78rem;color:var(--danger)">*obrigatorio</em>
                <input name="rootPath" required placeholder="Ex: C:\\Videos ou /home/user/videos" />
              </label>
            </form>
          </div>
          <div class="inline-actions">
            <button class="button button-primary" type="button" id="scan-folder-submit">Escanear e importar</button>
          </div>
        </section>
        <section class="platform-surface platform-dashboard-panel">
          <div class="platform-dashboard-panel-head">
            <div>
              <span class="platform-dashboard-kicker">Manual</span>
              <h3>Criar playlist</h3>
            </div>
            <span class="platform-dashboard-panel-meta">${formatNumber(playlists.length)} criadas</span>
          </div>
          <p class="muted">Crie uma playlist vazia e adicione videos manualmente depois.</p>
          <div class="inline-actions">
            <button class="button button-primary" type="button" data-action="create-playlist-manual">+ Nova playlist</button>
          </div>
          <div class="platform-page-summary-grid">
            <article class="platform-page-summary-card">
              <span>Playlists</span>
              <strong>${formatNumber(playlists.length)}</strong>
            </article>
            <article class="platform-page-summary-card">
              <span>Total videos</span>
              <strong>${formatNumber(totalVideos)}</strong>
            </article>
            <article class="platform-page-summary-card">
              <span>Ja usados</span>
              <strong>${formatNumber(totalUsed)}</strong>
            </article>
          </div>
        </section>
      </section>

      ${emptyState}
      <section class="platform-surface platform-dashboard-panel">
        <div class="platform-dashboard-panel-head">
          <div>
            <span class="platform-dashboard-kicker">Biblioteca de playlists</span>
            <h3>Playlists (${formatNumber(playlists.length)})</h3>
          </div>
          <span class="platform-dashboard-panel-meta">Auto · Sem repeticao</span>
        </div>
        ${playlistCardsHtml ? `<div class="platform-media-grid">${playlistCardsHtml}</div>` : '<p class="muted">Nenhuma playlist encontrada.</p>'}
      </section>
    `,
  });

  animatePlaylistCockpit();

  document.getElementById('scan-folder-submit')?.addEventListener('click', async () => {
    const form = document.getElementById('scan-folder-form');
    if (!form) return;
    const rootPath = String(new FormData(form).get('rootPath') ?? '').trim();
    if (!rootPath) return;
    const btn = document.getElementById('scan-folder-submit');
    setButtonBusy(btn, true, 'Escaneando...');
    const result = await api.scanFolderForPlaylists(rootPath);
    setButtonBusy(btn, false);
    if (!result.ok) {
      setUiNotice('error', 'Erro ao escanear', result.error);
    } else {
      const { created, updated } = result.body ?? {};
      setUiNotice('success', 'Scan concluido', `${created} playlists criadas, ${updated} atualizadas.`);
    }
    await reRender();
  });

  document.querySelector('[data-action="create-playlist-manual"]')?.addEventListener('click', async () => {
    const result = await showFormDialog({
      title: 'Nova Playlist',
      fields: [
        { name: 'name', label: 'Nome', type: 'text', required: true },
        { name: 'folderPath', label: 'Caminho da pasta (opcional)', type: 'text' },
      ],
    });
    if (!result) return;
    const r = await api.createPlaylist(result.name, result.folderPath ?? '');
    if (!r.ok) { setUiNotice('error', 'Erro', r.error); } else { setUiNotice('success', 'Playlist criada', ''); }
    await reRender();
  });

  document.querySelectorAll('[data-action="delete-playlist"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const playlistId = btn.getAttribute('data-playlist-id');
      const confirmed = await showConfirmDialog({ title: 'Excluir playlist?', message: 'Os assets de video nao serao deletados, apenas a playlist.', tone: 'danger' });
      if (!confirmed) return;
      const r = await api.deletePlaylist(playlistId);
      if (!r.ok) { setUiNotice('error', 'Erro ao excluir', r.error); } else { setUiNotice('success', 'Playlist excluida', ''); }
      await reRender();
    });
  });
}

async function renderPlaylistDetailPage(playlistId) {
  const [plResult, mediaResult] = await Promise.all([api.getPlaylist(playlistId), api.media()]);
  if (!plResult.ok) {
    if (plResult.status === 401) { unauthorizedRedirect(); return; }
    renderWorkspaceShell({ title: 'Playlist', subtitle: '', noticeHtml: `<div class="notice error">${escapeHtml(plResult.error)}</div>`, contentHtml: '' });
    return;
  }

  const playlist = plResult.body?.playlist;
  const allAssets = Array.isArray(mediaResult.body?.assets) ? mediaResult.body.assets : [];
  const videoById = Object.fromEntries(allAssets.filter((a) => a.asset_type === 'video').map((a) => [a.id, a]));
  const items = playlist.items ?? [];
  const usedCount = items.filter((i) => i.usedAt).length;
  const availCount = items.length - usedCount;
  const liveClock = formatClockLabel();

  const metricsHtml = [
    { icon: 'video', label: 'Videos', value: formatNumber(items.length), hint: 'Total na playlist', tone: 'info' },
    { icon: 'folder', label: 'Disponiveis', value: formatNumber(availCount), hint: 'Ainda nao postados via Auto', tone: availCount > 0 ? 'info' : 'warning' },
    { icon: 'clock', label: 'Ja usados', value: formatNumber(usedCount), hint: 'Postados pelo modo Auto', tone: 'success' },
    { icon: 'playlist', label: 'Progresso', value: items.length > 0 ? `${Math.round((usedCount / items.length) * 100)}%` : '—', hint: 'Completude da playlist', tone: 'info' },
  ].map((card) => `
    <article class="platform-dashboard-stat" data-tone="${escapeHtml(card.tone)}">
      <span class="platform-dashboard-stat-icon">${renderMediaMark(card.icon, 'stat-chip', card.tone, 'media-stat-mark')}</span>
      <span class="platform-dashboard-stat-label">${escapeHtml(card.label)}</span>
      <strong>${escapeHtml(card.value)}</strong>
      <span class="platform-dashboard-stat-detail">${escapeHtml(card.hint)}</span>
    </article>
  `).join('');

  const itemCardsHtml = items.map((item) => {
    const asset = videoById[item.videoAssetId];
    const usedLabel = item.usedAt ? `Usado ${new Date(item.usedAt).toLocaleString(getActiveLocale())}` : 'Disponivel';
    const usedTone = item.usedAt ? '' : 'success';
    const previewHtml = asset ? renderVideoPreviewCell(asset) : '<span class="muted">Asset nao encontrado</span>';
    return `
      <article class="platform-media-card">
        <div class="platform-media-card-head">
          <div class="platform-media-card-titleline">
            <span class="platform-media-card-kind-icon">${renderMediaMark('video', 'chip', 'info', 'platform-media-card-kind-mark')}</span>
            <div>
              <span class="platform-dashboard-kicker">video</span>
              <h3>${escapeHtml(asset?.original_name ?? item.videoAssetId)}</h3>
              <p>${escapeHtml(asset?.mime_type ?? '')}${asset?.created_at ? ' · ' + escapeHtml(formatDate(asset.created_at)) : ''}</p>
            </div>
          </div>
          <div class="inline-actions">
            ${statusPill(item.usedAt ? 'usado' : 'disponivel')}
          </div>
        </div>
        <div class="platform-media-card-body playlist-card-body">
          <div class="platform-media-card-preview playlist-card-preview">
            ${previewHtml}
          </div>
          <div class="platform-media-card-meta playlist-card-meta">
            <div><span>Duracao</span><strong>${escapeHtml(formatDurationSeconds(asset?.duration_seconds ?? 0))}</strong></div>
            <div><span>Tamanho</span><strong>${escapeHtml(formatBytes(asset?.size_bytes ?? 0))}</strong></div>
            <div><span>Status</span><strong class="${usedTone}">${escapeHtml(usedLabel)}</strong></div>
            <div title="${escapeHtml(item.videoAssetId)}"><span>Asset ID</span><strong><code class="playlist-card-asset-id">${escapeHtml(item.videoAssetId)}</code></strong></div>
          </div>
        </div>
        <div class="platform-media-card-actions inline-actions">
          <button class="button button-secondary" type="button" data-action="edit-preset" data-video-asset-id="${escapeHtml(item.videoAssetId)}" data-name="${escapeHtml(asset?.original_name ?? '')}">Preset</button>
          <button class="button button-danger" type="button" data-action="remove-pl-item" data-video-asset-id="${escapeHtml(item.videoAssetId)}">Remover</button>
        </div>
      </article>
    `;
  }).join('');

  const availableForAdd = allAssets.filter((a) => a.asset_type === 'video' && !items.some((i) => i.videoAssetId === a.id));
  const videoOptions = availableForAdd.map((v) => `<option value="${escapeHtml(v.id)}">${escapeHtml(v.original_name)}</option>`).join('');

  renderWorkspaceShell({
    title: escapeHtml(playlist.name),
    subtitle: escapeHtml(playlist.folderPath || 'Playlist manual'),
    actionsHtml: `
      <div class="inline-actions">
        <a class="button button-secondary" data-link href="/workspace/videos?view=playlists">← Playlists</a>
        <a class="button button-secondary" data-link href="/workspace/playlists/${encodeURIComponent(playlistId)}">Refresh</a>
      </div>
    `,
    contentHtml: `
      <section class="platform-dashboard-hero">
        <article class="platform-surface platform-dashboard-hero-copy">
          <div class="platform-dashboard-kicker-row">
            <span class="platform-dashboard-kicker">Playlist</span>
            <span class="platform-dashboard-live"><span class="platform-login-live-dot"></span> Sincronizado ${escapeHtml(liveClock)}</span>
          </div>
          <h2>${escapeHtml(playlist.name)}</h2>
          <p>${escapeHtml(playlist.folderPath || 'Criada manualmente')}</p>
          <div class="platform-dashboard-chip-row">
            <span class="platform-chip">${renderMediaPipelineMark('playlist', 'Auto aleatorio')}</span>
            <span class="platform-chip">${renderMediaPipelineMark('available', 'Sem repeticao', 'success')}</span>
          </div>
          <div class="platform-dashboard-chip-row">
            <span class="platform-dashboard-inline-stat">${formatNumber(items.length)} videos</span>
            <span class="platform-dashboard-inline-stat">${formatNumber(availCount)} disponiveis</span>
            <span class="platform-dashboard-inline-stat">${formatNumber(usedCount)} usados</span>
          </div>
        </article>
        <article class="platform-surface platform-dashboard-hero-visual">
          <div class="platform-page-summary-grid">
            <article class="platform-page-summary-card">
              <span>Videos</span>
              <strong>${formatNumber(items.length)}</strong>
            </article>
            <article class="platform-page-summary-card">
              <span>Disponiveis</span>
              <strong>${formatNumber(availCount)}</strong>
            </article>
            <article class="platform-page-summary-card">
              <span>Usados</span>
              <strong>${formatNumber(usedCount)}</strong>
            </article>
          </div>
          <div class="platform-dashboard-orbit-footer">
            <div><span>Folder</span><strong>${escapeHtml(playlist.folderPath ? 'Pasta local' : 'Manual')}</strong></div>
            <div><span>Criada</span><strong>${escapeHtml(formatDate(playlist.createdAt))}</strong></div>
            <div><span>Status</span><strong>${availCount > 0 ? 'Com videos' : 'Esgotada'}</strong></div>
          </div>
        </article>
      </section>

      <section class="platform-dashboard-stat-grid">
        ${metricsHtml}
      </section>

      <section class="platform-dashboard-main-grid">
        <section class="platform-surface platform-dashboard-panel">
          <div class="platform-dashboard-panel-head">
            <div>
              <span class="platform-dashboard-kicker">Add video</span>
              <h3>Adicionar video existente</h3>
            </div>
            <span class="platform-dashboard-panel-meta">${formatNumber(availableForAdd.length)} disponiveis na biblioteca</span>
          </div>
          ${videoOptions ? `
            <div class="media-upload-zone">
              <div class="media-upload-zone-header">
                <span class="media-upload-zone-icon">${renderMediaMark('add', 'upload', 'info', 'media-upload-mark')}</span>
                <div>
                  <p class="media-upload-zone-title">Selecione um video da biblioteca</p>
                  <p class="media-upload-zone-sub">Videos ja na playlist nao aparecem</p>
                </div>
              </div>
              <form id="add-pl-item-form" class="form-grid">
                <label>
                  Video
                  <select name="videoAssetId"><option value="">Selecione...</option>${videoOptions}</select>
                </label>
              </form>
            </div>
            <div class="inline-actions">
              <button class="button button-primary" type="button" id="add-pl-item-submit">Adicionar a playlist</button>
            </div>
          ` : '<p class="muted">Todos os videos da biblioteca ja estao nesta playlist.</p>'}
        </section>
        <section class="platform-surface platform-dashboard-panel">
          <div class="platform-dashboard-panel-head">
            <div>
              <span class="platform-dashboard-kicker">Progresso</span>
              <h3>Status de uso</h3>
            </div>
            <span class="platform-dashboard-panel-meta">${items.length > 0 ? Math.round((usedCount / items.length) * 100) : 0}% usada</span>
          </div>
          <div class="platform-page-summary-grid">
            <article class="platform-page-summary-card">
              <span>Total</span>
              <strong>${formatNumber(items.length)}</strong>
            </article>
            <article class="platform-page-summary-card">
              <span>Usados</span>
              <strong>${formatNumber(usedCount)}</strong>
            </article>
            <article class="platform-page-summary-card">
              <span>Restantes</span>
              <strong>${formatNumber(availCount)}</strong>
            </article>
          </div>
          <p class="muted" style="font-size:0.85rem;">Quando todos os videos forem usados, o ciclo reinicia automaticamente a partir dos mais antigos.</p>
        </section>
      </section>

      ${items.length === 0 ? renderEmptyStateCard({ title: 'Playlist vazia', message: 'Adicione videos da biblioteca ou escaneie novamente a pasta.', tone: 'info' }) : ''}
      <section class="platform-surface platform-dashboard-panel">
        <div class="platform-dashboard-panel-head">
          <div>
            <span class="platform-dashboard-kicker">Video library</span>
            <h3>Videos da playlist (${formatNumber(items.length)})</h3>
          </div>
          <span class="platform-dashboard-panel-meta">${formatNumber(availCount)} disponiveis · ${formatNumber(usedCount)} usados</span>
        </div>
        ${itemCardsHtml ? `<div class="platform-media-grid">${itemCardsHtml}</div>` : '<p class="muted">Nenhum video nesta playlist.</p>'}
      </section>
    `,
  });

  document.getElementById('add-pl-item-submit')?.addEventListener('click', async () => {
    const form = document.getElementById('add-pl-item-form');
    if (!form) return;
    const vid = String(new FormData(form).get('videoAssetId') ?? '').trim();
    if (!vid) return;
    const r = await api.addPlaylistItem(playlistId, vid);
    if (!r.ok) { setUiNotice('error', 'Erro', r.error); } else { setUiNotice('success', 'Video adicionado', ''); }
    await renderPlaylistDetailPage(playlistId);
  });

  document.querySelectorAll('[data-action="remove-pl-item"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const vid = btn.getAttribute('data-video-asset-id');
      const r = await api.removePlaylistItem(playlistId, vid);
      if (!r.ok) { setUiNotice('error', 'Erro ao remover', r.error); } else { setUiNotice('success', 'Removido', ''); }
      await renderPlaylistDetailPage(playlistId);
    });
  });

  document.querySelectorAll('[data-action="edit-preset"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const videoAssetId = btn.getAttribute('data-video-asset-id');
      const name = btn.getAttribute('data-name') ?? videoAssetId;
      const existing = await api.getPreset(videoAssetId);
      const preset = existing.ok ? existing.body?.preset : null;
      const result = await showFormDialog({
        title: `Preset — ${name}`,
        message: 'Pre-configure titulo, descricao e tags para uso automatico em campanhas.',
        fields: [
          { name: 'title', label: 'Titulo', type: 'text', value: preset?.title ?? '' },
          { name: 'description', label: 'Descricao', type: 'textarea', value: preset?.description ?? '' },
          { name: 'tags', label: 'Tags (virgula)', type: 'text', value: (preset?.tags ?? []).join(', ') },
          { name: 'privacy', label: 'Privacidade', type: 'select', options: ['private', 'unlisted', 'public'], value: preset?.privacy ?? 'private' },
        ],
      });
      if (!result) return;
      const tags = String(result.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean);
      const r = await api.upsertPreset(videoAssetId, { title: result.title, description: result.description, tags, privacy: result.privacy });
      if (!r.ok) { setUiNotice('error', 'Erro ao salvar preset', r.error); } else { setUiNotice('success', 'Preset salvo', ''); }
      await renderPlaylistDetailPage(playlistId);
    });
  });

  attachVideoPreviewListeners(new Map(Object.entries(videoById)));
}

async function renderCampaignsPage() {
  const query = parseCurrentQuery();
  const filters = {
    status: (query.get('status') ?? '').trim(),
    search: (query.get('search') ?? '').trim(),
    limit: parseInteger(query.get('limit') ?? '20', 20, 1, 200),
    offset: parseInteger(query.get('offset') ?? '0', 0, 0),
  };
  const [campaignsResult, mediaResult, reauthResult] = await Promise.all([
    api.campaigns(filters),
    api.media(),
    api.campaignReauthRequired(),
  ]);
  if (!campaignsResult.ok || !mediaResult.ok) {
    const failing = !campaignsResult.ok ? campaignsResult : mediaResult;
    if (failing.status === 401) {
      unauthorizedRedirect();
      return;
    }
    renderWorkspaceShell({
      title: 'Campanhas',
      subtitle: 'Controle rascunhos, filas, agendamentos e resultados de publicacao.',
      noticeHtml: `<div class="notice error">${escapeHtml(failing.error)}</div>`,
      contentHtml: '<section class="card">Nao foi possivel carregar as campanhas.</section>',
    });
    return;
  }
  if (reauthResult.status === 401) {
    unauthorizedRedirect();
    return;
  }

  const campaigns = Array.isArray(campaignsResult.body?.campaigns) ? campaignsResult.body.campaigns : [];
  const mediaAssets = Array.isArray(mediaResult.body?.assets) ? mediaResult.body.assets : [];
  const mediaById = new Map(mediaAssets.map((asset) => [asset.id, asset]));
  const total = Number(campaignsResult.body?.total ?? campaigns.length);
  const pageLimit = parseInteger(campaignsResult.body?.limit ?? filters.limit, filters.limit, 1, 200);
  const pageOffset = parseInteger(campaignsResult.body?.offset ?? filters.offset, filters.offset, 0);
  const pageStart = total === 0 ? 0 : pageOffset + 1;
  const pageEnd = Math.min(pageOffset + pageLimit, total);
  const totalPages = Math.max(1, Math.ceil(total / pageLimit));
  const currentPage = total === 0 ? 1 : Math.floor(pageOffset / pageLimit) + 1;
  const liveClock = formatClockLabel();

  const statusTotals = {
    draft: campaigns.filter((campaign) => campaign.status === 'draft').length,
    ready: campaigns.filter((campaign) => campaign.status === 'ready').length,
    launching: campaigns.filter((campaign) => campaign.status === 'launching').length,
    completed: campaigns.filter((campaign) => campaign.status === 'completed').length,
    failed: campaigns.filter((campaign) => campaign.status === 'failed').length,
  };

  // Mission Insights computations
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const finishedCount = statusTotals.completed + statusTotals.failed;
  const successRate = finishedCount > 0 ? Math.round((statusTotals.completed / finishedCount) * 100) : 0;
  const upcoming = campaigns
    .filter((c) => c.scheduledAt && new Date(c.scheduledAt).getTime() > now.getTime() && (c.status === 'ready' || c.status === 'draft'))
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  const nextScheduled = upcoming[0] ?? null;
  const todayLaunches = campaigns.filter((c) => c.scheduledAt && new Date(c.scheduledAt).getTime() >= todayStart && new Date(c.scheduledAt).getTime() < todayStart + 86400000).length;
  const platformCounts = {};
  campaigns.forEach((c) => {
    (c.targets ?? []).forEach((t) => {
      const p = (t.platform ?? '').toLowerCase();
      if (!p) return;
      platformCounts[p] = (platformCounts[p] ?? 0) + 1;
    });
  });
  const topPlatform = Object.entries(platformCounts).sort((a, b) => b[1] - a[1])[0] ?? null;
  const last7Days = [];
  for (let i = 6; i >= 0; i -= 1) {
    const dayStart = todayStart - i * 86400000;
    const dayEnd = dayStart + 86400000;
    const count = campaigns.filter((c) => {
      const t = c.scheduledAt ? new Date(c.scheduledAt).getTime() : new Date(c.createdAt ?? 0).getTime();
      return t >= dayStart && t < dayEnd;
    }).length;
    const date = new Date(dayStart);
    last7Days.push({
      label: ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'][date.getDay()],
      count,
      iso: date.toISOString().slice(0, 10),
    });
  }
  const max7 = Math.max(1, ...last7Days.map((d) => d.count));
  const nextCountdown = nextScheduled ? Math.max(0, new Date(nextScheduled.scheduledAt).getTime() - now.getTime()) : null;
  const formatCountdown = (ms) => {
    if (ms === null) return '—';
    const totalSec = Math.floor(ms / 1000);
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };
  const platformLabel = topPlatform ? (topPlatform[0] === 'youtube' ? 'YouTube' : topPlatform[0] === 'tiktok' ? 'TikTok' : topPlatform[0] === 'instagram' ? 'Instagram' : topPlatform[0]) : '—';
  const platformIcon = topPlatform?.[0] && CAMPAIGN_FLOW_PLATFORMS.includes(topPlatform[0])
    ? renderCampaignPlatformMark(topPlatform[0], 'mission-platform-mark campaign-platform-mark')
    : renderCampaignMark('SP', 'info', 'mission-platform-placeholder');
  const successCircumference = 2 * Math.PI * 36;
  const successOffset = successCircumference * (1 - successRate / 100);
  const campaignOutcomeTotals = campaigns.reduce((acc, campaign) => {
    const summary = summarizeCampaignOutcomes(campaign);
    acc.total += Number(summary.total ?? 0);
    acc.published += Number(summary.published ?? 0);
    acc.failed += Number(summary.failed ?? 0);
    acc.pending += Number(summary.pending ?? 0);
    acc.reauthRequired += Number(summary.reauthRequired ?? 0);
    return acc;
  }, { total: 0, published: 0, failed: 0, pending: 0, reauthRequired: 0 });
  const targetTotalSafe = Math.max(1, campaignOutcomeTotals.total);
  const targetCompletionRate = Math.round((campaignOutcomeTotals.published / targetTotalSafe) * 100);
  const campaignReauthOverview = normalizeCampaignReauthOverview(
    reauthResult.ok ? reauthResult.body?.overview : null,
    campaignOutcomeTotals.reauthRequired,
  );
  const reauthResumeProvider = query.get('reauth') === 'resume'
    ? readCampaignReauthReturnProvider()
    : null;
  if (query.get('reauth') === 'resume') {
    writeCampaignReauthReturnProvider(null);
  }
  const activeCampaignCount = statusTotals.ready + statusTotals.launching;
  const draftReadyCount = statusTotals.draft + statusTotals.ready;
  const campaignStatusCardsHtml = [
    { key: 'draft', label: 'Rascunhos', hint: 'editaveis', mark: 'RA' },
    { key: 'ready', label: 'Prontas', hint: 'aguardando lancamento', mark: 'PR' },
    { key: 'launching', label: 'Enviando', hint: 'fila ativa', mark: 'FL' },
    { key: 'completed', label: 'Concluidas', hint: 'publicadas', mark: 'OK' },
    { key: 'failed', label: 'Falhas', hint: 'precisam de acao', mark: 'ER' },
  ].map((item) => `
    <article class="campaign-control-status-card" data-status="${escapeHtml(item.key)}">
      <span class="campaign-control-status-icon" aria-hidden="true">${renderCampaignMark(item.mark, item.key, 'campaign-control-status-mark')}</span>
      <span class="campaign-control-status-label">${escapeHtml(item.label)}</span>
      <strong data-target="${statusTotals[item.key] ?? 0}">0</strong>
      <small>${escapeHtml(item.hint)}</small>
    </article>
  `).join('');
  const platformStats = CAMPAIGN_FLOW_PLATFORMS
    .map((platform) => ({
      platform,
      label: getCampaignFlowPlatformLabel(platform),
      count: Number(platformCounts[platform] ?? 0),
    }))
    .filter((item) => item.count > 0);
  const maxPlatformCount = Math.max(1, ...platformStats.map((item) => item.count));
  const platformDistributionHtml = platformStats.length > 0
    ? platformStats.map((item) => `
      <div class="campaign-control-platform-row">
        ${renderCampaignPlatformMark(item.platform, 'campaign-control-platform-mark campaign-platform-mark')}
        <span>${escapeHtml(item.label)}</span>
        <div class="campaign-control-platform-track"><span style="--fill:${Math.min(100, (item.count / maxPlatformCount) * 100)}%"></span></div>
        <strong>${formatNumber(item.count)}</strong>
      </div>
    `).join('')
    : `<div class="campaign-control-empty-note">${renderCampaignMark('SP', 'info', 'campaign-control-empty-mark')} Sem destinos conectados nas campanhas desta pagina.</div>`;
  const targetProgressHtml = `
    <div class="campaign-control-target-progress">
      <div class="campaign-control-target-head">
        <span>Destinos publicados</span>
        <strong>${formatNumber(campaignOutcomeTotals.published)} / ${formatNumber(campaignOutcomeTotals.total)}</strong>
      </div>
      <div class="campaign-control-target-track" aria-hidden="true">
        <span class="is-published" style="--fill:${Math.min(100, targetCompletionRate)}%"></span>
        <span class="is-failed" style="--fill:${Math.min(100, (campaignOutcomeTotals.failed / targetTotalSafe) * 100)}%"></span>
      </div>
      <div class="campaign-control-target-foot">
        <span>${formatNumber(campaignOutcomeTotals.pending)} pendentes</span>
        <span>${formatNumber(campaignOutcomeTotals.failed)} com erro</span>
        <span>${formatNumber(campaignOutcomeTotals.reauthRequired)} reconectar</span>
      </div>
    </div>
  `;

  const metricsHtml = [
    { label: 'Campanhas', value: formatNumber(total), hint: `Pagina ${formatNumber(currentPage)} de ${formatNumber(totalPages)}`, tone: 'info', mark: 'CP' },
    { label: 'Concluidas', value: formatNumber(statusTotals.completed), hint: 'Publicadas com sucesso', tone: 'success', mark: 'OK' },
    { label: 'Em envio', value: formatNumber(statusTotals.launching), hint: 'Na fila de publicacao', tone: 'warning', mark: 'FL' },
    { label: 'Com erro', value: formatNumber(statusTotals.failed), hint: 'Precisam de revisao', tone: 'danger', mark: 'ER' },
  ].map((card) => `
    <article class="platform-dashboard-stat campaign-stat-card" data-tone="${escapeHtml(card.tone)}">
      <span class="campaign-stat-icon" aria-hidden="true">${renderCampaignMark(card.mark, card.tone, 'campaign-stat-mark')}</span>
      <span class="platform-dashboard-stat-label">${escapeHtml(card.label)}</span>
      <strong>${escapeHtml(card.value)}</strong>
      <span class="platform-dashboard-stat-detail">${escapeHtml(card.hint)}</span>
    </article>
  `).join('');

  const rows = campaigns.length === 0
    ? '<tr><td colspan="8" class="muted">No campaigns found.</td></tr>'
    : campaigns.map((campaign) => `
      ${(() => {
        const summary = summarizeCampaignOutcomes(campaign);
        const scheduledLabel = campaign.scheduledAt ? formatDate(campaign.scheduledAt) : 'Immediate';
        const mediaAsset = mediaById.get(campaign.videoAssetId);
        const publishFormat = getVideoPublishFormat(mediaAsset ?? {});
        return `
      <tr>
        <td>
          <strong>${escapeHtml(campaign.title)}</strong>
          <div class="muted">${escapeHtml(campaign.videoAssetName ?? campaign.videoAssetId ?? '-')}</div>
          <code>${escapeHtml(campaign.id)}</code>
        </td>
        <td>${statusPill(getVideoPublishFormatLabel(publishFormat))}</td>
        <td>${statusPill(campaign.status)}</td>
        <td>${escapeHtml(scheduledLabel)}</td>
        <td>${formatNumber(campaign.targetCount ?? summary.total)}</td>
        <td>
          <div class="summary-inline">
            <span>Published: ${formatNumber(summary.published)}</span>
            <span>Failed: ${formatNumber(summary.failed)}</span>
            <span>Pending: ${formatNumber(summary.pending)}</span>
            <span>Reauth: ${formatNumber(summary.reauthRequired)}</span>
          </div>
        </td>
        <td>${escapeHtml(formatDate(campaign.createdAt))}</td>
        <td>${campaignActionButtons(campaign)}</td>
      </tr>
    `;
      })()}
    `).join('');

  const previousHref = pageOffset > 0
    ? buildUrl('/workspace/campanhas', {
      status: filters.status,
      search: filters.search,
      limit: pageLimit,
      offset: Math.max(pageOffset - pageLimit, 0),
    })
    : '';
  const nextHref = pageEnd < total
    ? buildUrl('/workspace/campanhas', {
      status: filters.status,
      search: filters.search,
      limit: pageLimit,
      offset: pageOffset + pageLimit,
    })
    : '';
  const campaignsEmptyState = total === 0
    ? renderEmptyStateCard({
        title: 'Nenhuma campanha ainda',
        message: 'Crie sua primeira campanha quando a midia e os destinos estiverem prontos. A pagina vai guiar a fila sem esconder o que falta.',
        tone: 'info',
        actionsHtml: [
          '<a class="button button-primary" data-link href="/workspace/campanhas/nova">Nova campanha</a>',
          '<a class="button button-secondary" data-link href="/workspace/videos">Abrir videos</a>',
          '<a class="button button-secondary" data-link href="/workspace/accounts">Abrir contas</a>',
        ].join(''),
      })
    : campaigns.length === 0
      ? renderEmptyStateCard({
          title: 'Nenhuma campanha encontrada',
          message: 'Ajuste os filtros ou limpe a busca para voltar a ver a fila completa.',
          actionsHtml: '<a class="button button-secondary" data-link href="/workspace/campanhas">Limpar filtros</a>',
        })
      : '';

  const campaignItemsHtml = campaigns.length === 0
    ? ''
    : `<div class="campaign-list campaign-launch-board">${campaigns.map((campaign) => {
        const summary = summarizeCampaignOutcomes(campaign);
        const scheduledLabel = campaign.scheduledAt ? formatDate(campaign.scheduledAt) : 'Imediato';
        const createdLabel = formatDate(campaign.createdAt);
        const mediaAsset = mediaById.get(campaign.videoAssetId);
        const publishFormat = getVideoPublishFormat(mediaAsset ?? {});
        const statusMeta = getCampaignStatusMeta(campaign.status);
        return `
          <article class="campaign-item campaign-command-card" data-status="${escapeHtml(campaign.status)}" data-tone="${escapeHtml(statusMeta.tone)}">
            <div class="campaign-command-icon" aria-hidden="true">${renderCampaignMark(statusMeta.mark, statusMeta.tone, 'campaign-command-status-mark')}</div>
            <div class="campaign-command-main">
              <div class="campaign-command-head">
                <div class="campaign-command-title-block">
                  <span class="campaign-command-kicker">${escapeHtml(statusMeta.label)} - ${escapeHtml(statusMeta.detail)}</span>
                  <p class="campaign-item-title">${escapeHtml(campaign.title || 'Campanha sem titulo')}</p>
                </div>
                ${renderCampaignPlatformStack(campaign)}
              </div>
              <div class="campaign-command-meta-grid">
                <div><span>Midia</span><strong>${escapeHtml(campaign.videoAssetName ?? campaign.videoAssetId ?? '-')}</strong></div>
                <div><span>Formato</span><strong>${escapeHtml(getVideoPublishFormatLabel(publishFormat))}</strong></div>
                <div><span>Agenda</span><strong>${escapeHtml(scheduledLabel)}</strong></div>
                <div><span>Destinos</span><strong>${formatNumber(campaign.targetCount ?? summary.total)}</strong></div>
                <div><span>Criada</span><strong>${escapeHtml(createdLabel)}</strong></div>
                <div><span>ID</span><strong><code>${escapeHtml(campaign.id)}</code></strong></div>
              </div>
              ${renderCampaignOutcomeChips(summary)}
              ${renderCampaignProgress(summary)}
            </div>
            <div class="campaign-item-actions">${campaignActionButtons(campaign)}</div>
          </article>
        `;
      }).join('')}</div>`;
  const campaignReauthPanelHtml = renderCampaignReauthPanel(campaignReauthOverview, {
    resumeProvider: reauthResumeProvider,
  });

  renderWorkspaceShell({
    title: 'Campanhas',
    subtitle: 'Controle rascunhos, filas, agendamentos e resultados de publicacao.',
    actionsHtml: `
      <div class="inline-actions cc-hero-actions">
        <a class="cc-refresh-btn" data-link href="${escapeHtml(buildUrl('/workspace/campanhas', {
          status: filters.status,
          search: filters.search,
          limit: pageLimit,
          offset: pageOffset,
        }))}" title="Atualizar lista">
          <span class="cc-refresh-indicator" aria-hidden="true"></span>
          <span>Atualizar</span>
        </a>
      </div>
    `,
    contentHtml: `
      <div class="campaign-cockpit-row">
      <section class="campaign-control-panel" id="campaign-control-panel">
        <div class="campaign-control-bg-grid" aria-hidden="true"></div>

        <header class="campaign-control-header">
          <div class="campaign-control-header-main">
            <span class="campaign-control-kicker">
              <span class="campaign-control-dot"></span>
              CENTRO DE CAMPANHAS
            </span>
            <span class="campaign-control-clock">AO VIVO - ${escapeHtml(liveClock)}</span>
          </div>
          <div class="campaign-control-legend">
            <span data-legend="draft"><span class="legend-swatch"></span>Rascunho</span>
            <span data-legend="ready"><span class="legend-swatch"></span>Pronta</span>
            <span data-legend="launching"><span class="legend-swatch"></span>Enviando</span>
            <span data-legend="completed"><span class="legend-swatch"></span>Concluida</span>
            <span data-legend="failed"><span class="legend-swatch"></span>Falhou</span>
          </div>
        </header>

        <div class="campaign-control-grid">
          <div class="campaign-control-command">
            <div class="campaign-control-command-top">
              <span class="campaign-control-command-icon" aria-hidden="true">${renderCampaignMark('NOVO', 'info', 'campaign-control-command-mark')}</span>
              <div class="campaign-control-command-copy">
                <span>Novo fluxo</span>
                <h2>Criar campanha</h2>
                <p>Campanhas por etapas com plataformas, midias, destinos, metadados e revisao antes do lancamento.</p>
              </div>
            </div>
            <a class="campaign-control-create-btn" data-link href="/workspace/campanhas/nova" title="Criar nova campanha">
              <span>Comecar campanha</span>
              <span class="campaign-text-arrow" aria-hidden="true"></span>
            </a>
            <div class="campaign-control-command-metrics">
              <span><strong data-target="${total}">0</strong> campanhas</span>
              <span><strong data-target="${activeCampaignCount}">0</strong> ativas</span>
              <span><strong data-target="${draftReadyCount}">0</strong> editaveis</span>
            </div>
          </div>

          <div class="campaign-control-intel">
            <div class="campaign-control-status-grid">
              ${campaignStatusCardsHtml}
            </div>
            <div class="campaign-control-pulse">
              <div class="pulse-head">
                <span>PULSO DA FILA - 30 SINAIS</span>
                <span class="pulse-now">+${formatNumber(statusTotals.launching)}</span>
              </div>
              <svg class="pulse-chart" viewBox="0 0 600 140" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <linearGradient id="pulseFill" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="currentColor" stop-opacity="0.6" />
                    <stop offset="100%" stop-color="currentColor" stop-opacity="0" />
                  </linearGradient>
                  <linearGradient id="pulseStroke" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="currentColor" />
                    <stop offset="100%" class="pulse-stroke-end" stop-color="var(--cc-accent2)" />
                  </linearGradient>
                </defs>
                ${buildPulseChart(statusTotals)}
              </svg>
              <div class="pulse-ticks">
                ${['RASCUNHO','PRONTA','ENVIANDO','OK','ERRO'].map((label, i) => {
                  const key = ['draft','ready','launching','completed','failed'][i];
                  return `<div class="pulse-tick" data-status="${key}">
                    <span class="pulse-tick-label">${label}</span>
                    <strong class="pulse-tick-val" data-target="${statusTotals[key] ?? 0}">0</strong>
                    <div class="pulse-tick-bar"><div class="pulse-tick-fill" style="--fill:${Math.min(100, (statusTotals[key] ?? 0) / Math.max(1, total) * 100)}%"></div></div>
                  </div>`;
                }).join('')}
              </div>
            </div>
            <div class="campaign-control-insight-grid">
              <div class="campaign-control-mini-panel">
                <div class="campaign-control-mini-head">
                  <span>Plataformas</span>
                  <strong>${topPlatform ? escapeHtml(platformLabel) : 'Sem lider'}</strong>
                </div>
                <div class="campaign-control-platform-list">
                  ${platformDistributionHtml}
                </div>
              </div>
              <div class="campaign-control-mini-panel">
                <div class="campaign-control-mini-head">
                  <span>Publicacao</span>
                  <strong>${formatNumber(targetCompletionRate)}%</strong>
                </div>
                ${targetProgressHtml}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="mission-insights" id="mission-insights" data-next-iso="${nextScheduled ? escapeHtml(nextScheduled.scheduledAt) : ''}">
        <div class="mission-insights-bg" aria-hidden="true">
          <div class="mission-insights-grid"></div>
        </div>
        <header class="mission-insights-head">
          <span class="mission-insights-kicker"><span class="mission-insights-dot"></span> INTELIGENCIA DA FILA</span>
          <span class="mission-insights-clock">${escapeHtml(liveClock)}</span>
        </header>

        <div class="mission-insights-hero">
          <svg class="mission-success-ring" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" stroke-opacity="0.15" stroke-width="6" />
            <circle class="mission-success-arc" cx="40" cy="40" r="36" fill="none"
              stroke="currentColor" stroke-width="6" stroke-linecap="round"
              stroke-dasharray="${successCircumference}"
              stroke-dashoffset="${successCircumference}"
              data-target-offset="${successOffset}"
              transform="rotate(-90 40 40)" />
          </svg>
          <div class="mission-success-info">
            <span class="mission-success-label">Taxa de sucesso</span>
            <strong class="mission-success-value" data-target-rate="${successRate}">0%</strong>
            <span class="mission-success-detail">${formatNumber(statusTotals.completed)} ok - ${formatNumber(statusTotals.failed)} erro</span>
          </div>
        </div>

        <div class="mission-insights-tiles">
          <button type="button" class="mission-tile mission-tile-countdown" ${nextScheduled ? `data-link-href="/workspace/campanhas/${escapeHtml(nextScheduled.id)}"` : 'disabled'}>
            <div class="mission-tile-icon">${renderCampaignMark('D+', 'processing', 'mission-tile-mark')}</div>
            <div class="mission-tile-info">
              <span class="mission-tile-label">Proximo envio</span>
              <strong class="mission-tile-value" id="mission-countdown" data-countdown-ms="${nextCountdown ?? ''}">${nextScheduled ? escapeHtml(formatCountdown(nextCountdown)) : 'Sem fila'}</strong>
              <span class="mission-tile-detail">${nextScheduled ? escapeHtml((nextScheduled.title ?? '').slice(0, 24)) : 'Agende uma campanha'}</span>
            </div>
          </button>

          <button type="button" class="mission-tile" data-link-href="/workspace/campanhas?status=launching">
            <div class="mission-tile-icon">${renderCampaignMark('HJ', 'success', 'mission-tile-mark')}</div>
            <div class="mission-tile-info">
              <span class="mission-tile-label">Hoje</span>
              <strong class="mission-tile-value" data-counter="${todayLaunches}">0</strong>
              <span class="mission-tile-detail">envios agendados</span>
            </div>
          </button>

          <div class="mission-tile mission-tile-static">
            <div class="mission-tile-icon">${platformIcon}</div>
            <div class="mission-tile-info">
              <span class="mission-tile-label">Plataforma lider</span>
              <strong class="mission-tile-value">${escapeHtml(platformLabel)}</strong>
              <span class="mission-tile-detail">${topPlatform ? `${formatNumber(topPlatform[1])} destinos` : 'Sem dados ainda'}</span>
            </div>
          </div>

          <div class="mission-tile mission-tile-static">
            <div class="mission-tile-icon">${renderCampaignMark('AT', 'info', 'mission-tile-mark')}</div>
            <div class="mission-tile-info">
              <span class="mission-tile-label">Ativas</span>
              <strong class="mission-tile-value" data-counter="${statusTotals.launching + statusTotals.ready}">0</strong>
              <span class="mission-tile-detail">no pipeline</span>
            </div>
          </div>
        </div>

        <div class="mission-insights-spark">
          <div class="mission-spark-head">
            <span>ULTIMOS 7 DIAS</span>
            <span class="mission-spark-total">${formatNumber(last7Days.reduce((sum, d) => sum + d.count, 0))} no total</span>
          </div>
          <div class="mission-spark-bars">
            ${last7Days.map((d) => `
              <div class="mission-spark-bar" data-count="${d.count}" title="${escapeHtml(d.iso)}: ${d.count} campaign${d.count === 1 ? '' : 's'}">
                <div class="mission-spark-bar-fill" style="--h:${(d.count / max7) * 100}%"></div>
                <span class="mission-spark-bar-label">${escapeHtml(d.label)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </section>
      </div>

      ${campaignReauthPanelHtml}

      ${campaignsEmptyState}
      <section class="platform-surface platform-dashboard-panel">
        <div class="platform-dashboard-panel-head">
          <div>
            <span class="platform-dashboard-kicker">Painel de lancamento</span>
            <h3>Campanhas (${formatNumber(total)})</h3>
          </div>
          <div class="inline-actions">
            ${previousHref
              ? `<a class="button button-secondary" data-link href="${previousHref}">Anterior</a>`
              : '<button class="button button-secondary" type="button" disabled>Anterior</button>'}
            ${nextHref
              ? `<a class="button button-secondary" data-link href="${nextHref}">Proxima</a>`
              : '<button class="button button-secondary" type="button" disabled>Proxima</button>'}
          </div>
        </div>
        <form id="campaign-filter-form" class="filter-bar campaign-launch-toolbar">
          <label>
            Status
            <select name="status">
              <option value="">Todos</option>
              <option value="draft" ${filters.status === 'draft' ? 'selected' : ''}>Rascunho</option>
              <option value="ready" ${filters.status === 'ready' ? 'selected' : ''}>Pronta</option>
              <option value="launching" ${filters.status === 'launching' ? 'selected' : ''}>Enviando</option>
              <option value="completed" ${filters.status === 'completed' ? 'selected' : ''}>Concluida</option>
              <option value="failed" ${filters.status === 'failed' ? 'selected' : ''}>Falhou</option>
            </select>
          </label>
          <label>
            Busca
            <input name="search" value="${escapeHtml(filters.search)}" placeholder="Titulo contem..." />
          </label>
          <label>
            Por pagina
            <input name="limit" type="number" min="1" max="200" value="${escapeHtml(pageLimit)}" />
          </label>
          <div class="inline-actions cc-filter-actions">
            <button class="cc-apply-btn" type="submit" title="Aplicar filtros">
              <span class="cc-apply-icon" aria-hidden="true"><img class="cc-filter-artwork-image" src="/assets/icons/FL_aplicar_filtros.svg" alt="" decoding="async" draggable="false" /></span>
              <span class="cc-apply-label">Aplicar filtros</span>
            </button>
            <a class="cc-clear-btn" data-link href="/workspace/campanhas" title="Limpar filtros">
              <span class="cc-clear-mark" aria-hidden="true"><img class="cc-filter-artwork-image" src="/assets/icons/X_limpar_filtros.svg" alt="" decoding="async" draggable="false" /></span>
              Limpar
            </a>
          </div>
        </form>
        ${campaignItemsHtml}
        ${total > 0 ? `<p class="muted">Mostrando ${formatNumber(pageStart)}-${formatNumber(pageEnd)} de ${formatNumber(total)} campanhas.</p>` : ''}
      </section>
    `,
  });

  const normalizeOutcomeLabel = (selector, label) => {
    document.querySelectorAll(selector).forEach((node) => {
      const count = (node.textContent ?? '').replace(/[^\d]/g, '') || '0';
      node.textContent = `${label} ${count}`;
    });
  };
  normalizeOutcomeLabel('.campaign-item-outcome .ok', 'Published');
  normalizeOutcomeLabel('.campaign-item-outcome .fail', 'Failed');
  normalizeOutcomeLabel('.campaign-item-outcome .pending', 'Pending');
  normalizeOutcomeLabel('.campaign-item-outcome .warn', 'Reauth');

  const filterForm = document.getElementById('campaign-filter-form');
  filterForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(filterForm);
    const href = buildUrl('/workspace/campanhas', {
      status: String(data.get('status') ?? ''),
      search: String(data.get('search') ?? ''),
      limit: String(data.get('limit') ?? ''),
      offset: '0',
    });
    navigate(href);
  });

  document.querySelectorAll('[data-action="campaign-reauth-oauth"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const platform = button.getAttribute('data-platform');
      if (!CAMPAIGN_FLOW_PLATFORMS.includes(platform)) return;

      clearUiNotice();
      setButtonBusy(button, true, 'Reconectando...');
      const result = platform === 'youtube'
        ? await api.startYouTubeOauth()
        : platform === 'tiktok'
          ? await api.startTikTokOauth()
          : await api.startInstagramOauth();
      setButtonBusy(button, false);

      if (!result.ok) {
        setUiNotice('error', `Falha ao reconectar ${getCampaignFlowPlatformLabel(platform)}`, result.error);
        await renderCampaignsPage();
        return;
      }

      const redirectUrl = result.body?.redirectUrl;
      if (!redirectUrl) {
        setUiNotice('error', `Falha ao reconectar ${getCampaignFlowPlatformLabel(platform)}`, 'OAuth redirect URL nao retornou pela API.');
        await renderCampaignsPage();
        return;
      }

      writePendingOauthProvider(platform);
      writeCampaignReauthReturnProvider(platform);
      window.location.assign(redirectUrl);
    });
  });

  document.querySelectorAll('[data-action="retry-reauth-required"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const confirmed = await showConfirmDialog({
        title: 'Tentar novamente destinos reconectados?',
        message: 'Todos os destinos com REAUTH_REQUIRED e job falhado serao reenfileirados. Se alguma conta ainda nao foi reconectada, ela pode falhar novamente.',
        confirmLabel: 'Tentar novamente',
        tone: 'warning',
      });
      if (!confirmed) return;

      setButtonBusy(button, true, 'Reenfileirando...');
      const response = await api.retryReauthRequired();
      setButtonBusy(button, false);
      if (!response.ok) {
        setUiNotice('error', 'Retry em lote falhou', response.error);
        await renderCampaignsPage();
        return;
      }

      const retried = Number(response.body?.retried ?? response.body?.jobs?.length ?? 0);
      const skipped = Number(response.body?.skipped ?? 0);
      const tone = retried > 0 ? 'success' : 'warning';
      setUiNotice(
        tone,
        retried > 0 ? 'Destinos reenfileirados' : 'Nenhum destino reenfileirado',
        `${formatNumber(retried)} destinos voltaram para a fila. ${formatNumber(skipped)} ficaram pendentes de revisao.`,
      );
      await renderCampaignsPage();
    });
  });

  document.querySelectorAll('[data-action="mark-ready"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const campaignId = button.getAttribute('data-campaign-id');
      if (!campaignId) return;
      setButtonBusy(button, true, 'Saving...');
      const response = await api.markReady(campaignId);
      setButtonBusy(button, false);
      if (!response.ok) {
        setUiNotice('error', 'Unable to mark ready', response.error);
        await renderCampaignsPage();
        return;
      }
      setUiNotice('success', 'Campaign updated', 'The campaign is now ready to launch.');
      await renderCampaignsPage();
    });
  });

  document.querySelectorAll('[data-action="launch-campaign"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const campaignId = button.getAttribute('data-campaign-id');
      if (!campaignId) return;
      setButtonBusy(button, true, 'Launching...');
      const response = await api.launch(campaignId);
      setButtonBusy(button, false);
      if (!response.ok) {
        setUiNotice('error', 'Launch failed', response.error);
        await renderCampaignsPage();
        return;
      }
      setUiNotice('success', 'Campanha lancada', 'O lancamento comecou para a campanha selecionada.');
      await renderCampaignsPage();
    });
  });

  document.querySelectorAll('[data-action="delete-campaign"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const campaignId = button.getAttribute('data-campaign-id');
      if (!campaignId) return;
      const confirmed = await showConfirmDialog({
        title: 'Excluir campanha',
        message: 'Isso vai remover permanentemente a campanha selecionada da lista.',
        confirmLabel: 'Excluir campanha',
        tone: 'warning',
      });
      if (!confirmed) return;
      setButtonBusy(button, true, 'Excluindo...');
      const response = await api.deleteCampaign(campaignId);
      setButtonBusy(button, false);
      if (!response.ok) {
        setUiNotice('error', 'Falha ao excluir', response.error);
        await renderCampaignsPage();
        return;
      }
      setUiNotice('success', 'Campanha excluida', 'A campanha foi removida com sucesso.');
      await renderCampaignsPage();
    });
  });

  animateCampaignControl();

  document.querySelectorAll('[data-action="clone-campaign"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const campaignId = button.getAttribute('data-campaign-id');
      if (!campaignId) return;
      const values = await showFormDialog({
        title: 'Clone campaign',
        message: 'You can leave the title empty to use the default clone naming.',
        confirmLabel: 'Create clone',
        tone: 'info',
        fields: [
          { name: 'title', label: 'Optional clone title', value: '', placeholder: 'Leave blank for default' },
        ],
      });
      if (values === null) return;
      const title = String(values.title ?? '');
      setButtonBusy(button, true, 'Cloning...');
      const response = await api.clone(campaignId, title.trim() || undefined);
      setButtonBusy(button, false);
      if (!response.ok) {
        setUiNotice('error', 'Clone failed', response.error);
        await renderCampaignsPage();
        return;
      }
      const newId = response.body?.campaign?.id;
      if (newId) {
        setUiNotice('success', 'Campaign cloned', 'The cloned campaign is ready for review.');
        navigate(`/workspace/campanhas/${encodeURIComponent(newId)}`);
        return;
      }
      await renderCampaignsPage();
    });
  });
}

const CAMPAIGN_FLOW_STORAGE_KEY = 'ytmp-campaign-flow-v2';
const CAMPAIGN_FLOW_STEPS = [
  { number: 1, label: 'Plataformas', path: '/workspace/campanhas/Etapa1' },
  { number: 2, label: 'Midia', path: '/workspace/campanhas/Etapa2' },
  { number: 3, label: 'Destinos', path: '/workspace/campanhas/Etapa3' },
  { number: 4, label: 'Metadados', path: '/workspace/campanhas/Etapa4' },
  { number: 5, label: 'Revisao', path: '/workspace/campanhas/Etapa5' },
  { number: 6, label: 'Salvar', path: '/workspace/campanhas/Etapa6' },
];
const CAMPAIGN_FLOW_PLATFORMS = ['youtube', 'tiktok', 'instagram'];

function getCampaignFlowDefaults() {
  return {
    selectedPlatforms: [],
    sourceType: 'media',
    publishFormat: 'standard',
    videoAssetId: '',
    playlistId: '',
    playlistSequenceMode: 'random',
    playlistRepeatPolicy: 'no-repeat',
    playlistStrictFormat: true,
    selectedDestinationRefs: [],
    scheduledAt: '',
    perTargetPublishAt: {},
    schedulePatternEnabled: false,
    scheduleTimesPerDay: 1,
    scheduleHourAuto: true,
    scheduleHours: [],
    scheduleDays: [],
    title: '',
    randomTitleEnabled: false,
    titleSeed: '',
    videoTitle: '',
    videoDescription: '',
    tags: '',
    privacy: '',
    youtubePlaylistId: '',
    thumbnailAssetId: '',
    thumbnailAssistantEnabled: false,
    thumbnailCoverPlatforms: [],
    instagramCaption: '',
    instagramShareToFeed: true,
  };
}

function readCampaignFlowState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CAMPAIGN_FLOW_STORAGE_KEY) || '{}');
    return {
      ...getCampaignFlowDefaults(),
      ...(parsed && typeof parsed === 'object' ? parsed : {}),
      selectedPlatforms: Array.isArray(parsed?.selectedPlatforms) ? parsed.selectedPlatforms : [],
      selectedDestinationRefs: Array.isArray(parsed?.selectedDestinationRefs) ? parsed.selectedDestinationRefs : [],
      thumbnailCoverPlatforms: Array.isArray(parsed?.thumbnailCoverPlatforms) ? parsed.thumbnailCoverPlatforms : [],
      perTargetPublishAt: parsed?.perTargetPublishAt && typeof parsed.perTargetPublishAt === 'object' ? parsed.perTargetPublishAt : {},
      scheduleHours: Array.isArray(parsed?.scheduleHours) ? parsed.scheduleHours : [],
      scheduleDays: Array.isArray(parsed?.scheduleDays) ? parsed.scheduleDays : [],
    };
  } catch {
    return getCampaignFlowDefaults();
  }
}

function writeCampaignFlowState(nextState) {
  localStorage.setItem(CAMPAIGN_FLOW_STORAGE_KEY, JSON.stringify({
    ...getCampaignFlowDefaults(),
    ...nextState,
  }));
}

function patchCampaignFlowState(patch) {
  const next = {
    ...readCampaignFlowState(),
    ...patch,
  };
  writeCampaignFlowState(next);
  return next;
}

function resetCampaignFlowState() {
  localStorage.removeItem(CAMPAIGN_FLOW_STORAGE_KEY);
}

function getCampaignFlowPlatformLabel(platform) {
  if (platform === 'youtube') return 'YouTube';
  if (platform === 'tiktok') return 'TikTok';
  if (platform === 'instagram') return 'Instagram';
  return 'Plataforma';
}

function getCampaignFlowPlatformMeta(platform) {
  if (platform === 'youtube') {
    return {
      tone: 'youtube',
      title: 'YouTube',
      body: 'Canais, playlists do canal, thumbnails e privacidade de video.',
      helper: 'Ideal para videos longos, Shorts e publicacoes recorrentes.',
    };
  }
  if (platform === 'tiktok') {
    return {
      tone: 'tiktok',
      title: 'TikTok',
      body: 'Contas conectadas para videos curtos e distribuicao rapida.',
      helper: 'Pode exigir plano com acesso a TikTok no momento de salvar.',
    };
  }
  return {
    tone: 'instagram',
    title: 'Instagram',
    body: 'Contas conectadas para Reels, caption e envio para feed.',
    helper: 'Bom para reaproveitar Shorts/Reels com caption dedicada.',
  };
}

function campaignFlowDestinationRef(destination) {
  return `${String(destination?.platform ?? 'youtube')}:${String(destination?.destinationId ?? destination?.id ?? '')}`;
}

function campaignFlowParseDestinationRef(ref) {
  const value = String(ref ?? '');
  const index = value.indexOf(':');
  if (index === -1) return { platform: 'youtube', destinationId: value };
  return {
    platform: value.slice(0, index),
    destinationId: value.slice(index + 1),
  };
}

function campaignFlowFindDestination(destinations, ref) {
  const parsed = campaignFlowParseDestinationRef(ref);
  return destinations.find((destination) =>
    String(destination.platform) === parsed.platform &&
    String(destination.destinationId) === parsed.destinationId);
}

function isPaidCampaignPlan(account) {
  const plan = String(account?.plan ?? '').toUpperCase();
  return Boolean(plan && plan !== 'FREE');
}

function isCampaignFlowPlatformAllowedByPlan(platform, account) {
  const plan = String(account?.plan ?? 'FREE').toUpperCase();
  if (platform === 'youtube') return true;
  return plan === 'PRO' || plan === 'PREMIUM';
}

function campaignFlowToIso(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return undefined;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function campaignFlowFormatLocalDate(value) {
  if (!value) return 'Imediato';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString(getActiveLocale());
}

function campaignFlowSelectedVideos(videos, flowState) {
  return videos.filter((video) => {
    const format = getVideoPublishFormat(video);
    return flowState.publishFormat === 'short' ? format === 'short' : format === 'standard';
  });
}

function countCampaignFlowWords(value) {
  const matches = String(value ?? '')
    .normalize('NFKC')
    .match(/[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*/gu);
  return matches ? matches.length : 0;
}

function campaignFlowCoverPlatformLabel(platform) {
  return getCampaignFlowPlatformLabel(platform);
}

function campaignFlowCoverFormat(platform) {
  if (platform === 'youtube') return 'YouTube: thumbnail horizontal 16:9, alto contraste e leitura forte em telas pequenas.';
  if (platform === 'tiktok') return 'TikTok: capa vertical 9:16, assunto centralizado e texto dentro de area segura.';
  if (platform === 'instagram') return 'Instagram: capa para Reels/feed, vertical 9:16 com centro seguro para corte 1:1.';
  return 'Capa de video adaptada para a plataforma selecionada.';
}

function getCampaignFlowThumbnailAssistantGate(flowState) {
  const baseWordCount = countCampaignFlowWords(flowState.titleSeed);
  const baseReady = baseWordCount >= 12;
  const coverPlatforms = (Array.isArray(flowState.thumbnailCoverPlatforms) ? flowState.thumbnailCoverPlatforms : [])
    .filter((platform) => CAMPAIGN_FLOW_PLATFORMS.includes(platform));
  const hasCoverPlatform = coverPlatforms.length > 0;
  const hasCampaignPlatform = Array.isArray(flowState.selectedPlatforms) && flowState.selectedPlatforms.length > 0;
  const hasDestination = Array.isArray(flowState.selectedDestinationRefs) && flowState.selectedDestinationRefs.length > 0;
  const canEnable = baseReady && hasCoverPlatform && hasCampaignPlatform && hasDestination;
  let message = '';
  if (!baseReady) {
    message = 'Preencha a Base para título aleatório com no mínimo 12 palavras para gerar um briefing melhor.';
  } else if (!hasCoverPlatform) {
    message = 'Selecione pelo menos uma plataforma: YouTube, TikTok ou Instagram.';
  } else if (!hasCampaignPlatform || !hasDestination) {
    message = 'Selecione pelo menos uma plataforma e um destino antes de ativar o briefing de capa.';
  }
  return {
    baseReady,
    baseWordCount,
    canEnable,
    coverPlatforms,
    hasCoverPlatform,
    hasCampaignPlatform,
    hasDestination,
    message,
  };
}

function buildCampaignFlowThumbnailBrief(context, flowState) {
  const selectedVideo = context.videos.find((video) => video.id === flowState.videoAssetId);
  const selectedPlaylist = context.playlists.find((playlist) => playlist.id === flowState.playlistId);
  const gate = getCampaignFlowThumbnailAssistantGate(flowState);
  const destinationNames = flowState.selectedDestinationRefs
    .map((ref) => campaignFlowFindDestination(context.destinations, ref))
    .filter(Boolean)
    .map((destination) => destination.destinationLabel ?? destination.title ?? destination.destinationId)
    .slice(0, 5);
  const campaignTitle = flowState.titleSeed.trim();
  const platformFormats = gate.coverPlatforms.map(campaignFlowCoverFormat);
  const sourceLabel = flowState.sourceType === 'playlist'
    ? `playlist "${selectedPlaylist?.name ?? 'selecionada'}"`
    : `video "${selectedVideo?.original_name ?? 'selecionado'}"`;
  const scheduleLabel = flowState.schedulePatternEnabled
    ? `${flowState.scheduleTimesPerDay} disparo${Number(flowState.scheduleTimesPerDay) === 1 ? '' : 's'} por dia com horarios ${flowState.scheduleHourAuto ? 'automaticos' : 'definidos manualmente'}`
    : (flowState.scheduledAt ? `agendado para ${campaignFlowFormatLocalDate(flowState.scheduledAt)}` : 'publicacao manual ou imediata');

  return [
    'Brief de capa de video para campanha automatizada.',
    '',
    `Base principal obrigatoria: ${campaignTitle}.`,
    'Conceito central: automacao de postagens automaticas para criadores e equipes que publicam em escala.',
    `Origem do conteudo: ${sourceLabel}.`,
    `Mecanica de automacao: ${scheduleLabel}.`,
    destinationNames.length > 0 ? `Canais/destinos relacionados: ${destinationNames.join(', ')}.` : 'Canais/destinos relacionados: YouTube.',
    `Plataformas da capa: ${gate.coverPlatforms.map(campaignFlowCoverPlatformLabel).join(', ')}.`,
    '',
    'Formatos a considerar:',
    ...platformFormats.map((format) => `- ${format}`),
    '',
    'Direcao visual recomendada para capa de video:',
    '- Mostre um painel de publicacao automatica, fila de posts, calendario, icones de upload e sinal de fluxo continuo.',
    '- Estilo profissional de SaaS/creator tools, moderno, claro, premium e confiavel.',
    '- Use contraste forte, foco central nitido e profundidade leve; evite fundo poluido.',
    `- Use como base textual e semantica: "${campaignTitle}".`,
    '- Transforme a base em uma frase curta de capa, com poucas palavras e leitura imediata.',
    '- Nao use logos oficiais do YouTube se nao houver licenca; use uma referencia generica de play/video.',
    '- Nao criar texto pequeno demais, marcas d agua, deformacoes, excesso de elementos ou visual generico de banco de imagem.',
    '',
    'Fluxo no app:',
    '1. Crie a imagem em qualquer editor ou ferramenta de imagem usando este brief.',
    '2. Envie a imagem em Midia como thumbnail.',
    '3. Volte para esta etapa e selecione a imagem no campo Thumbnail.',
  ].join('\n');
}

function getCampaignFlowThumbnailChecklist(context, flowState) {
  const selectedThumbnail = context.thumbnails.find((asset) => asset.id === flowState.thumbnailAssetId);
  const gate = getCampaignFlowThumbnailAssistantGate(flowState);
  const hasAutomationContext = flowState.sourceType === 'playlist' || flowState.schedulePatternEnabled;
  return [
    {
      label: 'Base',
      value: gate.baseReady ? `${formatNumber(gate.baseWordCount)} palavras` : `${formatNumber(gate.baseWordCount)}/12 palavras`,
      state: gate.baseReady ? 'ready' : 'attention',
    },
    {
      label: 'Plataformas',
      value: gate.hasCoverPlatform ? gate.coverPlatforms.map(campaignFlowCoverPlatformLabel).join(', ') : 'Nenhuma capa selecionada',
      state: gate.hasCoverPlatform ? 'ready' : 'pending',
    },
    {
      label: 'Contexto',
      value: hasAutomationContext ? 'Automacao visivel' : 'Mostre o fluxo de publicacao',
      state: hasAutomationContext ? 'ready' : 'attention',
    },
    {
      label: 'Arquivo',
      value: selectedThumbnail ? selectedThumbnail.original_name : 'Thumbnail ainda nao selecionada',
      state: selectedThumbnail ? 'ready' : 'pending',
    },
  ];
}

function renderCampaignAutomationGuide(context, flowState) {
  const playlistAutomationOn = flowState.sourceType === 'playlist';
  const scheduleAutomationOn = playlistAutomationOn && flowState.schedulePatternEnabled;
  const titleAutomationOn = scheduleAutomationOn && flowState.randomTitleEnabled;
  const thumbnailGate = getCampaignFlowThumbnailAssistantGate(flowState);
  const thumbnailAssistantOn = flowState.thumbnailAssistantEnabled && thumbnailGate.canEnable;
  const automationItems = [
    {
      label: 'Videos',
      state: playlistAutomationOn ? 'active' : 'manual',
      value: playlistAutomationOn ? 'Playlist automatica' : 'Midia manual',
    },
    {
      label: 'Agenda',
      state: scheduleAutomationOn ? 'active' : 'manual',
      value: scheduleAutomationOn ? 'Padrao aleatorio' : (flowState.scheduledAt ? 'Data fixa' : 'Manual'),
    },
    {
      label: 'Titulos',
      state: titleAutomationOn ? 'active' : 'manual',
      value: titleAutomationOn ? 'Gerados por disparo' : 'Titulo fixo',
    },
    {
      label: 'Thumbnail',
      state: thumbnailAssistantOn ? 'active' : thumbnailGate.hasCoverPlatform ? 'available' : 'locked',
      value: thumbnailAssistantOn
        ? 'Briefing pronto'
        : thumbnailGate.hasCoverPlatform
          ? 'Aguardando base'
          : 'Escolha capa',
    },
  ];

  return `
    <section class="campaign-automation-guide" aria-label="Automacao da campanha">
      <div class="campaign-automation-guide-head">
        <span class="campaign-flow-eyebrow">Automacao</span>
        <strong>${scheduleAutomationOn ? 'Publicacao automatica ativa' : 'Configure a automacao por etapas'}</strong>
      </div>
      <div class="campaign-automation-guide-list">
        ${automationItems.map((item) => `
          <div class="campaign-automation-guide-item" data-state="${item.state}">
            <span>${escapeHtml(item.label)}</span>
            <strong>${escapeHtml(item.value)}</strong>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

async function loadCampaignFlowContext() {
  const [mediaResult, destinationsResult, playlistsResult, planResult] = await Promise.all([
    api.media(),
    loadConnectedPublishDestinations(),
    api.playlists(),
    api.accountPlanSummary(),
  ]);

  if (!mediaResult.ok || !destinationsResult.ok) {
    const failing = !mediaResult.ok ? mediaResult : destinationsResult;
    return { ok: false, status: failing.status, error: failing.error };
  }

  if (planResult.ok && planResult.body?.account) {
    state.account = planResult.body.account;
  }

  const assets = Array.isArray(mediaResult.body?.assets) ? mediaResult.body.assets : [];
  return {
    ok: true,
    assets,
    videos: assets.filter((asset) => asset.asset_type === 'video' || asset.asset_type === undefined),
    thumbnails: assets.filter((asset) => asset.asset_type === 'thumbnail'),
    playlists: Array.isArray(playlistsResult.body?.playlists) ? playlistsResult.body.playlists : [],
    destinations: Array.isArray(destinationsResult.destinations) ? destinationsResult.destinations : [],
    account: planResult.ok ? planResult.body?.account : state.account,
  };
}

function renderCampaignFlowStepper(activeStep) {
  return `
    <nav class="campaign-flow-stepper" aria-label="Etapas da campanha">
      ${CAMPAIGN_FLOW_STEPS.map((step) => {
        const stateAttr = step.number === activeStep ? 'active' : step.number < activeStep ? 'done' : 'next';
        return `
          <a class="campaign-flow-step" data-state="${stateAttr}" data-link href="${step.path}">
            <span>${step.number}</span>
            <strong>${escapeHtml(step.label)}</strong>
          </a>
        `;
      }).join('')}
    </nav>
  `;
}

function renderCampaignFlowSummary(context, flowState) {
  const selectedDestinations = flowState.selectedDestinationRefs
    .map((ref) => campaignFlowFindDestination(context.destinations, ref))
    .filter(Boolean);
  const selectedVideo = context.videos.find((video) => video.id === flowState.videoAssetId);
  const selectedPlaylist = context.playlists.find((playlist) => playlist.id === flowState.playlistId);
  const selectedPlatformLabels = flowState.selectedPlatforms.map(getCampaignFlowPlatformLabel);
  return `
    <aside class="campaign-flow-summary" aria-label="Resumo da campanha">
      <div class="campaign-flow-summary-head">
        <span class="campaign-flow-eyebrow">Resumo vivo</span>
        <strong>${escapeHtml(flowState.title || 'Nova campanha')}</strong>
      </div>
      <div class="campaign-flow-summary-grid">
        <div><span>Plano</span><strong>${escapeHtml(context.account?.planLabel ?? context.account?.plan ?? 'Free')}</strong></div>
        <div><span>Tokens</span><strong>${formatNumber(context.account?.tokens ?? 0)}</strong></div>
        <div><span>Plataformas</span><strong>${selectedPlatformLabels.length ? escapeHtml(selectedPlatformLabels.join(', ')) : 'Nenhuma'}</strong></div>
        <div><span>Origem</span><strong>${flowState.sourceType === 'playlist' ? 'Playlist' : 'Midia'}</strong></div>
        <div><span>Formato</span><strong>${escapeHtml(getVideoPublishFormatLabel(flowState.publishFormat))}</strong></div>
        <div><span>Selecionado</span><strong>${escapeHtml(selectedPlaylist?.name ?? selectedVideo?.original_name ?? '-')}</strong></div>
        <div><span>Destinos</span><strong>${formatNumber(selectedDestinations.length)}</strong></div>
        <div><span>Agendamento</span><strong>${flowState.schedulePatternEnabled ? 'Aleatorio' : (flowState.scheduledAt ? 'Data fixa' : 'Manual')}</strong></div>
      </div>
      ${renderCampaignAutomationGuide(context, flowState)}
    </aside>
  `;
}

function renderCampaignFlowLayout(context, flowState, activeStep, bodyHtml) {
  return `
    <section class="campaign-flow">
      <header class="campaign-flow-header">
        <div>
          <span class="campaign-flow-eyebrow">Campanhas</span>
          <h1>Crie uma campanha em etapas claras</h1>
          <p>Plataformas primeiro, depois midia, destinos, agenda, metadados e revisao. O fluxo fica salvo no navegador enquanto voce ajusta.</p>
        </div>
        <a class="button button-secondary" data-link href="/workspace/campanhas">Voltar para campanhas</a>
      </header>
      ${renderCampaignFlowStepper(activeStep)}
      <div class="campaign-flow-body">
        <main class="campaign-flow-main">${bodyHtml}</main>
        ${renderCampaignFlowSummary(context, flowState)}
      </div>
    </section>
  `;
}

function renderCampaignFlowFooter({ backHref, nextHref, nextDisabled = false, nextLabel = 'Proxima etapa', submit = false }) {
  return `
    <div class="campaign-flow-footer">
      <a class="button button-secondary" data-link href="${escapeHtml(backHref)}">Voltar</a>
      ${submit
        ? `<button class="button button-primary" type="button" data-action="campaign-flow-submit" ${nextDisabled ? 'disabled' : ''}>${escapeHtml(nextLabel)}</button>`
        : `<button class="button button-primary" type="button" data-next-href="${escapeHtml(nextHref)}" ${nextDisabled ? 'disabled' : ''}>${escapeHtml(nextLabel)}</button>`}
    </div>
  `;
}

function attachCampaignFlowNextHandlers(validate) {
  document.querySelectorAll('[data-next-href]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.disabled) return;
      const result = validate?.();
      if (result && result.ok === false) {
        setUiNotice('warning', result.title ?? 'Revise esta etapa', result.message ?? 'Complete os campos obrigatorios antes de continuar.');
        return;
      }
      navigate(button.getAttribute('data-next-href'));
    });
  });
}

function renderCampaignFlowPlatformStep(context, flowState) {
  const byPlatform = Object.fromEntries(CAMPAIGN_FLOW_PLATFORMS.map((platform) => [
    platform,
    context.destinations.filter((destination) => destination.platform === platform),
  ]));
  const selectedSet = new Set(flowState.selectedPlatforms);
  const cards = CAMPAIGN_FLOW_PLATFORMS.map((platform) => {
    const meta = getCampaignFlowPlatformMeta(platform);
    const count = byPlatform[platform]?.length ?? 0;
    const disabled = count === 0;
    const selected = selectedSet.has(platform) && !disabled;
    return `
      <label class="campaign-platform-card" data-tone="${meta.tone}" data-disabled="${disabled ? 'true' : 'false'}" data-selected="${selected ? 'true' : 'false'}">
        <input type="checkbox" data-platform-input="${platform}" value="${platform}" ${selected ? 'checked' : ''} ${disabled ? 'disabled' : ''} />
        <span class="campaign-platform-card-top">
          ${renderPlatformArtwork(platform, 36)}
          <span class="campaign-platform-status">${disabled ? 'Sem conta conectada' : `${formatNumber(count)} destino${count === 1 ? '' : 's'}`}</span>
        </span>
        <strong>${escapeHtml(meta.title)}</strong>
        <span>${escapeHtml(meta.body)}</span>
        <small>${escapeHtml(disabled ? 'Conecte uma conta para habilitar esta opcao.' : meta.helper)}</small>
      </label>
    `;
  }).join('');

  return renderCampaignFlowLayout(context, flowState, 1, `
    <section class="campaign-flow-panel">
      <div class="campaign-flow-panel-head">
        <span class="campaign-flow-eyebrow">Etapa 1</span>
        <h2>Criando nova campanha</h2>
        <p>Escolha uma ou mais plataformas. As plataformas sem conta conectada ficam visiveis, mas bloqueadas.</p>
      </div>
      <div class="campaign-platform-grid">${cards}</div>
      ${renderCampaignFlowFooter({
        backHref: '/workspace/campanhas',
        nextHref: '/workspace/campanhas/Etapa2',
        nextDisabled: flowState.selectedPlatforms.length === 0,
      })}
    </section>
  `);
}

function attachCampaignFlowPlatformStep(flowState) {
  const selected = new Set(flowState.selectedPlatforms);
  const nextButton = document.querySelector('[data-next-href]');
  const sync = () => {
    document.querySelectorAll('[data-platform-input]').forEach((input) => {
      const platform = input.getAttribute('data-platform-input');
      const card = input.closest('.campaign-platform-card');
      if (input.checked) selected.add(platform);
      else selected.delete(platform);
      card?.setAttribute('data-selected', input.checked ? 'true' : 'false');
    });
    const selectedPlatforms = Array.from(selected).filter((platform) => CAMPAIGN_FLOW_PLATFORMS.includes(platform));
    patchCampaignFlowState({
      selectedPlatforms,
      selectedDestinationRefs: flowState.selectedDestinationRefs.filter((ref) => selectedPlatforms.includes(campaignFlowParseDestinationRef(ref).platform)),
    });
    if (nextButton) nextButton.disabled = selectedPlatforms.length === 0;
  };
  document.querySelectorAll('[data-platform-input]').forEach((input) => input.addEventListener('change', sync));
  attachCampaignFlowNextHandlers(() => {
    const next = readCampaignFlowState();
    return next.selectedPlatforms.length === 0
      ? { ok: false, title: 'Escolha uma plataforma', message: 'Selecione pelo menos uma plataforma para liberar a proxima etapa.' }
      : { ok: true };
  });
  sync();
}

function renderCampaignFlowMediaStep(context, flowState) {
  const paidPlan = isPaidCampaignPlan(context.account);
  const sourceType = flowState.sourceType === 'playlist' && paidPlan ? 'playlist' : 'media';
  const videos = campaignFlowSelectedVideos(context.videos, { ...flowState, sourceType });
  const videoCards = videos.length === 0
    ? `<div class="campaign-flow-empty-inline">Nenhum video encontrado para ${escapeHtml(getVideoPublishFormatLabel(flowState.publishFormat))}.</div>`
    : videos.map((video) => `
      <label class="campaign-video-card" data-selected="${flowState.videoAssetId === video.id ? 'true' : 'false'}">
        <input type="radio" name="campaignFlowVideo" value="${escapeHtml(video.id)}" ${flowState.videoAssetId === video.id ? 'checked' : ''} />
        <strong>${escapeHtml(video.original_name)}</strong>
        <span>${escapeHtml(formatDurationSeconds(video.duration_seconds))}</span>
        <small>${escapeHtml(getVideoPublishFormatLabel(getVideoPublishFormat(video)))}</small>
      </label>
    `).join('');
  const playlistOptions = context.playlists.map((playlist) => `
    <option value="${escapeHtml(playlist.id)}" ${flowState.playlistId === playlist.id ? 'selected' : ''}>${escapeHtml(playlist.name)} (${formatNumber(playlist.items?.length ?? 0)} videos)</option>
  `).join('');

  return renderCampaignFlowLayout(context, flowState, 2, `
    <section class="campaign-flow-panel">
      <div class="campaign-flow-panel-head">
        <span class="campaign-flow-eyebrow">Etapa 2</span>
        <h2>Selecionar video</h2>
        <p>Defina se a campanha usa uma midia especifica ou uma playlist automatizada, e se o formato e video longo ou curto.</p>
      </div>
      <div class="campaign-segment-grid">
        <label class="campaign-segment" data-selected="${sourceType === 'media' ? 'true' : 'false'}">
          <input type="radio" name="campaignFlowSource" value="media" ${sourceType === 'media' ? 'checked' : ''} />
          ${renderCampaignMark('MID', 'info', 'campaign-segment-mark')}
          <strong>Midia</strong><span>Escolher um video manualmente.</span>
        </label>
        <label class="campaign-segment" data-selected="${sourceType === 'playlist' ? 'true' : 'false'}" data-disabled="${paidPlan ? 'false' : 'true'}">
          <input type="radio" name="campaignFlowSource" value="playlist" ${sourceType === 'playlist' ? 'checked' : ''} ${paidPlan ? '' : 'disabled'} />
          ${renderCampaignMark('AUTO', 'processing', 'campaign-segment-mark')}
          <strong>Playlist</strong><span>${paidPlan ? 'Escolha automatica a partir de uma playlist.' : 'Liberado somente para planos pagos.'}</span>
        </label>
      </div>
      <div class="campaign-format-row" role="radiogroup" aria-label="Formato do video">
        <label data-selected="${flowState.publishFormat === 'standard' ? 'true' : 'false'}"><input type="radio" name="campaignFlowFormat" value="standard" ${flowState.publishFormat === 'standard' ? 'checked' : ''} />Video longo</label>
        <label data-selected="${flowState.publishFormat === 'short' ? 'true' : 'false'}"><input type="radio" name="campaignFlowFormat" value="short" ${flowState.publishFormat === 'short' ? 'checked' : ''} />Video curto</label>
      </div>
      ${sourceType === 'media' ? `<div class="campaign-video-grid">${videoCards}</div>` : `
        <div class="campaign-flow-field-grid">
          <label class="campaign-flow-field">
            <span>Playlist</span>
            <select id="campaign-flow-playlist-select" ${paidPlan ? '' : 'disabled'}>
              <option value="">Selecionar playlist</option>
              ${playlistOptions}
            </select>
          </label>
        </div>
        <section class="campaign-random-panel">
          <div>
            <span class="campaign-flow-eyebrow">Padrao de agendamento aleatorio</span>
            <h3>Regras de escolha dos videos</h3>
            <p>Este painel fica limitado ao comportamento da playlist. Horarios entram na Etapa 3 e titulos entram na Etapa 4.</p>
          </div>
          <div class="campaign-flow-field-grid">
            <label class="campaign-flow-field">
              <span>Ordem dos videos</span>
              <select id="campaign-flow-playlist-sequence">
                <option value="random" ${flowState.playlistSequenceMode === 'random' ? 'selected' : ''}>Aleatorio</option>
                <option value="sequential" ${flowState.playlistSequenceMode === 'sequential' ? 'selected' : ''}>Sequencial</option>
                <option value="fresh-first" ${flowState.playlistSequenceMode === 'fresh-first' ? 'selected' : ''}>Nao usados primeiro</option>
              </select>
            </label>
            <label class="campaign-flow-field">
              <span>Quando a playlist acabar</span>
              <select id="campaign-flow-playlist-repeat">
                <option value="no-repeat" ${flowState.playlistRepeatPolicy === 'no-repeat' ? 'selected' : ''}>Nao repetir ate todos sairem</option>
                <option value="allow-repeat" ${flowState.playlistRepeatPolicy === 'allow-repeat' ? 'selected' : ''}>Permitir repeticao</option>
                <option value="stop" ${flowState.playlistRepeatPolicy === 'stop' ? 'selected' : ''}>Pausar campanha</option>
              </select>
            </label>
            <label class="campaign-check-row">
              <input id="campaign-flow-playlist-strict-format" type="checkbox" ${flowState.playlistStrictFormat ? 'checked' : ''} />
              <span>Usar apenas videos compativeis com o formato escolhido.</span>
            </label>
          </div>
        </section>
      `}
      ${renderCampaignFlowFooter({
        backHref: '/workspace/campanhas/Etapa1',
        nextHref: '/workspace/campanhas/Etapa3',
        nextDisabled: sourceType === 'playlist' ? (!flowState.playlistId || !paidPlan) : !flowState.videoAssetId,
      })}
    </section>
  `);
}

function attachCampaignFlowMediaStep(context) {
  const collect = () => {
    const current = readCampaignFlowState();
    const sourceType = document.querySelector('input[name="campaignFlowSource"]:checked')?.value ?? current.sourceType;
    const publishFormat = document.querySelector('input[name="campaignFlowFormat"]:checked')?.value ?? current.publishFormat;
    const candidateVideoAssetId = document.querySelector('input[name="campaignFlowVideo"]:checked')?.value ?? (sourceType === 'media' ? current.videoAssetId : '');
    const candidateVideo = context.videos.find((video) => video.id === candidateVideoAssetId);
    const videoAssetId = sourceType === 'media' && candidateVideo && getVideoPublishFormat(candidateVideo) === publishFormat
      ? candidateVideoAssetId
      : '';
    const next = patchCampaignFlowState({
      sourceType,
      publishFormat,
      videoAssetId,
      playlistId: document.querySelector('#campaign-flow-playlist-select')?.value ?? current.playlistId,
      playlistSequenceMode: document.querySelector('#campaign-flow-playlist-sequence')?.value ?? current.playlistSequenceMode,
      playlistRepeatPolicy: document.querySelector('#campaign-flow-playlist-repeat')?.value ?? current.playlistRepeatPolicy,
      playlistStrictFormat: Boolean(document.querySelector('#campaign-flow-playlist-strict-format')?.checked ?? current.playlistStrictFormat),
    });
    const nextButton = document.querySelector('[data-next-href]');
    if (nextButton) nextButton.disabled = next.sourceType === 'playlist' ? (!next.playlistId || !isPaidCampaignPlan(context.account)) : !next.videoAssetId;
  };
  document.querySelectorAll('input[name="campaignFlowSource"], input[name="campaignFlowFormat"], input[name="campaignFlowVideo"]').forEach((input) => {
    input.addEventListener('change', () => {
      collect();
      void renderCampaignFlowPage(2);
    });
  });
  document.querySelectorAll('#campaign-flow-playlist-select, #campaign-flow-playlist-sequence, #campaign-flow-playlist-repeat, #campaign-flow-playlist-strict-format').forEach((input) => {
    input.addEventListener('change', collect);
  });
  attachCampaignFlowNextHandlers(() => {
    const next = readCampaignFlowState();
    if (next.sourceType === 'playlist') {
      if (!isPaidCampaignPlan(context.account)) return { ok: false, title: 'Playlist bloqueada', message: 'Selecao por playlist esta liberada somente para planos pagos.' };
      if (!next.playlistId) return { ok: false, title: 'Escolha uma playlist', message: 'Selecione uma playlist antes de avancar.' };
      return { ok: true };
    }
    return next.videoAssetId ? { ok: true } : { ok: false, title: 'Escolha uma midia', message: 'Selecione um video compativel com o formato escolhido.' };
  });
  collect();
}

function renderCampaignFlowDestinationStep(context, flowState) {
  const selectedPlatforms = new Set(flowState.selectedPlatforms);
  const destinations = context.destinations.filter((destination) => selectedPlatforms.has(destination.platform));
  const selectedRefs = new Set(flowState.selectedDestinationRefs);
  const destinationCards = destinations.length === 0
    ? '<div class="campaign-flow-empty-inline">Nenhum destino ativo encontrado para as plataformas escolhidas.</div>'
    : destinations.map((destination) => {
      const ref = campaignFlowDestinationRef(destination);
      const selected = selectedRefs.has(ref);
      return `
        <article class="campaign-destination-card" data-platform="${escapeHtml(destination.platform)}" data-selected="${selected ? 'true' : 'false'}">
          <label>
            <input type="checkbox" data-destination-input="${escapeHtml(ref)}" ${selected ? 'checked' : ''} />
            <span>
              ${renderPlatformArtwork(destination.platform, 28)}
              <strong>${escapeHtml(destination.destinationLabel ?? destination.title ?? destination.destinationId)}</strong>
              <small>${escapeHtml(getProviderLabel(destination.platform))} - ${escapeHtml(destination.handle ?? destination.email ?? destination.youtubeChannelId ?? destination.destinationId)}</small>
            </span>
          </label>
          <div class="campaign-destination-schedule">
            <span>Horario deste destino</span>
            <input type="datetime-local" data-target-publish-at="${escapeHtml(ref)}" value="${escapeHtml(flowState.perTargetPublishAt?.[ref] ?? '')}" />
          </div>
        </article>
      `;
    }).join('');
  const playlistMode = flowState.sourceType === 'playlist';
  const schedulePanel = playlistMode && flowState.schedulePatternEnabled ? `
    <section class="campaign-random-panel">
      <div>
        <span class="campaign-flow-eyebrow">Padrao de agendamento aleatorio</span>
        <h3>Horarios e dias de disparo</h3>
        <p>Use este bloco para transformar uma playlist em varios disparos. Titulos entram na etapa de metadados.</p>
      </div>
      <div class="campaign-flow-field-grid">
        <label class="campaign-flow-field"><span>Disparos por dia</span><input id="campaign-flow-times-per-day" type="number" min="1" max="48" value="${escapeHtml(flowState.scheduleTimesPerDay)}" /></label>
        <label class="campaign-check-row"><input id="campaign-flow-hour-auto" type="checkbox" ${flowState.scheduleHourAuto ? 'checked' : ''} /><span>Distribuir horarios automaticamente dentro do dia.</span></label>
      </div>
      <div id="campaign-flow-hours-container" class="campaign-hours-container"></div>
      <div class="campaign-flow-date-editor">
        <div id="campaign-flow-date-list" class="campaign-date-list"></div>
        <div class="inline-actions">
          <input id="campaign-flow-date-input" type="date" />
          <button class="button button-secondary" type="button" id="campaign-flow-date-add">Adicionar dia</button>
        </div>
      </div>
    </section>
  ` : '';

  return renderCampaignFlowLayout(context, flowState, 3, `
    <section class="campaign-flow-panel">
      <div class="campaign-flow-panel-head">
        <span class="campaign-flow-eyebrow">Etapa 3</span>
        <h2>Selecionar destinos e agendamentos</h2>
        <p>Agora aparecem somente os canais e contas das plataformas escolhidas na Etapa 1.</p>
      </div>
      <div class="campaign-destination-grid">${destinationCards}</div>
      <section class="campaign-flow-subpanel">
        <div class="campaign-flow-panel-head compact">
          <h3>Entrada na fila</h3>
          <p>Use um horario geral para a campanha e, se precisar, sobrescreva por destino.</p>
        </div>
        <div class="campaign-flow-field-grid">
          <label class="campaign-flow-field"><span>Horario geral da campanha</span><input id="campaign-flow-scheduled-at" type="datetime-local" value="${escapeHtml(flowState.scheduledAt)}" /></label>
          <label class="campaign-check-row" data-disabled="${playlistMode ? 'false' : 'true'}">
            <input id="campaign-flow-schedule-random" type="checkbox" ${flowState.schedulePatternEnabled ? 'checked' : ''} ${playlistMode ? '' : 'disabled'} />
            <span>Usar padrao aleatorio de dias e horarios para playlist.</span>
          </label>
        </div>
      </section>
      ${schedulePanel}
      ${renderCampaignFlowFooter({
        backHref: '/workspace/campanhas/Etapa2',
        nextHref: '/workspace/campanhas/Etapa4',
        nextDisabled: flowState.selectedDestinationRefs.length === 0,
      })}
    </section>
  `);
}

function attachCampaignFlowDestinationStep(flowState) {
  const selectedRefs = new Set(flowState.selectedDestinationRefs);
  const selectedDates = new Set(flowState.scheduleDays);
  const collect = () => {
    document.querySelectorAll('[data-destination-input]').forEach((input) => {
      const ref = input.getAttribute('data-destination-input');
      const card = input.closest('.campaign-destination-card');
      if (input.checked) selectedRefs.add(ref);
      else selectedRefs.delete(ref);
      card?.setAttribute('data-selected', input.checked ? 'true' : 'false');
    });
    const perTargetPublishAt = {};
    document.querySelectorAll('[data-target-publish-at]').forEach((input) => {
      const ref = input.getAttribute('data-target-publish-at');
      if (ref && input.value) perTargetPublishAt[ref] = input.value;
    });
    const hours = Array.from(document.querySelectorAll('input[name="campaignFlowScheduleHour"]')).map((input) => input.value).filter(Boolean);
    const next = patchCampaignFlowState({
      selectedDestinationRefs: Array.from(selectedRefs),
      scheduledAt: document.querySelector('#campaign-flow-scheduled-at')?.value ?? '',
      perTargetPublishAt,
      schedulePatternEnabled: Boolean(document.querySelector('#campaign-flow-schedule-random')?.checked),
      scheduleTimesPerDay: Math.max(1, parseInteger(document.querySelector('#campaign-flow-times-per-day')?.value, 1, 1, 48)),
      scheduleHourAuto: Boolean(document.querySelector('#campaign-flow-hour-auto')?.checked ?? true),
      scheduleHours: hours,
      scheduleDays: Array.from(selectedDates).sort(),
    });
    const nextButton = document.querySelector('[data-next-href]');
    if (nextButton) nextButton.disabled = next.selectedDestinationRefs.length === 0;
  };
  const renderDates = () => {
    const datesList = document.querySelector('#campaign-flow-date-list');
    if (!datesList) return;
    const dates = Array.from(selectedDates).sort();
    datesList.innerHTML = dates.length === 0
      ? '<small class="muted">Nenhum dia selecionado.</small>'
      : dates.map((date) => `<span class="campaign-date-chip">${escapeHtml(date)}<button type="button" data-remove-date="${escapeHtml(date)}">x</button></span>`).join('');
    datesList.querySelectorAll('[data-remove-date]').forEach((button) => {
      button.addEventListener('click', () => {
        selectedDates.delete(button.getAttribute('data-remove-date'));
        collect();
        renderDates();
      });
    });
  };
  const renderHours = () => {
    const hoursContainer = document.querySelector('#campaign-flow-hours-container');
    if (!hoursContainer) return;
    const randomOn = Boolean(document.querySelector('#campaign-flow-schedule-random')?.checked);
    const hourAuto = Boolean(document.querySelector('#campaign-flow-hour-auto')?.checked ?? true);
    if (!randomOn || hourAuto) {
      hoursContainer.innerHTML = `<small class="muted">${hourAuto ? 'Horarios serao distribuidos automaticamente.' : 'Ative o padrao aleatorio para configurar horarios.'}</small>`;
      return;
    }
    const count = Math.max(1, parseInteger(document.querySelector('#campaign-flow-times-per-day')?.value, 1, 1, 48));
    const stored = readCampaignFlowState().scheduleHours;
    hoursContainer.innerHTML = Array.from({ length: count }, (_, index) => `
      <label class="campaign-hour-input"><span>#${index + 1}</span><input type="time" name="campaignFlowScheduleHour" value="${escapeHtml(stored[index] ?? (index === 0 ? '18:00' : ''))}" /></label>
    `).join('');
    hoursContainer.querySelectorAll('input').forEach((input) => input.addEventListener('change', collect));
  };
  document.querySelectorAll('[data-destination-input], [data-target-publish-at], #campaign-flow-scheduled-at').forEach((input) => input.addEventListener('change', collect));
  document.querySelector('#campaign-flow-schedule-random')?.addEventListener('change', () => {
    collect();
    void renderCampaignFlowPage(3);
  });
  document.querySelector('#campaign-flow-times-per-day')?.addEventListener('input', () => {
    collect();
    renderHours();
  });
  document.querySelector('#campaign-flow-hour-auto')?.addEventListener('change', () => {
    collect();
    renderHours();
  });
  document.querySelector('#campaign-flow-date-add')?.addEventListener('click', () => {
    const input = document.querySelector('#campaign-flow-date-input');
    const value = String(input?.value ?? '').trim();
    if (!value) return;
    selectedDates.add(value);
    if (input) input.value = '';
    collect();
    renderDates();
  });
  attachCampaignFlowNextHandlers(() => {
    const next = readCampaignFlowState();
    return next.selectedDestinationRefs.length === 0
      ? { ok: false, title: 'Selecione destinos', message: 'Escolha pelo menos um canal ou conta para continuar.' }
      : { ok: true };
  });
  renderDates();
  renderHours();
  collect();
}

function renderCampaignFlowMetadataStep(context, flowState) {
  const selectedPlatforms = new Set(flowState.selectedPlatforms);
  const thumbnailOptions = context.thumbnails.map((asset) => `
    <option value="${escapeHtml(asset.id)}" ${flowState.thumbnailAssetId === asset.id ? 'selected' : ''}>${escapeHtml(asset.original_name)}</option>
  `).join('');
  const randomTitleAvailable = flowState.sourceType === 'playlist' && flowState.schedulePatternEnabled;
  const randomTitleOn = randomTitleAvailable && flowState.randomTitleEnabled;
  const thumbnailGate = getCampaignFlowThumbnailAssistantGate(flowState);
  const thumbnailAssistantEnabled = flowState.thumbnailAssistantEnabled && thumbnailGate.canEnable;
  const thumbnailBrief = buildCampaignFlowThumbnailBrief(context, flowState);
  const thumbnailChecklist = getCampaignFlowThumbnailChecklist(context, flowState);
  const thumbnailWarnings = [
    !thumbnailGate.baseReady ? 'Preencha a Base para título aleatório com no mínimo 12 palavras para gerar um briefing melhor.' : '',
    !thumbnailGate.hasCoverPlatform ? 'Selecione pelo menos uma plataforma: YouTube, TikTok ou Instagram.' : '',
    (!thumbnailGate.hasCampaignPlatform || !thumbnailGate.hasDestination) ? 'Selecione pelo menos uma plataforma e um destino antes de ativar o briefing de capa.' : '',
  ].filter(Boolean);
  const coverPlatformCards = CAMPAIGN_FLOW_PLATFORMS.map((platform) => {
    const selected = thumbnailGate.coverPlatforms.includes(platform);
    return `
      <label class="campaign-cover-platform" data-selected="${selected ? 'true' : 'false'}">
        <input type="checkbox" name="campaign-flow-cover-platform" data-campaign-flow-meta value="${platform}" ${selected ? 'checked' : ''} />
        <strong>${escapeHtml(campaignFlowCoverPlatformLabel(platform))}</strong>
        <span>${escapeHtml(campaignFlowCoverFormat(platform))}</span>
      </label>
    `;
  }).join('');

  return renderCampaignFlowLayout(context, flowState, 4, `
    <section class="campaign-flow-panel">
      <div class="campaign-flow-panel-head">
        <span class="campaign-flow-eyebrow">Etapa 4</span>
        <h2>Preencher metadados</h2>
        <p>Metadados comuns ficam no topo. Campos especificos aparecem apenas para plataformas selecionadas.</p>
      </div>
      <div class="campaign-flow-field-grid">
        <label class="campaign-flow-field"><span>Titulo da campanha</span><input id="campaign-flow-title" data-campaign-flow-meta value="${escapeHtml(flowState.title)}" placeholder="Ex: Lancamento Shorts Abril" ${randomTitleOn ? 'disabled' : ''} /></label>
        <label class="campaign-check-row" data-disabled="${randomTitleAvailable ? 'false' : 'true'}"><input id="campaign-flow-random-title" data-campaign-flow-meta type="checkbox" ${randomTitleOn ? 'checked' : ''} ${randomTitleAvailable ? '' : 'disabled'} /><span>Gerar titulo da campanha por disparo da playlist.</span></label>
        <label class="campaign-flow-field campaign-flow-field-wide">
          <span>Base para titulo aleatorio</span>
          <input id="campaign-flow-title-seed" data-campaign-flow-meta data-min-words="12" value="${escapeHtml(flowState.titleSeed)}" placeholder="Ex: estrategia completa para automatizar postagens em multiplas plataformas todos os dias" />
          <small class="campaign-field-warning" data-state="${thumbnailGate.baseReady ? 'ok' : 'warning'}">${thumbnailGate.baseReady ? `${formatNumber(thumbnailGate.baseWordCount)} palavras. Base suficiente para briefing.` : `${formatNumber(thumbnailGate.baseWordCount)}/12 palavras. Preencha a Base para título aleatório com no mínimo 12 palavras para gerar um briefing melhor.`}</small>
        </label>
        <label class="campaign-flow-field"><span>Titulo do video</span><input id="campaign-flow-video-title" data-campaign-flow-meta value="${escapeHtml(flowState.videoTitle)}" placeholder="Titulo publicado nas plataformas" /></label>
        <label class="campaign-flow-field">
          <span>Privacidade</span>
          <select id="campaign-flow-privacy" data-campaign-flow-meta>
            <option value="" ${flowState.privacy === '' ? 'selected' : ''}>Padrao da plataforma</option>
            <option value="public" ${flowState.privacy === 'public' ? 'selected' : ''}>public</option>
            <option value="unlisted" ${flowState.privacy === 'unlisted' ? 'selected' : ''}>unlisted</option>
            <option value="private" ${flowState.privacy === 'private' ? 'selected' : ''}>private</option>
          </select>
        </label>
        <label class="campaign-flow-field campaign-flow-field-wide"><span>Descricao do video</span><textarea id="campaign-flow-video-description" data-campaign-flow-meta rows="5" placeholder="Descricao base">${escapeHtml(flowState.videoDescription)}</textarea></label>
        <label class="campaign-flow-field"><span>Tags</span><input id="campaign-flow-tags" data-campaign-flow-meta value="${escapeHtml(flowState.tags)}" placeholder="tag1, tag2, tag3" /></label>
        ${selectedPlatforms.has('youtube') ? `
          <label class="campaign-flow-field"><span>Playlist ID do YouTube</span><input id="campaign-flow-youtube-playlist-id" data-campaign-flow-meta value="${escapeHtml(flowState.youtubePlaylistId)}" placeholder="PL..." /></label>
          <label class="campaign-flow-field"><span>Thumbnail</span><select id="campaign-flow-thumbnail-asset-id" data-campaign-flow-meta><option value="">Sem thumbnail</option>${thumbnailOptions}</select></label>
        ` : ''}
        ${selectedPlatforms.has('instagram') ? `
          <label class="campaign-flow-field campaign-flow-field-wide"><span>Caption do Instagram</span><textarea id="campaign-flow-instagram-caption" data-campaign-flow-meta rows="4" maxlength="2200" placeholder="Se vazio, usa a descricao">${escapeHtml(flowState.instagramCaption)}</textarea></label>
          <label class="campaign-check-row"><input id="campaign-flow-instagram-share" data-campaign-flow-meta type="checkbox" ${flowState.instagramShareToFeed ? 'checked' : ''} /><span>Compartilhar Reel no feed.</span></label>
        ` : ''}
      </div>
      <section class="campaign-thumbnail-panel">
        <div class="campaign-thumbnail-head">
          <div>
            <span class="campaign-flow-eyebrow">Thumbnail</span>
            <h3>Assistente de capa de video</h3>
            <p>Monte uma direcao visual clara para a capa antes de salvar a campanha, usando a Base para titulo aleatorio como fonte principal.</p>
          </div>
          <span class="campaign-thumbnail-badge">Integrado ao fluxo</span>
        </div>
        <div class="campaign-cover-platform-wrap">
          <div class="campaign-flow-panel-head compact">
            <h3>Plataforma da capa</h3>
            <p>Selecione uma ou mais plataformas para adaptar o briefing ao formato correto.</p>
          </div>
          <div class="campaign-cover-platform-grid">${coverPlatformCards}</div>
        </div>
        <div id="campaign-thumbnail-warning" class="campaign-thumbnail-warning" ${thumbnailWarnings.length > 0 ? '' : 'hidden'}>
          ${thumbnailWarnings.map((message) => `<p>${escapeHtml(message)}</p>`).join('')}
        </div>
        <label class="campaign-check-row" data-disabled="${thumbnailGate.canEnable ? 'false' : 'true'}">
          <input id="campaign-flow-thumbnail-assistant-enabled" data-campaign-flow-meta type="checkbox" ${thumbnailAssistantEnabled ? 'checked' : ''} ${thumbnailGate.canEnable ? '' : 'disabled'} />
          <span>Ativar briefing e checklist para thumbnail desta campanha.</span>
        </label>
        ${thumbnailAssistantEnabled ? `
          <div class="campaign-thumbnail-checklist">
            ${thumbnailChecklist.map((item) => `
              <div data-state="${item.state}">
                <span>${escapeHtml(item.label)}</span>
                <strong>${escapeHtml(item.value)}</strong>
              </div>
            `).join('')}
          </div>
          <textarea id="campaign-flow-thumbnail-brief" readonly rows="12">${escapeHtml(thumbnailBrief)}</textarea>
          <div class="campaign-thumbnail-actions">
            <button class="button button-secondary" type="button" data-action="copy-thumbnail-brief">Copiar briefing</button>
            <a class="button button-secondary" data-link href="/workspace/videos">Enviar thumbnail</a>
          </div>
        ` : `
          <div class="campaign-thumbnail-standby">
            Ative para transformar a base de titulo aleatorio, plataformas, agendamento e destinos em um briefing de capa pronto para producao.
          </div>
        `}
      </section>
      ${renderCampaignFlowFooter({ backHref: '/workspace/campanhas/Etapa3', nextHref: '/workspace/campanhas/Etapa5' })}
    </section>
  `);
}

function attachCampaignFlowMetadataStep() {
  const readLiveMetadataState = () => {
    const current = readCampaignFlowState();
    return {
      ...current,
      title: document.querySelector('#campaign-flow-title')?.value ?? '',
      randomTitleEnabled: Boolean(document.querySelector('#campaign-flow-random-title')?.checked),
      titleSeed: document.querySelector('#campaign-flow-title-seed')?.value ?? '',
      videoTitle: document.querySelector('#campaign-flow-video-title')?.value ?? '',
      videoDescription: document.querySelector('#campaign-flow-video-description')?.value ?? '',
      tags: document.querySelector('#campaign-flow-tags')?.value ?? '',
      privacy: document.querySelector('#campaign-flow-privacy')?.value ?? '',
      youtubePlaylistId: document.querySelector('#campaign-flow-youtube-playlist-id')?.value ?? '',
      thumbnailAssetId: document.querySelector('#campaign-flow-thumbnail-asset-id')?.value ?? '',
      thumbnailCoverPlatforms: Array.from(document.querySelectorAll('input[name="campaign-flow-cover-platform"]:checked')).map((input) => input.value),
      thumbnailAssistantEnabled: Boolean(document.querySelector('#campaign-flow-thumbnail-assistant-enabled')?.checked),
      instagramCaption: document.querySelector('#campaign-flow-instagram-caption')?.value ?? '',
      instagramShareToFeed: Boolean(document.querySelector('#campaign-flow-instagram-share')?.checked ?? true),
    };
  };
  const collect = () => {
    const draft = readLiveMetadataState();
    const gate = getCampaignFlowThumbnailAssistantGate(draft);
    return patchCampaignFlowState({
      ...draft,
      thumbnailAssistantEnabled: draft.thumbnailAssistantEnabled && gate.canEnable,
    });
  };
  const syncThumbnailAssistantGate = () => {
    const next = readLiveMetadataState();
    const gate = getCampaignFlowThumbnailAssistantGate(next);
    const warnings = [
      !gate.baseReady ? 'Preencha a Base para título aleatório com no mínimo 12 palavras para gerar um briefing melhor.' : '',
      !gate.hasCoverPlatform ? 'Selecione pelo menos uma plataforma: YouTube, TikTok ou Instagram.' : '',
      (!gate.hasCampaignPlatform || !gate.hasDestination) ? 'Selecione pelo menos uma plataforma e um destino antes de ativar o briefing de capa.' : '',
    ].filter(Boolean);
    const seedWarning = document.querySelector('.campaign-field-warning');
    if (seedWarning) {
      seedWarning.setAttribute('data-state', gate.baseReady ? 'ok' : 'warning');
      seedWarning.textContent = gate.baseReady
        ? `${formatNumber(gate.baseWordCount)} palavras. Base suficiente para briefing.`
        : `${formatNumber(gate.baseWordCount)}/12 palavras. Preencha a Base para título aleatório com no mínimo 12 palavras para gerar um briefing melhor.`;
    }
    const warningBox = document.querySelector('#campaign-thumbnail-warning');
    if (warningBox) {
      warningBox.hidden = warnings.length === 0;
      warningBox.innerHTML = warnings.map((message) => `<p>${escapeHtml(message)}</p>`).join('');
    }
    const toggle = document.querySelector('#campaign-flow-thumbnail-assistant-enabled');
    if (toggle instanceof HTMLInputElement) {
      toggle.disabled = !gate.canEnable;
      if (!gate.canEnable) toggle.checked = false;
      toggle.closest('.campaign-check-row')?.setAttribute('data-disabled', gate.canEnable ? 'false' : 'true');
    }
    if (!gate.canEnable && readCampaignFlowState().thumbnailAssistantEnabled) {
      patchCampaignFlowState({ thumbnailAssistantEnabled: false });
      void renderCampaignFlowPage(4);
    }
  };
  document.querySelectorAll('[data-campaign-flow-meta]').forEach((input) => {
    input.addEventListener('input', () => {
      collect();
      if (input.id === 'campaign-flow-title-seed') syncThumbnailAssistantGate();
    });
    input.addEventListener('change', () => {
      collect();
      if (
        input.id === 'campaign-flow-random-title' ||
        input.id === 'campaign-flow-thumbnail-assistant-enabled' ||
        input.id === 'campaign-flow-thumbnail-asset-id' ||
        input.name === 'campaign-flow-cover-platform'
      ) void renderCampaignFlowPage(4);
      else syncThumbnailAssistantGate();
    });
  });
  document.querySelector('[data-action="copy-thumbnail-brief"]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const brief = document.querySelector('#campaign-flow-thumbnail-brief')?.value ?? '';
    if (!brief) return;
    try {
      await navigator.clipboard.writeText(brief);
      setUiNotice('success', 'Briefing copiado', 'Use este briefing para criar a imagem e depois envie em Midia.');
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = brief;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
      setUiNotice('success', 'Briefing copiado', 'Use este briefing para criar a imagem e depois envie em Midia.');
    }
    if (button instanceof HTMLButtonElement) {
      setButtonBusy(button, true, 'Copiado');
      setTimeout(() => setButtonBusy(button, false), 900);
    }
  });
  attachCampaignFlowNextHandlers(() => {
    const next = readCampaignFlowState();
    const randomTitleUsable = next.sourceType === 'playlist' && next.schedulePatternEnabled && next.randomTitleEnabled;
    const hasCampaignTitle = (randomTitleUsable && next.titleSeed.trim()) || next.title.trim();
    if (randomTitleUsable && countCampaignFlowWords(next.titleSeed) < 12) return { ok: false, title: 'Base para titulo aleatorio', message: 'Preencha a Base para título aleatório com no mínimo 12 palavras para gerar um briefing melhor.' };
    if (!hasCampaignTitle) return { ok: false, title: 'Titulo da campanha', message: 'Informe um titulo fixo ou ative o titulo aleatorio com uma base.' };
    if (!next.videoTitle.trim() || !next.videoDescription.trim()) return { ok: false, title: 'Metadados obrigatorios', message: 'Titulo e descricao do video sao obrigatorios.' };
    return { ok: true };
  });
}

function campaignFlowBuildScheduledLaunches(flowState) {
  if (flowState.sourceType !== 'playlist' || !flowState.schedulePatternEnabled) return [];
  const days = Array.isArray(flowState.scheduleDays) && flowState.scheduleDays.length > 0 ? flowState.scheduleDays : [new Date().toLocaleDateString('sv-SE')];
  const count = Math.max(1, parseInteger(flowState.scheduleTimesPerDay, 1, 1, 48));
  const launches = [];
  for (const day of days) {
    const hours = flowState.scheduleHourAuto ? generateSpacedHoursForDay(day, count) : (flowState.scheduleHours.length > 0 ? flowState.scheduleHours : ['18:00']);
    for (const hour of hours.slice(0, count)) {
      const iso = campaignFlowToIso(`${day}T${hour}:00`);
      if (iso) launches.push(iso);
    }
  }
  return launches;
}

function validateCampaignFlowReadyToSave(flowState, context) {
  if (!flowState.selectedPlatforms.length) {
    return { ok: false, title: 'Escolha plataformas', message: 'Selecione pelo menos uma plataforma na Etapa 1.' };
  }
  if (flowState.sourceType === 'playlist') {
    if (!isPaidCampaignPlan(context?.account)) {
      return { ok: false, title: 'Playlist bloqueada', message: 'A selecao por playlist fica disponivel apenas em plano pago.' };
    }
    if (!flowState.playlistId) {
      return { ok: false, title: 'Escolha a playlist', message: 'Selecione uma playlist na Etapa 2.' };
    }
  } else if (!flowState.videoAssetId) {
    return { ok: false, title: 'Escolha o video', message: 'Selecione uma midia na Etapa 2.' };
  }
  if (!flowState.selectedDestinationRefs.length) {
    return { ok: false, title: 'Selecione destinos', message: 'Escolha pelo menos um canal ou conta na Etapa 3.' };
  }
  const randomTitleUsable = flowState.sourceType === 'playlist' && flowState.schedulePatternEnabled && flowState.randomTitleEnabled;
  const hasCampaignTitle = (randomTitleUsable && flowState.titleSeed.trim()) || flowState.title.trim();
  if (randomTitleUsable && countCampaignFlowWords(flowState.titleSeed) < 12) {
    return { ok: false, title: 'Base para titulo aleatorio', message: 'Preencha a Base para título aleatório com no mínimo 12 palavras para gerar um briefing melhor.' };
  }
  if (!hasCampaignTitle) {
    return { ok: false, title: 'Titulo da campanha', message: 'Informe um titulo fixo ou uma base para titulo aleatorio na Etapa 4.' };
  }
  if (!flowState.videoTitle.trim() || !flowState.videoDescription.trim()) {
    return { ok: false, title: 'Metadados obrigatorios', message: 'Titulo e descricao do video sao obrigatorios na Etapa 4.' };
  }
  return { ok: true };
}

function renderCampaignFlowReviewStep(context, flowState) {
  const selectedDestinations = flowState.selectedDestinationRefs
    .map((ref) => ({ ref, destination: campaignFlowFindDestination(context.destinations, ref) }))
    .filter((entry) => entry.destination);
  const selectedVideo = context.videos.find((video) => video.id === flowState.videoAssetId);
  const selectedPlaylist = context.playlists.find((playlist) => playlist.id === flowState.playlistId);
  const scheduledLaunches = campaignFlowBuildScheduledLaunches(flowState);
  const blockedPlatforms = flowState.selectedPlatforms.filter((platform) => !isCampaignFlowPlatformAllowedByPlan(platform, context.account));
  const thumbnailGate = getCampaignFlowThumbnailAssistantGate(flowState);
  const thumbnailAssistantEnabled = flowState.thumbnailAssistantEnabled && thumbnailGate.canEnable;
  const reviewRows = [
    {
      label: 'Origem',
      value: flowState.sourceType === 'playlist' ? `Playlist: ${selectedPlaylist?.name ?? '-'}` : `Midia: ${selectedVideo?.original_name ?? '-'}`,
      editHref: '/workspace/campanhas/Etapa2',
    },
    {
      label: 'Formato',
      value: getVideoPublishFormatLabel(flowState.publishFormat),
      editHref: '/workspace/campanhas/Etapa2',
    },
    {
      label: 'Plataformas',
      value: flowState.selectedPlatforms.map(getCampaignFlowPlatformLabel).join(', ') || '-',
      editHref: '/workspace/campanhas/Etapa1',
    },
    {
      label: 'Destinos',
      value: `${selectedDestinations.length} selecionado${selectedDestinations.length === 1 ? '' : 's'}`,
      editHref: '/workspace/campanhas/Etapa3',
    },
    {
      label: 'Horario geral',
      value: flowState.scheduledAt ? campaignFlowFormatLocalDate(flowState.scheduledAt) : 'Sem horario geral',
      editHref: '/workspace/campanhas/Etapa3',
    },
    {
      label: 'Disparos gerados',
      value: scheduledLaunches.length > 0 ? `${scheduledLaunches.length} campanhas agendadas` : '1 campanha',
      editHref: '/workspace/campanhas/Etapa3',
    },
    ...(thumbnailGate.hasCoverPlatform ? [{
      label: 'Thumbnail assistida',
      value: thumbnailAssistantEnabled
        ? `Briefing para ${thumbnailGate.coverPlatforms.map(campaignFlowCoverPlatformLabel).join(', ')}`
        : 'Opcional nao ativado',
      editHref: '/workspace/campanhas/Etapa4',
    }] : []),
  ];

  return renderCampaignFlowLayout(context, flowState, 5, `
    <section class="campaign-flow-panel">
      <div class="campaign-flow-panel-head">
        <span class="campaign-flow-eyebrow">Etapa 5</span>
        <h2>Revisar campanha</h2>
        <p>Confira o pacote antes de salvar. O rascunho sera criado no backend e podera ser marcado como pronto na tela de detalhes.</p>
      </div>
      ${blockedPlatforms.length > 0 ? `<div class="notice warning">Seu plano atual pode bloquear: ${escapeHtml(blockedPlatforms.map(getCampaignFlowPlatformLabel).join(', '))}. Se o backend negar, ajuste o plano ou remova estes destinos.</div>` : ''}
      <div class="campaign-review-grid">
        ${reviewRows.map((row) => `
          <div class="campaign-review-item">
            <span>${escapeHtml(row.label)}</span>
            <strong>${escapeHtml(row.value)}</strong>
            <a class="campaign-review-edit" data-link href="${escapeHtml(row.editHref)}">Editar</a>
          </div>
        `).join('')}
      </div>
      <section class="campaign-review-destinations">
        <div class="campaign-review-section-head">
          <h3>Destinos</h3>
          <a class="campaign-review-edit" data-link href="/workspace/campanhas/Etapa3">Editar</a>
        </div>
        ${selectedDestinations.map(({ ref, destination }) => `
          <div class="campaign-review-destination">
            <span>${renderPlatformArtwork(destination.platform, 24)}</span>
            <strong>${escapeHtml(destination.destinationLabel ?? destination.title ?? destination.destinationId)}</strong>
            <small>${escapeHtml(flowState.perTargetPublishAt?.[ref] ? campaignFlowFormatLocalDate(flowState.perTargetPublishAt[ref]) : 'Usa horario geral ou imediato')}</small>
          </div>
        `).join('') || '<p class="muted">Nenhum destino selecionado.</p>'}
      </section>
      <section class="campaign-review-metadata">
        <div class="campaign-review-section-head">
          <h3>Metadados</h3>
          <a class="campaign-review-edit" data-link href="/workspace/campanhas/Etapa4">Editar</a>
        </div>
        <p><strong>${escapeHtml(flowState.videoTitle || '-')}</strong></p>
        <p class="muted">${escapeHtml(flowState.videoDescription || '-')}</p>
        <p class="muted">Tags: ${escapeHtml(flowState.tags || 'sem tags')}</p>
        ${thumbnailAssistantEnabled ? `
          <div class="campaign-review-thumbnail">
            <strong>Capa assistida por plataforma</strong>
            <span>Briefing e checklist preparados para ${escapeHtml(thumbnailGate.coverPlatforms.map(campaignFlowCoverPlatformLabel).join(', '))}. Depois de criar a imagem, envie em Midia e selecione no campo Thumbnail quando aplicavel.</span>
          </div>
        ` : ''}
      </section>
      ${renderCampaignFlowFooter({
        backHref: '/workspace/campanhas/Etapa4',
        nextHref: '/workspace/campanhas/Etapa6',
        nextDisabled: selectedDestinations.length === 0,
        nextLabel: 'Continuar para salvar',
      })}
    </section>
  `);
}

function renderCampaignFlowSaveStep(context, flowState) {
  const selectedDestinations = flowState.selectedDestinationRefs
    .map((ref) => campaignFlowFindDestination(context.destinations, ref))
    .filter(Boolean);
  const selectedVideo = context.videos.find((video) => video.id === flowState.videoAssetId);
  const selectedPlaylist = context.playlists.find((playlist) => playlist.id === flowState.playlistId);
  const scheduledLaunches = campaignFlowBuildScheduledLaunches(flowState);
  const campaignCount = Math.max(1, scheduledLaunches.length);
  const sourceLabel = flowState.sourceType === 'playlist'
    ? `Playlist: ${selectedPlaylist?.name ?? 'playlist selecionada'}`
    : `Midia: ${selectedVideo?.original_name ?? 'video selecionado'}`;
  const targetCount = selectedDestinations.length * campaignCount;
  const validation = validateCampaignFlowReadyToSave(flowState, context);

  return renderCampaignFlowLayout(context, flowState, 6, `
    <section class="campaign-flow-panel">
      <div class="campaign-flow-panel-head">
        <span class="campaign-flow-eyebrow">Etapa 6</span>
        <h2>Salvar rascunho</h2>
        <p>Esta etapa grava a campanha e seus destinos sem iniciar a publicacao. Depois disso, a preparacao, o lancamento e o acompanhamento ficam na tela da campanha.</p>
      </div>
      <div class="notice info">Salvar rascunho nao consome o lancamento agora. A campanha ainda precisa ser marcada como pronta antes de publicar.</div>
      ${validation.ok ? '' : `<div class="notice warning">${escapeHtml(validation.message)}</div>`}
      <div class="campaign-save-grid">
        <div>
          <span>Campanhas a criar</span>
          <strong>${formatNumber(campaignCount)}</strong>
          <small>${escapeHtml(scheduledLaunches.length > 0 ? 'Geradas pelo padrao aleatorio da playlist.' : 'Um rascunho unico sera criado.')}</small>
        </div>
        <div>
          <span>Destinos vinculados</span>
          <strong>${formatNumber(selectedDestinations.length)}</strong>
          <small>${escapeHtml(`${formatNumber(targetCount)} destino${targetCount === 1 ? '' : 's'} no total considerando todos os disparos.`)}</small>
        </div>
        <div>
          <span>Origem do video</span>
          <strong>${escapeHtml(sourceLabel)}</strong>
          <small>${escapeHtml(getVideoPublishFormatLabel(flowState.publishFormat))}</small>
        </div>
      </div>
      <section class="campaign-save-progress" aria-live="polite">
        <div class="campaign-save-progress-row" data-save-progress-step="create_campaign" data-state="waiting">
          <span>1</span>
          <div><strong>Criar campanha</strong><small>Preparando o rascunho principal.</small></div>
        </div>
        <div class="campaign-save-progress-row" data-save-progress-step="add_targets" data-state="waiting">
          <span>2</span>
          <div><strong>Adicionar destinos</strong><small>Vinculando canais e contas selecionadas.</small></div>
        </div>
        <div class="campaign-save-progress-row" data-save-progress-step="finish" data-state="waiting">
          <span>3</span>
          <div><strong>Finalizar</strong><small>Abrindo a campanha salva para revisao operacional.</small></div>
        </div>
      </section>
      ${renderCampaignFlowFooter({
        backHref: '/workspace/campanhas/Etapa5',
        nextHref: '#',
        nextDisabled: !validation.ok,
        nextLabel: 'Salvar rascunho',
        submit: true,
      })}
    </section>
  `);
}

function setCampaignFlowSaveProgress(stepKey, state, message) {
  const row = document.querySelector(`[data-save-progress-step="${stepKey}"]`);
  if (!row) return;
  row.setAttribute('data-state', state);
  const small = row.querySelector('small');
  if (small && message) small.textContent = message;
}

async function submitCampaignFlow(context) {
  const flowState = readCampaignFlowState();
  const submitButton = document.querySelector('[data-action="campaign-flow-submit"]');
  const validation = validateCampaignFlowReadyToSave(flowState, context);
  if (!validation.ok) {
    setUiNotice('warning', validation.title, validation.message);
    return;
  }
  setButtonBusy(submitButton, true, 'Salvando...');
  setCampaignFlowSaveProgress('create_campaign', 'active', 'Criando rascunho 1.');
  setCampaignFlowSaveProgress('add_targets', 'waiting', 'Aguardando criacao da campanha.');
  setCampaignFlowSaveProgress('finish', 'waiting', 'Aguardando finalizacao.');
  const tags = String(flowState.tags ?? '').split(',').map((tag) => tag.trim()).filter(Boolean);
  const scheduledLaunches = campaignFlowBuildScheduledLaunches(flowState);
  const launchDates = scheduledLaunches.length > 0 ? scheduledLaunches : [campaignFlowToIso(flowState.scheduledAt)];
  let firstCampaignId = null;
  let activeSaveStep = 'create_campaign';

  async function resolveVideoAssetId() {
    if (flowState.sourceType === 'media') return flowState.videoAssetId;
    const nextVideo = await api.nextPlaylistVideo(flowState.playlistId);
    if (!nextVideo.ok || !nextVideo.body?.videoAssetId) {
      throw new Error(nextVideo.error || 'Nao foi possivel selecionar um video da playlist.');
    }
    return nextVideo.body.videoAssetId;
  }

  try {
    for (let index = 0; index < launchDates.length; index += 1) {
      const scheduledAt = launchDates[index];
      const videoAssetId = await resolveVideoAssetId();
      const assetForTitle = context.videos.find((video) => video.id === videoAssetId);
      const shouldGenerateRandomTitle = flowState.sourceType === 'playlist' && flowState.schedulePatternEnabled && flowState.randomTitleEnabled && flowState.titleSeed;
      const campaignTitle = shouldGenerateRandomTitle
        ? generateRandomTitle(flowState.titleSeed, assetForTitle)
        : (flowState.title || `Campanha ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`);
      const created = await api.createCampaign({
        title: `${campaignTitle}${launchDates.length > 1 ? ` #${index + 1}/${launchDates.length}` : ''}`,
        videoAssetId,
        scheduledAt,
        playlistId: flowState.sourceType === 'playlist' ? flowState.playlistId : undefined,
        autoMode: flowState.sourceType === 'playlist',
        schedulePattern: flowState.schedulePatternEnabled ? `random:${JSON.stringify({
          timesPerDay: flowState.scheduleTimesPerDay,
          sequence: flowState.playlistSequenceMode,
          repeat: flowState.playlistRepeatPolicy,
          strictFormat: flowState.playlistStrictFormat,
          days: flowState.scheduleDays,
          hours: flowState.scheduleHourAuto ? 'auto' : flowState.scheduleHours,
        })}` : undefined,
      });
      if (!created.ok) throw new Error(created.error);
      const campaignId = created.body?.campaign?.id;
      if (!campaignId) throw new Error('Campaign id ausente na resposta.');
      if (!firstCampaignId) firstCampaignId = campaignId;
      setCampaignFlowSaveProgress('create_campaign', 'done', `Rascunho ${index + 1}/${launchDates.length} criado.`);
      activeSaveStep = 'add_targets';
      setCampaignFlowSaveProgress('add_targets', 'active', `Adicionando destinos do rascunho ${index + 1}/${launchDates.length}.`);
      const targets = flowState.selectedDestinationRefs.map((ref) => {
        const destination = campaignFlowFindDestination(context.destinations, ref) ?? campaignFlowParseDestinationRef(ref);
        return buildCampaignTargetPayloadForDestination(destination, {
          videoTitle: flowState.videoTitle,
          videoDescription: flowState.videoDescription,
          tags: tags.length > 0 ? tags : undefined,
          publishAt: campaignFlowToIso(flowState.perTargetPublishAt?.[ref]) ?? scheduledAt,
          playlistId: flowState.youtubePlaylistId || undefined,
          privacy: flowState.privacy || undefined,
          thumbnailAssetId: flowState.thumbnailAssetId || undefined,
        }, {
          instagramCaption: flowState.instagramCaption,
          instagramShareToFeed: flowState.instagramShareToFeed,
        });
      });
      const added = await api.addTargetsBulk(campaignId, targets);
      if (!added.ok) throw new Error(added.error || 'Falha ao salvar destinos.');
      setCampaignFlowSaveProgress('add_targets', 'done', `Destinos adicionados ao rascunho ${index + 1}/${launchDates.length}.`);
      if (index + 1 < launchDates.length) {
        activeSaveStep = 'create_campaign';
        setCampaignFlowSaveProgress('create_campaign', 'active', `Criando rascunho ${index + 2}/${launchDates.length}.`);
      }
    }
    activeSaveStep = 'finish';
    setCampaignFlowSaveProgress('finish', 'done', 'Campanha salva. Abrindo revisao operacional.');
    setButtonBusy(submitButton, false);
    resetCampaignFlowState();
    setUiNotice('success', launchDates.length > 1 ? 'Campanhas criadas' : 'Campanha salva', launchDates.length > 1
      ? `${launchDates.length} rascunhos foram criados com os disparos definidos.`
      : 'O rascunho foi salvo e esta pronto para revisao.');
    navigate(firstCampaignId ? `/workspace/campanhas/${encodeURIComponent(firstCampaignId)}` : '/workspace/campanhas');
  } catch (error) {
    setCampaignFlowSaveProgress(activeSaveStep, 'error', error instanceof Error ? error.message : 'Erro inesperado.');
    setButtonBusy(submitButton, false);
    setUiNotice('error', 'Falha ao salvar campanha', error instanceof Error ? error.message : 'Erro inesperado.');
  }
}

async function renderCampaignFlowPage(step = 1) {
  const context = await loadCampaignFlowContext();
  if (!context.ok) {
    if (context.status === 401) {
      unauthorizedRedirect();
      return;
    }
    renderWorkspaceShell({
      title: 'Nova campanha',
      subtitle: 'Fluxo de criacao por etapas.',
      noticeHtml: `<div class="notice error">${escapeHtml(context.error)}</div>`,
      contentHtml: '<section class="card">Nao foi possivel carregar as dependencias da campanha.</section>',
    });
    return;
  }

    const flowState = readCampaignFlowState();
  flowState.selectedPlatforms = flowState.selectedPlatforms.filter((platform) => CAMPAIGN_FLOW_PLATFORMS.includes(platform));
  flowState.selectedDestinationRefs = flowState.selectedDestinationRefs.filter((ref) =>
    flowState.selectedPlatforms.includes(campaignFlowParseDestinationRef(ref).platform));
  writeCampaignFlowState(flowState);

  const currentStep = Math.min(Math.max(Number(step) || 1, 1), 6);
  const contentHtml = currentStep === 1
    ? renderCampaignFlowPlatformStep(context, flowState)
    : currentStep === 2
      ? renderCampaignFlowMediaStep(context, flowState)
      : currentStep === 3
        ? renderCampaignFlowDestinationStep(context, flowState)
        : currentStep === 4
          ? renderCampaignFlowMetadataStep(context, flowState)
          : currentStep === 5
            ? renderCampaignFlowReviewStep(context, flowState)
            : renderCampaignFlowSaveStep(context, flowState);

  renderWorkspaceShell({
    title: `Nova campanha - Etapa ${currentStep}`,
    subtitle: 'Criacao guiada para YouTube, TikTok e Instagram.',
    contentHtml,
  });

  if (currentStep === 1) attachCampaignFlowPlatformStep(flowState);
  else if (currentStep === 2) attachCampaignFlowMediaStep(context);
  else if (currentStep === 3) attachCampaignFlowDestinationStep(flowState);
  else if (currentStep === 4) attachCampaignFlowMetadataStep();
  else if (currentStep === 5) {
    attachCampaignFlowNextHandlers(() => {
      return validateCampaignFlowReadyToSave(readCampaignFlowState(), context);
    });
  } else {
    const validation = validateCampaignFlowReadyToSave(readCampaignFlowState(), context);
    setCampaignFlowSaveProgress('create_campaign', validation.ok ? 'active' : 'waiting', validation.ok ? 'Pronto para criar o rascunho.' : 'Corrija as etapas anteriores antes de salvar.');
    document.querySelector('[data-action="campaign-flow-submit"]')?.addEventListener('click', () => { void submitCampaignFlow(context); });
  }
}

async function renderCampaignComposerPage() {
  await renderCampaignFlowPage(1);
}

function minutesToHHMM(minutes) {
  const m = Math.max(0, Math.min(1439, Math.round(minutes)));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function generateSpacedHoursForDay(day, count) {
  if (!count || count <= 0) return [];
  const now = new Date();
  const todayKey = now.toLocaleDateString('sv-SE');
  const isToday = day === todayKey;
  const startBuffer = 2; // minutes from now to give the worker time to schedule
  const minStart = isToday
    ? Math.min(now.getHours() * 60 + now.getMinutes() + startBuffer, 1438)
    : 0;
  const minEnd = 1439; // 23:59
  const window = minEnd - minStart;
  if (window <= 0) {
    // No room left today: bunch them tightly at the very end
    return Array.from({ length: count }, () => minutesToHHMM(minEnd));
  }
  const slot = window / count;
  // For very tight slots, fall back to even distribution
  if (slot < 4) {
    return Array.from({ length: count }, (_, i) => minutesToHHMM(minStart + i * slot));
  }
  const result = [];
  for (let i = 0; i < count; i++) {
    const slotStart = minStart + i * slot;
    // Restrict to the middle 60% of the slot to guarantee spacing between picks
    const innerOffset = slot * 0.2 + Math.random() * slot * 0.6;
    result.push(minutesToHHMM(slotStart + innerOffset));
  }
  return result;
}

function pickOne(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function extractVideoHints(asset) {
  if (!asset) return { number: null, durationLabel: null, isShort: false };
  const name = String(asset.original_name ?? '').toLowerCase();
  const numberMatch = name.match(/\((\d+)\)|[_\-\s](\d+)\.|episodio?\s*(\d+)|ep\s*(\d+)|parte\s*(\d+)/);
  const number = numberMatch ? numberMatch.slice(1).find((v) => v) : null;
  const dur = Number(asset.duration_seconds ?? 0);
  let durationLabel = null;
  if (dur > 0 && dur <= 60) durationLabel = 'rapido';
  else if (dur > 60 && dur <= 180) durationLabel = 'curto';
  else if (dur > 180 && dur <= 600) durationLabel = 'completo';
  else if (dur > 600) durationLabel = 'longo';
  const isShort = dur > 0 && dur <= 180;
  return { number, durationLabel, isShort };
}

function generateRandomTitle(seed, asset) {
  const baseSeed = String(seed ?? '').trim();
  if (!baseSeed) return '';
  const hints = extractVideoHints(asset);
  const prefixes = ['', '🔥 ', '✨ ', '🎬 ', '🚀 ', '💥 ', '👀 ', ''];
  const suffixes = [
    '', ' (assista ate o fim)', ' — voce nao vai acreditar', ' #shorts', ' [imperdivel]',
    ' que viralizou', ' explicado', ' completo', ' em 60s', ' do dia',
  ];
  const intensifiers = ['INCRIVEL', 'EPICO', 'ABSURDO', 'GENIAL', 'INSANO', 'INESQUECIVEL', 'TOP'];
  const variants = [
    () => `${pickOne(prefixes)}${baseSeed}${pickOne(suffixes)}`,
    () => `${baseSeed} ${pickOne(intensifiers)}`,
    () => `${pickOne(intensifiers)} - ${baseSeed}${hints.number ? ` parte ${hints.number}` : ''}`,
    () => `${baseSeed}${hints.number ? ` #${hints.number}` : ''}${hints.isShort ? ' #shorts' : ''}`,
    () => `${pickOne(prefixes)}${baseSeed}${hints.durationLabel ? ` (${hints.durationLabel})` : ''}`,
    () => `${baseSeed} | ${new Date().toLocaleDateString(getActiveLocale())}`,
  ];
  let title = pickOne(variants)().replace(/\s+/g, ' ').trim();
  if (title.length > 100) title = title.slice(0, 97) + '...';
  return title;
}

function mergeTimeline(jobsByTarget, auditEvents) {
  const jobEvents = Object.entries(jobsByTarget ?? {}).flatMap(([targetId, jobs]) =>
    jobs
      .map((job) => ({
        kind: 'job',
        timestamp: job.completedAt || job.startedAt || job.createdAt,
        targetId,
        label: `${job.status} (attempt ${job.attempt})`,
      }))
      .filter((event) => Boolean(event.timestamp)),
  );
  const auditTimeline = (auditEvents ?? []).map((event) => ({
    kind: 'audit',
    timestamp: event.createdAt,
    targetId: event.targetId,
    label: `${event.eventType} by ${event.actorEmail}`,
  }));
  return [...jobEvents, ...auditTimeline]
    .sort((left, right) => (left.timestamp < right.timestamp ? 1 : -1));
}

function applyTimelineFilters(timeline, activityFilter, targetFilter) {
  return timeline.filter((entry) => {
    if (activityFilter === 'jobs' && entry.kind !== 'job') return false;
    if (activityFilter === 'audit' && entry.kind !== 'audit') return false;
    if (targetFilter && entry.targetId !== targetFilter) return false;
    return true;
  });
}

function renderCampaignLifecyclePanel(campaign, status, jobsByTarget) {
  const targets = Array.isArray(campaign.targets) ? campaign.targets : [];
  const jobs = Object.values(jobsByTarget ?? {}).flatMap((entries) => Array.isArray(entries) ? entries : []);
  const campaignStatus = String(status?.campaignStatus ?? campaign.status ?? 'draft');
  const totalTargets = targets.length;
  const publishedTargets = targets.filter((target) => target.status === 'publicado').length;
  const failedTargets = targets.filter((target) => target.status === 'erro').length;
  const waitingTargets = targets.filter((target) => target.status === 'aguardando').length;
  const sendingTargets = targets.filter((target) => target.status === 'enviando').length;
  const queuedJobs = jobs.filter((job) => job.status === 'queued').length;
  const processingJobs = jobs.filter((job) => job.status === 'processing').length;
  const completedJobs = jobs.filter((job) => job.status === 'completed').length;
  const failedJobs = jobs.filter((job) => job.status === 'failed').length;
  const terminal = campaignStatus === 'completed' || campaignStatus === 'failed';
  const canEdit = campaignStatus === 'draft' || campaignStatus === 'ready';

  const steps = [
    {
      number: 7,
      title: 'Editar antes do lancamento',
      body: canEdit ? 'Campanha e destinos ainda podem ser ajustados.' : 'Edicao fica bloqueada depois que a campanha entra em publicacao.',
      state: canEdit ? 'active' : 'done',
      badge: canEdit ? 'editavel' : 'bloqueado',
      metric: `${formatNumber(totalTargets)} destino${totalTargets === 1 ? '' : 's'}`,
    },
    {
      number: 8,
      title: 'Marcar como pronta',
      body: campaignStatus === 'draft'
        ? (totalTargets > 0 ? 'Valide o rascunho e marque como pronto para liberar o lancamento.' : 'Adicione pelo menos um destino antes de marcar como pronta.')
        : 'Validacao de rascunho ja passou ou a campanha seguiu para publicacao.',
      state: campaignStatus === 'draft' ? (totalTargets > 0 ? 'active' : 'blocked') : 'done',
      badge: campaignStatus === 'draft' ? 'pendente' : 'ok',
      metric: campaignStatus,
    },
    {
      number: 9,
      title: 'Lancar campanha',
      body: campaignStatus === 'ready'
        ? 'Lancamento disponivel. Confirme antes de consumir autorizacoes ou tokens.'
        : campaignStatus === 'launching'
          ? 'A publicacao ja foi iniciada.'
          : terminal
            ? 'Lancamento finalizado.'
            : 'Aguarda a campanha ficar pronta.',
      state: campaignStatus === 'ready' || campaignStatus === 'launching' ? 'active' : terminal ? 'done' : 'next',
      badge: campaignStatus === 'ready' ? 'acao' : campaignStatus,
      metric: campaign.scheduledAt ? `Geral: ${formatDate(campaign.scheduledAt)}` : 'Sem horario geral',
    },
    {
      number: 10,
      title: 'Criar jobs de publicacao',
      body: jobs.length > 0
        ? 'Jobs existem para os destinos elegiveis.'
        : campaignStatus === 'launching'
          ? 'Destinos podem estar aguardando horario futuro.'
          : 'Jobs nascem quando a campanha entra em lancamento.',
      state: queuedJobs > 0 || processingJobs > 0 ? 'active' : jobs.length > 0 ? 'done' : 'next',
      badge: `${formatNumber(jobs.length)} job${jobs.length === 1 ? '' : 's'}`,
      metric: `${formatNumber(queuedJobs)} fila / ${formatNumber(processingJobs)} proc.`,
    },
    {
      number: 11,
      title: 'Processar por plataforma',
      body: processingJobs > 0 || sendingTargets > 0
        ? 'Workers estao enviando conteudo para as plataformas.'
        : 'Cada destino segue para o worker da sua plataforma.',
      state: processingJobs > 0 || sendingTargets > 0 ? 'active' : completedJobs + failedJobs > 0 || terminal ? 'done' : 'next',
      badge: `${formatNumber(sendingTargets)} enviando`,
      metric: `${formatNumber(completedJobs)} ok / ${formatNumber(failedJobs)} falha`,
    },
    {
      number: 13,
      title: 'Acompanhar status',
      body: status?.shouldPoll
        ? 'A tela continua atualizando enquanto houver trabalho em andamento.'
        : 'Status, progresso e historico ficam visiveis nesta pagina.',
      state: status?.shouldPoll || campaignStatus === 'launching' ? 'active' : terminal ? 'done' : 'next',
      badge: status?.shouldPoll ? 'polling' : 'manual',
      metric: `${formatNumber(status?.progress?.completed ?? publishedTargets)}/${formatNumber(status?.progress?.total ?? totalTargets)} concluidos`,
    },
    {
      number: 14,
      title: 'Erros e retentativas',
      body: failedTargets > 0 || failedJobs > 0
        ? 'Ha falhas que podem exigir retry, reautenticacao ou ajuste de metadados.'
        : 'Retentativas aparecem quando algum destino falha.',
      state: failedTargets > 0 || failedJobs > 0 ? 'active' : terminal ? 'done' : 'next',
      badge: failedTargets > 0 || failedJobs > 0 ? 'atencao' : 'sem erros',
      metric: `${formatNumber(failedTargets)} destino${failedTargets === 1 ? '' : 's'} com erro`,
    },
    {
      number: 15,
      title: 'Finalizar campanha',
      body: terminal
        ? 'A campanha chegou a um estado final.'
        : 'Finaliza quando todos os destinos chegam a publicado ou erro.',
      state: terminal ? 'done' : campaignStatus === 'launching' ? 'active' : 'next',
      badge: terminal ? campaignStatus : 'aguardando',
      metric: `${formatNumber(waitingTargets)} pendente${waitingTargets === 1 ? '' : 's'}`,
    },
    {
      number: 16,
      title: 'Pos-publicacao',
      body: terminal
        ? 'Agora da para clonar, reaproveitar e revisar links ou erros finais.'
        : 'Acoes de reaproveitamento entram depois da finalizacao.',
      state: terminal ? 'active' : 'next',
      badge: terminal ? 'disponivel' : 'futuro',
      metric: `${formatNumber(publishedTargets)} publicado${publishedTargets === 1 ? '' : 's'}`,
    },
  ];

  return `
    <section class="campaign-lifecycle-panel">
      <div class="campaign-flow-panel-head compact">
        <span class="campaign-flow-eyebrow">Etapas 7-16</span>
        <h3>Ciclo operacional da campanha</h3>
        <p>Depois do rascunho, a campanha passa por edicao, validacao, lancamento, jobs, processamento, acompanhamento, retentativas e pos-publicacao.</p>
      </div>
      <div class="campaign-lifecycle-grid">
        ${steps.map((step) => `
          <article class="campaign-lifecycle-step" data-state="${step.state}">
            <div class="campaign-lifecycle-step-head">
              <span>${step.number}</span>
              <strong>${escapeHtml(step.title)}</strong>
            </div>
            <p>${escapeHtml(step.body)}</p>
            <div class="campaign-lifecycle-step-foot">
              <small>${typeof step.badge === 'string' ? escapeHtml(step.badge) : step.badge}</small>
              <em>${typeof step.metric === 'string' ? escapeHtml(step.metric) : step.metric}</em>
            </div>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

function formatPublishDestinationOptionLabel(destination) {
  const providerLabel = getProviderLabel(destination?.platform);
  const title = String(destination?.destinationLabel ?? destination?.title ?? destination?.id ?? 'Unknown destination');
  const secondary = destination?.handle
    ? destination.handle
    : destination?.youtubeChannelId
      ? `YT ${destination.youtubeChannelId}`
      : destination?.email
        ? destination.email
        : destination?.id ?? 'Unknown id';
  return `${providerLabel}: ${title} (${secondary})`;
}

function syncSwitchLabel(input, onLabel = 'ON', offLabel = 'OFF') {
  const label = input?.closest('.schedule-toggle-switch')?.querySelector('.schedule-toggle-label');
  if (label) {
    label.textContent = input.checked ? onLabel : offLabel;
  }
}

function buildCampaignTargetPayloadForDestination(destination, targetTemplate, platformOptions = {}) {
  const platform = String(destination?.platform ?? 'youtube').toLowerCase();
  const destinationId = String(destination?.destinationId ?? destination?.id ?? '').trim();
  const payload = {
    platform,
    destinationId,
    destinationLabel: destination?.destinationLabel ?? destination?.title ?? destinationId,
    connectedAccountId: destination?.connectedAccountId ?? null,
    channelId: platform === 'youtube' ? destinationId : undefined,
    videoTitle: targetTemplate.videoTitle,
    videoDescription: targetTemplate.videoDescription,
    tags: targetTemplate.tags,
    publishAt: targetTemplate.publishAt,
    privacy: targetTemplate.privacy,
  };

  if (platform === 'youtube') {
    payload.playlistId = targetTemplate.playlistId;
    payload.thumbnailAssetId = targetTemplate.thumbnailAssetId;
  }

  if (platform === 'instagram') {
    const caption = String(platformOptions.instagramCaption ?? '').trim()
      || targetTemplate.videoDescription
      || targetTemplate.videoTitle;
    payload.instagramCaption = caption.slice(0, 2200);
    payload.instagramShareToFeed = platformOptions.instagramShareToFeed !== false;
  }

  return payload;
}

async function loadConnectedPublishDestinations() {
  const accountsResult = await api.accounts();
  if (!accountsResult.ok) {
    return {
      ok: false,
      status: accountsResult.status,
      error: accountsResult.error,
      destinations: [],
    };
  }

  const accounts = Array.isArray(accountsResult.body?.accounts)
    ? accountsResult.body.accounts.filter((account) => isSupportedWorkspaceProvider(account.provider))
    : [];
  const youtubeAccounts = accounts.filter((account) => supportsChannels(account.provider));
  const channelResponses = await Promise.all(youtubeAccounts.map((account) => api.accountChannels(account.id)));
  const unauthorized = channelResponses.find((response) => !response.ok && response.status === 401);
  if (unauthorized) {
    return {
      ok: false,
      status: 401,
      error: unauthorized.error,
      destinations: [],
    };
  }

  const youtubeDestinations = channelResponses
    .filter((response) => response.ok)
    .flatMap((response) => Array.isArray(response.body?.channels) ? response.body.channels : [])
    .filter((channel) => channel.isActive)
    .map((channel) => ({
      platform: 'youtube',
      id: channel.id,
      destinationId: channel.id,
      destinationLabel: channel.title ?? channel.youtubeChannelId ?? channel.id,
      connectedAccountId: channel.connectedAccountId ?? null,
      title: channel.title,
      handle: channel.handle,
      youtubeChannelId: channel.youtubeChannelId,
      thumbnailUrl: channel.thumbnailUrl,
    }));

  const socialDestinations = accounts
    .filter((account) => !supportsChannels(account.provider) && account.status === 'connected')
    .map((account) => ({
      platform: account.provider,
      id: account.id,
      destinationId: account.id,
      destinationLabel: account.displayName ?? account.email ?? account.id,
      connectedAccountId: account.id,
      email: account.email ?? '',
      title: account.displayName ?? account.email ?? account.id,
    }));

  const destinations = [...youtubeDestinations, ...socialDestinations];
  destinations.sort((left, right) => formatPublishDestinationOptionLabel(left).localeCompare(formatPublishDestinationOptionLabel(right)));

  const failedResponse = channelResponses.find((response) => !response.ok);
  if (failedResponse && destinations.length === 0) {
    return {
      ok: false,
      status: failedResponse.status,
      error: failedResponse.error,
      destinations: [],
    };
  }

  return {
    ok: true,
    destinations,
  };
}

async function renderCampaignDetailPage(campaignId) {
  const [campaignResult, statusResult, jobsResult, auditResult, mediaResult] = await Promise.all([
    api.campaignById(campaignId),
    api.campaignStatus(campaignId),
    api.campaignJobs(campaignId),
    api.campaignAudit(campaignId),
    api.media(),
  ]);

  const firstError = [campaignResult, statusResult, jobsResult, auditResult, mediaResult].find((result) => !result.ok && result.status === 401);
  if (firstError && firstError.status === 401) {
    unauthorizedRedirect();
    return;
  }

  if (!campaignResult.ok) {
    renderWorkspaceShell({
      title: `Campaign ${campaignId}`,
      subtitle: 'Detail',
      noticeHtml: `<div class="notice error">${escapeHtml(campaignResult.error)}</div>`,
      contentHtml: '<section class="card">Unable to load campaign detail.</section>',
    });
    return;
  }

  const campaign = campaignResult.body?.campaign;
  const mediaAssets = mediaResult.ok && Array.isArray(mediaResult.body?.assets) ? mediaResult.body.assets : [];
  const videoAsset = mediaAssets.find((asset) => asset.id === campaign.videoAssetId);
  const publishFormat = getVideoPublishFormat(videoAsset ?? {});
  const status = statusResult.ok ? statusResult.body : null;
  const jobsByTarget = jobsResult.ok ? jobsResult.body?.jobsByTarget : {};
  const auditEvents = auditResult.ok ? auditResult.body?.events : [];
  const canMutateTargets = campaign.status === 'draft' || campaign.status === 'ready';
  const canEditCampaign = campaign.status === 'draft' || campaign.status === 'ready';
  let connectedChannelsResult = { ok: true, destinations: [] };

  if (canMutateTargets) {
    connectedChannelsResult = await loadConnectedPublishDestinations();
    if (!connectedChannelsResult.ok && connectedChannelsResult.status === 401) {
      unauthorizedRedirect();
      return;
    }
  }

  const actions = [];
  if (campaign.status === 'draft' && (campaign.targets?.length ?? 0) > 0) {
    actions.push(`<button class="button button-secondary" type="button" data-action="mark-ready" data-campaign-id="${escapeHtml(campaign.id)}">Marcar pronta</button>`);
  }
  if (campaign.status === 'ready' && (campaign.targets?.length ?? 0) > 0) {
    actions.push(`<button class="button button-primary" type="button" data-action="launch-campaign" data-campaign-id="${escapeHtml(campaign.id)}">Lancar</button>`);
  }
  if (campaign.status === 'draft' || campaign.status === 'ready') {
    actions.push(`<button class="button button-danger" type="button" data-action="delete-campaign" data-campaign-id="${escapeHtml(campaign.id)}">Excluir</button>`);
  }
  actions.push(`<button class="button button-secondary" type="button" data-action="clone-campaign" data-campaign-id="${escapeHtml(campaign.id)}">Duplicar</button>`);
  actions.push(`<a class="button button-secondary" data-link href="/workspace/campanhas">Voltar</a>`);

  const targets = Array.isArray(campaign.targets) ? campaign.targets : [];
  const existingChannelIds = new Set(targets.map((target) => `${target.platform ?? 'youtube'}:${target.destinationId ?? target.channelId}`).filter(Boolean));
  const availableConnectedChannels = connectedChannelsResult.ok
    ? connectedChannelsResult.destinations.filter((channel) => !existingChannelIds.has(`${channel.platform}:${channel.destinationId}`))
    : [];
  const canSubmitConnectedTarget = !connectedChannelsResult.ok || availableConnectedChannels.length > 0;
  const addTargetChannelFieldHtml = connectedChannelsResult.ok
    ? `
          <label>
            Destination
            <select name="destinationRef" required ${availableConnectedChannels.length > 0 ? '' : 'disabled'}>
              <option value="">Select a connected destination</option>
              ${availableConnectedChannels.map((channel) => (
                `<option value="${escapeHtml(`${channel.platform}:${channel.destinationId}`)}">${escapeHtml(formatPublishDestinationOptionLabel(channel))}</option>`
              )).join('')}
            </select>
          </label>
        `
    : `
          <label>
            Destination ID
            <input name="destinationId" required placeholder="destination-id" />
          </label>
        `;
  let addTargetChannelNoticeHtml = '';
  if (connectedChannelsResult.ok && connectedChannelsResult.destinations.length === 0) {
    addTargetChannelNoticeHtml = '<div class="notice warning">No connected publishing destinations are available. Open Accounts to connect channels or accounts before adding a target.</div>';
  } else if (connectedChannelsResult.ok && availableConnectedChannels.length === 0) {
    addTargetChannelNoticeHtml = '<div class="notice info">All connected destinations are already attached to this campaign.</div>';
  } else if (!connectedChannelsResult.ok) {
    addTargetChannelNoticeHtml = `<div class="notice warning">Connected destinations could not be loaded automatically: ${escapeHtml(connectedChannelsResult.error ?? 'Unknown error')}. You can still enter a destination id manually.</div>`;
  }
  const targetRows = targets.length === 0
    ? '<tr><td colspan="9" class="muted">No targets configured.</td></tr>'
    : targets.map((target) => {
      const isReauthRequired = target.errorMessage === 'REAUTH_REQUIRED' || target.reauthRequired === true;
      const actionButtons = [];
      if (target.status === 'erro') {
        actionButtons.push(`<button class="button button-secondary button-sm" type="button" data-action="retry-target" data-campaign-id="${escapeHtml(campaign.id)}" data-target-id="${escapeHtml(target.id)}">Retry</button>`);
      }
      if (canMutateTargets) {
        actionButtons.push(`<button class="button button-secondary button-sm" type="button" data-action="edit-target" data-target-id="${escapeHtml(target.id)}">Edit</button>`);
        actionButtons.push(`<button class="button button-danger" type="button" data-action="remove-target" data-target-id="${escapeHtml(target.id)}">Remove</button>`);
      }

      return `
        <tr>
          <td>${escapeHtml(target.destinationLabel ?? target.channelTitle ?? target.channelId ?? target.id)}</td>
          <td>${escapeHtml(target.videoTitle ?? '-')}</td>
          <td>${statusPill(target.status)}</td>
          <td>${target.publishAt ? escapeHtml(formatDate(target.publishAt)) : '-'}</td>
          <td>${target.platform === 'youtube' && target.youtubeVideoId ? `<a target="_blank" href="https://www.youtube.com/watch?v=${encodeURIComponent(target.youtubeVideoId)}">${escapeHtml(target.youtubeVideoId)}</a>` : escapeHtml(target.externalPublishId ?? '-')}</td>
          <td>${target.retryCount ?? 0}</td>
          <td>${target.errorMessage ? escapeHtml(target.errorMessage) : '-'}</td>
          <td>${isReauthRequired ? statusPill('reauth_required') : '-'}</td>
          <td>
            <div class="inline-actions">
              ${actionButtons.join('')}
            </div>
          </td>
        </tr>
      `;
    }).join('');

  const timeline = mergeTimeline(jobsByTarget, auditEvents);
  const query = parseCurrentQuery();
  const activityFilter = query.get('activity') || 'all';
  const targetFilter = query.get('targetId') || '';
  const filteredTimeline = applyTimelineFilters(timeline, activityFilter, targetFilter);

  const filterHrefs = {
    all: buildUrl(`/workspace/campanhas/${campaign.id}`),
    jobs: buildUrl(`/workspace/campanhas/${campaign.id}`, { activity: 'jobs', targetId: targetFilter || '' }),
    audit: buildUrl(`/workspace/campanhas/${campaign.id}`, { activity: 'audit', targetId: targetFilter || '' }),
  };

  const distinctTargetIds = Array.from(
    new Set(timeline.map((entry) => entry.targetId).filter(Boolean)),
  );
  const targetOptions = [
    `<option value="">All targets</option>`,
    ...distinctTargetIds.map((id) => `<option value="${escapeHtml(id)}" ${targetFilter === id ? 'selected' : ''}>${escapeHtml(id)}</option>`),
  ].join('');

  const timelineRows = filteredTimeline.length === 0
    ? '<tr><td colspan="4" class="muted">No activity found for the selected filters.</td></tr>'
    : filteredTimeline.map((entry) => `
      <tr>
        <td>${statusPill(entry.kind)}</td>
        <td>${escapeHtml(formatDate(entry.timestamp))}</td>
        <td>${escapeHtml(entry.targetId ?? '-')}</td>
        <td>${escapeHtml(entry.label)}</td>
      </tr>
    `).join('');

  renderWorkspaceShell({
    title: `Campaign ${campaign.title}`,
    subtitle: `ID: ${campaign.id}`,
    actionsHtml: `<div class="inline-actions">${actions.join('')}</div>`,
    noticeHtml: statusResult.ok
      ? `<div class="notice info">Live status: ${escapeHtml(status?.campaignStatus ?? campaign.status)} | progress ${escapeHtml(`${status?.progress?.completed ?? 0}/${status?.progress?.total ?? targets.length}`)} | poll ${status?.shouldPoll ? 'enabled' : 'disabled'}</div>`
      : `<div class="notice warning">Status unavailable: ${escapeHtml(statusResult.error)}</div>`,
    contentHtml: `
      <section class="grid-3">
        <article class="card"><div class="summary-value">${formatNumber(targets.length)}</div><div class="summary-label">Targets</div></article>
        <article class="card"><div class="summary-value">${escapeHtml(getVideoPublishFormatLabel(publishFormat))}</div><div class="summary-label">Publish format</div></article>
        <article class="card"><div class="summary-value">${formatNumber((auditEvents ?? []).length)}</div><div class="summary-label">Audit events</div></article>
        <article class="card"><div class="summary-value">${formatNumber(timeline.length)}</div><div class="summary-label">Total activity entries</div></article>
      </section>
      ${renderCampaignLifecyclePanel(campaign, status, jobsByTarget)}
      ${canEditCampaign ? `
      <section class="card stack">
        <h3>Campaign settings</h3>
        <form id="campaign-edit-form" class="grid-3">
          <label>
            Title
            <input name="title" required value="${escapeHtml(campaign.title ?? '')}" />
          </label>
          <label>
            Scheduled at
            <input name="scheduledAt" type="datetime-local" value="${escapeHtml(toDatetimeLocalValue(campaign.scheduledAt))}" />
          </label>
          <label>
            Publish format
            <input value="${escapeHtml(getVideoPublishFormatLabel(publishFormat))}" disabled />
          </label>
          <div class="inline-actions">
            <button class="button button-primary" type="submit">Save campaign</button>
          </div>
        </form>
      </section>
      <section class="card stack">
        <h3>Add target</h3>
        <form id="campaign-add-target-form" class="grid-3">
          ${addTargetChannelFieldHtml}
          <label>
            Video title
            <input name="videoTitle" required placeholder="Target title" />
          </label>
          <label>
            Video description
            <textarea name="videoDescription" required placeholder="Target description"></textarea>
          </label>
          <fieldset class="platform-target-options">
            <legend>Instagram options <small class="muted">(Reels)</small></legend>
            <label>
              Reels caption
              <textarea name="instagramCaption" maxlength="2200" placeholder="Defaults to target description"></textarea>
            </label>
            <label class="instagram-share-row">
              <span>
                Share Reel to feed
                <small class="muted">Visible on profile feed</small>
              </span>
              <span class="schedule-toggle-switch">
                <input type="checkbox" name="instagramShareToFeed" value="1" checked />
                <span class="schedule-toggle-track" aria-hidden="true"><span class="schedule-toggle-thumb"></span></span>
                <span class="schedule-toggle-label">ON</span>
              </span>
            </label>
          </fieldset>
          <label>
            Tags (comma-separated)
            <input name="tags" placeholder="tag1, tag2" />
          </label>
          <label>
            Publish at
            <input name="publishAt" type="datetime-local" />
          </label>
          <label>
            Privacy
            <select name="privacy">
              <option value="">Default</option>
              <option value="public">public</option>
              <option value="unlisted">unlisted</option>
              <option value="private">private</option>
            </select>
          </label>
          <label>
            Playlist ID
            <input name="playlistId" />
          </label>
          <label>
            Thumbnail asset ID
            <input name="thumbnailAssetId" />
          </label>
          ${addTargetChannelNoticeHtml}
          <div class="inline-actions">
            <button class="button button-primary" type="submit" ${canSubmitConnectedTarget ? '' : 'disabled'}>Add target</button>
          </div>
        </form>
      </section>
      ` : ''}
      <section class="card stack">
        <h3>Targets</h3>
        <table>
          <thead>
            <tr>
              <th>Destination</th>
              <th>Video title</th>
              <th>Status</th>
              <th>Publish at</th>
              <th>YouTube</th>
              <th>Retries</th>
              <th>Error</th>
              <th>Reauth</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>${targetRows}</tbody>
        </table>
      </section>
      <section class="card stack">
        <div class="title-row">
          <h3>Activity timeline</h3>
          <div class="inline-actions">
            <a class="button ${activityFilter === 'all' ? 'button-primary' : 'button-secondary'}" data-link href="${filterHrefs.all}">All</a>
            <a class="button ${activityFilter === 'jobs' ? 'button-primary' : 'button-secondary'}" data-link href="${filterHrefs.jobs}">Jobs</a>
            <a class="button ${activityFilter === 'audit' ? 'button-primary' : 'button-secondary'}" data-link href="${filterHrefs.audit}">Audit</a>
          </div>
        </div>
        <form id="timeline-filter-form" class="inline-actions">
          <input type="hidden" name="activity" value="${escapeHtml(activityFilter === 'all' ? '' : activityFilter)}" />
          <label>
            Target filter
            <select name="targetId">${targetOptions}</select>
          </label>
          <button class="button button-primary" type="submit">Apply</button>
        </form>
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Timestamp</th>
              <th>Target</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>${timelineRows}</tbody>
        </table>
      </section>
      <section class="card stack">
        <h3>Raw audit payload</h3>
        <pre>${escapeHtml(JSON.stringify(auditEvents ?? [], null, 2))}</pre>
      </section>
    `,
  });

  const campaignEditForm = document.getElementById('campaign-edit-form');
  campaignEditForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(campaignEditForm);
    const submitButton = campaignEditForm.querySelector('button[type="submit"]');
    const payload = {
      title: String(data.get('title') ?? ''),
      scheduledAt: data.get('scheduledAt')
        ? new Date(String(data.get('scheduledAt'))).toISOString()
        : undefined,
    };
    setButtonBusy(submitButton, true, 'Saving...');
    const response = await api.updateCampaign(campaign.id, payload);
    setButtonBusy(submitButton, false);
    if (!response.ok) {
      setUiNotice('error', 'Campaign update failed', response.error);
      await renderCampaignDetailPage(campaign.id);
      return;
    }
    setUiNotice('success', 'Campaign updated', 'Campaign settings were saved successfully.');
    await renderCampaignDetailPage(campaign.id);
  });

  const addTargetForm = document.getElementById('campaign-add-target-form');
  const addTargetInstagramShareToggle = addTargetForm?.querySelector('input[name="instagramShareToFeed"]');
  if (addTargetInstagramShareToggle) {
    syncSwitchLabel(addTargetInstagramShareToggle);
    addTargetInstagramShareToggle.addEventListener('change', () => syncSwitchLabel(addTargetInstagramShareToggle));
  }
  addTargetForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(addTargetForm);
    const submitButton = addTargetForm.querySelector('button[type="submit"]');
    const tags = String(data.get('tags') ?? '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
    const targetTemplate = {
      videoTitle: String(data.get('videoTitle') ?? ''),
      videoDescription: String(data.get('videoDescription') ?? ''),
      tags: tags.length > 0 ? tags : undefined,
      publishAt: data.get('publishAt') ? new Date(String(data.get('publishAt'))).toISOString() : undefined,
      privacy: String(data.get('privacy') ?? '').trim() || undefined,
      playlistId: String(data.get('playlistId') ?? '').trim() || undefined,
      thumbnailAssetId: String(data.get('thumbnailAssetId') ?? '').trim() || undefined,
    };
    const platformOptions = {
      instagramCaption: String(data.get('instagramCaption') ?? '').trim(),
      instagramShareToFeed: data.get('instagramShareToFeed') === '1',
    };
    const payload = data.get('destinationRef')
      ? (() => {
          const destinationRef = String(data.get('destinationRef') ?? '');
          const [platform, destinationId] = destinationRef.split(':');
          const destination = availableConnectedChannels.find((entry) => entry.platform === platform && entry.destinationId === destinationId);
          return buildCampaignTargetPayloadForDestination(destination ?? { platform, destinationId }, targetTemplate, platformOptions);
        })()
      : {
          destinationId: String(data.get('destinationId') ?? ''),
          channelId: String(data.get('destinationId') ?? ''),
          ...targetTemplate,
        };
    setButtonBusy(submitButton, true, 'Adding...');
    const response = await api.addTarget(campaign.id, payload);
    setButtonBusy(submitButton, false);
    if (!response.ok) {
      setUiNotice('error', 'Unable to add target', response.error);
      await renderCampaignDetailPage(campaign.id);
      return;
    }
    setUiNotice('success', 'Target added', 'The target was added to the campaign.');
    await renderCampaignDetailPage(campaign.id);
  });

  const timelineFilterForm = document.getElementById('timeline-filter-form');
  timelineFilterForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(timelineFilterForm);
    const nextHref = buildUrl(`/workspace/campanhas/${campaign.id}`, {
      activity: data.get('activity') ? String(data.get('activity')) : '',
      targetId: String(data.get('targetId') ?? ''),
    });
    navigate(nextHref);
  });

  document.querySelectorAll('[data-action="retry-target"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const targetId = button.getAttribute('data-target-id');
      if (!targetId) return;
      setButtonBusy(button, true, 'Retrying...');
      const response = await api.retryTarget(campaign.id, targetId);
      setButtonBusy(button, false);
      if (!response.ok) {
        setUiNotice('error', 'Retry failed', response.error);
        await renderCampaignDetailPage(campaign.id);
        return;
      }
      setUiNotice('success', 'Retry queued', 'The failed target was queued for another attempt.');
      await renderCampaignDetailPage(campaign.id);
    });
  });

  document.querySelectorAll('[data-action="edit-target"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const targetId = button.getAttribute('data-target-id');
      if (!targetId) return;

      const target = targets.find((entry) => entry.id === targetId);
      if (!target) return;
      const values = await showFormDialog({
        title: 'Edit target',
        message: 'Update the target content and optional publish time.',
        confirmLabel: 'Save target',
        tone: 'info',
        fields: [
          { name: 'videoTitle', label: 'Video title', value: target.videoTitle ?? '', required: true },
          { name: 'videoDescription', label: 'Video description', value: target.videoDescription ?? '', required: true, type: 'textarea' },
          { name: 'publishAt', label: 'Publish at (optional, ISO date)', value: target.publishAt ?? '' },
        ],
      });
      if (values === null) return;
      const videoTitle = String(values.videoTitle ?? '');
      const videoDescription = String(values.videoDescription ?? '');
      const publishAtInput = String(values.publishAt ?? '');
      if (!videoTitle.trim() || !videoDescription.trim()) return;

      let publishAt;
      if (publishAtInput.trim()) {
        const parsedPublishAt = new Date(publishAtInput.trim());
        if (Number.isNaN(parsedPublishAt.getTime())) {
          setUiNotice('warning', 'Invalid publish date', 'Use a valid ISO date or leave the publish date empty.');
          await renderCampaignDetailPage(campaign.id);
          return;
        }
        publishAt = parsedPublishAt.toISOString();
      }

      const payload = {
        videoTitle: videoTitle.trim(),
        videoDescription: videoDescription.trim(),
        publishAt,
      };

      const response = await api.updateTarget(campaign.id, targetId, payload);
      if (!response.ok) {
        setUiNotice('error', 'Target update failed', response.error);
        await renderCampaignDetailPage(campaign.id);
        return;
      }

      setUiNotice('success', 'Target updated', 'The target content was updated successfully.');
      await renderCampaignDetailPage(campaign.id);
    });
  });

  document.querySelectorAll('[data-action="remove-target"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const targetId = button.getAttribute('data-target-id');
      if (!targetId) return;
      const confirmed = await showConfirmDialog({
        title: 'Remove target',
        message: 'This target will be removed from the campaign.',
        confirmLabel: 'Remove target',
        tone: 'warning',
      });
      if (!confirmed) return;

      setButtonBusy(button, true, 'Removing...');
      const response = await api.removeTarget(campaign.id, targetId);
      setButtonBusy(button, false);
      if (!response.ok) {
        setUiNotice('error', 'Unable to remove target', response.error);
        await renderCampaignDetailPage(campaign.id);
        return;
      }

      setUiNotice('success', 'Target removed', 'The target was removed from the campaign.');
      await renderCampaignDetailPage(campaign.id);
    });
  });

  document.querySelectorAll('[data-action="mark-ready"]').forEach((button) => {
    button.addEventListener('click', async () => {
      setButtonBusy(button, true, 'Saving...');
      const response = await api.markReady(campaign.id);
      setButtonBusy(button, false);
      if (!response.ok) {
        setUiNotice('error', 'Unable to mark ready', response.error);
        await renderCampaignDetailPage(campaign.id);
        return;
      }
      setUiNotice('success', 'Campaign updated', 'The campaign is now ready to launch.');
      await renderCampaignDetailPage(campaign.id);
    });
  });

  document.querySelectorAll('[data-action="launch-campaign"]').forEach((button) => {
    button.addEventListener('click', async () => {
      setButtonBusy(button, true, 'Launching...');
      const response = await api.launch(campaign.id);
      setButtonBusy(button, false);
      if (!response.ok) {
        setUiNotice('error', 'Launch failed', response.error);
        await renderCampaignDetailPage(campaign.id);
        return;
      }
      setUiNotice('success', 'Campaign launched', 'Launch has started for this campaign.');
      await renderCampaignDetailPage(campaign.id);
    });
  });

  document.querySelectorAll('[data-action="delete-campaign"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const confirmed = await showConfirmDialog({
        title: 'Excluir campanha',
        message: 'Isso vai remover permanentemente a campanha atual.',
        confirmLabel: 'Excluir campanha',
        tone: 'warning',
      });
      if (!confirmed) return;
      setButtonBusy(button, true, 'Excluindo...');
      const response = await api.deleteCampaign(campaign.id);
      setButtonBusy(button, false);
      if (!response.ok) {
        setUiNotice('error', 'Falha ao excluir', response.error);
        await renderCampaignDetailPage(campaign.id);
        return;
      }
      setUiNotice('success', 'Campanha excluida', 'A campanha foi excluida com sucesso.');
      navigate('/workspace/campanhas');
    });
  });

  document.querySelectorAll('[data-action="clone-campaign"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const values = await showFormDialog({
        title: 'Clone campaign',
        message: 'You can leave the title empty to use the default clone naming.',
        confirmLabel: 'Create clone',
        tone: 'info',
        fields: [
          { name: 'title', label: 'Optional clone title', value: '', placeholder: 'Leave blank for default' },
        ],
      });
      if (values === null) return;
      const title = String(values.title ?? '');
      setButtonBusy(button, true, 'Cloning...');
      const response = await api.clone(campaign.id, title.trim() || undefined);
      setButtonBusy(button, false);
      if (!response.ok) {
        setUiNotice('error', 'Clone failed', response.error);
        await renderCampaignDetailPage(campaign.id);
        return;
      }
      const newId = response.body?.campaign?.id;
      if (!newId) {
        setUiNotice('success', 'Campaign cloned', 'A clone was created, but the new id was not returned.');
        await renderCampaignDetailPage(campaign.id);
        return;
      }
      setUiNotice('success', 'Campaign cloned', 'The cloned campaign is ready for review.');
      navigate(`/workspace/campanhas/${encodeURIComponent(newId)}`);
    });
  });

  if (statusResult.ok && status?.shouldPoll) {
    clearAutoRefreshTimer();
    state.autoRefreshTimer = setTimeout(() => {
      if (window.location.pathname !== `/workspace/campanhas/${encodeURIComponent(campaign.id)}`) {
        return;
      }
      void renderCampaignDetailPage(campaign.id);
    }, 3000);
  }
}

function renderNotFoundPage() {
  const isWorkspace = window.location.pathname.startsWith('/workspace');
  if (!isWorkspace) {
    root.innerHTML = `
      <div class="page">
        <main class="container">
          <section class="card stack">
            <h1>Not found</h1>
            <p class="muted">The page does not exist.</p>
            <a data-link href="/login">Go to login</a>
          </section>
        </main>
      </div>
    `;
    return;
  }

  renderWorkspaceShell({
    title: 'Not found',
    subtitle: 'This workspace page does not exist.',
    contentHtml: '<section class="card"><a data-link href="/workspace/dashboard">Back to dashboard</a></section>',
  });
}

async function renderRoute() {
  if (state.routeInFlight) return;
  clearAutoRefreshTimer();
  clearDashboardClockTimer();
  state.routeInFlight = true;
  try {
    const rawPath = window.location.pathname;
    const path = rawPath.length > 1 && rawPath.endsWith('/') ? rawPath.replace(/\/+$/, '') : rawPath;
    if (path !== rawPath) {
      navigate(`${path}${window.location.search || ''}`, true);
      return;
    }
    if (path === '/') {
      const me = await ensureAuthenticated();
      if (me) {
        navigate(me.needsPlanSelection ? '/onboarding/plan' : '/workspace/dashboard', true);
        return;
      }
      const query = parseCurrentQuery();
      renderLoginPage({
        mode: query.get('mode') === 'register' ? 'register' : 'login',
        initialSection: window.location.hash.replace(/^#/, '') || 'acesso',
        accessFirst: false,
      });
      return;
    }

    if (path === '/privacy') {
      renderPrivacyPolicyPage();
      return;
    }

    if (path === '/terms') {
      renderTermsOfServicePage();
      return;
    }

    if (path === '/data-deletion') {
      renderDataDeletionPage();
      return;
    }

    if (path === '/login') {
      const query = parseCurrentQuery();
      renderLoginPage({
        mode: query.get('mode') === 'register' ? 'register' : 'login',
        initialSection: window.location.hash.replace(/^#/, '') || 'acesso',
      });
      return;
    }

    if (path === '/login/callback') {
      await renderGoogleAuthCallbackPage();
      return;
    }

    if (path === '/onboarding/plan') {
      const me = await ensureAuthenticated();
      if (!me) {
        renderLoginPage({ initialSection: 'planos' });
        return;
      }
      if (!me.needsPlanSelection) {
        navigate('/workspace/dashboard', true);
        return;
      }
      await renderPlanSelectionPage();
      return;
    }

    if (path.startsWith('/workspace')) {
      const me = await ensureAuthenticated();
      if (!me) {
        unauthorizedRedirect();
        return;
      }
      if (me.needsPlanSelection) {
        navigate('/onboarding/plan', true);
        return;
      }
      await ensureAccountPlan();

      if (path === '/workspace') {
        navigate('/workspace/dashboard', true);
        return;
      }

      if (path === '/workspace/dashboard') {
        await renderDashboardPage();
        return;
      }

      if (path === '/workspace/growth/configuracoes') {
        navigate('/workspace/configuracoes', true);
        return;
      }

      if (path === '/workspace/growth' || path.startsWith('/workspace/growth/')) {
        await renderGrowthPage(path);
        return;
      }

      if (path === '/workspace/accounts/callback') {
        await renderAccountsOauthCallbackPage();
        return;
      }

      if (path === '/workspace/accounts') {
        await renderAccountsPage();
        return;
      }

      if (path === '/workspace/videos') {
        await renderVideosPage();
        return;
      }

      if (path === '/workspace/media') {
        const extra = window.location.search ? window.location.search.replace(/^\?/, '&') : '';
        navigate(`/workspace/videos?view=library${extra}`, true);
        return;
      }

      if (path === '/workspace/playlists') {
        navigate('/workspace/videos?view=playlists', true);
        return;
      }

      if (path === '/workspace/configuracoes') {
        await renderSettingsPage();
        return;
      }

      if (path === '/workspace/perfil') {
        await renderProfilePage();
        return;
      }

      const playlistDetailMatch = path.match(/^\/workspace\/playlists\/([^/]+)$/);
      if (playlistDetailMatch) {
        await renderPlaylistDetailPage(decodeURIComponent(playlistDetailMatch[1]));
        return;
      }

      if (path === '/workspace/planos') {
        await renderPlanosPage();
        return;
      }

      if (path === '/workspace/campanhas') {
        await renderCampaignsPage();
        return;
      }

      if (path === '/workspace/campanhas/nova') {
        await renderCampaignComposerPage();
        return;
      }

      const campaignFlowMatch = path.match(/^\/workspace\/campanhas\/Etapa([1-6])$/);
      if (campaignFlowMatch) {
        await renderCampaignFlowPage(Number(campaignFlowMatch[1]));
        return;
      }

      const detailMatch = path.match(/^\/workspace\/campanhas\/([^/]+)$/);
      if (detailMatch) {
        await renderCampaignDetailPage(decodeURIComponent(detailMatch[1]));
        return;
      }
    }

    renderNotFoundPage();
  } catch (error) {
    renderFatal(error instanceof Error ? error.message : 'Unknown error');
  } finally {
    state.routeInFlight = false;
    if (state.rerenderQueued) {
      state.rerenderQueued = false;
      void renderRoute();
    }
  }
}

applyBackgroundTheme(state.backgroundTheme);
applyLocaleTranslations();
attachGlobalNavigation();
void renderRoute();
