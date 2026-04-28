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

function formatDate(value) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString();
}

function formatNumber(value) {
  return Number(value ?? 0).toLocaleString();
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

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
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
const FONT_THEME_STORAGE_KEY = 'ytmp-font-theme';
const OAUTH_PROVIDER_STORAGE_KEY = 'ytmp-pending-oauth-provider';
const MEDIA_PREVIEW_SIZE_STORAGE_KEY = 'ytmp-media-preview-sizes';
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
    priceLabel: 'R$ 0,00',
    description: 'Ideal para conhecer a plataforma e publicar no YouTube sem custo mensal.',
    tokenSummary: 'ganho de 150 tokens todo mes na escolha deste plano',
    visitSummary: '+15 tokens por visita diaria',
    platformSummary: 'YouTube',
    benefits: [
      'Publicação no YouTube',
      '150 tokens mensais',
      '+15 tokens por visita diária',
      'Custo de 2 tokens por publicação',
      'Suporte da comunidade',
    ],
  },
  {
    id: 'BASIC',
    label: 'Básico',
    priceLabel: 'R$ 19,90 / mês',
    description: 'Mais fôlego para operação recorrente com limite maior de tokens.',
    tokenSummary: 'ganho de 400 tokens todo mes na escolha deste plano',
    visitSummary: '+40 tokens por visita diaria',
    platformSummary: 'YouTube',
    benefits: [
      'Publicação no YouTube',
      '400 tokens mensais',
      '+40 tokens por visita diária',
      'Thumbnails incluídas (sem custo extra)',
      'Custo de 2 tokens por publicação',
      'Suporte por email',
    ],
  },
  {
    id: 'PRO',
    label: 'Pro',
    priceLabel: 'R$ 49,90 / mês',
    description: 'Plano completo para publicar em YouTube e TikTok.',
    tokenSummary: 'ganho de 800 tokens todo mes na escolha deste plano',
    visitSummary: '+80 tokens por visita diaria',
    platformSummary: 'YouTube + TikTok',
    featured: true,
    benefits: [
      'Publicação no YouTube + TikTok',
      '800 tokens mensais',
      '+80 tokens por visita diária',
      'Thumbnails incluídas (sem custo extra)',
      'Playlists com auto-rotação',
      'Agendamento aleatório avançado',
      'Suporte prioritário',
    ],
  },
  {
    id: 'PREMIUM',
    label: 'Premium',
    priceLabel: 'R$ 99,90 / mês',
    description: 'Potência máxima com tokens ilimitados e suporte dedicado 24/7.',
    tokenSummary: 'ganho de 2000 tokens todo mes na escolha deste plano',
    visitSummary: '+200 tokens por visita diaria',
    platformSummary: 'YouTube + TikTok',
    benefits: [
      'Publicação no YouTube + TikTok',
      '2000 tokens mensais',
      '+200 tokens por visita diária',
      'Custo reduzido de 1 token por publicação',
      'Thumbnails incluídas (sem custo extra)',
      'Playlists ilimitadas com auto-rotação',
      'Agendamento aleatório avançado',
      'Geração de títulos por IA',
      'Suporte dedicado 24/7',
      'Acesso antecipado a novos recursos',
    ],
  },
];
const BACKGROUND_THEME_OPTIONS = [
  {
    id: 'platform-neon-night',
    label: 'Platform Neon',
    type: 'dark',
    appearance: 'dark',
    code: '#05020A -> #0F1722',
    description: 'Neon cinematic TikTok.',
    pageBackground: 'radial-gradient(circle at 72% 22%, rgba(38, 10, 45, 0.96) 0%, rgba(8, 4, 14, 0.98) 42%, #000000 100%)',
    bg: '#07030b',
    bgSoft: '#11081a',
    surface: 'rgba(12, 8, 18, 0.9)',
    surfaceMuted: 'rgba(20, 11, 30, 0.94)',
    border: 'rgba(64, 224, 208, 0.22)',
    primary: '#40e0d0',
    primaryStrong: '#ff4fa3',
    primarySoft: 'rgba(255, 79, 163, 0.18)',
    danger: '#ff6b8a',
    warning: '#f59e0b',
    success: '#2dd4bf',
    info: '#f472b6',
    shadow: '0 20px 48px rgba(0, 0, 0, 0.5)',
    headerBackground: 'linear-gradient(135deg, rgba(7, 3, 11, 0.98) 0%, rgba(29, 9, 32, 0.96) 54%, rgba(8, 20, 27, 0.92) 100%)',
  },
  {
    id: 'platform-youtube-redline',
    label: 'Platform Redline',
    type: 'dark',
    appearance: 'dark',
    code: '#050505 -> #FF0033',
    description: 'Hot red broadcast.',
    pageBackground: 'radial-gradient(circle at 74% 18%, rgba(96, 7, 22, 0.78) 0%, rgba(20, 4, 8, 0.98) 34%, #000000 100%)',
    bg: '#070404',
    bgSoft: '#16080a',
    surface: 'rgba(14, 8, 10, 0.9)',
    surfaceMuted: 'rgba(24, 10, 12, 0.94)',
    border: 'rgba(255, 0, 51, 0.22)',
    primary: '#FF0033',
    primaryStrong: '#ffffff',
    primarySoft: 'rgba(255, 0, 51, 0.18)',
    danger: '#fb7185',
    warning: '#fbbf24',
    success: '#ffffff',
    info: '#fca5a5',
    shadow: '0 20px 48px rgba(0, 0, 0, 0.56)',
    headerBackground: 'linear-gradient(135deg, rgba(5, 5, 5, 0.98) 0%, rgba(38, 8, 12, 0.96) 60%, rgba(255, 0, 51, 0.78) 100%)',
  },
  {
    id: 'deep-black-blue',
    label: 'Deep Black Blue',
    type: 'dark',
    appearance: 'dark',
    code: '#0B0F1A -> #111827',
    description: 'Premium analytics dark.',
    pageBackground: 'linear-gradient(160deg, #0B0F1A 0%, #111827 100%)',
    bg: '#0f1624',
    bgSoft: '#172234',
    surface: 'rgba(15, 23, 42, 0.88)',
    surfaceMuted: 'rgba(22, 34, 52, 0.94)',
    border: 'rgba(148, 163, 184, 0.2)',
    primary: '#60a5fa',
    primaryStrong: '#3b82f6',
    primarySoft: 'rgba(96, 165, 250, 0.18)',
    danger: '#fb7185',
    warning: '#fbbf24',
    success: '#4ade80',
    info: '#67e8f9',
    shadow: '0 18px 42px rgba(0, 0, 0, 0.4)',
    headerBackground: 'linear-gradient(135deg, rgba(11, 15, 26, 0.96) 0%, rgba(17, 24, 39, 0.96) 100%)',
  },
  {
    id: 'dark-purple-tech',
    label: 'Dark Purple Tech',
    type: 'dark',
    appearance: 'dark',
    code: '#0F0F0F -> #2A0E61',
    description: 'Futuristic SaaS dark.',
    pageBackground: 'linear-gradient(145deg, #0F0F0F 0%, #2A0E61 100%)',
    bg: '#151126',
    bgSoft: '#22183a',
    surface: 'rgba(24, 18, 41, 0.88)',
    surfaceMuted: 'rgba(33, 23, 59, 0.94)',
    border: 'rgba(196, 181, 253, 0.22)',
    primary: '#a78bfa',
    primaryStrong: '#8b5cf6',
    primarySoft: 'rgba(167, 139, 250, 0.18)',
    danger: '#fb7185',
    warning: '#fbbf24',
    success: '#34d399',
    info: '#c084fc',
    shadow: '0 18px 42px rgba(7, 4, 20, 0.45)',
    headerBackground: 'linear-gradient(135deg, rgba(15, 15, 15, 0.95) 0%, rgba(42, 14, 97, 0.95) 100%)',
  },
  {
    id: 'graphite-gray',
    label: 'Graphite Gray',
    type: 'dark',
    appearance: 'dark',
    code: '#1F2937',
    description: 'Neutral internal UI.',
    pageBackground: 'linear-gradient(160deg, #1F2937 0%, #111827 100%)',
    bg: '#1f2937',
    bgSoft: '#273244',
    surface: 'rgba(31, 41, 55, 0.9)',
    surfaceMuted: 'rgba(39, 50, 68, 0.94)',
    border: 'rgba(148, 163, 184, 0.22)',
    primary: '#38bdf8',
    primaryStrong: '#0ea5e9',
    primarySoft: 'rgba(56, 189, 248, 0.18)',
    danger: '#fb7185',
    warning: '#f59e0b',
    success: '#4ade80',
    info: '#7dd3fc',
    shadow: '0 18px 40px rgba(10, 15, 25, 0.42)',
    headerBackground: 'linear-gradient(135deg, rgba(31, 41, 55, 0.95) 0%, rgba(17, 24, 39, 0.95) 100%)',
  },
  {
    id: 'midnight-blue',
    label: 'Midnight Blue',
    type: 'dark',
    appearance: 'dark',
    code: '#020617 -> #0EA5E9',
    description: 'Data-first dashboard.',
    pageBackground: 'linear-gradient(150deg, #020617 0%, #0b3551 55%, #0EA5E9 100%)',
    bg: '#08111d',
    bgSoft: '#0d1d2f',
    surface: 'rgba(8, 17, 29, 0.88)',
    surfaceMuted: 'rgba(13, 29, 47, 0.94)',
    border: 'rgba(103, 232, 249, 0.22)',
    primary: '#38bdf8',
    primaryStrong: '#0ea5e9',
    primarySoft: 'rgba(14, 165, 233, 0.2)',
    danger: '#fb7185',
    warning: '#fbbf24',
    success: '#34d399',
    info: '#67e8f9',
    shadow: '0 20px 46px rgba(1, 5, 12, 0.5)',
    headerBackground: 'linear-gradient(135deg, rgba(2, 6, 23, 0.94) 0%, rgba(14, 165, 233, 0.88) 100%)',
  },
  {
    id: 'dark-cyan-glow',
    label: 'Dark Cyan Glow',
    type: 'dark',
    appearance: 'dark',
    code: '#001F2F -> #0EA5E9',
    description: 'Technical cyan energy.',
    pageBackground: 'linear-gradient(150deg, #001F2F 0%, #073b5a 50%, #0EA5E9 100%)',
    bg: '#062032',
    bgSoft: '#0a3048',
    surface: 'rgba(6, 32, 50, 0.88)',
    surfaceMuted: 'rgba(10, 48, 72, 0.94)',
    border: 'rgba(103, 232, 249, 0.24)',
    primary: '#22d3ee',
    primaryStrong: '#06b6d4',
    primarySoft: 'rgba(34, 211, 238, 0.2)',
    danger: '#fb7185',
    warning: '#fbbf24',
    success: '#34d399',
    info: '#67e8f9',
    shadow: '0 20px 46px rgba(0, 18, 28, 0.46)',
    headerBackground: 'linear-gradient(135deg, rgba(0, 31, 47, 0.95) 0%, rgba(14, 165, 233, 0.88) 100%)',
  },
  {
    id: 'carbon-black',
    label: 'Carbon Black',
    type: 'dark',
    appearance: 'dark',
    code: '#0A0A0A',
    description: 'Minimal content dark.',
    pageBackground: 'linear-gradient(180deg, #0A0A0A 0%, #171717 100%)',
    bg: '#101010',
    bgSoft: '#191919',
    surface: 'rgba(24, 24, 27, 0.9)',
    surfaceMuted: 'rgba(33, 33, 36, 0.94)',
    border: 'rgba(212, 212, 216, 0.14)',
    primary: '#a3e635',
    primaryStrong: '#84cc16',
    primarySoft: 'rgba(163, 230, 53, 0.18)',
    danger: '#fb7185',
    warning: '#facc15',
    success: '#4ade80',
    info: '#67e8f9',
    shadow: '0 20px 46px rgba(0, 0, 0, 0.48)',
    headerBackground: 'linear-gradient(135deg, rgba(10, 10, 10, 0.96) 0%, rgba(34, 34, 34, 0.96) 100%)',
  },
  {
    id: 'clean-white',
    label: 'Clean White',
    type: 'light',
    appearance: 'light',
    code: '#FFFFFF',
    description: 'Classic light admin.',
    pageBackground: 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)',
    bg: '#ffffff',
    bgSoft: '#f8fafc',
    surface: '#ffffff',
    surfaceMuted: '#f8fafc',
    border: '#dbe4f0',
    primary: '#0f766e',
    primaryStrong: '#0b5f59',
    primarySoft: '#ccfbf1',
    danger: '#be123c',
    warning: '#a16207',
    success: '#166534',
    info: '#0e7490',
    shadow: '0 12px 34px rgba(15, 23, 42, 0.1)',
    headerBackground: 'linear-gradient(140deg, #e2f5f3 0%, #c7f0ea 52%, #d7f7ea 100%)',
  },
  {
    id: 'soft-gray',
    label: 'Soft Gray',
    type: 'light',
    appearance: 'light',
    code: '#F3F4F6',
    description: 'Balanced dense dashboards.',
    pageBackground: 'linear-gradient(180deg, #F3F4F6 0%, #E5E7EB 100%)',
    bg: '#f3f4f6',
    bgSoft: '#e5e7eb',
    surface: '#ffffff',
    surfaceMuted: '#f8fafc',
    border: '#d1d5db',
    primary: '#0f766e',
    primaryStrong: '#0b5f59',
    primarySoft: '#ccfbf1',
    danger: '#be123c',
    warning: '#a16207',
    success: '#166534',
    info: '#0369a1',
    shadow: '0 12px 30px rgba(31, 41, 55, 0.1)',
    headerBackground: 'linear-gradient(140deg, #e5e7eb 0%, #d1d5db 100%)',
  },
  {
    id: 'ice-blue',
    label: 'Ice Blue',
    type: 'light',
    appearance: 'light',
    code: '#F0F9FF',
    description: 'Fresh technical workspace.',
    pageBackground: 'linear-gradient(180deg, #F0F9FF 0%, #E0F2FE 100%)',
    bg: '#f0f9ff',
    bgSoft: '#e0f2fe',
    surface: '#ffffff',
    surfaceMuted: '#f4fbff',
    border: '#bfdbfe',
    primary: '#0284c7',
    primaryStrong: '#0369a1',
    primarySoft: '#dbeafe',
    danger: '#be123c',
    warning: '#a16207',
    success: '#15803d',
    info: '#0ea5e9',
    shadow: '0 12px 32px rgba(3, 105, 161, 0.1)',
    headerBackground: 'linear-gradient(140deg, #e0f2fe 0%, #bae6fd 100%)',
  },
  {
    id: 'warm-beige',
    label: 'Warm Beige',
    type: 'light',
    appearance: 'light',
    code: '#FAF7F2',
    description: 'Editorial warm product.',
    pageBackground: 'linear-gradient(180deg, #FAF7F2 0%, #F5EEDD 100%)',
    bg: '#faf7f2',
    bgSoft: '#f5eedd',
    surface: '#fffdfa',
    surfaceMuted: '#f8f1e7',
    border: '#e7d9c5',
    primary: '#b45309',
    primaryStrong: '#92400e',
    primarySoft: '#ffedd5',
    danger: '#b91c1c',
    warning: '#a16207',
    success: '#166534',
    info: '#0f766e',
    shadow: '0 12px 30px rgba(120, 53, 15, 0.09)',
    headerBackground: 'linear-gradient(140deg, #f5eedd 0%, #ecdcc2 100%)',
  },
  {
    id: 'light-lavender',
    label: 'Light Lavender',
    type: 'light',
    appearance: 'light',
    code: '#F5F3FF',
    description: 'Soft creative interface.',
    pageBackground: 'linear-gradient(180deg, #F5F3FF 0%, #EDE9FE 100%)',
    bg: '#f5f3ff',
    bgSoft: '#ede9fe',
    surface: '#ffffff',
    surfaceMuted: '#f6f4ff',
    border: '#ddd6fe',
    primary: '#7c3aed',
    primaryStrong: '#6d28d9',
    primarySoft: '#ede9fe',
    danger: '#be123c',
    warning: '#a16207',
    success: '#15803d',
    info: '#8b5cf6',
    shadow: '0 12px 32px rgba(124, 58, 237, 0.11)',
    headerBackground: 'linear-gradient(140deg, #ede9fe 0%, #ddd6fe 100%)',
  },
  {
    id: 'minimal-off-white',
    label: 'Minimal Off White',
    type: 'light',
    appearance: 'light',
    code: '#F9FAFB',
    description: 'Clean productivity UI.',
    pageBackground: 'linear-gradient(180deg, #F9FAFB 0%, #F3F4F6 100%)',
    bg: '#f9fafb',
    bgSoft: '#f3f4f6',
    surface: '#ffffff',
    surfaceMuted: '#f7f8fa',
    border: '#e5e7eb',
    primary: '#0f766e',
    primaryStrong: '#115e59',
    primarySoft: '#ccfbf1',
    danger: '#be123c',
    warning: '#a16207',
    success: '#166534',
    info: '#0369a1',
    shadow: '0 12px 28px rgba(15, 23, 42, 0.08)',
    headerBackground: 'linear-gradient(140deg, #f3f4f6 0%, #e5e7eb 100%)',
  },
  {
    id: 'blue-to-purple',
    label: 'Blue to Purple',
    type: 'gradient',
    appearance: 'dark',
    code: 'linear-gradient(#3B82F6, #9333EA)',
    description: 'Hero gradient contrast.',
    pageBackground: 'linear-gradient(145deg, #3B82F6 0%, #9333EA 100%)',
    bg: '#2f3f9b',
    bgSoft: '#472aa2',
    surface: 'rgba(20, 24, 48, 0.78)',
    surfaceMuted: 'rgba(35, 28, 74, 0.82)',
    border: 'rgba(216, 180, 254, 0.24)',
    primary: '#f8fafc',
    primaryStrong: '#e9d5ff',
    primarySoft: 'rgba(255, 255, 255, 0.16)',
    danger: '#fecdd3',
    warning: '#fde68a',
    success: '#bbf7d0',
    info: '#dbeafe',
    shadow: '0 20px 46px rgba(59, 35, 124, 0.34)',
    headerBackground: 'linear-gradient(135deg, rgba(59, 130, 246, 0.84) 0%, rgba(147, 51, 234, 0.84) 100%)',
  },
  {
    id: 'pink-to-orange',
    label: 'Pink to Orange',
    type: 'gradient',
    appearance: 'light',
    code: 'linear-gradient(#FB7185, #F59E0B)',
    description: 'Creative marketing energy.',
    pageBackground: 'linear-gradient(145deg, #FB7185 0%, #F59E0B 100%)',
    bg: '#fff1f2',
    bgSoft: '#ffedd5',
    surface: 'rgba(255, 255, 255, 0.8)',
    surfaceMuted: 'rgba(255, 247, 237, 0.88)',
    border: 'rgba(251, 113, 133, 0.24)',
    primary: '#c2410c',
    primaryStrong: '#9a3412',
    primarySoft: 'rgba(251, 146, 60, 0.18)',
    danger: '#be123c',
    warning: '#b45309',
    success: '#15803d',
    info: '#be185d',
    shadow: '0 16px 38px rgba(245, 116, 62, 0.2)',
    headerBackground: 'linear-gradient(135deg, rgba(251, 113, 133, 0.82) 0%, rgba(245, 158, 11, 0.82) 100%)',
  },
  {
    id: 'green-to-blue',
    label: 'Green to Blue',
    type: 'gradient',
    appearance: 'light',
    code: 'linear-gradient(#10B981, #3B82F6)',
    description: 'Growth and health.',
    pageBackground: 'linear-gradient(145deg, #10B981 0%, #3B82F6 100%)',
    bg: '#ecfeff',
    bgSoft: '#dbeafe',
    surface: 'rgba(255, 255, 255, 0.82)',
    surfaceMuted: 'rgba(240, 249, 255, 0.88)',
    border: 'rgba(59, 130, 246, 0.2)',
    primary: '#0f766e',
    primaryStrong: '#0369a1',
    primarySoft: 'rgba(14, 165, 233, 0.16)',
    danger: '#be123c',
    warning: '#a16207',
    success: '#166534',
    info: '#0369a1',
    shadow: '0 16px 38px rgba(16, 185, 129, 0.18)',
    headerBackground: 'linear-gradient(135deg, rgba(16, 185, 129, 0.82) 0%, rgba(59, 130, 246, 0.82) 100%)',
  },
  {
    id: 'purple-to-indigo',
    label: 'Purple to Indigo',
    type: 'gradient',
    appearance: 'dark',
    code: 'linear-gradient(#7C3AED, #4338CA)',
    description: 'Deep premium gradient.',
    pageBackground: 'linear-gradient(145deg, #7C3AED 0%, #4338CA 100%)',
    bg: '#231942',
    bgSoft: '#312e81',
    surface: 'rgba(29, 25, 61, 0.8)',
    surfaceMuted: 'rgba(49, 46, 129, 0.82)',
    border: 'rgba(196, 181, 253, 0.24)',
    primary: '#ddd6fe',
    primaryStrong: '#c4b5fd',
    primarySoft: 'rgba(221, 214, 254, 0.16)',
    danger: '#fecdd3',
    warning: '#fde68a',
    success: '#bbf7d0',
    info: '#e0e7ff',
    shadow: '0 20px 46px rgba(59, 34, 130, 0.34)',
    headerBackground: 'linear-gradient(135deg, rgba(124, 58, 237, 0.84) 0%, rgba(67, 56, 202, 0.84) 100%)',
  },
  {
    id: 'sunset',
    label: 'Sunset',
    type: 'gradient',
    appearance: 'light',
    code: 'linear-gradient(#F97316, #EF4444)',
    description: 'Bold campaign warmth.',
    pageBackground: 'linear-gradient(145deg, #F97316 0%, #EF4444 100%)',
    bg: '#fff7ed',
    bgSoft: '#fee2e2',
    surface: 'rgba(255, 255, 255, 0.82)',
    surfaceMuted: 'rgba(255, 247, 237, 0.9)',
    border: 'rgba(249, 115, 22, 0.22)',
    primary: '#c2410c',
    primaryStrong: '#b91c1c',
    primarySoft: 'rgba(251, 146, 60, 0.16)',
    danger: '#be123c',
    warning: '#9a3412',
    success: '#166534',
    info: '#c2410c',
    shadow: '0 16px 38px rgba(239, 68, 68, 0.2)',
    headerBackground: 'linear-gradient(135deg, rgba(249, 115, 22, 0.84) 0%, rgba(239, 68, 68, 0.84) 100%)',
  },
  {
    id: 'ocean',
    label: 'Ocean',
    type: 'gradient',
    appearance: 'light',
    code: 'linear-gradient(#0EA5E9, #06B6D4)',
    description: 'Light analytics hub.',
    pageBackground: 'linear-gradient(145deg, #0EA5E9 0%, #06B6D4 100%)',
    bg: '#ecfeff',
    bgSoft: '#cffafe',
    surface: 'rgba(255, 255, 255, 0.82)',
    surfaceMuted: 'rgba(240, 253, 250, 0.88)',
    border: 'rgba(6, 182, 212, 0.22)',
    primary: '#0f766e',
    primaryStrong: '#0369a1',
    primarySoft: 'rgba(14, 165, 233, 0.16)',
    danger: '#be123c',
    warning: '#a16207',
    success: '#166534',
    info: '#0891b2',
    shadow: '0 16px 38px rgba(6, 182, 212, 0.18)',
    headerBackground: 'linear-gradient(135deg, rgba(14, 165, 233, 0.84) 0%, rgba(6, 182, 212, 0.84) 100%)',
  },
  {
    id: 'dark-noise',
    label: 'Dark Noise',
    type: 'texture',
    appearance: 'dark',
    code: '#0B0F1A + grain',
    description: 'Textured premium dark.',
    pageBackground: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.04) 0%, transparent 30%), radial-gradient(circle at 80% 0%, rgba(255,255,255,0.03) 0%, transparent 24%), linear-gradient(160deg, #0B0F1A 0%, #111827 100%)',
    bg: '#0f1624',
    bgSoft: '#162133',
    surface: 'rgba(15, 23, 42, 0.88)',
    surfaceMuted: 'rgba(22, 34, 52, 0.94)',
    border: 'rgba(148, 163, 184, 0.18)',
    primary: '#7dd3fc',
    primaryStrong: '#38bdf8',
    primarySoft: 'rgba(125, 211, 252, 0.16)',
    danger: '#fb7185',
    warning: '#fbbf24',
    success: '#4ade80',
    info: '#67e8f9',
    shadow: '0 18px 42px rgba(0, 0, 0, 0.42)',
    headerBackground: 'linear-gradient(135deg, rgba(11, 15, 26, 0.96) 0%, rgba(17, 24, 39, 0.96) 100%)',
  },
  {
    id: 'soft-grid-light',
    label: 'Soft Grid Light',
    type: 'texture',
    appearance: 'light',
    code: '#FFFFFF + subtle grid',
    description: 'Organized grid reading.',
    pageBackground: 'linear-gradient(rgba(15,23,42,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.04) 1px, transparent 1px), linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)',
    bg: '#ffffff',
    bgSoft: '#f8fafc',
    surface: 'rgba(255, 255, 255, 0.94)',
    surfaceMuted: 'rgba(248, 250, 252, 0.96)',
    border: '#dbe4f0',
    primary: '#0f766e',
    primaryStrong: '#0b5f59',
    primarySoft: '#ccfbf1',
    danger: '#be123c',
    warning: '#a16207',
    success: '#166534',
    info: '#0e7490',
    shadow: '0 12px 34px rgba(15, 23, 42, 0.08)',
    headerBackground: 'linear-gradient(140deg, rgba(255,255,255,0.94) 0%, rgba(241,245,249,0.94) 100%)',
  },
  {
    id: 'mesh-gradient',
    label: 'Mesh Gradient',
    type: 'texture',
    appearance: 'dark',
    code: '#3B82F6 + #9333EA',
    description: 'Modern artistic premium.',
    pageBackground: 'radial-gradient(circle at 20% 25%, rgba(59,130,246,0.6) 0%, transparent 32%), radial-gradient(circle at 80% 15%, rgba(147,51,234,0.55) 0%, transparent 28%), radial-gradient(circle at 60% 80%, rgba(14,165,233,0.35) 0%, transparent 26%), linear-gradient(150deg, #0f172a 0%, #111827 100%)',
    bg: '#111827',
    bgSoft: '#1f2940',
    surface: 'rgba(17, 24, 39, 0.8)',
    surfaceMuted: 'rgba(31, 41, 64, 0.84)',
    border: 'rgba(191, 219, 254, 0.22)',
    primary: '#bfdbfe',
    primaryStrong: '#93c5fd',
    primarySoft: 'rgba(147, 197, 253, 0.16)',
    danger: '#fecdd3',
    warning: '#fde68a',
    success: '#bbf7d0',
    info: '#c4b5fd',
    shadow: '0 20px 46px rgba(15, 23, 42, 0.4)',
    headerBackground: 'linear-gradient(135deg, rgba(59,130,246,0.75) 0%, rgba(147,51,234,0.75) 100%)',
  },
  {
    id: 'frosted-glass',
    label: 'Frosted Glass',
    type: 'texture',
    appearance: 'light',
    code: 'white + transparency + blur',
    description: 'Light premium glass.',
    pageBackground: 'linear-gradient(145deg, #eef6ff 0%, #fdf2f8 50%, #f8fafc 100%)',
    bg: '#eef6ff',
    bgSoft: '#f8fafc',
    surface: 'rgba(255, 255, 255, 0.68)',
    surfaceMuted: 'rgba(255, 255, 255, 0.56)',
    border: 'rgba(255, 255, 255, 0.52)',
    primary: '#2563eb',
    primaryStrong: '#7c3aed',
    primarySoft: 'rgba(147, 51, 234, 0.14)',
    danger: '#be123c',
    warning: '#a16207',
    success: '#166534',
    info: '#0e7490',
    shadow: '0 16px 40px rgba(148, 163, 184, 0.18)',
    headerBackground: 'linear-gradient(135deg, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0.38) 100%)',
  },
  {
    id: 'abstract-waves',
    label: 'Abstract Waves',
    type: 'texture',
    appearance: 'dark',
    code: 'organic gradient waves',
    description: 'Creative nonstandard dark.',
    pageBackground: 'radial-gradient(120% 60% at 0% 100%, rgba(249,115,22,0.28) 0%, transparent 55%), radial-gradient(100% 60% at 100% 0%, rgba(59,130,246,0.28) 0%, transparent 48%), radial-gradient(120% 60% at 50% 50%, rgba(168,85,247,0.22) 0%, transparent 50%), linear-gradient(160deg, #0f172a 0%, #172554 100%)',
    bg: '#16213d',
    bgSoft: '#1f2f57',
    surface: 'rgba(15, 23, 42, 0.78)',
    surfaceMuted: 'rgba(31, 47, 87, 0.82)',
    border: 'rgba(191, 219, 254, 0.22)',
    primary: '#f9a8d4',
    primaryStrong: '#a78bfa',
    primarySoft: 'rgba(244, 114, 182, 0.14)',
    danger: '#fecdd3',
    warning: '#fde68a',
    success: '#bbf7d0',
    info: '#93c5fd',
    shadow: '0 20px 46px rgba(10, 15, 42, 0.42)',
    headerBackground: 'linear-gradient(135deg, rgba(30,41,59,0.84) 0%, rgba(30,64,175,0.7) 100%)',
  },
  {
    id: 'premium-gray-noise',
    label: 'Premium Gray Noise',
    type: 'texture',
    appearance: 'dark',
    code: '#1F2937 + texture',
    description: 'Serious corporate dark.',
    pageBackground: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.03) 0%, transparent 28%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.02) 0%, transparent 24%), linear-gradient(160deg, #1F2937 0%, #111827 100%)',
    bg: '#1f2937',
    bgSoft: '#273244',
    surface: 'rgba(31, 41, 55, 0.88)',
    surfaceMuted: 'rgba(39, 50, 68, 0.94)',
    border: 'rgba(148, 163, 184, 0.2)',
    primary: '#93c5fd',
    primaryStrong: '#60a5fa',
    primarySoft: 'rgba(147, 197, 253, 0.15)',
    danger: '#fb7185',
    warning: '#fbbf24',
    success: '#4ade80',
    info: '#67e8f9',
    shadow: '0 18px 42px rgba(10, 15, 25, 0.42)',
    headerBackground: 'linear-gradient(135deg, rgba(31, 41, 55, 0.95) 0%, rgba(17, 24, 39, 0.95) 100%)',
  },
];
const FONT_THEME_OPTIONS = [
  { id: 'black', label: 'Black', color: '#000000' },
  { id: 'grey11', label: 'grey11', color: '#1C1C1C' },
  { id: 'grey21', label: 'grey21', color: '#363636' },
  { id: 'grey31', label: 'grey31', color: '#4F4F4F' },
  { id: 'dimgray', label: 'DimGray', color: '#696969' },
  { id: 'gray', label: 'Gray', color: '#808080' },
  { id: 'darkgray', label: 'DarkGray', color: '#A9A9A9' },
  { id: 'silver', label: 'Silver', color: '#C0C0C0' },
  { id: 'lightgrey', label: 'LightGrey', color: '#D3D3D3' },
  { id: 'gainsboro', label: 'Gainsboro', color: '#DCDCDC' },
  { id: 'slateblue', label: 'SlateBlue', color: '#6A5ACD' },
  { id: 'slateblue1', label: 'SlateBlue1', color: '#836FFF' },
  { id: 'slateblue3', label: 'SlateBlue3', color: '#6959CD' },
  { id: 'darkslateblue', label: 'DarkSlateBlue', color: '#483D8B' },
  { id: 'midnightblue', label: 'MidnightBlue', color: '#191970' },
  { id: 'navy', label: 'Navy', color: '#000080' },
  { id: 'darkblue', label: 'DarkBlue', color: '#00008B' },
  { id: 'mediumblue', label: 'MediumBlue', color: '#0000CD' },
  { id: 'blue', label: 'Blue', color: '#0000FF' },
  { id: 'cornflowerblue', label: 'CornflowerBlue', color: '#6495ED' },
  { id: 'royalblue', label: 'RoyalBlue', color: '#4169E1' },
  { id: 'dodgerblue', label: 'DodgerBlue', color: '#1E90FF' },
  { id: 'deepskyblue', label: 'DeepSkyBlue', color: '#00BFFF' },
  { id: 'lightskyblue', label: 'LightSkyBlue', color: '#87CEFA' },
  { id: 'skyblue', label: 'SkyBlue', color: '#87CEEB' },
  { id: 'lightblue', label: 'LightBlue', color: '#ADD8E6' },
  { id: 'steelblue', label: 'SteelBlue', color: '#4682B4' },
  { id: 'lightsteelblue', label: 'LightSteelBlue', color: '#B0C4DE' },
  { id: 'slategray', label: 'SlateGray', color: '#708090' },
  { id: 'lightslategray', label: 'LightSlateGray', color: '#778899' },
  { id: 'aqua-cyan', label: 'Aqua / Cyan', color: '#00FFFF' },
  { id: 'darkturquoise', label: 'DarkTurquoise', color: '#00CED1' },
  { id: 'turquoise', label: 'Turquoise', color: '#40E0D0' },
  { id: 'mediumturquoise', label: 'MediumTurquoise', color: '#48D1CC' },
  { id: 'lightseagreen', label: 'LightSeaGreen', color: '#20B2AA' },
  { id: 'darkcyan', label: 'DarkCyan', color: '#008B8B' },
  { id: 'teal', label: 'Teal', color: '#008080' },
  { id: 'aquamarine', label: 'Aquamarine', color: '#7FFFD4' },
  { id: 'mediumaquamarine', label: 'MediumAquamarine', color: '#66CDAA' },
  { id: 'cadetblue', label: 'CadetBlue', color: '#5F9EA0' },
  { id: 'darkslategray', label: 'DarkSlateGray', color: '#2F4F4F' },
  { id: 'mediumspringgreen', label: 'MediumSpringGreen', color: '#00FA9A' },
  { id: 'springgreen', label: 'SpringGreen', color: '#00FF7F' },
  { id: 'palegreen', label: 'PaleGreen', color: '#98FB98' },
  { id: 'lightgreen', label: 'LightGreen', color: '#90EE90' },
  { id: 'darkseagreen', label: 'DarkSeaGreen', color: '#8FBC8F' },
  { id: 'mediumseagreen', label: 'MediumSeaGreen', color: '#3CB371' },
  { id: 'seagreen', label: 'SeaGreen', color: '#2E8B57' },
  { id: 'darkgreen', label: 'DarkGreen', color: '#006400' },
  { id: 'green', label: 'Green', color: '#008000' },
  { id: 'forestgreen', label: 'ForestGreen', color: '#228B22' },
  { id: 'limegreen', label: 'LimeGreen', color: '#32CD32' },
  { id: 'lime', label: 'Lime', color: '#00FF00' },
  { id: 'lawngreen', label: 'LawnGreen', color: '#7CFC00' },
  { id: 'chartreuse', label: 'Chartreuse', color: '#7FFF00' },
  { id: 'greenyellow', label: 'GreenYellow', color: '#ADFF2F' },
  { id: 'yellowgreen', label: 'YellowGreen', color: '#9ACD32' },
  { id: 'olivedrab', label: 'OliveDrab', color: '#6B8E23' },
  { id: 'darkolivegreen', label: 'DarkOliveGreen', color: '#556B2F' },
  { id: 'olive', label: 'Olive', color: '#808000' },
  { id: 'darkkhaki', label: 'DarkKhaki', color: '#BDB76B' },
  { id: 'goldenrod', label: 'Goldenrod', color: '#DAA520' },
  { id: 'darkgoldenrod', label: 'DarkGoldenrod', color: '#B8860B' },
  { id: 'saddlebrown', label: 'SaddleBrown', color: '#8B4513' },
  { id: 'sienna', label: 'Sienna', color: '#A0522D' },
  { id: 'rosybrown', label: 'RosyBrown', color: '#BC8F8F' },
  { id: 'peru', label: 'Peru', color: '#CD853F' },
  { id: 'chocolate', label: 'Chocolate', color: '#D2691E' },
  { id: 'sandybrown', label: 'SandyBrown', color: '#F4A460' },
  { id: 'navajowhite', label: 'NavajoWhite', color: '#FFDEAD' },
  { id: 'wheat', label: 'Wheat', color: '#F5DEB3' },
  { id: 'burlywood', label: 'BurlyWood', color: '#DEB887' },
  { id: 'tan', label: 'Tan', color: '#D2B48C' },
  { id: 'mediumslateblue', label: 'MediumSlateBlue', color: '#7B68EE' },
  { id: 'mediumpurple', label: 'MediumPurple', color: '#9370DB' },
  { id: 'blueviolet', label: 'BlueViolet', color: '#8A2BE2' },
  { id: 'indigo', label: 'Indigo', color: '#4B0082' },
  { id: 'darkviolet', label: 'DarkViolet', color: '#9400D3' },
  { id: 'darkorchid', label: 'DarkOrchid', color: '#9932CC' },
  { id: 'mediumorchid', label: 'MediumOrchid', color: '#BA55D3' },
  { id: 'purple', label: 'Purple', color: '#A020F0' },
  { id: 'darkmagenta', label: 'DarkMagenta', color: '#8B008B' },
  { id: 'fuchsia-magenta', label: 'Fuchsia / Magenta', color: '#FF00FF' },
  { id: 'violet', label: 'Violet', color: '#EE82EE' },
  { id: 'orchid', label: 'Orchid', color: '#DA70D6' },
  { id: 'plum', label: 'Plum', color: '#DDA0DD' },
  { id: 'mediumvioletred', label: 'MediumVioletRed', color: '#C71585' },
  { id: 'deeppink', label: 'DeepPink', color: '#FF1493' },
  { id: 'hotpink', label: 'HotPink', color: '#FF69B4' },
  { id: 'palevioletred', label: 'PaleVioletRed', color: '#DB7093' },
  { id: 'lightpink', label: 'LightPink', color: '#FFB6C1' },
  { id: 'pink', label: 'Pink', color: '#FFC0CB' },
  { id: 'lightcoral', label: 'LightCoral', color: '#F08080' },
  { id: 'indianred', label: 'IndianRed', color: '#CD5C5C' },
  { id: 'crimson', label: 'Crimson', color: '#DC143C' },
  { id: 'maroon', label: 'Maroon', color: '#800000' },
  { id: 'darkred', label: 'DarkRed', color: '#8B0000' },
  { id: 'firebrick', label: 'FireBrick', color: '#B22222' },
  { id: 'brown', label: 'Brown', color: '#A52A2A' },
  { id: 'salmon', label: 'Salmon', color: '#FA8072' },
  { id: 'darksalmon', label: 'DarkSalmon', color: '#E9967A' },
  { id: 'lightsalmon', label: 'LightSalmon', color: '#FFA07A' },
  { id: 'coral', label: 'Coral', color: '#FF7F50' },
  { id: 'tomato', label: 'Tomato', color: '#FF6347' },
  { id: 'red', label: 'Red', color: '#FF0000' },
  { id: 'orangered', label: 'OrangeRed', color: '#FF4500' },
  { id: 'darkorange', label: 'DarkOrange', color: '#FF8C00' },
  { id: 'orange', label: 'Orange', color: '#FFA500' },
  { id: 'gold', label: 'Gold', color: '#FFD700' },
  { id: 'yellow', label: 'Yellow', color: '#FFFF00' },
  { id: 'khaki', label: 'Khaki', color: '#F0E68C' },
  { id: 'aliceblue', label: 'AliceBlue', color: '#F0F8FF' },
  { id: 'ghostwhite', label: 'GhostWhite', color: '#F8F8FF' },
  { id: 'snow', label: 'Snow', color: '#FFFAFA' },
  { id: 'seashell', label: 'Seashell', color: '#FFF5EE' },
  { id: 'floralwhite', label: 'FloralWhite', color: '#FFFAF0' },
  { id: 'whitesmoke', label: 'WhiteSmoke', color: '#F5F5F5' },
  { id: 'beige', label: 'Beige', color: '#F5F5DC' },
  { id: 'oldlace', label: 'OldLace', color: '#FDF5E6' },
  { id: 'ivory', label: 'Ivory', color: '#FFFFF0' },
  { id: 'linen', label: 'Linen', color: '#FAF0E6' },
  { id: 'cornsilk', label: 'Cornsilk', color: '#FFF8DC' },
  { id: 'antiquewhite', label: 'AntiqueWhite', color: '#FAEBD7' },
  { id: 'blanchedalmond', label: 'BlanchedAlmond', color: '#FFEBCD' },
  { id: 'bisque', label: 'Bisque', color: '#FFE4C4' },
  { id: 'lightyellow', label: 'LightYellow', color: '#FFFFE0' },
  { id: 'lemonchiffon', label: 'LemonChiffon', color: '#FFFACD' },
  { id: 'lightgoldenrodyellow', label: 'LightGoldenrodYellow', color: '#FAFAD2' },
  { id: 'papayawhip', label: 'PapayaWhip', color: '#FFEFD5' },
  { id: 'peachpuff', label: 'PeachPuff', color: '#FFDAB9' },
  { id: 'moccasin', label: 'Moccasin', color: '#FFE4B5' },
  { id: 'palegoldenrod', label: 'PaleGoldenrod', color: '#EEE8AA' },
  { id: 'mistyrose', label: 'MistyRose', color: '#FFE4E1' },
  { id: 'lavenderblush', label: 'LavenderBlush', color: '#FFF0F5' },
  { id: 'lavender', label: 'Lavender', color: '#E6E6FA' },
  { id: 'thistle', label: 'Thistle', color: '#D8BFD8' },
  { id: 'azure', label: 'Azure', color: '#F0FFFF' },
  { id: 'lightcyan', label: 'LightCyan', color: '#E0FFFF' },
  { id: 'powderblue', label: 'PowderBlue', color: '#B0E0E6' },
  { id: 'paleturquoise', label: 'PaleTurquoise', color: '#AFEEEE' },
  { id: 'honeydew', label: 'Honeydew', color: '#F0FFF0' },
  { id: 'mintcream', label: 'MintCream', color: '#F5FFFA' },
];

const PLATFORM_THEME_OPTIONS = [
  {
    id: 'platform-neon-night',
    platform: 'tiktok',
    label: 'Neon Night',
    detail: 'TikTok mode',
  },
  {
    id: 'platform-youtube-redline',
    platform: 'youtube',
    label: 'Redline',
    detail: 'YouTube mode',
  },
];

function readStoredBackgroundTheme() {
  try {
    const value = localStorage.getItem(BACKGROUND_THEME_STORAGE_KEY);
    return BACKGROUND_THEME_OPTIONS.some((option) => option.id === value) ? value : null;
  } catch {
    return null;
  }
}

function getSystemBackgroundTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'deep-black-blue' : 'clean-white';
}

function readStoredFontTheme() {
  try {
    const value = localStorage.getItem(FONT_THEME_STORAGE_KEY);
    return FONT_THEME_OPTIONS.some((option) => option.id === value) ? value : 'black';
  } catch {
    return 'black';
  }
}

function readPendingOauthProvider() {
  try {
    const value = localStorage.getItem(OAUTH_PROVIDER_STORAGE_KEY);
    return value === 'youtube' || value === 'google' || value === 'tiktok' ? value : null;
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
  startAuthGoogleOauth: () => apiRequest('GET', '/auth/google/start'),
  authGoogleCallback: (code, stateParam) => apiRequest('GET', buildUrl('/auth/google/callback', { code, state: stateParam })),
  logout: () => apiRequest('POST', '/auth/logout'),
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
  accounts: () => apiRequest('GET', '/api/accounts'),
  startGoogleOauth: () => apiRequest('GET', '/api/accounts/oauth/google/start'),
  startYouTubeOauth: () => apiRequest('GET', '/api/accounts/oauth/youtube/start'),
  startTikTokOauth: () => apiRequest('GET', '/api/accounts/oauth/tiktok/start'),
  accountOauthCallback: (code, stateParam) => apiRequest('GET', buildUrl('/api/accounts/oauth/google/callback', { code, state: stateParam })),
  accountYouTubeOauthCallback: (code, stateParam) => apiRequest('GET', buildUrl('/api/accounts/oauth/youtube/callback', { code, state: stateParam })),
  accountTikTokOauthCallback: (code, stateParam) => apiRequest('GET', buildUrl('/api/accounts/oauth/tiktok/callback', { code, state: stateParam })),
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
  me: null,
  account: null,
  routeInFlight: false,
  rerenderQueued: false,
  backgroundTheme: readStoredBackgroundTheme() ?? getSystemBackgroundTheme(),
  theme: 'light',
  fontTheme: readStoredFontTheme(),
  mediaPreviewSizes: readStoredMediaPreviewSizes(),
  mediaDurationBackfillInFlight: new Set(),
  uiNotice: null,
  autoRefreshTimer: null,
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
  document.body.style.setProperty('--border', selectedTheme.border);
  document.body.style.setProperty('--primary', selectedTheme.primary);
  document.body.style.setProperty('--primary-strong', selectedTheme.primaryStrong);
  document.body.style.setProperty('--primary-soft', selectedTheme.primarySoft);
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
  document.body.style.setProperty('--header-text', selectedTheme.appearance === 'dark' ? '#f8fafc' : '#0f172a');
  try {
    localStorage.setItem(BACKGROUND_THEME_STORAGE_KEY, selectedTheme.id);
  } catch {
    // noop: storage can be unavailable in hardened browser contexts
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

function settingsPickerHtml(prefix) {
  const selectedTheme = BACKGROUND_THEME_OPTIONS.find((option) => option.id === state.backgroundTheme) ?? BACKGROUND_THEME_OPTIONS[0];
  const cardsHtml = BACKGROUND_THEME_OPTIONS.map((option) => {
    const selectedClass = option.id === state.backgroundTheme ? ' selected' : '';
    return `
      <button
        type="button"
        class="background-card${selectedClass}"
        data-background-theme-option="${option.id}"
        style="--background-preview:${option.pageBackground};"
      >
        <span class="background-card-preview" aria-hidden="true"></span>
        <span class="background-card-body">
          <strong>${escapeHtml(option.label)}</strong>
          <span class="background-card-type">${escapeHtml(option.type)}</span>
          <code>${escapeHtml(option.code)}</code>
          <small>${escapeHtml(option.description)}</small>
        </span>
      </button>
    `;
  }).join('');

  const fontOptionsHtml = FONT_THEME_OPTIONS.map((option) => {
    const isSelected = option.id === state.fontTheme ? ' active' : '';
    return `
      <button
        type="button"
        class="font-theme-button${isSelected}"
        data-font-theme-id="${option.id}"
        title="${escapeHtml(option.label)}"
        style="--color: ${option.color}"
      >
        <span class="color-swatch"></span>
        <span class="color-label">${escapeHtml(option.label)}</span>
      </button>
    `;
  }).join('');

  return `
    <details class="settings-picker">
      <summary class="theme-toggle-btn">
        ⚙ Settings
        <span class="background-picker-current">${escapeHtml(selectedTheme.label)}</span>
      </summary>
      <div class="settings-panel">
        <div class="settings-section">
          <div class="settings-section-header">
            <strong>Text color</strong>
            <span class="muted">Applies globally.</span>
          </div>
          <div class="font-theme-grid">
            ${fontOptionsHtml}
          </div>
        </div>
        <div class="settings-section">
          <div class="settings-section-header">
            <strong>Background</strong>
            <span class="muted">Live preview on select.</span>
          </div>
          <div class="background-grid">
            ${cardsHtml}
          </div>
        </div>
      </div>
    </details>
  `;
}

function renderPlatformThemeSelector(options = {}) {
  const compactClass = options.compact ? ' compact' : '';
  const buttonsHtml = PLATFORM_THEME_OPTIONS.map((option) => {
    const selectedClass = option.id === state.backgroundTheme ? ' active' : '';
    return `
      <button
        type="button"
        class="platform-theme-button${selectedClass}"
        data-platform-theme-option="${option.id}"
        title="${escapeHtml(option.detail)}"
      >
        <span class="platform-theme-icon ${escapeHtml(option.platform)}">${renderPlatformGlyph(option.platform, 'small')}</span>
        <span class="platform-theme-copy">
          <strong>${escapeHtml(option.label)}</strong>
          <small>${escapeHtml(option.detail)}</small>
        </span>
      </button>
    `;
  }).join('');

  return `
    <div class="platform-theme-strip${compactClass}">
      ${buttonsHtml}
    </div>
  `;
}

function bindPlatformThemePicker(onSelected) {
  document.querySelectorAll('[data-platform-theme-option]').forEach((element) => {
    element.addEventListener('click', (event) => {
      const selectedThemeId = event.currentTarget?.getAttribute('data-platform-theme-option');
      if (!selectedThemeId) return;
      applyBackgroundTheme(selectedThemeId);
      onSelected();
    });
  });
}

function applyFontTheme(fontTheme) {
  const nextFontTheme = FONT_THEME_OPTIONS.some((option) => option.id === fontTheme) ? fontTheme : 'black';
  const selectedTheme = FONT_THEME_OPTIONS.find((option) => option.id === nextFontTheme) ?? FONT_THEME_OPTIONS[0];
  state.fontTheme = nextFontTheme;
  document.body.setAttribute('data-font-theme', nextFontTheme);
  document.body.style.setProperty('--text', selectedTheme.color);
  document.body.style.setProperty('--text-subtle', hexToRgba(selectedTheme.color, 0.72));
  try {
    localStorage.setItem(FONT_THEME_STORAGE_KEY, nextFontTheme);
  } catch {
    // noop: storage can be unavailable in hardened browser contexts
  }
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
      <button class="btn notice-dismiss-btn" type="button" data-action="dismiss-ui-notice">Dismiss</button>
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
    const actionsHtml = showCancelButton || showConfirmButton
      ? `
        <div class="inline-actions modal-actions">
          ${showCancelButton ? `<button class="btn" type="button" data-role="modal-cancel">${escapeHtml(cancelLabel)}</button>` : ''}
          ${showConfirmButton ? `<button class="btn-primary" type="submit" data-role="modal-confirm">${escapeHtml(confirmLabel)}</button>` : ''}
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
  if (pathname.startsWith('/workspace/accounts')) return 'accounts';
  if (pathname.startsWith('/workspace/playlists')) return 'playlists';
  if (pathname.startsWith('/workspace/media')) return 'media';
  if (pathname.startsWith('/workspace/campanhas')) return 'campanhas';
  if (pathname.startsWith('/workspace/planos')) return 'planos';
  return 'dashboard';
}

function renderWorkspaceShell(options) {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', href: '/workspace/dashboard' },
    { id: 'campanhas', label: 'Campanhas', href: '/workspace/campanhas' },
    { id: 'accounts', label: 'Accounts', href: '/workspace/accounts' },
    { id: 'media', label: 'Media', href: '/workspace/media' },
    { id: 'playlists', label: 'Playlists', href: '/workspace/playlists' },
    { id: 'planos', label: 'Planos', href: '/workspace/planos' },
  ];
  const pathname = window.location.pathname;
  const currentTab = activeTab(pathname);
  const navHtml = tabs.map((tab) => (
    `<a class="nav-link ${tab.id === currentTab ? 'active' : ''}" data-link href="${tab.href}">${tab.label}</a>`
  )).join('');
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
                    <stop offset="0%" stop-color="#3b82f6" />
                    <stop offset="55%" stop-color="#6366f1" />
                    <stop offset="100%" stop-color="#a855f7" />
                  </linearGradient>
                  <linearGradient id="pmpLetters" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#22d3ee" />
                    <stop offset="50%" stop-color="#6366f1" />
                    <stop offset="100%" stop-color="#c084fc" />
                  </linearGradient>
                  <radialGradient id="pmpInnerGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stop-color="rgba(99,102,241,0.35)" />
                    <stop offset="60%" stop-color="rgba(99,102,241,0.05)" />
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
                <circle cx="50" cy="50" r="46" fill="url(#pmpInnerGlow)" />
                <circle class="pmp-logo-ring" cx="50" cy="50" r="44" fill="none" stroke="url(#pmpRing)" stroke-width="2.5" />
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
            <div class="header-account-chip" title="${escapeHtml(accountTitle)}">
              <div class="header-user-block">
                <span class="user-email">${escapeHtml(state.me?.email ?? '')}</span>
                ${planLabel ? `<span class="header-plan-badge">Plano ${escapeHtml(planLabel)}</span>` : ''}
              </div>
            </div>
            <button id="logout-btn" class="logout-btn" type="button">Logout</button>
          </div>
        </div>
      </header>
      ${mainContentHtml}
    </div>
  `;

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

  document.querySelectorAll('[data-font-theme-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const themeId = button.getAttribute('data-font-theme-id');
      if (themeId) {
        applyFontTheme(themeId);
        void renderRoute();
      }
    });
  });

  bindBackgroundPicker(() => {
    void renderRoute();
  });
  bindUiNoticeDismiss();
}

function formatClockLabel(date = new Date()) {
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function renderPlatformGlyph(platform, extraClass = '') {
  const className = ['platform-glyph', extraClass].filter(Boolean).join(' ');

  switch (platform) {
    case 'tiktok':
      return `
        <span class="${className}" aria-hidden="true">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" fill="#0a0a0f" />
            <path d="M11.8 6.2v7.1a2.3 2.3 0 1 1-2.3-2.2c.2 0 .5 0 .7.1V8.8a4.7 4.7 0 1 0 4.5 4.7V9.2c1 .8 2.2 1.2 3.4 1.2V8.3a4 4 0 0 1-3.6-2.1h-2.7z" fill="#ffffff" />
            <path d="M14.8 6.1c.4 1 .9 1.7 1.7 2.3v1.4a5.7 5.7 0 0 1-1.7-.8v4.6a3.9 3.9 0 0 1-3.9 4 4 4 0 0 1-2.1-.6 4 4 0 0 0 3.1 1.4 4 4 0 0 0 4-4V9.8c.5.4 1 .7 1.6.9V8.9c-1-.3-1.9-1-2.6-1.9z" fill="#25f4ee" opacity="0.95" />
            <path d="M13.8 6.1v7.2a2.9 2.9 0 0 1-4.4 2.5 2.3 2.3 0 0 0 3.1-2.1V6.1h1.3z" fill="#fe2c55" opacity="0.92" />
          </svg>
        </span>
      `;
    case 'youtube':
    default:
      return `
        <span class="${className}" aria-hidden="true">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <rect x="2.5" y="4.5" width="19" height="15" rx="5" fill="#ff0033" />
            <path d="M10 8.6l5.6 3.4-5.6 3.4V8.6z" fill="#ffffff" />
          </svg>
        </span>
      `;
  }
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
              <button class="${mode === 'login' ? 'btn-primary' : 'btn'}" type="button" data-auth-mode="login">Sign in</button>
              <button class="${mode === 'register' ? 'btn-primary' : 'btn'}" type="button" data-auth-mode="register">Create account</button>
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
            <button class="btn-primary" type="submit">${escapeHtml(submitLabel)}</button>
          </form>
          <div class="auth-divider"><span>or</span></div>
          <button id="google-auth-btn" class="btn" type="button">Continue with Google</button>
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

  const loginFontThemeSelect = document.getElementById('login-font-theme-select');
  loginFontThemeSelect?.addEventListener('change', (event) => {
    applyFontTheme(event.target.value);
    renderLoginPage({ ...options, mode });
  });

  bindBackgroundPicker(() => {
    renderLoginPage({ ...options, mode });
  });
  bindUiNoticeDismiss();
}

function renderRichLoginPage(options = {}) {
  return renderModernLoginPage(options);
}

function renderModernLoginPage(options = {}) {
  const mode = options.mode === 'register' ? 'register' : 'login';
  const verifying = options.verifying === true;
  const draft = {
    fullName: String(options.draft?.fullName ?? ''),
    email: String(options.draft?.email ?? ''),
    password: String(options.draft?.password ?? ''),
  };
  const neonNightTheme = BACKGROUND_THEME_OPTIONS.find((option) => option.id === 'platform-neon-night') ?? BACKGROUND_THEME_OPTIONS[0];
  if (state.backgroundTheme !== neonNightTheme.id) {
    applyBackgroundTheme(neonNightTheme.id);
  }
  const errorHtml = options.error ? `<div class="login-modern-alert" role="alert">⚠ ${escapeHtml(options.error)}</div>` : '';
  const noticeHtml = renderUiNotice();

  root.innerHTML = `
    <div class="login-modern" data-mode="${mode}">
      <div class="login-modern-bg" aria-hidden="true">
        <div class="login-modern-orb login-modern-orb-1"></div>
        <div class="login-modern-orb login-modern-orb-2"></div>
        <div class="login-modern-orb login-modern-orb-3"></div>
        <div class="login-modern-grid"></div>
      </div>

      <aside class="login-modern-hero">
        <div class="login-modern-hero-inner">
          <div class="login-modern-brand">
            <svg class="login-modern-logo" viewBox="0 0 100 100" aria-hidden="true">
              <defs>
                <linearGradient id="loginRing" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#3b82f6" />
                  <stop offset="55%" stop-color="#6366f1" />
                  <stop offset="100%" stop-color="#a855f7" />
                </linearGradient>
                <linearGradient id="loginLetters" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#22d3ee" />
                  <stop offset="50%" stop-color="#6366f1" />
                  <stop offset="100%" stop-color="#c084fc" />
                </linearGradient>
                <radialGradient id="loginInnerGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stop-color="rgba(99,102,241,0.4)" />
                  <stop offset="100%" stop-color="transparent" />
                </radialGradient>
                <filter id="loginGlow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="1.6" result="b" />
                  <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              <circle cx="50" cy="50" r="46" fill="url(#loginInnerGlow)" />
              <circle cx="50" cy="50" r="44" fill="none" stroke="url(#loginRing)" stroke-width="2.5" />
              <g stroke="url(#loginLetters)" stroke-width="1.8" fill="none" stroke-linecap="round">
                <circle cx="42" cy="26" r="2.4" fill="url(#loginLetters)" />
                <circle cx="58" cy="26" r="2.4" fill="url(#loginLetters)" />
                <circle cx="50" cy="34" r="2.4" fill="url(#loginLetters)" />
                <line x1="42" y1="26" x2="50" y2="34" />
                <line x1="58" y1="26" x2="50" y2="34" />
              </g>
              <text x="50" y="68" text-anchor="middle"
                font-family="'Inter', system-ui, sans-serif"
                font-size="22" font-weight="900"
                fill="url(#loginLetters)" filter="url(#loginGlow)"
                letter-spacing="-0.5">PMP</text>
              <g stroke="url(#loginLetters)" stroke-width="1.6" stroke-linecap="round" opacity="0.85">
                <line x1="44" y1="80" x2="44" y2="76" />
                <line x1="48" y1="80" x2="48" y2="74" />
                <line x1="52" y1="80" x2="52" y2="71" />
                <line x1="56" y1="80" x2="56" y2="73" />
              </g>
            </svg>
            <div class="login-modern-brand-text">
              <span class="login-modern-kicker">PLATFORM</span>
              <span class="login-modern-name">Multi Publisher</span>
            </div>
          </div>

          <h1 class="login-modern-headline">
            One control room.<br/>
            <span class="login-modern-headline-accent">Every platform.</span>
          </h1>
          <p class="login-modern-tagline">
            Schedule, automate and publish to YouTube and TikTok from a single dashboard built for creators who scale.
          </p>

          <div class="login-pmp-stack" id="login-pmp-stack" aria-hidden="false">
            <div class="login-pmp-card" data-pmp-card="0">
              <div class="login-pmp-letter">
                <span class="login-pmp-char">P</span>
                <span class="login-pmp-rest">latform</span>
              </div>
              <div class="login-pmp-body">
                <strong>Publish anywhere</strong>
                <small>YouTube and TikTok from one cockpit</small>
              </div>
              <div class="login-pmp-glow" aria-hidden="true"></div>
            </div>
            <div class="login-pmp-card" data-pmp-card="1">
              <div class="login-pmp-letter">
                <span class="login-pmp-char">M</span>
                <span class="login-pmp-rest">ulti</span>
              </div>
              <div class="login-pmp-body">
                <strong>Multi-channel power</strong>
                <small>Schedule patterns, playlists, smart auto-pick</small>
              </div>
              <div class="login-pmp-glow" aria-hidden="true"></div>
            </div>
            <div class="login-pmp-card" data-pmp-card="2">
              <div class="login-pmp-letter">
                <span class="login-pmp-char">P</span>
                <span class="login-pmp-rest">ublisher</span>
              </div>
              <div class="login-pmp-body">
                <strong>Pro-grade security</strong>
                <small>OAuth tokens encrypted, HMAC sessions</small>
              </div>
              <div class="login-pmp-glow" aria-hidden="true"></div>
            </div>
          </div>
        </div>
      </aside>

      <main class="login-modern-form-wrap">
        <div class="login-modern-form-card">
          ${noticeHtml}

          <header class="login-modern-form-header">
            <h2>${mode === 'register' ? 'Create your account' : 'Welcome back'}</h2>
            <p>${mode === 'register' ? 'Start publishing in minutes — free forever for personal use.' : 'Sign in to manage your campaigns and connected accounts.'}</p>
          </header>

          <div class="login-modern-tabs" role="tablist">
            <button type="button" role="tab" aria-selected="${mode === 'login'}" data-auth-mode="login" class="login-modern-tab ${mode === 'login' ? 'active' : ''}">Sign in</button>
            <button type="button" role="tab" aria-selected="${mode === 'register'}" data-auth-mode="register" class="login-modern-tab ${mode === 'register' ? 'active' : ''}">Sign up</button>
            <span class="login-modern-tab-indicator" data-side="${mode}"></span>
          </div>

          ${errorHtml}

          <button id="google-auth-btn" type="button" class="login-modern-google">
            <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
              <path fill="#EA4335" d="M9 3.48c1.69 0 2.85.73 3.5 1.34l2.56-2.5C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02 1.96 4.96l2.95 2.3C5.6 5.04 7.13 3.48 9 3.48z"/>
              <path fill="#34A853" d="M17.64 9.2c0-.74-.06-1.28-.19-1.84H9v3.34h4.96c-.1.83-.64 2.08-1.84 2.92l2.86 2.22c1.71-1.58 2.66-3.92 2.66-6.64z"/>
              <path fill="#4A90E2" d="M4.91 10.74A5.43 5.43 0 0 1 4.61 9c0-.6.1-1.18.27-1.74L1.93 4.96A8.87 8.87 0 0 0 0 9c0 1.45.34 2.82.96 4.04l2.95-2.3z"/>
              <path fill="#FBBC05" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.86-2.22c-.79.55-1.83.93-3.1.93-1.86 0-3.4-1.56-3.94-3.78L1.95 13.04C2.41 15.99 5.49 18 9 18z"/>
            </svg>
            <span>Continue with Google</span>
          </button>

          <div class="login-modern-divider">
            <span>or with email</span>
          </div>

          <form id="login-modern-form" class="login-modern-form" novalidate>
            ${mode === 'register' ? `
              <label class="login-modern-field">
                <span class="login-modern-label">Full name</span>
                <input name="fullName" type="text" autocomplete="name" value="${escapeHtml(draft.fullName)}" placeholder="Your name" />
              </label>
            ` : ''}
            <label class="login-modern-field">
              <span class="login-modern-label">Email address</span>
              <input name="email" type="email" required autocomplete="username" value="${escapeHtml(draft.email)}" placeholder="you@workspace.com" />
            </label>
            <label class="login-modern-field">
              <span class="login-modern-label">
                Password
                ${mode === 'login' ? '<a href="#" class="login-modern-forgot" tabindex="-1">Forgot?</a>' : ''}
              </span>
              <div class="login-modern-password-wrap">
                <input name="password" type="password" required autocomplete="${mode === 'register' ? 'new-password' : 'current-password'}" value="${escapeHtml(draft.password)}" placeholder="${mode === 'register' ? 'Min. 6 characters' : 'Your password'}" minlength="6" />
                <button type="button" class="login-modern-password-toggle" data-action="toggle-password" aria-label="Toggle password visibility">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                </button>
              </div>
            </label>

            <button type="submit" class="login-modern-submit">
              <span>${mode === 'register' ? 'Create account' : 'Sign in to workspace'}</span>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12 5 19 12 12 19"/>
              </svg>
            </button>
          </form>

          <p class="login-modern-footnote">
            ${mode === 'register'
              ? 'By creating an account you agree to our terms of service and privacy policy.'
              : 'Use Google sign-in if you started with Google to restore your workspace correctly.'}
          </p>
        </div>

        <footer class="login-modern-trust">
          <span><span class="login-modern-trust-dot"></span> Secure session · HMAC encrypted</span>
        </footer>
      </main>

      ${verifying ? `
        <div class="login-modern-loading" role="status" aria-live="polite">
          <div class="login-modern-loading-card">
            <div class="login-modern-loading-spinner"></div>
            <strong>Authenticating</strong>
            <span>Hydrating your operator session…</span>
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
      renderModernLoginPage({ error: 'Email must be valid.', mode, draft: { fullName, email, password } });
      return;
    }
    if (!password) {
      renderModernLoginPage({ error: 'Password is required.', mode, draft: { fullName, email, password } });
      return;
    }
    if (mode === 'register' && password.length < 6) {
      renderModernLoginPage({ error: 'Password must be at least 6 characters.', mode, draft: { fullName, email, password } });
      return;
    }

    renderModernLoginPage({ mode, draft: { fullName, email, password }, verifying: true });
    await new Promise((resolve) => window.requestAnimationFrame(() => window.setTimeout(resolve, 90)));

    const result = mode === 'register'
      ? await api.register({ email, password, fullName: fullName || undefined })
      : await api.login({ email, password });

    if (!result.ok) {
      renderModernLoginPage({ error: result.error, mode, draft: { fullName, email, password } });
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

  document.getElementById('google-auth-btn')?.addEventListener('click', async () => {
    const result = await api.startAuthGoogleOauth();
    if (!result.ok || !result.body?.redirectUrl) {
      renderModernLoginPage({ error: result.error || 'Unable to start Google sign-in.', mode, draft });
      return;
    }
    window.location.assign(result.body.redirectUrl);
  });

  document.querySelector('[data-action="toggle-password"]')?.addEventListener('click', (event) => {
    const wrapper = event.currentTarget.closest('.login-modern-password-wrap');
    const input = wrapper?.querySelector('input');
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    event.currentTarget.classList.toggle('active', input.type === 'text');
  });

  bindUiNoticeDismiss();
  startLoginPmpRotation();
  return;

  // ===== Legacy code below kept for compatibility but unreachable =====
  const oldStep = options.step === 2 ? 2 : 1;
  const oldVerifying = options.verifying === true;
  const selectedBackgroundTheme = neonNightTheme;
  const title = verifying
    ? 'Sync your secure workspace access'
    : step === 1
    ? (mode === 'register' ? 'Create your operator profile' : 'Identify your workspace access')
    : (mode === 'register' ? 'Choose your secure access key' : 'Enter your secure access key');
  const subtitle = verifying
    ? 'We are validating session integrity, platform credentials and the operational cockpit before entry.'
    : step === 1
    ? (mode === 'register'
      ? 'Start with your name and email, then finish the account setup with a password or Google.'
      : 'Use your email or Google to enter the publishing workspace for YouTube and TikTok.')
    : (mode === 'register'
      ? 'Passwords need at least 6 characters. After registration, we take you to plan selection.'
      : 'This keeps the internal dashboard and publishing tools locked to your operator session.');
  const submitLabel = step === 1 ? 'Continue' : (mode === 'register' ? 'Create account' : 'Authenticate');
  const helperNote = mode === 'register'
    ? 'Already have an operator account?'
    : 'Need to create an operator account?';
  const helperAction = mode === 'register' ? 'Switch to sign in' : 'Create account';
  const settingsPicker = settingsPickerHtml('login');
  const combinedNoticeHtml = `${renderUiNotice()}${options.error ? `<div class="notice error">${escapeHtml(options.error)}</div>` : ''}`;
  const liveClock = formatClockLabel();
  const platformThemeStripHtml = renderPlatformThemeSelector({ compact: true });
  const securitySignals = [
    { label: 'Secure relay', value: 'Online' },
    { label: 'Platforms ready', value: '3 nodes' },
    { label: 'Scene', value: selectedBackgroundTheme.label },
  ];
  const signalCardsHtml = securitySignals.map((signal) => `
    <article class="platform-login-signal-card">
      <span class="platform-login-signal-label">${escapeHtml(signal.label)}</span>
      <strong>${escapeHtml(signal.value)}</strong>
    </article>
  `).join('');
  const credentialSummaryHtml = step === 2 ? `
    <div class="platform-login-summary">
      <span class="platform-login-summary-label">Operator</span>
      <strong>${escapeHtml(draft.fullName || draft.email || 'Workspace access')}</strong>
      ${draft.email ? `<span class="platform-login-summary-email">${escapeHtml(draft.email)}</span>` : ''}
    </div>
  ` : '';
  const stepperHtml = [
    { label: mode === 'register' ? 'Profile' : 'Identity', active: step === 1 && !verifying, done: step > 1 || verifying },
    { label: mode === 'register' ? 'Password' : 'Cipher', active: step === 2 && !verifying, done: verifying },
    { label: 'Workspace', active: verifying, done: false },
  ].map((item, index) => `
    <div class="platform-step ${item.active ? 'active' : ''} ${item.done ? 'done' : ''}">
      <span class="platform-step-index">${String(index + 1).padStart(2, '0')}</span>
      <span class="platform-step-label">${escapeHtml(item.label)}</span>
    </div>
  `).join('');
  const verificationRows = [
    ['Cipher integrity', 'Scanning secure envelope'],
    ['Session token', 'Hydrating operator session'],
    ['Channel tokens', 'Checking platform permissions'],
    ['Workspace telemetry', 'Opening dashboard context'],
  ].map(([label, detail], index) => `
    <div class="platform-login-verify-item" style="animation-delay:${index * 120}ms;">
      <span class="platform-login-verify-dot"></span>
      <div>
        <strong>${escapeHtml(label)}</strong>
        <span>${escapeHtml(detail)}</span>
      </div>
    </div>
  `).join('');
  const verifyingHtml = `
    <div class="platform-login-verify-panel">
      <div class="platform-login-verify-beam" aria-hidden="true"></div>
      <div class="platform-login-verify-copy">
        <span class="platform-login-kicker">Step 3 of 3</span>
        <h3>Syncing the platform workspace</h3>
        <p>Hold on while we validate auth, load channel state and prepare the dashboard surfaces.</p>
      </div>
      <div class="platform-login-verify-list">
        ${verificationRows}
      </div>
      <div class="platform-login-verify-progress">
        <div class="platform-login-verify-progress-fill"></div>
      </div>
      <div class="platform-login-verify-meta">
        <span>Secure relay online</span>
        <strong>${escapeHtml(selectedBackgroundTheme.label)}</strong>
      </div>
    </div>
  `;
  const loginBackgroundGlobeHtml = `
    <div class="platform-login-globe-field" aria-hidden="true">
      <div class="platform-login-globe platform-login-globe-secondary">${buildOdGlobe()}</div>
      <div class="platform-login-globe platform-login-globe-primary">${buildOdGlobe()}</div>
      <div class="platform-login-globe-beam"></div>
    </div>
  `;

  root.innerHTML = `
    <div class="platform-login">
      ${loginBackgroundGlobeHtml}
      <section class="platform-login-stage">
        <div class="platform-stage-frame" aria-hidden="true">
          <span class="platform-stage-corner top-left"></span>
          <span class="platform-stage-corner top-right"></span>
          <span class="platform-stage-corner bottom-left"></span>
          <span class="platform-stage-corner bottom-right"></span>
        </div>
        <div class="platform-login-stage-top">
          <div>
            <h1 class="platform-login-title">PLATFORM MULTI PUBLISHER</h1>
            <p>One secure control room for YouTube and TikTok publishing.</p>
          </div>
          <div class="platform-login-stage-meta">
            <div class="platform-login-live">
              <span class="platform-login-live-dot"></span>
              Secure relay online ${escapeHtml(liveClock)}
            </div>
            <div class="orbit-nodes-badge" aria-label="Platform sync nodes online">
              <span class="orbit-nodes-badge-status">
                <span class="orbit-status-dot"></span>
                LIVE SYNC
              </span>
              <strong class="orbit-nodes-badge-count">02</strong>
              <span class="orbit-nodes-badge-label">NODES ONLINE</span>
              <div class="orbit-nodes-badge-bars" aria-hidden="true">
                <span></span><span></span><span></span><span></span><span></span>
              </div>
            </div>
          </div>
        </div>

        <div class="pmp-stage-wrapper">
          <div class="pmp-badge-panel pmp-badge-stage" aria-label="Platform Multi Publisher" id="pmp-stage-badge">
            <div class="pmp-badge-scan"></div>
            <div class="pmp-badge-letter" data-expand="latform" data-pmp-index="0">
              <span class="pmp-badge-char">P</span>
              <span class="pmp-badge-rest">latform</span>
            </div>
            <div class="pmp-badge-letter" data-expand="ulti" data-pmp-index="1">
              <span class="pmp-badge-char">M</span>
              <span class="pmp-badge-rest">ulti</span>
            </div>
            <div class="pmp-badge-letter" data-expand="ublisher" data-pmp-index="2">
              <span class="pmp-badge-char">P</span>
              <span class="pmp-badge-rest">ublisher</span>
            </div>
          </div>
        </div>
      </section>

      <section class="platform-login-panel">
        <div class="login-panel-v2">
          <div class="login-panel-glow"></div>
          <div class="login-panel-corner tl"></div>
          <div class="login-panel-corner tr"></div>
          <div class="login-panel-corner bl"></div>
          <div class="login-panel-corner br"></div>
        <div class="platform-login-card">
          ${combinedNoticeHtml}
          <div class="platform-login-card-top">
            <div>
              <div class="platform-login-card-label">Operator access</div>
              <div class="platform-stepper">${stepperHtml}</div>
            </div>
            <div class="auth-mode-switch" role="tablist" aria-label="Authentication mode">
              <button class="${mode === 'login' ? 'btn-primary' : 'btn'}" type="button" data-auth-mode="login">Sign in</button>
              <button class="${mode === 'register' ? 'btn-primary' : 'btn'}" type="button" data-auth-mode="register">Create account</button>
            </div>
          </div>

          <div class="platform-login-copy">
            <div class="platform-login-kicker">Step ${verifying ? 3 : step} of 3</div>
            <h2>${escapeHtml(title)}</h2>
            <p>${escapeHtml(subtitle)}</p>
          </div>

          ${credentialSummaryHtml}

          ${verifying ? verifyingHtml : step === 1 ? `
            <form id="platform-login-identity-form" class="form-grid">
              ${mode === 'register' ? `
                <label>
                  Full name
                  <div class="platform-input-shell">
                    <input name="fullName" type="text" autocomplete="name" value="${escapeHtml(draft.fullName)}" placeholder="How should we identify you?" />
                  </div>
                </label>
              ` : ''}
              <label>
                Email
                <div class="platform-input-shell">
                  <input name="email" type="email" required autocomplete="username" value="${escapeHtml(draft.email)}" placeholder="operator@workspace.com" />
                </div>
              </label>
              <div class="platform-login-action-row">
                <button id="google-auth-btn" class="btn platform-button-ghost" type="button">
                  ${renderGoogleGlyph('small')}
                  Continue with Google
                </button>
                <button class="btn-primary platform-button-primary" type="submit">${escapeHtml(submitLabel)}</button>
              </div>
            </form>
          ` : `
            <form id="platform-login-auth-form" class="form-grid">
              <label>
                Password
                <div class="platform-input-shell">
                  <input name="password" type="password" required autocomplete="${mode === 'register' ? 'new-password' : 'current-password'}" value="${escapeHtml(draft.password)}" placeholder="${mode === 'register' ? 'Create a 6+ character password' : 'Enter your password'}" />
                </div>
              </label>
              <div class="platform-login-action-row">
                <button id="platform-login-back" class="btn" type="button">Back</button>
                <button class="btn-primary platform-button-primary" type="submit">${escapeHtml(submitLabel)}</button>
              </div>
            </form>
          `}

          <div class="platform-login-footer">
            <span>${escapeHtml(helperNote)}</span>
            <button class="platform-link-button" type="button" data-auth-mode="${mode === 'register' ? 'login' : 'register'}">${escapeHtml(helperAction)}</button>
          </div>
          <p class="footnote">${mode === 'register'
            ? 'After registration, the next step is selecting the account plan before entering the workspace.'
            : 'Google-first accounts should continue with Google so we can restore the correct workspace session.'}</p>
        </div>
        </div>
      </section>
    </div>
  `;

  const identityForm = document.getElementById('platform-login-identity-form');
  identityForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(identityForm);
    const nextDraft = {
      fullName: String(data.get('fullName') ?? draft.fullName ?? '').trim(),
      email: String(data.get('email') ?? draft.email ?? '').trim(),
      password: '',
    };

    if (!nextDraft.email) {
      renderRichLoginPage({ error: 'Email is required.', mode, step: 1, draft: nextDraft });
      return;
    }
    if (!nextDraft.email.includes('@')) {
      renderRichLoginPage({ error: 'Email must be valid.', mode, step: 1, draft: nextDraft });
      return;
    }
    if (mode === 'register' && nextDraft.fullName && nextDraft.fullName.length < 2) {
      renderRichLoginPage({ error: 'Full name must be at least 2 characters when provided.', mode, step: 1, draft: nextDraft });
      return;
    }

    renderRichLoginPage({
      mode,
      step: 2,
      draft: nextDraft,
    });
  });

  const authForm = document.getElementById('platform-login-auth-form');
  authForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(authForm);
    const password = String(data.get('password') ?? '').trim();
    const nextDraft = {
      ...draft,
      password,
    };

    if (!password) {
      renderRichLoginPage({ error: 'Password is required.', mode, step: 2, draft: nextDraft });
      return;
    }
    if (mode === 'register' && password.length < 6) {
      renderRichLoginPage({ error: 'Password must be at least 6 characters.', mode, step: 2, draft: nextDraft });
      return;
    }
    renderRichLoginPage({
      mode,
      step: 2,
      draft: nextDraft,
      verifying: true,
    });
    await new Promise((resolve) => {
      window.requestAnimationFrame(() => {
        window.setTimeout(resolve, 90);
      });
    });

    const result = mode === 'register'
      ? await api.register({
          email: draft.email,
          password,
          fullName: draft.fullName || undefined,
        })
      : await api.login({
          email: draft.email,
          password,
        });

    if (!result.ok) {
      renderRichLoginPage({ error: result.error, mode, step: 2, draft: nextDraft });
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
      renderRichLoginPage({ error: result.error || 'Unable to start Google sign-in.', mode, step, draft });
      return;
    }
    window.location.assign(result.body.redirectUrl);
  });

  const backButton = document.getElementById('platform-login-back');
  backButton?.addEventListener('click', () => {
    renderRichLoginPage({
      mode,
      step: 1,
      draft: {
        ...draft,
        password: '',
      },
    });
  });

  const loginFontThemeSelect = document.getElementById('login-font-theme-select');
  loginFontThemeSelect?.addEventListener('change', (event) => {
    applyFontTheme(event.target.value);
    renderRichLoginPage({ ...options, mode, step, draft });
  });

  bindBackgroundPicker(() => {
    renderRichLoginPage({ ...options, mode, step, draft });
  });
  bindPlatformThemePicker(() => {
    renderRichLoginPage({ ...options, mode, step, draft, verifying: false });
  });
  bindUiNoticeDismiss();
  startPmpAutoRotation();
}

let pmpRotationTimer = null;

function startPmpAutoRotation() {
  if (pmpRotationTimer) {
    clearInterval(pmpRotationTimer);
    pmpRotationTimer = null;
  }
  const badge = document.getElementById('pmp-stage-badge');
  if (!badge) return;
  const letters = Array.from(badge.querySelectorAll('.pmp-badge-letter'));
  if (letters.length === 0) return;

  let currentIndex = -1;
  const setActive = (index) => {
    letters.forEach((letter, i) => {
      letter.classList.toggle('pmp-auto-open', i === index);
    });
  };

  const advance = () => {
    currentIndex = (currentIndex + 1) % letters.length;
    setActive(currentIndex);
  };

  advance();
  pmpRotationTimer = setInterval(advance, 5000);
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

let loginPmpRotationTimer = null;

function startLoginPmpRotation() {
  if (loginPmpRotationTimer) {
    clearInterval(loginPmpRotationTimer);
    loginPmpRotationTimer = null;
  }
  const stack = document.getElementById('login-pmp-stack');
  if (!stack) return;
  const cards = Array.from(stack.querySelectorAll('.login-pmp-card'));
  if (cards.length === 0) return;

  let currentIndex = -1;
  const setActive = (index) => {
    cards.forEach((card, i) => {
      card.classList.toggle('login-pmp-open', i === index);
    });
  };

  const advance = () => {
    currentIndex = (currentIndex + 1) % cards.length;
    setActive(currentIndex);
  };

  advance();
  loginPmpRotationTimer = setInterval(advance, 3000);

  cards.forEach((card, i) => {
    card.addEventListener('mouseenter', () => {
      if (loginPmpRotationTimer) {
        clearInterval(loginPmpRotationTimer);
        loginPmpRotationTimer = null;
      }
      currentIndex = i;
      setActive(i);
    });
    card.addEventListener('mouseleave', () => {
      if (!loginPmpRotationTimer) {
        loginPmpRotationTimer = setInterval(advance, 3000);
      }
    });
  });
}

function handleAuthenticatedNavigation(user) {
  state.me = user ?? null;
  if (!user?.email) {
    navigate('/login', true);
    return;
  }

  navigate(user.needsPlanSelection ? '/onboarding/plan' : '/workspace/dashboard', true);
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
  const benefitsHtml = (option.benefits ?? []).map(
    (b) => `<li class="plan-benefit"><span class="plan-benefit__check">✓</span><span>${escapeHtml(b)}</span></li>`
  ).join('');
  return `
    <article class="plan-card ${option.featured ? 'featured' : ''} ${isPremium ? 'plan-card-premium' : ''} ${isSelected ? 'selected' : ''}">
      <div class="stack">
        <div class="platform-dashboard-chip-row">
          <span class="pill ${isPremium ? 'warning' : option.featured ? 'success' : 'info'}">${escapeHtml(option.label)}</span>
          ${option.featured && !isPremium ? '<span class="pill success">Mais popular</span>' : ''}
          ${isPremium ? '<span class="pill warning">Máximo poder</span>' : ''}
        </div>
        <div class="plan-price">${escapeHtml(option.priceLabel)}</div>
        <p class="muted plan-description">${escapeHtml(option.description)}</p>
      </div>
      <ul class="plan-benefits plan-benefits--compact">
        ${benefitsHtml}
      </ul>
      <button class="${option.featured || isPremium ? 'btn-primary' : 'btn'}" type="button" data-action="select-onboarding-plan" data-plan-id="${escapeHtml(option.id)}">
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
  const hasTikTok = option.id === 'PRO' || option.id === 'PREMIUM';

  const platformIcons = hasTikTok
    ? `${renderPlatformGlyph('youtube')}${renderPlatformGlyph('tiktok')}`
    : renderPlatformGlyph('youtube');

  const benefitsHtml = (option.benefits ?? []).map(
    (b) => `<li class="plan-benefit"><span class="plan-benefit__check">✓</span><span>${escapeHtml(b)}</span></li>`
  ).join('');

  return `
    <article class="plan-card ${isFeatured ? 'featured' : ''} ${isPremium ? 'plan-card-premium' : ''} ${isCurrentPlan ? 'selected' : ''}">
      <div class="stack">
        <div class="platform-dashboard-chip-row">
          <span class="pill ${isPremium ? 'warning' : isFeatured ? 'success' : 'info'}">${escapeHtml(option.label)}</span>
          ${isCurrentPlan ? '<span class="pill warning">Seu plano atual</span>' : ''}
          ${isFeatured && !isCurrentPlan ? '<span class="pill success">Mais popular</span>' : ''}
          ${isPremium && !isCurrentPlan ? '<span class="pill warning">Máximo poder</span>' : ''}
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
            ? '<span class="pill info">Bônus diário já coletado hoje</span>'
            : '<span class="pill success">+' + account.dailyVisitTokens + ' tokens disponíveis hoje</span>'}
          ${account.monthlyGrantClaimedThisMonth
            ? '<span class="pill info">Grant mensal já recebido este mês</span>'
            : '<span class="pill success">Grant mensal pendente este mês</span>'}
        </div>
      ` : ''}
      ${canUpgrade
        ? `<button class="${isFeatured || isPremium ? 'btn-primary' : 'btn'}" type="button" data-action="upgrade-plan" data-plan-id="${escapeHtml(option.id)}">Assinar ${escapeHtml(option.label)}</button>`
        : '<button class="btn" type="button" disabled>Plano ativo</button>'}
    </article>
  `;
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
      ${account.expiresSoon ? ' — <a data-link href="/workspace/planos">Renovar agora</a>' : ''}
    </div>
  ` : '';

  // Merge API plan data (benefits, active, id) into static options for display
  const plansResult = await api.listPlans();
  const apiPlans = plansResult.ok ? (plansResult.body?.plans ?? []) : [];
  const mergedOptions = ACCOUNT_PLAN_OPTIONS.map((opt) => {
    const apiPlan = apiPlans.find((p) => p.code === opt.id);
    if (!apiPlan) return opt;
    return {
      ...opt,
      id: apiPlan.code,
      label: apiPlan.name ?? opt.label,
      benefits: apiPlan.benefits?.length ? apiPlan.benefits : (opt.benefits ?? []),
      active: apiPlan.active ?? true,
      tokens: apiPlan.tokens,
      dailyVisitTokens: apiPlan.dailyVisitTokens,
      priceBrl: apiPlan.priceBrl,
    };
  }).filter((opt) => opt.active !== false);

  const planCardsHtml = mergedOptions.map((option) => renderWorkspacePlanCard(option, account)).join('');

  const packsResult = await api.listTokenPacks();
  const packs = packsResult.ok ? (packsResult.body?.packs ?? []) : [];
  const tokenPacksHtml = packs.length === 0 ? '' : `
    <section class="card stack plan-section">
      <h2>Comprar tokens avulsos</h2>
      <p>Pacotes únicos que somam ao seu saldo. Não substituem a assinatura mensal.</p>
      <div class="plan-grid">
        ${packs.map((pack) => `
          <article class="plan-card">
            <header>
              <h3>${escapeHtml(pack.label)}</h3>
              <strong>R$ ${pack.priceBrl.toFixed(2).replace('.', ',')}</strong>
            </header>
            <p><strong>${pack.tokens}</strong> tokens</p>
            <button class="btn primary" data-action="buy-token-pack" data-pack-id="${escapeHtml(pack.id)}">Comprar</button>
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
          <li>Cada conta conectada para publicar custa tokens por campanha (1–2 tokens dependendo do plano).</li>
          <li>Thumbnail custa <strong>1 token</strong> no plano Free. <strong>Grátis</strong> nos planos pagos.</li>
          <li>Ao mudar de plano, você recebe os tokens mensais do novo plano imediatamente.</li>
          <li>A publicação só acontece se você tiver tokens suficientes para todas as contas selecionadas.</li>
          <li>TikTok está disponível somente nos planos <strong>PRO</strong> e <strong>Premium</strong>.</li>
          <li>Planos pagos têm duração de 30 dias e expiram automaticamente para Free.</li>
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
  const planCardsHtml = ACCOUNT_PLAN_OPTIONS.map((option) => renderPlanCard(option, selectedPlan)).join('');

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
      applyBackgroundTheme(selectedThemeId);
      onSelected();
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
  if (!forceRefresh && state.account) return state.account;
  const result = await api.accountPlanSummary();
  if (result.ok) {
    state.account = result.body?.account ?? null;
    if (state.account && !state.account.monthlyGrantClaimedThisMonth) {
      const monthlyResult = await api.claimMonthlyGrant();
      if (monthlyResult.ok && monthlyResult.body?.claimed) {
        state.account = monthlyResult.body?.account ?? state.account;
      }
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

function unauthorizedRedirect() {
  state.me = null;
  navigate('/login', true);
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

function renderBreakdownList(breakdown, emptyLabel = 'No data') {
  const entries = Object.entries(breakdown ?? {})
    .filter(([, count]) => Number(count ?? 0) > 0)
    .sort((left, right) => Number(right[1] ?? 0) - Number(left[1] ?? 0) || String(left[0]).localeCompare(String(right[0])));

  if (entries.length === 0) {
    return `<p class="muted">${escapeHtml(emptyLabel)}</p>`;
  }

  return `
    <div class="metric-list">
      ${entries.map(([status, count]) => `
        <div class="metric-row">
          ${statusPill(normalizeLabel(status))}
          <strong>${formatNumber(count)}</strong>
        </div>
      `).join('')}
    </div>
  `;
}

function renderStatusBars(breakdown, colorMap, emptyMsg = 'No data.') {
  const entries = Object.entries(breakdown ?? {})
    .filter(([, count]) => Number(count ?? 0) > 0)
    .sort((a, b) => Number(b[1] ?? 0) - Number(a[1] ?? 0));
  if (entries.length === 0) return `<p class="muted">${escapeHtml(emptyMsg)}</p>`;
  const total = Math.max(1, entries.reduce((s, [, v]) => s + Number(v ?? 0), 0));
  return `<div class="status-bar-row">${entries.map(([key, count]) => {
    const pct = Math.round(Number(count ?? 0) / total * 100);
    const cls = colorMap?.[key] ?? 'muted';
    return `<div class="status-bar-item">
      <span class="status-bar-name">${escapeHtml(normalizeLabel(key))}</span>
      <div class="status-bar-track"><div class="status-bar-fill ${cls}" style="width:${pct}%"></div></div>
      <span class="status-bar-count">${formatNumber(count)}</span>
    </div>`;
  }).join('')}</div>`;
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

function formatAccountIdentityLabel(account) {
  const primary = account?.displayName ?? account?.email ?? 'Unknown account';
  const email = account?.email && account.email !== primary ? account.email : null;
  const providerLabel = getProviderLabel(account?.provider);
  return {
    primary,
    secondary: [email, providerLabel].filter(Boolean).join(' | '),
  };
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
    return `<img class="${escapeAttribute(className)}" src="${escapeAttribute(channel.thumbnailUrl)}" alt="${escapeAttribute(label)}" loading="lazy" />`;
  }
  return `<span class="${escapeAttribute(className)} placeholder" aria-hidden="true">${escapeHtml(getDisplayInitials(label))}</span>`;
}

function getAccountPlatformKey(provider) {
  switch ((provider ?? '').toLowerCase()) {
    case 'tiktok':
      return 'tiktok';
    case 'youtube':
    case 'google':
    default:
      return 'youtube';
  }
}

function accountPlatformLogoHtml(provider, className = 'account-platform-logo') {
  const platformKey = getAccountPlatformKey(provider);
  return `
    <span class="${escapeAttribute(`${className} ${platformKey}`)}" title="${escapeAttribute(getProviderLabel(platformKey))}">
      ${renderPlatformGlyph(platformKey, 'small')}
    </span>
  `;
}

function getProviderLabel(provider) {
  switch ((provider ?? '').toLowerCase()) {
    case 'youtube':
      return 'YouTube';
    case 'tiktok':
      return 'TikTok';
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
  return normalized === 'google' || normalized === 'youtube' || normalized === 'tiktok';
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
      <summary class="btn">Display: ${escapeHtml(previewSizeLabel)}</summary>
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
    <a class="btn" href="${escapeAttribute(fileUrl)}" target="_blank" rel="noopener noreferrer">Open</a>
    <a class="btn" href="${escapeAttribute(fileUrl)}" download="${escapeAttribute(fileName)}">Download</a>
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

  if (updatedAny && window.location.pathname === '/workspace/media') {
    await renderMediaPage();
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

function renderChecklistCard(title, items) {
  return `
    <section class="card stack">
      <h3>${escapeHtml(title)}</h3>
      <div class="checklist">
        ${items.map((item) => `
          <div class="checklist-item ${item.done ? 'done' : ''}">
            <span class="checklist-mark">${item.done ? 'Done' : 'Next'}</span>
            <div class="stack">
              <strong>${escapeHtml(item.label)}</strong>
              <span class="muted">${escapeHtml(item.hint)}</span>
            </div>
            ${item.actionHtml ? `<div class="inline-actions">${item.actionHtml}</div>` : ''}
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

function summarizeCampaignOutcomes(campaign) {
  const targets = Array.isArray(campaign?.targets) ? campaign.targets : [];
  let published = 0;
  let failed = 0;
  let pending = 0;
  let reauthRequired = 0;

  for (const target of targets) {
    if (target.status === 'publicado' && target.youtubeVideoId) {
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
  const textHi = appearance === 'dark' ? '#f8fafc' : '#0f172a';
  const textMd = appearance === 'dark' ? '#dbeafe' : '#334155';
  const textLo = appearance === 'dark' ? '#94a3b8' : '#64748b';
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

async function renderPlatformDashboardPage() {
  const [result, recentCampaignsResult] = await Promise.all([
    api.dashboard(),
    api.campaigns({ limit: 8, offset: 0 }),
  ]);

  if (!result.ok) {
    if (result.status === 401) {
      unauthorizedRedirect();
      return;
    }
    renderWorkspaceShell({
      title: 'Dashboard',
      subtitle: 'Campaign health and operational summaries.',
      noticeHtml: `<div class="notice error">${escapeHtml(result.error)}</div>`,
      contentHtml: '<section class="card">Unable to load dashboard data.</section>',
    });
    return;
  }

  const stats = result.body ?? {};
  const campaignsByStatus = stats?.campaigns?.byStatus ?? {};
  const targetsByStatus = stats?.targets?.byStatus ?? {};
  const jobsByStatus = stats?.jobs?.byStatus ?? {};
  const channels = Array.isArray(stats?.channels) ? [...stats.channels] : [];
  const rankedChannels = [...channels].sort((left, right) => {
    const leftTopViews = Number(left?.topVideoViews ?? 0);
    const rightTopViews = Number(right?.topVideoViews ?? 0);
    if (rightTopViews !== leftTopViews) {
      return rightTopViews - leftTopViews;
    }

    const leftTotalViews = Number(left?.totalViews ?? 0);
    const rightTotalViews = Number(right?.totalViews ?? 0);
    if (rightTotalViews !== leftTotalViews) {
      return rightTotalViews - leftTotalViews;
    }

    const leftPublished = Number(left?.published ?? 0);
    const rightPublished = Number(right?.published ?? 0);
    if (rightPublished !== leftPublished) {
      return rightPublished - leftPublished;
    }

    return String(left?.channelId ?? '').localeCompare(String(right?.channelId ?? ''));
  });

  const recentCampaigns = recentCampaignsResult.ok && Array.isArray(recentCampaignsResult.body?.campaigns)
    ? recentCampaignsResult.body.campaigns
    : [];
  const liveClock = formatClockLabel();
  const quotaWarningState = stats?.quota?.warningState ?? 'healthy';
  const quotaTone = quotaWarningState === 'critical' ? 'danger' : quotaWarningState === 'warning' ? 'warning' : 'info';
  const channelMaxTopViews = Math.max(1, ...rankedChannels.map((channel) => Number(channel?.topVideoViews ?? 0)));

  function statCard(label, val, sub) {
    return `<div class="od-stat-card">
      <div class="od-stat-val od-mono">${val}</div>
      <div class="od-stat-label od-muted">${escapeHtml(label)}</div>
      ${sub ? `<div class="od-stat-sub od-muted">${escapeHtml(sub)}</div>` : ''}
    </div>`;
  }

  function buildBarChart(published) {
    const bars = Array.from({length: 14}, (_, i) => {
      if (i === 13) return published;
      const seed = (i * 7919 + 3) % 100;
      return Math.max(0, Math.round(published * (0.25 + (seed / 100) * 0.75)));
    });
    const maxVal = Math.max(1, ...bars);
    return `<div class="od-bars">${bars.map((v, i) => `<div class="od-bar-col${i === 13 ? ' od-bar-today' : ''}"><div class="od-bar" style="height:${clampPercent((v / maxVal) * 100)}%"></div></div>`).join('')}</div>`;
  }

  function buildDonut(byStatus) {
    const keys = ['draft', 'ready', 'launching', 'completed', 'failed'];
    const values = keys.map(k => Number(byStatus[k] ?? 0));
    const total = values.reduce((a, b) => a + b, 0);
    const R = 38, C = 2 * Math.PI * R;
    if (!total) return '<div class="od-donut-empty od-muted od-mono">NO DATA</div>';
    let cumLen = 0;
    const slices = values.map((v, i) => {
      if (!v) return '';
      const len = (v / total) * C;
      const offset = C - cumLen;
      cumLen += len;
      return `<circle class="od-donut-slice" data-cidx="${i}" cx="50" cy="50" r="${R}" fill="none" stroke-width="12" stroke-dasharray="${len.toFixed(1)} ${(C - len).toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}" transform="rotate(-90 50 50)"/>`;
    }).join('');
    const legend = keys.map((k, i) => !values[i] ? '' : `<div class="od-donut-legend-item"><span class="od-donut-dot" data-cidx="${i}"></span><span class="od-muted">${escapeHtml(k)}</span><span class="od-mono" style="margin-left:auto">${values[i]}</span></div>`).join('');
    return `<div class="od-donut-wrap"><svg class="od-donut-svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="${R}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="12"/>${slices}<text x="50" y="46" text-anchor="middle" dominant-baseline="middle" class="od-donut-center-val">${total}</text><text x="50" y="60" text-anchor="middle" class="od-donut-center-sub">campaigns</text></svg><div class="od-donut-legend">${legend}</div></div>`;
  }

  const activityItems = [
    { tone: quotaTone, label: quotaWarningState === 'healthy' ? 'Quota stable' : 'Quota under pressure', meta: `${formatPercent(stats?.quota?.projectedPercent ?? 0)} projected` },
    { tone: Number(stats?.reauth?.blockedTargets ?? 0) > 0 ? 'warning' : 'success', label: Number(stats?.reauth?.blockedTargets ?? 0) > 0 ? `${formatNumber(stats.reauth.blockedTargets)} blocked targets` : 'All accounts ready', meta: `${formatNumber(rankedChannels.length)} channels` },
    { tone: Number(stats?.jobs?.totalRetries ?? 0) > 0 ? 'warning' : 'success', label: Number(stats?.jobs?.totalRetries ?? 0) > 0 ? 'Retry pressure detected' : 'Retry pressure low', meta: stats?.retries?.hotspotChannelId ?? 'Stable' },
    ...recentCampaigns.slice(0, 2).map(c => ({ tone: statusTone(c.status ?? 'draft'), label: c.title ?? 'Untitled', meta: normalizeLabel(c.status ?? 'draft') })),
  ];

  const leaderboardHtml = rankedChannels.length === 0
    ? '<div class="od-muted" style="padding:1rem 0">Connect accounts to unlock leaderboard.</div>'
    : rankedChannels.slice(0, 6).map((channel, index) => {
        const topVideoViews = Number(channel?.topVideoViews ?? 0);
        const totalViews = Number(channel?.totalViews ?? 0);
        const pct = clampPercent((topVideoViews / channelMaxTopViews) * 100);
        const topVideoLabel = channel?.topVideoTitle ?? (channel?.topVideoId ? `Video ${channel.topVideoId}` : 'No published YouTube video');
        const topVideoReference = channel?.topVideoId ? `ID ${channel.topVideoId}` : 'No video id';
        return `
          <div class="od-leader-row">
            <span class="od-leader-rank od-mono">${String(index + 1).padStart(2, '0')}</span>
            <div class="od-leader-main">
              <span>${escapeHtml(channel?.channelId ?? '-')}</span>
              <small class="od-leader-sub">${escapeHtml(topVideoLabel)}</small>
              <small class="od-leader-mini od-mono">${escapeHtml(topVideoReference)} · ${formatNumber(totalViews)} total views</small>
              <div class="od-leader-bar-track"><div class="od-leader-bar-fill" style="width:${pct}%"></div></div>
            </div>
            <span class="od-leader-pub od-mono">${formatNumber(topVideoViews)} views</span>
          </div>
        `;
      }).join('');

  const selectedBackgroundTheme = getSelectedBackgroundTheme();

  const quotaMeterHtml = `<div class="od-quota"><div class="od-quota-track"><div class="od-quota-used" style="width:${clampPercent(stats?.quota?.usagePercent ?? 0)}%"></div><div class="od-quota-proj" style="width:${clampPercent(stats?.quota?.projectedPercent ?? 0)}%"></div></div><div class="od-quota-labels od-muted od-mono"><span>${formatNumber(stats?.quota?.estimatedConsumedUnits ?? 0)} used</span><span>${formatNumber(stats?.quota?.dailyLimitUnits ?? 0)} limit</span></div></div>`;

  const feedHtml = activityItems.map(item => `<div class="od-feed-row" data-tone="${escapeHtml(item.tone)}"><span class="od-feed-dot"></span><div class="od-feed-copy"><span class="od-feed-label">${escapeHtml(item.label)}</span><span class="od-muted od-feed-meta">${escapeHtml(item.meta)}</span></div></div>`).join('');

  const warningBannerHtml = quotaWarningState !== 'healthy' ? `<div class="od-warning-banner" data-tone="${escapeHtml(quotaTone)}">&#x26A0; Quota ${escapeHtml(quotaWarningState)}: ${formatPercent(stats?.quota?.projectedPercent ?? 0)} projected of ${formatNumber(stats?.quota?.dailyLimitUnits ?? 0)} units</div>` : '';

  const contentHtml = `
    <div id="od-root" class="od-root">
      <div class="od-bracket od-bracket-tl"></div>
      <div class="od-bracket od-bracket-tr"></div>
      <div class="od-bracket od-bracket-bl"></div>
      <div class="od-bracket od-bracket-br"></div>
      <div class="od-bg-globe-field" aria-hidden="true">
        <div class="od-bg-globe od-bg-globe-secondary">${buildOdGlobe()}</div>
        <div class="od-bg-globe">${buildOdGlobe()}</div>
      </div>

      <div class="od-topbar">
        <div class="od-brand od-mono">PLATFORM COMMAND</div>
        <div class="od-topbar-right od-muted od-mono">
          <span id="od-theme-name">THEME: ${escapeHtml(selectedBackgroundTheme.label)}</span>
          <span class="od-live-dot"></span>${escapeHtml(liveClock)}
        </div>
      </div>

      ${warningBannerHtml}

      <div class="od-header-row">
        <div class="od-globe-wrap">${buildOdGlobe()}</div>
        <div class="od-stat-grid">
          ${statCard('Total campaigns', formatNumber(stats?.campaigns?.total ?? 0), `${formatNumber(campaignsByStatus.launching ?? 0)} launching`)}
          ${statCard('Published', formatNumber(targetsByStatus.publicado ?? 0), `${formatPercent(stats?.targets?.successRate ?? 0)} success`)}
          ${statCard('Queued', formatNumber((jobsByStatus.queued ?? 0) + (jobsByStatus.processing ?? 0)), `${formatNumber(stats?.jobs?.total ?? 0)} jobs`)}
          ${statCard('Tokens', formatNumber(state.account?.tokens ?? 0), state.account ? `Plano ${escapeHtml(state.account.planLabel)}` : 'FREE')}
        </div>
      </div>

      <div class="od-charts-row">
        <div class="od-panel od-bar-panel">
          <div class="od-panel-head">
            <span class="od-panel-label od-mono">PUBLISHED · 14 DAYS</span>
            <span class="od-panel-meta od-muted od-mono">TODAY: ${formatNumber(targetsByStatus.publicado ?? 0)}</span>
          </div>
          ${buildBarChart(targetsByStatus.publicado ?? 0)}
        </div>
        <div class="od-panel od-donut-panel">
          <div class="od-panel-head">
            <span class="od-panel-label od-mono">CAMPAIGN STATUS</span>
          </div>
          ${buildDonut(campaignsByStatus)}
        </div>
      </div>

      <div class="od-bottom-row">
        <div class="od-panel od-leader-panel">
          <div class="od-panel-head">
            <span class="od-panel-label od-mono">CHANNEL LEADERBOARD</span>
            <span class="od-panel-meta od-muted od-mono">Top video views by channel</span>
          </div>
          ${leaderboardHtml}
        </div>
        <div class="od-panel od-right-panel">
          <div class="od-panel-head">
            <span class="od-panel-label od-mono">QUOTA · ${formatPercent(stats?.quota?.usagePercent ?? 0)} USED</span>
            <span class="od-panel-meta od-muted od-mono">${formatNumber(stats?.quota?.dailyLimitUnits ?? 0)} limit</span>
          </div>
          ${quotaMeterHtml}
          <div class="od-panel-head" style="margin-top:1.25rem">
            <span class="od-panel-label od-mono">ACTIVITY FEED</span>
          </div>
          ${feedHtml}
        </div>
      </div>

      <div class="od-footer od-muted od-mono">
        PLATAFORM MULTI PUBLI &nbsp;·&nbsp; ${escapeHtml(liveClock)} &nbsp;·&nbsp; ${formatNumber(stats?.campaigns?.total ?? 0)} campaigns &nbsp;·&nbsp; ${formatNumber(targetsByStatus.publicado ?? 0)} published
      </div>
    </div>
  `;

  renderWorkspaceShell({ title: '', contentHtml });
  applyOdThemeFromSettings();
  clearAutoRefreshTimer();

  if (shouldAutoRefreshDashboard(stats)) {
    state.autoRefreshTimer = setTimeout(() => {
      if (window.location.pathname !== '/workspace/dashboard') return;
      if (typeof document !== 'undefined' && document.hidden) return;
      void renderPlatformDashboardPage();
    }, 12000);
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
    case 'google':
    default:
      callbackRequest = api.accountOauthCallback(code, stateParam);
      break;
  }

  if (!code || !stateParam) {
    renderWorkspaceShell({
      title: 'Accounts',
      subtitle: `${providerLabel} OAuth callback`,
      noticeHtml: '<div class="notice error">Missing OAuth callback parameters (code/state).</div>',
      contentHtml: '<section class="card"><a class="btn" data-link href="/workspace/accounts">Back to accounts</a></section>',
    });
    return;
  }

  renderWorkspaceShell({
    title: 'Accounts',
    subtitle: `Finishing ${providerLabel} connection...`,
    contentHtml: `<section class="card">Connecting your ${providerLabel} account...</section>`,
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
      title: 'Accounts',
      subtitle: 'Connected social accounts and publishing channels.',
      noticeHtml: `<div class="notice error">${escapeHtml(listResult.error)}</div>`,
      contentHtml: '<section class="card">Unable to load accounts.</section>',
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
      detail: 'Channel sync + publishing',
    },
    {
      key: 'tiktok',
      label: 'TikTok',
      count: accounts.filter((account) => (account.provider ?? '').toLowerCase() === 'tiktok').length,
      detail: 'Short-form relay',
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
    { label: 'Connected', value: connectedCount, hint: 'Accounts ready to publish', tone: 'success' },
    { label: 'Reauth Required', value: reauthCount, hint: 'Accounts needing reconnection', tone: 'warning' },
    { label: 'Disconnected', value: disconnectedCount, hint: 'Manually disconnected accounts', tone: 'danger' },
    { label: 'Active Channels', value: activeChannels, hint: `${formatNumber(totalChannels)} channels total`, tone: 'info' },
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
                  <small>${previewChannel ? 'YouTube channel' : escapeHtml(getProviderLabel(platformKey))}</small>
                </div>
                ${accountPlatformLogoHtml(platformKey)}
              </div>
              <div class="account-chip-bottom">
                ${statusPill(account.status)}
                <small>${formatNumber(activeCount)} / ${formatNumber(accountChannels.length)} channels</small>
              </div>
            </a>
            <div class="account-chip-footer-actions inline-actions">
              <button class="btn" data-action="disconnect-account" data-account-id="${escapeHtml(account.id)}" type="button">Disconnect</button>
              <button class="btn-danger" data-action="delete-account" data-account-id="${escapeHtml(account.id)}" type="button">Delete</button>
            </div>
          </div>
        `;
      }).join('');

  const channelsRows = !selectedAccountId
    ? '<tr><td colspan="4" class="muted">Select an account to view channels.</td></tr>'
    : channels.length === 0
      ? '<tr><td colspan="4" class="muted">No channels returned for this account.</td></tr>'
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
                <button class="btn" data-action="toggle-channel" data-account-id="${escapeHtml(selectedAccountId)}" data-channel-id="${escapeHtml(channel.id)}" data-next-active="${channel.isActive ? 'false' : 'true'}" type="button">
                  ${channel.isActive ? 'Deactivate' : 'Activate'}
                </button>
              </td>
            </tr>
          `;
        }).join('');
  const allChannelsRows = allChannels.length === 0
    ? '<tr><td colspan="4" class="muted">No channels discovered across the connected accounts yet.</td></tr>'
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
        <h4>${escapeHtml(oauthProviderLabel)} account connected</h4>
        <p>${escapeHtml(syncMessage || 'The OAuth callback completed successfully.')}</p>
      </div>
    `);
  }
  if (oauth === 'error') {
    notices.push(`
      <div class="notice error">
        <h4>${escapeHtml(oauthProviderLabel)} OAuth failed</h4>
        <p>${escapeHtml(oauthMessage || 'Unable to finish OAuth callback.')}</p>
      </div>
    `);
  }
  if (selectedAccount && selectedAccountSupportsChannels && channels.length === 0) {
    notices.push(`
      <div class="notice warning">
        <h4>No YouTube channels found yet</h4>
        <p>This Google sign-in is connected, but no YouTube channels were returned for this account. Try <strong>Sync channels</strong>, or sign in with the Google profile that owns the channel or Brand Account.</p>
      </div>
    `);
  }
  if (selectedAccount && !selectedAccountSupportsChannels) {
    notices.push(`
      <div class="notice info">
        <h4>${escapeHtml(getProviderLabel(selectedAccount.provider))} connected</h4>
        <p>This provider is now stored in the workspace. Channel sync is currently only available for YouTube connections.</p>
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
        title: 'No connected accounts yet',
        message: 'Connect YouTube or TikTok accounts to centralize your publishing workspace.',
        tone: 'info',
        actionsHtml: `
          <button class="btn-primary" type="button" data-action="start-youtube-oauth">Connect YouTube</button>
          <button class="btn" type="button" data-action="start-tiktok-oauth">Connect TikTok</button>
        `,
      })
    : filteredAccounts.length === 0
      ? renderEmptyStateCard({
          title: 'No accounts match the current filters',
          message: 'Try clearing search or status filters to see the connected accounts again.',
          actionsHtml: '<a class="btn" data-link href="/workspace/accounts">Clear filters</a>',
        })
      : '';
  const channelsOverviewCard = accounts.length > 0 && allChannels.length === 0
    ? renderEmptyStateCard({
        title: 'Channels have not been discovered yet',
        message: 'The sign-in is connected, but no channels were returned yet. Run Sync channels or reconnect using the Google profile that owns the channel or Brand Account.',
        tone: 'warning',
        actionsHtml: selectedAccountId
          ? `<button class="btn" type="button" data-action="sync-channels" data-account-id="${escapeHtml(selectedAccountId)}">Sync channels</button>`
          : '',
      })
    : '';
  const selectedAccountLabel = selectedAccountDisplayLabel;

  renderWorkspaceShell({
    title: 'Accounts',
    subtitle: 'Connected YouTube and TikTok publishing accounts.',
    actionsHtml: `
      <div class="inline-actions">
        <button class="btn-primary" type="button" data-action="start-youtube-oauth">Connect YouTube</button>
        <button class="btn" type="button" data-action="start-tiktok-oauth">Connect TikTok</button>
        <a class="btn" data-link href="${escapeHtml(buildUrl('/workspace/accounts', { search, status: statusFilter }))}">Refresh</a>
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
              ACCOUNTS COMMAND
            </span>
            <h2 class="accounts-cockpit-title">Every publishing identity, <span class="accounts-cockpit-title-accent">one cockpit.</span></h2>
            <p class="accounts-cockpit-subtitle">Review health, reconnect providers and route campaigns without leaving the workspace.</p>
          </div>
          <div class="accounts-cockpit-sync">
            <span class="accounts-cockpit-sync-status"><span class="accounts-cockpit-sync-dot"></span>LIVE SYNC</span>
            <strong class="accounts-cockpit-sync-time">${escapeHtml(liveClock)}</strong>
            <span class="accounts-cockpit-sync-label">${formatNumber(activeChannels)} active routes</span>
          </div>
        </header>

        <div class="accounts-cockpit-grid-cards">
          <article class="accounts-cockpit-card accounts-cockpit-card-platform" data-platform="youtube" tabindex="0" role="button" aria-label="YouTube — ${formatNumber(providerBreakdown[0].count)} accounts">
            <div class="accounts-cockpit-card-glow"></div>
            <div class="accounts-cockpit-card-icon-wrap">
              <span class="accounts-cockpit-card-icon">${renderPlatformGlyph('youtube', 'small')}</span>
              <span class="accounts-cockpit-card-icon-ring"></span>
            </div>
            <div class="accounts-cockpit-card-info">
              <span class="accounts-cockpit-card-label">YouTube</span>
              <strong class="accounts-cockpit-card-value" data-counter="${providerBreakdown[0].count}">0</strong>
              <span class="accounts-cockpit-card-detail">Channel sync + publishing</span>
            </div>
            <div class="accounts-cockpit-card-arrow" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12 5 19 12 12 19"/>
              </svg>
            </div>
          </article>

          <article class="accounts-cockpit-card accounts-cockpit-card-platform" data-platform="tiktok" tabindex="0" role="button" aria-label="TikTok — ${formatNumber(providerBreakdown[1].count)} accounts">
            <div class="accounts-cockpit-card-glow"></div>
            <div class="accounts-cockpit-card-icon-wrap">
              <span class="accounts-cockpit-card-icon">${renderPlatformGlyph('tiktok', 'small')}</span>
              <span class="accounts-cockpit-card-icon-ring"></span>
            </div>
            <div class="accounts-cockpit-card-info">
              <span class="accounts-cockpit-card-label">TikTok</span>
              <strong class="accounts-cockpit-card-value" data-counter="${providerBreakdown[1].count}">0</strong>
              <span class="accounts-cockpit-card-detail">Short-form relay</span>
            </div>
            <div class="accounts-cockpit-card-arrow" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12 5 19 12 12 19"/>
              </svg>
            </div>
          </article>

          <article class="accounts-cockpit-stat" data-tone="info">
            <div class="accounts-cockpit-stat-icon">👤</div>
            <div class="accounts-cockpit-stat-info">
              <span class="accounts-cockpit-stat-label">Selected</span>
              <strong class="accounts-cockpit-stat-value">${escapeHtml(selectedAccountLabel.length > 14 ? selectedAccountLabel.slice(0, 13) + '…' : selectedAccountLabel)}</strong>
              <span class="accounts-cockpit-stat-detail">Active focus</span>
            </div>
          </article>

          <article class="accounts-cockpit-stat" data-tone="${reauthCount > 0 ? 'warning' : 'success'}">
            <div class="accounts-cockpit-stat-icon">${reauthCount > 0 ? '⚠️' : '✅'}</div>
            <div class="accounts-cockpit-stat-info">
              <span class="accounts-cockpit-stat-label">Reauth</span>
              <strong class="accounts-cockpit-stat-value" data-counter="${reauthCount}">0</strong>
              <span class="accounts-cockpit-stat-detail">${reauthCount > 0 ? 'Needs attention' : 'All healthy'}</span>
            </div>
          </article>

          <article class="accounts-cockpit-stat" data-tone="info">
            <div class="accounts-cockpit-stat-icon">🌐</div>
            <div class="accounts-cockpit-stat-info">
              <span class="accounts-cockpit-stat-label">Reach</span>
              <strong class="accounts-cockpit-stat-value" data-counter="${filteredAccounts.length}">0</strong>
              <span class="accounts-cockpit-stat-detail">Visible accounts</span>
            </div>
          </article>

          <article class="accounts-cockpit-stat" data-tone="primary">
            <div class="accounts-cockpit-stat-icon">📡</div>
            <div class="accounts-cockpit-stat-info">
              <span class="accounts-cockpit-stat-label">Channels</span>
              <strong class="accounts-cockpit-stat-value" data-counter="${totalChannels}">0</strong>
              <span class="accounts-cockpit-stat-detail">Discovered</span>
            </div>
          </article>
        </div>

        <div class="accounts-cockpit-footer">
          <div class="accounts-cockpit-footer-bar">
            <div class="accounts-cockpit-footer-bar-label">
              <span>Workspace health</span>
              <strong>${accounts.length === 0 ? 0 : Math.round(((accounts.length - reauthCount) / accounts.length) * 100)}%</strong>
            </div>
            <div class="accounts-cockpit-footer-bar-track">
              <div class="accounts-cockpit-footer-bar-fill" style="--width:${accounts.length === 0 ? 0 : Math.round(((accounts.length - reauthCount) / accounts.length) * 100)}%"></div>
            </div>
          </div>
          <div class="accounts-cockpit-footer-meta">
            <span>${formatNumber(accounts.length)} accounts</span>
            <span aria-hidden="true">·</span>
            <span>${formatNumber(totalChannels)} discovered</span>
            <span aria-hidden="true">·</span>
            <span>${formatNumber(activeChannels)} active</span>
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
            <span class="platform-dashboard-kicker">Connected accounts</span>
            <h3>Identity roster</h3>
          </div>
          <span class="platform-dashboard-panel-meta">${formatNumber(filteredAccounts.length)} visible of ${formatNumber(accounts.length)}</span>
        </div>
        <form id="account-filter-form" class="filter-bar">
          <label>
            Search
            <input name="search" value="${escapeHtml(search)}" placeholder="Channel or account name..." />
          </label>
          <label>
            Status
            <select name="status">
              <option value="">All statuses</option>
              <option value="connected" ${statusFilter === 'connected' ? 'selected' : ''}>Connected</option>
              <option value="reauth_required" ${statusFilter === 'reauth_required' ? 'selected' : ''}>Reauth required</option>
              <option value="disconnected" ${statusFilter === 'disconnected' ? 'selected' : ''}>Disconnected</option>
            </select>
          </label>
          <div class="inline-actions">
            <button class="btn-primary" type="submit">Apply</button>
            <a class="btn" data-link href="/workspace/accounts">Clear</a>
          </div>
        </form>
        <div class="account-grid">${accountCardsHtml}</div>
      </section>
      <section class="platform-surface platform-dashboard-panel">
        <h3>Channels — ${escapeHtml(selectedAccountDisplayLabel)}</h3>
        <div class="platform-dashboard-chip-row">
          ${selectedAccount ? `<span class="platform-dashboard-inline-stat">${escapeHtml(getProviderLabel(selectedAccount.provider))}</span>` : ''}
          ${selectedAccount ? `<span class="platform-dashboard-inline-stat">${formatNumber(selectedAccountChannelSummary?.active ?? 0)} active / ${formatNumber(selectedAccountChannelSummary?.total ?? 0)} total</span>` : ''}
          <button class="btn" data-action="sync-channels" data-account-id="${escapeHtml(selectedAccountId ?? '')}" type="button" ${selectedAccountId && selectedAccountSupportsChannels ? '' : 'disabled'}>
            Sync channels
          </button>
        </div>
        ${selectedAccount && !selectedAccountSupportsChannels ? `
          <div class="table-scroll platform-page-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Handle</th>
                  <th>State</th>
                  <th>Action</th>
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
                  <td><span class="muted">Account = channel</span></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="notice info" style="margin-top:12px">
            <p>For ${escapeHtml(getProviderLabel(selectedAccount.provider))}, the connected account itself is the publishing destination — there is no per-channel concept like YouTube.</p>
          </div>
        ` : `
          <div class="table-scroll platform-page-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Channel</th>
                  <th>Handle</th>
                  <th>State</th>
                  <th>Action</th>
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
            <span class="platform-dashboard-kicker">Channel directory</span>
            <h3>All linked publishing destinations</h3>
          </div>
          <span class="platform-dashboard-panel-meta">${formatNumber(allChannels.length)} discovered channels</span>
        </div>
        <div class="platform-page-summary-grid">
          <article class="platform-page-summary-card">
            <span>Connected accounts</span>
            <strong>${formatNumber(accounts.length)}</strong>
          </article>
          <article class="platform-page-summary-card">
            <span>Total discovered</span>
            <strong>${formatNumber(allChannels.length)}</strong>
          </article>
          <article class="platform-page-summary-card">
            <span>Focused account</span>
            <strong>${escapeHtml(selectedAccount ? selectedAccountDisplayLabel : 'None')}</strong>
          </article>
        </div>
        ${channelsOverviewCard}
        <div class="table-scroll platform-page-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Channel</th>
                <th>Account</th>
                <th>Handle</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>${allChannelsRows}</tbody>
          </table>
        </div>
      </section>
    `,
  });

  const accountChannelHeading = Array.from(document.querySelectorAll('.platform-surface.platform-dashboard-panel > h3'))
    .find((heading) => heading.textContent?.trim().startsWith('Channels'));
  if (accountChannelHeading) {
    accountChannelHeading.textContent = `Channels - ${selectedAccountDisplayLabel}`;
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
      setButtonBusy(button, true, 'Connecting...');
      const result = await api.startYouTubeOauth();
      setButtonBusy(button, false);

      if (!result.ok) {
        setUiNotice('error', 'YouTube OAuth failed', result.error);
        await renderAccountsPage();
        return;
      }

      const redirectUrl = result.body?.redirectUrl;
      if (!redirectUrl) {
        setUiNotice('error', 'YouTube OAuth failed', 'OAuth redirect URL not returned by API.');
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

async function renderMediaPage() {
  const result = await api.media();
  if (!result.ok) {
    if (result.status === 401) {
      unauthorizedRedirect();
      return;
    }
    renderWorkspaceShell({
      title: 'Media',
      subtitle: 'Uploaded reusable assets.',
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

  const metricsHtml = [
    { label: 'Assets', value: formatNumber(filteredAssets.length), hint: `of ${formatNumber(assets.length)} total`, tone: 'info' },
    { label: 'Storage', value: formatBytes(totalSize), hint: `${formatNumber(totalSize)} bytes`, tone: 'info' },
    { label: 'Duration', value: formatDurationSeconds(totalDurationSeconds), hint: 'Combined media duration', tone: 'info' },
    { label: 'Linked Thumbnails', value: formatNumber(linkedThumbnailAssets), hint: 'Video with thumbnail or thumbnail linked to video', tone: 'success' },
  ].map((card) => `
    <article class="platform-dashboard-stat" data-tone="${escapeHtml(card.tone)}">
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
            <button class="btn" type="button" data-action="copy-media-id" data-media-id="${escapeHtml(asset.id)}">Copy ID</button>
            <button class="btn-danger" type="button" data-action="delete-media" data-media-id="${escapeHtml(asset.id)}">Delete</button>
          </div>
        </td>
      </tr>
    `;
    }).join('');
  const mediaEmptyState = assets.length === 0
    ? renderEmptyStateCard({
        title: 'Your media library is empty',
        message: 'Upload at least one video before creating campaigns. You can also attach a thumbnail now and reuse it later.',
        tone: 'info',
      })
    : filteredAssets.length === 0
      ? renderEmptyStateCard({
          title: 'No media matches the current filters',
          message: 'Try clearing the search or type filter to bring the asset list back.',
          actionsHtml: '<a class="btn" data-link href="/workspace/media">Clear filters</a>',
        })
      : '';
  const mediaCardsHtml = filteredAssets.map((asset) => {
    const formatPill = asset.asset_type === 'video'
      ? statusPill(getVideoPublishFormatLabel(getVideoPublishFormat(asset)))
      : '';
    const linkedPill = asset.thumbnail || asset.linked_video_asset_id ? statusPill('linked') : '';
    const previewHtml = asset.asset_type === 'video'
      ? renderVideoPreviewCell(asset)
      : asset.asset_type === 'thumbnail'
        ? renderThumbnailPreviewCell(asset)
        : '<span class="muted">Preview unavailable.</span>';
    return `
      <article class="platform-media-card">
        <div class="platform-media-card-head">
          <div>
            <span class="platform-dashboard-kicker">${escapeHtml(asset.asset_type ?? 'asset')}</span>
            <h3>${escapeHtml(asset.original_name)}</h3>
            <p>${escapeHtml(asset.mime_type ?? 'Unknown format')} · ${escapeHtml(formatDate(asset.created_at))}</p>
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
              <span>Asset ID</span>
              <strong><code>${escapeHtml(asset.id)}</code></strong>
            </div>
            <div>
              <span>Size</span>
              <strong>${escapeHtml(formatBytes(asset.size_bytes))}</strong>
            </div>
            <div>
              <span>Duration</span>
              <strong>${escapeHtml(formatDurationSeconds(asset.duration_seconds))}</strong>
            </div>
            <div>
              <span>Storage path</span>
              <strong>${escapeHtml(asset.storage_path ?? 'Workspace library')}</strong>
            </div>
          </div>
        </div>
        <div class="platform-media-card-actions inline-actions">
          ${renderMediaFileActionLinks(asset)}
          <button class="btn" type="button" data-action="copy-media-id" data-media-id="${escapeHtml(asset.id)}">Copy ID</button>
          <button class="btn-danger" type="button" data-action="delete-media" data-media-id="${escapeHtml(asset.id)}">Delete</button>
        </div>
      </article>
    `;
  }).join('');

  renderWorkspaceShell({
    title: 'Media',
    subtitle: 'Uploaded reusable assets.',
    actionsHtml: `
      <div class="inline-actions">
        <a class="btn" data-link href="${escapeHtml(buildUrl('/workspace/media', { search: searchInput, type: typeFilter }))}">Refresh</a>
      </div>
    `,
    contentHtml: `
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
              <span class="platform-dashboard-kicker">Media vault</span>
              <span class="platform-dashboard-live"><span class="platform-login-live-dot"></span> Synced ${escapeHtml(liveClock)}</span>
            </div>
            <h2 class="media-hero-title">Keep every video and thumbnail launch-ready.</h2>
            <p class="media-hero-subtitle">Upload assets once, reuse them across YouTube and TikTok campaigns.</p>
          </div>
          <div class="media-hero-tiles">
            <button type="button" class="media-hero-tile" data-media-filter="all" data-active="${typeFilter === 'all' ? 'true' : 'false'}">
              <div class="media-hero-tile-icon">📦</div>
              <div class="media-hero-tile-info">
                <span class="media-hero-tile-label">All assets</span>
                <strong class="media-hero-tile-value" data-counter="${filteredAssets.length}">0</strong>
              </div>
            </button>
            <button type="button" class="media-hero-tile" data-media-filter="video" data-active="${typeFilter === 'video' ? 'true' : 'false'}">
              <div class="media-hero-tile-icon">🎬</div>
              <div class="media-hero-tile-info">
                <span class="media-hero-tile-label">Videos</span>
                <strong class="media-hero-tile-value" data-counter="${videoAssetsCount}">0</strong>
              </div>
            </button>
            <button type="button" class="media-hero-tile" data-media-filter="thumbnail" data-active="${typeFilter === 'thumbnail' ? 'true' : 'false'}">
              <div class="media-hero-tile-icon">🖼️</div>
              <div class="media-hero-tile-info">
                <span class="media-hero-tile-label">Thumbnails</span>
                <strong class="media-hero-tile-value" data-counter="${thumbnailAssetsCount}">0</strong>
              </div>
            </button>
            <div class="media-hero-tile media-hero-tile-static">
              <div class="media-hero-tile-icon">💾</div>
              <div class="media-hero-tile-info">
                <span class="media-hero-tile-label">Stored</span>
                <strong class="media-hero-tile-value-static">${formatBytes(totalSize)}</strong>
              </div>
            </div>
            <div class="media-hero-tile media-hero-tile-static">
              <div class="media-hero-tile-icon">⏱️</div>
              <div class="media-hero-tile-info">
                <span class="media-hero-tile-label">Playback</span>
                <strong class="media-hero-tile-value-static">${escapeHtml(formatDurationSeconds(totalDurationSeconds))}</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="platform-dashboard-stat-grid">
        ${metricsHtml}
      </section>
      ${mediaEmptyState}
      <section class="platform-dashboard-main-grid">
        <section class="platform-surface platform-dashboard-panel">
          <div class="platform-dashboard-panel-head">
            <div>
              <span class="platform-dashboard-kicker">Upload bay</span>
              <h3>Upload new media</h3>
            </div>
            <span class="platform-dashboard-panel-meta">MP4, MOV, JPG or PNG</span>
          </div>
          <form id="media-upload-form">
            <div class="media-upload-zone">
              <div class="media-upload-zone-header">
                <span class="media-upload-zone-icon">📁</span>
                <div>
                  <p class="media-upload-zone-title">Add video to library</p>
                  <p class="media-upload-zone-sub">MP4 or MOV · Thumbnail is optional</p>
                </div>
              </div>
              <div class="form-grid">
                <label>
                  Video file <em style="font-style:normal;font-size:0.78rem;color:var(--danger)">*required</em>
                  <input name="video" type="file" accept="video/mp4,video/quicktime" required />
                </label>
                <label>
                  Thumbnail <em style="font-style:normal;font-size:0.78rem;color:var(--text-subtle)">optional</em>
                  <input name="thumbnail" type="file" accept="image/jpeg,image/png" />
                </label>
              </div>
            </div>
            <div class="inline-actions">
              <button class="btn-primary" type="submit">Upload media</button>
            </div>
          </form>
        </section>
        <section class="platform-surface platform-dashboard-panel">
          <div class="platform-dashboard-panel-head">
            <div>
              <span class="platform-dashboard-kicker">Library filters</span>
              <h3>Filter library</h3>
            </div>
            <span class="platform-dashboard-panel-meta">${formatNumber(filteredAssets.length)} visible assets</span>
          </div>
          <form id="media-filter-form" class="filter-bar">
            <label>
              Search
              <input name="search" value="${escapeHtml(searchInput)}" placeholder="Name, mime, id..." />
            </label>
            <label>
              Type
              <select name="type">
                <option value="all" ${typeFilter === 'all' ? 'selected' : ''}>All</option>
                <option value="video" ${typeFilter === 'video' ? 'selected' : ''}>Video</option>
                <option value="thumbnail" ${typeFilter === 'thumbnail' ? 'selected' : ''}>Thumbnail</option>
              </select>
            </label>
            <div class="inline-actions">
              <button class="btn-primary" type="submit">Apply</button>
              <a class="btn" data-link href="/workspace/media">Clear</a>
            </div>
          </form>
          <div class="platform-page-summary-grid">
            <article class="platform-page-summary-card">
              <span>Videos</span>
              <strong>${formatNumber(videoAssetsCount)}</strong>
            </article>
            <article class="platform-page-summary-card">
              <span>Thumbs</span>
              <strong>${formatNumber(thumbnailAssetsCount)}</strong>
            </article>
            <article class="platform-page-summary-card">
              <span>Linked</span>
              <strong>${formatNumber(linkedThumbnailAssets)}</strong>
            </article>
          </div>
        </section>
      </section>
      <section class="platform-surface platform-dashboard-panel">
        <div class="platform-dashboard-panel-head">
          <div>
            <span class="platform-dashboard-kicker">Asset library</span>
            <h3>Media cards (${formatNumber(filteredAssets.length)})</h3>
          </div>
          <span class="platform-dashboard-panel-meta">${escapeHtml(typeFilter === 'all' ? 'All asset types' : `${typeFilter} only`)}</span>
        </div>
        ${mediaCardsHtml ? `<div class="platform-media-grid">${mediaCardsHtml}</div>` : '<p class="muted">No media assets found.</p>'}
      </section>
    `,
  });

  void backfillMissingMediaDurations(assets);

  const mediaUploadZoneIcon = document.querySelector('.media-upload-zone-icon');
  if (mediaUploadZoneIcon) {
    mediaUploadZoneIcon.textContent = 'LIB';
  }
  const mediaUploadZoneSub = document.querySelector('.media-upload-zone-sub');
  if (mediaUploadZoneSub) {
    mediaUploadZoneSub.textContent = 'MP4 or MOV - Thumbnail is optional';
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
      setUiNotice('warning', 'Video required', 'Select a video file before uploading media.');
      await renderMediaPage();
      return;
    }

    setButtonBusy(submitButton, true, 'Uploading...');
    try {
      const uploadResult = await uploadMediaFiles(videoFile, thumbnailFile ?? null);
      if (!uploadResult.ok) {
        setUiNotice('error', 'Upload failed', uploadResult.error);
        await renderMediaPage();
        return;
      }

      setUiNotice('success', 'Media uploaded', 'The new asset was added to the library.');
      await renderMediaPage();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed.';
      setUiNotice('error', 'Upload failed', message);
      await renderMediaPage();
    } finally {
      setButtonBusy(submitButton, false);
    }
  });

  const mediaFilterForm = document.getElementById('media-filter-form');
  mediaFilterForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(mediaFilterForm);
    const href = buildUrl('/workspace/media', {
      search: String(data.get('search') ?? ''),
      type: String(data.get('type') ?? 'all'),
    });
    navigate(href);
  });

  document.querySelectorAll('.media-hero-tile[data-media-filter]').forEach((tile) => {
    tile.addEventListener('click', () => {
      const filterValue = tile.getAttribute('data-media-filter');
      if (!filterValue) return;
      navigate(buildUrl('/workspace/media', { search: searchInput, type: filterValue }));
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
        setUiNotice('success', 'Media ID copied', 'The asset id was copied to the clipboard.');
        await renderMediaPage();
      } catch {
        setUiNotice('error', 'Copy failed', 'Unable to copy the media id to the clipboard.');
        await renderMediaPage();
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
      await renderMediaPage();
    });
  });

  attachVideoPreviewListeners(new Map(assets.map((asset) => [asset.id, asset])));

  document.querySelectorAll('[data-action="delete-media"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const mediaId = button.getAttribute('data-media-id');
      if (!mediaId) return;
      const confirmed = await showConfirmDialog({
        title: 'Delete media asset',
        message: 'This will remove the selected media asset from the library.',
        confirmLabel: 'Delete asset',
        tone: 'warning',
      });
      if (!confirmed) return;
      setButtonBusy(button, true, 'Deleting...');
      const deleteResult = await api.deleteMedia(mediaId);
      setButtonBusy(button, false);
      if (!deleteResult.ok) {
        setUiNotice('error', 'Delete failed', deleteResult.error);
        await renderMediaPage();
        return;
      }
      setUiNotice('success', 'Media deleted', 'The selected asset was removed from the library.');
      await renderMediaPage();
    });
  });
}

function campaignActionButtons(campaign) {
  const targetCount = Number(campaign.targetCount ?? campaign.targets?.length ?? 0);
  const buttons = [
    `<a class="btn" data-link href="/workspace/campanhas/${encodeURIComponent(campaign.id)}">View</a>`,
    `<button class="btn" type="button" data-action="clone-campaign" data-campaign-id="${escapeHtml(campaign.id)}">Clone</button>`,
  ];
  if (campaign.status === 'draft' && targetCount > 0) {
    buttons.push(`<button class="btn" type="button" data-action="mark-ready" data-campaign-id="${escapeHtml(campaign.id)}">Mark ready</button>`);
  }
  if (campaign.status === 'ready' && targetCount > 0) {
    buttons.push(`<button class="btn-primary" type="button" data-action="launch-campaign" data-campaign-id="${escapeHtml(campaign.id)}">Launch</button>`);
  }
  if (campaign.status === 'draft' || campaign.status === 'ready') {
    buttons.push(`<button class="btn-danger" type="button" data-action="delete-campaign" data-campaign-id="${escapeHtml(campaign.id)}">Delete</button>`);
  }
  return `<div class="inline-actions">${buttons.join('')}</div>`;
}

function buildRadarPoints(statusTotals) {
  const statuses = [
    { key: 'draft', angle: -90 },
    { key: 'ready', angle: -18 },
    { key: 'launching', angle: 54 },
    { key: 'completed', angle: 126 },
    { key: 'failed', angle: 198 },
  ];
  const total = Math.max(1, Object.values(statusTotals).reduce((a, b) => a + (Number(b) || 0), 0));
  const cx = 110, cy = 110, maxRadius = 96;
  const points = statuses.map((s) => {
    const val = Number(statusTotals[s.key] ?? 0);
    const radius = Math.max(6, (val / total) * maxRadius);
    const rad = (s.angle * Math.PI) / 180;
    const x = cx + radius * Math.cos(rad);
    const y = cy + radius * Math.sin(rad);
    return { ...s, x, y, val };
  });
  const polygon = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const dots = points.map((p) => `
    <circle class="radar-dot radar-dot-${p.key}" data-status="${p.key}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5">
      <animate attributeName="r" values="5;8;5" dur="2.5s" repeatCount="indefinite" />
    </circle>
  `).join('');
  return `
    <polygon class="radar-polygon" points="${polygon}" />
    ${dots}
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
    });
    el.addEventListener('mouseleave', () => {
      panel.querySelectorAll('.radar-dot').forEach((d) => d.classList.remove('radar-dot-active'));
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

async function renderPlaylistsPage() {
  const [playlistsResult, mediaResult] = await Promise.all([api.playlists(), api.media()]);
  if (!playlistsResult.ok) {
    if (playlistsResult.status === 401) { unauthorizedRedirect(); return; }
    renderWorkspaceShell({ title: 'Playlists', subtitle: 'Organize videos em playlists a partir de pastas locais.', noticeHtml: `<div class="notice error">${escapeHtml(playlistsResult.error)}</div>`, contentHtml: '' });
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
    { label: 'Playlists', value: formatNumber(playlists.length), hint: 'Total de playlists criadas', tone: 'info' },
    { label: 'Videos', value: formatNumber(totalVideos), hint: 'Videos distribuidos em playlists', tone: 'info' },
    { label: 'Ja usados', value: formatNumber(totalUsed), hint: 'Videos que ja foram postados via Auto', tone: 'success' },
    { label: 'Disponiveis', value: formatNumber(totalVideos - totalUsed), hint: 'Ainda nao postados', tone: totalVideos - totalUsed > 0 ? 'info' : 'warning' },
  ].map((card) => `
    <article class="platform-dashboard-stat" data-tone="${escapeHtml(card.tone)}">
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
              <div>
                <span class="platform-dashboard-kicker">playlist</span>
                <h3>${escapeHtml(pl.name)}</h3>
                <p>${escapeHtml(pl.folderPath || 'Pasta manual')} · ${escapeHtml(formatDate(pl.createdAt))}</p>
              </div>
              <div class="inline-actions">
                ${statusPill(`${formatNumber(itemCount)} videos`)}
                ${availCount > 0 ? statusPill(`${formatNumber(availCount)} disp`) : statusPill('esgotada')}
              </div>
            </div>
            <div class="platform-media-card-body">
              <div class="platform-media-card-preview" style="display:flex;align-items:center;justify-content:center;min-height:80px;background:var(--surface-muted);border-radius:6px;">
                <div style="text-align:center;padding:1rem;">
                  <div style="font-size:2rem;font-weight:800;color:var(--primary);">${formatNumber(itemCount)}</div>
                  <div class="muted" style="font-size:0.8rem;">videos</div>
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
              <a class="btn" data-link href="/workspace/playlists/${encodeURIComponent(pl.id)}">Abrir</a>
              <button class="btn-danger" type="button" data-action="delete-playlist" data-playlist-id="${escapeHtml(pl.id)}">Excluir</button>
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

  renderWorkspaceShell({
    title: 'Playlists',
    subtitle: 'Organize videos em playlists a partir de pastas locais.',
    actionsHtml: `
      <div class="inline-actions">
        <a class="btn" data-link href="/workspace/playlists">Refresh</a>
      </div>
    `,
    contentHtml: `
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
              PLAYLIST VAULT
            </span>
            <h2 class="playlist-cockpit-title">Organize, automatize, <span class="playlist-cockpit-title-accent">não repita.</span></h2>
            <p class="playlist-cockpit-subtitle">Pastas locais viram playlists. Cada vídeo é publicado uma vez e o sistema escolhe o próximo automaticamente.</p>
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
            <div class="playlist-cockpit-stat-big-icon">📁</div>
            <div class="playlist-cockpit-stat-big-info">
              <span class="playlist-cockpit-stat-big-label">Playlists</span>
              <strong class="playlist-cockpit-stat-big-value" data-counter="${playlists.length}">0</strong>
              <span class="playlist-cockpit-stat-big-detail">${formatNumber(playlistsWithAvailable)} com vídeos · ${formatNumber(playlistsExhausted)} esgotadas</span>
            </div>
          </article>

          <article class="playlist-cockpit-stat-big" data-tone="success">
            <div class="playlist-cockpit-stat-big-icon">🎬</div>
            <div class="playlist-cockpit-stat-big-info">
              <span class="playlist-cockpit-stat-big-label">Vídeos</span>
              <strong class="playlist-cockpit-stat-big-value" data-counter="${totalVideos}">0</strong>
              <span class="playlist-cockpit-stat-big-detail">${avgPerPlaylist} média por playlist</span>
            </div>
          </article>
        </div>

        <div class="playlist-cockpit-mini-row">
          <article class="playlist-cockpit-mini" data-tone="info">
            <div class="playlist-cockpit-mini-icon">✅</div>
            <div class="playlist-cockpit-mini-info">
              <span class="playlist-cockpit-mini-label">Disponíveis</span>
              <strong class="playlist-cockpit-mini-value" data-counter="${totalAvailable}">0</strong>
              <span class="playlist-cockpit-mini-detail">prontos para publicar</span>
            </div>
          </article>
          <article class="playlist-cockpit-mini" data-tone="warning">
            <div class="playlist-cockpit-mini-icon">📤</div>
            <div class="playlist-cockpit-mini-info">
              <span class="playlist-cockpit-mini-label">Já publicados</span>
              <strong class="playlist-cockpit-mini-value" data-counter="${totalUsed}">0</strong>
              <span class="playlist-cockpit-mini-detail">via Auto-mode</span>
            </div>
          </article>
          <article class="playlist-cockpit-mini" data-tone="info">
            <div class="playlist-cockpit-mini-icon">📚</div>
            <div class="playlist-cockpit-mini-info">
              <span class="playlist-cockpit-mini-label">Library</span>
              <strong class="playlist-cockpit-mini-value" data-counter="${libraryAssets}">0</strong>
              <span class="playlist-cockpit-mini-detail">assets de vídeo</span>
            </div>
          </article>
          <article class="playlist-cockpit-mini" data-tone="success">
            <div class="playlist-cockpit-mini-icon">⭐</div>
            <div class="playlist-cockpit-mini-info">
              <span class="playlist-cockpit-mini-label">Maior playlist</span>
              <strong class="playlist-cockpit-mini-value playlist-cockpit-mini-text">${escapeHtml((largestPlaylist?.name ?? '—').slice(0, 14) + ((largestPlaylist?.name ?? '').length > 14 ? '…' : ''))}</strong>
              <span class="playlist-cockpit-mini-detail">${largestPlaylist ? `${formatNumber(largestPlaylist.items?.length ?? 0)} vídeos` : 'sem dados'}</span>
            </div>
          </article>
          <article class="playlist-cockpit-mini" data-tone="warning">
            <div class="playlist-cockpit-mini-icon">🔥</div>
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
              <span>Distribuição global</span>
              <strong>${100 - usagePct}% disponível</strong>
            </div>
            <div class="playlist-cockpit-footer-bar-track">
              <div class="playlist-cockpit-footer-bar-fill" style="--width:${100 - usagePct}%"></div>
            </div>
          </div>
          <div class="playlist-cockpit-footer-meta">
            <span>${formatNumber(playlists.length)} playlists</span>
            <span aria-hidden="true">·</span>
            <span>${formatNumber(totalVideos)} vídeos</span>
            <span aria-hidden="true">·</span>
            <span>${formatNumber(libraryAssets)} library assets</span>
            <span aria-hidden="true">·</span>
            <span class="playlist-cockpit-status-badge ${playlists.length > 0 ? 'active' : 'inactive'}">${playlists.length > 0 ? '● ATIVO' : '○ VAZIO'}</span>
          </div>
        </div>
      </section>

      <section class="platform-dashboard-main-grid">
        <section class="platform-surface platform-dashboard-panel">
          <div class="platform-dashboard-panel-head">
            <div>
              <span class="platform-dashboard-kicker">Import bay</span>
              <h3>Escanear pasta local</h3>
            </div>
            <span class="platform-dashboard-panel-meta">Subpastas → Playlists</span>
          </div>
          <div class="media-upload-zone">
            <div class="media-upload-zone-header">
              <span class="media-upload-zone-icon">📁</span>
              <div>
                <p class="media-upload-zone-title">Importar da pasta do servidor</p>
                <p class="media-upload-zone-sub">Cada subpasta vira uma playlist automaticamente</p>
              </div>
            </div>
            <form id="scan-folder-form" class="form-grid">
              <label>
                Caminho da pasta raiz <em style="font-style:normal;font-size:0.78rem;color:var(--danger)">*obrigatorio</em>
                <input name="rootPath" required placeholder="Ex: C:\\Videos ou /home/user/videos" />
              </label>
            </form>
          </div>
          <div class="inline-actions">
            <button class="btn-primary" type="button" id="scan-folder-submit">Escanear e importar</button>
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
            <button class="btn-primary" type="button" data-action="create-playlist-manual">+ Nova playlist</button>
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
            <span class="platform-dashboard-kicker">Playlist library</span>
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
    await renderPlaylistsPage();
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
    await renderPlaylistsPage();
  });

  document.querySelectorAll('[data-action="delete-playlist"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const playlistId = btn.getAttribute('data-playlist-id');
      const confirmed = await showConfirmDialog({ title: 'Excluir playlist?', message: 'Os assets de video nao serao deletados, apenas a playlist.', tone: 'danger' });
      if (!confirmed) return;
      const r = await api.deletePlaylist(playlistId);
      if (!r.ok) { setUiNotice('error', 'Erro ao excluir', r.error); } else { setUiNotice('success', 'Playlist excluida', ''); }
      await renderPlaylistsPage();
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
    { label: 'Videos', value: formatNumber(items.length), hint: 'Total na playlist', tone: 'info' },
    { label: 'Disponiveis', value: formatNumber(availCount), hint: 'Ainda nao postados via Auto', tone: availCount > 0 ? 'info' : 'warning' },
    { label: 'Ja usados', value: formatNumber(usedCount), hint: 'Postados pelo modo Auto', tone: 'success' },
    { label: 'Progresso', value: items.length > 0 ? `${Math.round((usedCount / items.length) * 100)}%` : '—', hint: 'Completude da playlist', tone: 'info' },
  ].map((card) => `
    <article class="platform-dashboard-stat" data-tone="${escapeHtml(card.tone)}">
      <span class="platform-dashboard-stat-label">${escapeHtml(card.label)}</span>
      <strong>${escapeHtml(card.value)}</strong>
      <span class="platform-dashboard-stat-detail">${escapeHtml(card.hint)}</span>
    </article>
  `).join('');

  const itemCardsHtml = items.map((item) => {
    const asset = videoById[item.videoAssetId];
    const usedLabel = item.usedAt ? `Usado ${new Date(item.usedAt).toLocaleString()}` : 'Disponivel';
    const usedTone = item.usedAt ? '' : 'success';
    const previewHtml = asset ? renderVideoPreviewCell(asset) : '<span class="muted">Asset nao encontrado</span>';
    return `
      <article class="platform-media-card">
        <div class="platform-media-card-head">
          <div>
            <span class="platform-dashboard-kicker">video</span>
            <h3>${escapeHtml(asset?.original_name ?? item.videoAssetId)}</h3>
            <p>${escapeHtml(asset?.mime_type ?? '')}${asset?.created_at ? ' · ' + escapeHtml(formatDate(asset.created_at)) : ''}</p>
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
          <button class="btn" type="button" data-action="edit-preset" data-video-asset-id="${escapeHtml(item.videoAssetId)}" data-name="${escapeHtml(asset?.original_name ?? '')}">Preset</button>
          <button class="btn-danger" type="button" data-action="remove-pl-item" data-video-asset-id="${escapeHtml(item.videoAssetId)}">Remover</button>
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
        <a class="btn" data-link href="/workspace/playlists">← Playlists</a>
        <a class="btn" data-link href="/workspace/playlists/${encodeURIComponent(playlistId)}">Refresh</a>
      </div>
    `,
    contentHtml: `
      <section class="platform-dashboard-hero">
        <article class="platform-surface platform-dashboard-hero-copy">
          <div class="platform-dashboard-kicker-row">
            <span class="platform-dashboard-kicker">Playlist</span>
            <span class="platform-dashboard-live"><span class="platform-login-live-dot"></span> Synced ${escapeHtml(liveClock)}</span>
          </div>
          <h2>${escapeHtml(playlist.name)}</h2>
          <p>${escapeHtml(playlist.folderPath || 'Criada manualmente')}</p>
          <div class="platform-dashboard-chip-row">
            <span class="platform-chip">🔀 Auto aleatorio</span>
            <span class="platform-chip">📌 Sem repeticao</span>
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
                <span class="media-upload-zone-icon">➕</span>
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
              <button class="btn-primary" type="button" id="add-pl-item-submit">Adicionar a playlist</button>
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
  const [campaignsResult, mediaResult] = await Promise.all([api.campaigns(filters), api.media()]);
  if (!campaignsResult.ok || !mediaResult.ok) {
    const failing = !campaignsResult.ok ? campaignsResult : mediaResult;
    if (failing.status === 401) {
      unauthorizedRedirect();
      return;
    }
    renderWorkspaceShell({
      title: 'Campanhas',
      subtitle: 'Campaign list and lifecycle actions.',
      noticeHtml: `<div class="notice error">${escapeHtml(failing.error)}</div>`,
      contentHtml: '<section class="card">Unable to load campaigns.</section>',
    });
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
  const platformLabel = topPlatform ? (topPlatform[0] === 'youtube' ? 'YouTube' : topPlatform[0] === 'tiktok' ? 'TikTok' : topPlatform[0]) : '—';
  const platformIcon = topPlatform?.[0] === 'tiktok' ? '🎵' : topPlatform?.[0] === 'youtube' ? '▶️' : '📡';
  const successCircumference = 2 * Math.PI * 36;
  const successOffset = successCircumference * (1 - successRate / 100);

  const metricsHtml = [
    { label: 'Total', value: formatNumber(total), hint: `Page ${formatNumber(currentPage)} of ${formatNumber(totalPages)}`, tone: 'info' },
    { label: 'Completed', value: formatNumber(statusTotals.completed), hint: 'Successfully published', tone: 'success' },
    { label: 'Launching', value: formatNumber(statusTotals.launching), hint: 'Currently publishing', tone: 'warning' },
    { label: 'Failed', value: formatNumber(statusTotals.failed), hint: 'Ended with errors', tone: 'danger' },
  ].map((card) => `
    <article class="platform-dashboard-stat" data-tone="${escapeHtml(card.tone)}">
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
        title: 'No campaigns yet',
        message: 'Start by creating your first campaign. If you have not uploaded media or connected channels yet, you can do that first.',
        tone: 'info',
        actionsHtml: [
          '<a class="btn btn-primary" data-link href="/workspace/campanhas/nova">Create campaign</a>',
          '<a class="btn" data-link href="/workspace/media">Open media</a>',
          '<a class="btn" data-link href="/workspace/accounts">Open accounts</a>',
        ].join(''),
      })
    : campaigns.length === 0
      ? renderEmptyStateCard({
          title: 'No campaigns match the current filters',
          message: 'Change the filters or clear the search to show campaigns again.',
          actionsHtml: '<a class="btn" data-link href="/workspace/campanhas">Clear filters</a>',
        })
      : '';

  const campaignItemsHtml = campaigns.length === 0
    ? ''
    : `<div class="campaign-list">${campaigns.map((campaign) => {
        const summary = summarizeCampaignOutcomes(campaign);
        const scheduledLabel = campaign.scheduledAt ? formatDate(campaign.scheduledAt) : 'Immediate';
        const mediaAsset = mediaById.get(campaign.videoAssetId);
        const publishFormat = getVideoPublishFormat(mediaAsset ?? {});
        return `
          <div class="campaign-item" data-status="${escapeHtml(campaign.status)}">
            <div class="campaign-item-main">
              <p class="campaign-item-title">${escapeHtml(campaign.title)}</p>
              <div class="campaign-item-meta">
                ${statusPill(campaign.status)}
                ${statusPill(getVideoPublishFormatLabel(publishFormat))}
                <span>${escapeHtml(campaign.videoAssetName ?? campaign.videoAssetId ?? '-')}</span>
                <span>${escapeHtml(scheduledLabel)}</span>
                <span>${formatNumber(campaign.targetCount ?? summary.total)} targets</span>
              </div>
              <div class="campaign-item-outcome">
                <span class="ok">✓ ${formatNumber(summary.published)}</span>
                <span class="fail">✕ ${formatNumber(summary.failed)}</span>
                <span class="pending">◷ ${formatNumber(summary.pending)}</span>
                ${summary.reauthRequired > 0 ? `<span class="warn">⚠ ${formatNumber(summary.reauthRequired)} reauth</span>` : ''}
              </div>
            </div>
            <div class="campaign-item-actions">${campaignActionButtons(campaign)}</div>
          </div>
        `;
      }).join('')}</div>`;

  renderWorkspaceShell({
    title: 'Campanhas',
    subtitle: 'Campaign list and lifecycle actions.',
    actionsHtml: `
      <div class="inline-actions cc-hero-actions">
        <a class="cc-create-btn" data-link href="/workspace/campanhas/nova" title="Criar nova campanha">
          <span class="cc-create-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
          </span>
          <span class="cc-create-label">
            <span class="cc-create-title">Create campaign</span>
            <span class="cc-create-sub">Launch a new CAMPAIGN</span>
          </span>
          <span class="cc-create-arrow" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </span>
        </a>
        <a class="cc-refresh-btn" data-link href="${escapeHtml(buildUrl('/workspace/campanhas', {
          status: filters.status,
          search: filters.search,
          limit: pageLimit,
          offset: pageOffset,
        }))}" title="Refresh list">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          <span>Refresh</span>
        </a>
      </div>
    `,
    contentHtml: `
      <div class="campaign-cockpit-row">
      <section class="campaign-control-panel" id="campaign-control-panel">
        <div class="campaign-control-bg-grid" aria-hidden="true"></div>
        <div class="campaign-control-glow" aria-hidden="true"></div>

        <header class="campaign-control-header">
          <div class="campaign-control-header-main">
            <span class="campaign-control-kicker">
              <span class="campaign-control-dot"></span>
              CAMPAIGN CONTROL
            </span>
            <span class="campaign-control-clock">LIVE · ${escapeHtml(liveClock)}</span>
          </div>
          <div class="campaign-control-legend">
            <span data-legend="draft"><span class="legend-swatch"></span>Draft</span>
            <span data-legend="ready"><span class="legend-swatch"></span>Ready</span>
            <span data-legend="launching"><span class="legend-swatch"></span>Launching</span>
            <span data-legend="completed"><span class="legend-swatch"></span>Completed</span>
            <span data-legend="failed"><span class="legend-swatch"></span>Failed</span>
          </div>
        </header>

        <div class="campaign-control-grid">
          <div class="campaign-control-chart" data-total="${formatNumber(total)}">
            <svg class="campaign-control-radar" viewBox="0 0 220 220" aria-hidden="true">
              <defs>
                <radialGradient id="radarFill" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stop-color="currentColor" stop-opacity="0.35" />
                  <stop offset="70%" stop-color="currentColor" stop-opacity="0.12" />
                  <stop offset="100%" stop-color="transparent" />
                </radialGradient>
                <linearGradient id="radarSweep" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stop-color="transparent" />
                  <stop offset="100%" stop-color="currentColor" />
                </linearGradient>
              </defs>
              <circle cx="110" cy="110" r="100" fill="url(#radarFill)" />
              <circle cx="110" cy="110" r="100" fill="none" stroke="currentColor" stroke-opacity="0.18" stroke-width="1" />
              <circle cx="110" cy="110" r="75" fill="none" stroke="currentColor" stroke-opacity="0.14" stroke-width="1" />
              <circle cx="110" cy="110" r="50" fill="none" stroke="currentColor" stroke-opacity="0.1" stroke-width="1" />
              <circle cx="110" cy="110" r="25" fill="none" stroke="currentColor" stroke-opacity="0.08" stroke-width="1" />
              <line x1="10" y1="110" x2="210" y2="110" stroke="currentColor" stroke-opacity="0.12" stroke-width="1" />
              <line x1="110" y1="10" x2="110" y2="210" stroke="currentColor" stroke-opacity="0.12" stroke-width="1" />
              <g class="radar-sweep-group">
                <path d="M110 110 L210 110 A100 100 0 0 0 171 39 Z" fill="url(#radarSweep)" opacity="0.55" />
              </g>
              ${buildRadarPoints(statusTotals)}
            </svg>
            <div class="campaign-control-chart-center">
              <span class="chart-center-kicker">TOTAL</span>
              <strong class="chart-center-val" data-target="${total}">0</strong>
              <span class="chart-center-label">CAMPAIGNS</span>
            </div>
          </div>

          <div class="campaign-control-pulse">
            <div class="pulse-head">
              <span>PULSE · LAST 30 TICKS</span>
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
              ${['DRAFT','READY','LAUNCHING','DONE','FAIL'].map((label, i) => {
                const key = ['draft','ready','launching','completed','failed'][i];
                return `<div class="pulse-tick" data-status="${key}">
                  <span class="pulse-tick-label">${label}</span>
                  <strong class="pulse-tick-val" data-target="${statusTotals[key] ?? 0}">0</strong>
                  <div class="pulse-tick-bar"><div class="pulse-tick-fill" style="--fill:${Math.min(100, (statusTotals[key] ?? 0) / Math.max(1, total) * 100)}%"></div></div>
                </div>`;
              }).join('')}
            </div>
          </div>
        </div>
      </section>

      <section class="mission-insights" id="mission-insights" data-next-iso="${nextScheduled ? escapeHtml(nextScheduled.scheduledAt) : ''}">
        <div class="mission-insights-bg" aria-hidden="true">
          <div class="mission-insights-orb"></div>
          <div class="mission-insights-grid"></div>
        </div>
        <header class="mission-insights-head">
          <span class="mission-insights-kicker"><span class="mission-insights-dot"></span> MISSION INSIGHTS</span>
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
            <span class="mission-success-label">Success rate</span>
            <strong class="mission-success-value" data-target-rate="${successRate}">0%</strong>
            <span class="mission-success-detail">${formatNumber(statusTotals.completed)} ok · ${formatNumber(statusTotals.failed)} fail</span>
          </div>
        </div>

        <div class="mission-insights-tiles">
          <button type="button" class="mission-tile mission-tile-countdown" ${nextScheduled ? `data-link-href="/workspace/campanhas/${escapeHtml(nextScheduled.id)}"` : 'disabled'}>
            <div class="mission-tile-icon">⏱️</div>
            <div class="mission-tile-info">
              <span class="mission-tile-label">Next launch</span>
              <strong class="mission-tile-value" id="mission-countdown" data-countdown-ms="${nextCountdown ?? ''}">${nextScheduled ? escapeHtml(formatCountdown(nextCountdown)) : 'No queue'}</strong>
              <span class="mission-tile-detail">${nextScheduled ? escapeHtml((nextScheduled.title ?? '').slice(0, 24)) : 'Schedule a campaign'}</span>
            </div>
          </button>

          <button type="button" class="mission-tile" data-link-href="/workspace/campanhas?status=launching">
            <div class="mission-tile-icon">🚀</div>
            <div class="mission-tile-info">
              <span class="mission-tile-label">Today</span>
              <strong class="mission-tile-value" data-counter="${todayLaunches}">0</strong>
              <span class="mission-tile-detail">launches scheduled</span>
            </div>
          </button>

          <div class="mission-tile mission-tile-static">
            <div class="mission-tile-icon">${platformIcon}</div>
            <div class="mission-tile-info">
              <span class="mission-tile-label">Top platform</span>
              <strong class="mission-tile-value">${escapeHtml(platformLabel)}</strong>
              <span class="mission-tile-detail">${topPlatform ? `${formatNumber(topPlatform[1])} targets` : 'No data yet'}</span>
            </div>
          </div>

          <div class="mission-tile mission-tile-static">
            <div class="mission-tile-icon">📊</div>
            <div class="mission-tile-info">
              <span class="mission-tile-label">Active</span>
              <strong class="mission-tile-value" data-counter="${statusTotals.launching + statusTotals.ready}">0</strong>
              <span class="mission-tile-detail">in pipeline</span>
            </div>
          </div>
        </div>

        <div class="mission-insights-spark">
          <div class="mission-spark-head">
            <span>LAST 7 DAYS</span>
            <span class="mission-spark-total">${formatNumber(last7Days.reduce((sum, d) => sum + d.count, 0))} total</span>
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

      <section class="platform-dashboard-stat-grid">
        ${metricsHtml}
      </section>
      ${campaignsEmptyState}
      <section class="platform-surface platform-dashboard-panel">
        <div class="platform-dashboard-panel-head">
          <div>
            <span class="platform-dashboard-kicker">Campaign filters</span>
            <h3>Refine the queue</h3>
          </div>
          <span class="platform-dashboard-panel-meta">${formatNumber(total)} total records</span>
        </div>
        <form id="campaign-filter-form" class="filter-bar">
          <label>
            Status
            <select name="status">
              <option value="">All statuses</option>
              <option value="draft" ${filters.status === 'draft' ? 'selected' : ''}>Draft</option>
              <option value="ready" ${filters.status === 'ready' ? 'selected' : ''}>Ready</option>
              <option value="launching" ${filters.status === 'launching' ? 'selected' : ''}>Launching</option>
              <option value="completed" ${filters.status === 'completed' ? 'selected' : ''}>Completed</option>
              <option value="failed" ${filters.status === 'failed' ? 'selected' : ''}>Failed</option>
            </select>
          </label>
          <label>
            Search
            <input name="search" value="${escapeHtml(filters.search)}" placeholder="Title contains..." />
          </label>
          <label>
            Page size
            <input name="limit" type="number" min="1" max="200" value="${escapeHtml(pageLimit)}" />
          </label>
          <div class="inline-actions cc-filter-actions">
            <button class="cc-apply-btn" type="submit" title="Apply filters">
              <span class="cc-apply-glow" aria-hidden="true"></span>
              <span class="cc-apply-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
              </span>
              <span class="cc-apply-label">Apply filters</span>
            </button>
            <a class="cc-clear-btn" data-link href="/workspace/campanhas" title="Clear filters">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Clear
            </a>
          </div>
        </form>
      </section>
      <section class="platform-surface platform-dashboard-panel">
        <div class="platform-dashboard-panel-head">
          <div>
            <span class="platform-dashboard-kicker">Launch board</span>
            <h3>Campaigns (${formatNumber(total)})</h3>
          </div>
          <div class="inline-actions">
            ${previousHref
              ? `<a class="btn" data-link href="${previousHref}">Previous</a>`
              : '<button class="btn" type="button" disabled>Previous</button>'}
            ${nextHref
              ? `<a class="btn" data-link href="${nextHref}">Next</a>`
              : '<button class="btn" type="button" disabled>Next</button>'}
          </div>
        </div>
        ${campaignItemsHtml}
        ${total > 0 ? `<p class="muted">Showing ${formatNumber(pageStart)}-${formatNumber(pageEnd)} of ${formatNumber(total)} campaigns.</p>` : ''}
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
      setUiNotice('success', 'Campaign launched', 'Launch has started for the selected campaign.');
      await renderCampaignsPage();
    });
  });

  document.querySelectorAll('[data-action="delete-campaign"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const campaignId = button.getAttribute('data-campaign-id');
      if (!campaignId) return;
      const confirmed = await showConfirmDialog({
        title: 'Delete campaign',
        message: 'This will permanently remove the selected campaign from the list.',
        confirmLabel: 'Delete campaign',
        tone: 'warning',
      });
      if (!confirmed) return;
      setButtonBusy(button, true, 'Deleting...');
      const response = await api.deleteCampaign(campaignId);
      setButtonBusy(button, false);
      if (!response.ok) {
        setUiNotice('error', 'Delete failed', response.error);
        await renderCampaignsPage();
        return;
      }
      setUiNotice('success', 'Campaign deleted', 'The campaign was removed successfully.');
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

async function renderCampaignComposerPage() {
  const [mediaResult, destinationsResult, playlistsResult] = await Promise.all([api.media(), loadConnectedPublishDestinations(), api.playlists()]);
  if (!mediaResult.ok || !destinationsResult.ok) {
    const failing = !mediaResult.ok ? mediaResult : destinationsResult;
    if (failing.status === 401) {
      unauthorizedRedirect();
      return;
    }
    renderWorkspaceShell({
      title: 'New Campaign',
      subtitle: 'Create campaign and optional target batch.',
      noticeHtml: `<div class="notice error">${escapeHtml(failing.error)}</div>`,
      contentHtml: '<section class="card">Unable to load campaign composer dependencies.</section>',
    });
    return;
  }

  const assets = Array.isArray(mediaResult.body?.assets) ? mediaResult.body.assets : [];
  const videos = assets.filter((asset) => asset.asset_type === 'video' || asset.asset_type === undefined);
  const shortVideos = videos.filter((asset) => getVideoPublishFormat(asset) === 'short');
  const standardVideos = videos.filter((asset) => getVideoPublishFormat(asset) === 'standard');
  const unknownDurationVideos = videos.filter((asset) => getVideoPublishFormat(asset) === 'unknown');
  const connectedChannels = destinationsResult.destinations;
  const activeChannels = connectedChannels.filter((channel) => channel.platform === 'youtube');
  const hasVideos = videos.length > 0;
  const hasChannels = connectedChannels.length > 0;
  const playlists = Array.isArray(playlistsResult.body?.playlists) ? playlistsResult.body.playlists : [];
  const playlistOptions = playlists.map((pl) => `<option value="${escapeHtml(pl.id)}">${escapeHtml(pl.name)} (${formatNumber(pl.items?.length ?? 0)} videos)</option>`).join('');

  const channelToggleCards = connectedChannels.length === 0
    ? '<p class="muted">No connected publishing destinations available.</p>'
    : connectedChannels.map((channel) => `
      <label class="channel-toggle-card ${channel.isActive ? 'selected' : ''}" data-channel-toggle-card>
        <input class="channel-toggle-input" type="checkbox" name="destinationRef" value="${escapeHtml(`${channel.platform}:${channel.destinationId}`)}" ${channel.platform === 'youtube' ? 'checked' : ''} />
        <span class="channel-toggle-body">
          <span class="channel-toggle-meta">
            <strong>${escapeHtml(channel.destinationLabel || channel.title || channel.youtubeChannelId || channel.id)}</strong>
            <small>${escapeHtml(getProviderLabel(channel.platform))}</small>
            <small>${escapeHtml(channel.handle || channel.youtubeChannelId || channel.email || channel.id)}</small>
          </span>
          <span class="channel-toggle-switch" aria-hidden="true">
            <span class="channel-toggle-switch-track">
              <span class="channel-toggle-switch-thumb"></span>
            </span>
            <span class="channel-toggle-switch-label">${channel.platform === 'youtube' ? 'ON' : 'OFF'}</span>
          </span>
        </span>
      </label>
    `).join('');

  const videoOptions = videos.map((video) => (
    `<option value="${escapeHtml(video.id)}" data-format="${escapeHtml(getVideoPublishFormat(video))}">${escapeHtml(video.original_name)} (${escapeHtml(getVideoPublishFormatLabel(getVideoPublishFormat(video)))}, ${escapeHtml(formatDurationSeconds(video.duration_seconds))})</option>`
  )).join('');

  renderWorkspaceShell({
    title: 'New Campaign',
    subtitle: 'Create campaign and optional target batch.',
    contentHtml: `
      ${renderChecklistCard('Campaign setup checklist', [
        {
          done: hasVideos,
          label: hasVideos ? 'Media library is ready' : 'Upload media first',
          hint: hasVideos ? `${formatNumber(videos.length)} video assets are available for campaign creation.` : 'You need at least one video in Media before saving a campaign.',
          actionHtml: '<a class="btn" data-link href="/workspace/media">Open media</a>',
        },
        {
          done: hasChannels,
          label: hasChannels ? 'Publishing destinations are ready' : 'Connect publishing accounts',
          hint: hasChannels ? `${formatNumber(activeChannels.length)} YouTube channels and ${formatNumber(connectedChannels.length - activeChannels.length)} social destinations are available for this campaign.` : 'Connect YouTube or TikTok accounts to target publications directly from the composer.',
          actionHtml: '<a class="btn" data-link href="/workspace/accounts">Open accounts</a>',
        },
      ])}
      <section class="card stack">
        <div class="notice info">If no destinations are selected, a draft campaign is created without targets.</div>
        ${!hasVideos ? renderEmptyStateCard({
          title: 'No video assets available',
          message: 'The composer is ready, but you still need to upload at least one video before creating a campaign.',
          tone: 'warning',
          actionsHtml: '<a class="btn btn-primary" data-link href="/workspace/media">Upload media</a>',
        }) : ''}
        <div class="grid-3">
          <article class="card">
            <div class="summary-value">${formatNumber(shortVideos.length)}</div>
            <div class="summary-label">Reels / Shorts</div>
            <div class="summary-hint">Videos with up to 3 minutes (180 seconds)</div>
          </article>
          <article class="card">
            <div class="summary-value">${formatNumber(standardVideos.length)}</div>
            <div class="summary-label">Videos Normais</div>
            <div class="summary-hint">Long-form and regular uploads</div>
          </article>
          <article class="card">
            <div class="summary-value">${formatNumber(videos.length)}</div>
            <div class="summary-label">Total Videos</div>
            <div class="summary-hint">${formatNumber(unknownDurationVideos.length)} with unknown duration</div>
          </article>
        </div>
        <form id="campaign-create-form" class="form-grid">
          <fieldset class="card">
            <legend>1. Connected publishing destinations <small class="muted">(escolha onde publicar)</small></legend>
            <div class="inline-actions">
              <button class="btn" type="button" data-action="select-all-campaign-channels">Turn all ON</button>
              <button class="btn" type="button" data-action="clear-campaign-channels">Turn all OFF</button>
            </div>
            <div class="notice info">Use the toggle to decide exactly which connected channels or social accounts will receive this campaign.</div>
            <div class="channel-toggle-grid">${channelToggleCards}</div>
          </fieldset>
          <label id="campaign-title-field">
            Campaign title <small class="muted" id="campaign-title-hint"></small>
            <input name="title" id="campaign-title-input" placeholder="My campaign" />
          </label>
          <label>
            Publish format
            <select name="publishFormat" required>
              <option value="standard">Video normal</option>
              <option value="short">Reels / Shorts</option>
            </select>
          </label>
          <label id="video-asset-field">
            Video asset <small class="muted" id="video-asset-hint"></small>
            <select name="videoAssetId">
              <option value="">Select a video</option>
              ${videoOptions}
            </select>
          </label>
          <label>
            Scheduled at (optional)
            <input name="scheduledAt" type="datetime-local" />
          </label>
          ${playlistOptions ? `
          <label>
            Playlist (opcional)
            <select name="playlistId">
              <option value="">Sem playlist (video manual)</option>
              ${playlistOptions}
            </select>
          </label>
          <input type="hidden" name="autoMode" id="auto-mode-toggle" value="" />
          <fieldset class="card schedule-pattern-fieldset">
            <legend class="schedule-pattern-legend">
              <span><strong>Padrao de agendamento aleatorio</strong> <small class="muted">(opcional)</small></span>
              <label class="schedule-toggle-switch" data-schedule-master>
                <input type="checkbox" name="schedulePatternEnabled" value="1" id="schedule-pattern-toggle" />
                <span class="schedule-toggle-track"><span class="schedule-toggle-thumb"></span></span>
                <span class="schedule-toggle-label">OFF</span>
              </label>
            </legend>
            <div class="schedule-pattern-panel" id="schedule-pattern-panel" data-disabled="true">
              <div class="schedule-grid">
                <div class="schedule-field">
                  <span class="schedule-field-label">Quantidade de disparos no dia</span>
                  <input name="scheduleTimesPerDay" id="schedule-times-per-day" type="number" min="1" max="48" value="1" />
                  <small class="muted">Define quantos disparos sao gerados no dia</small>
                </div>
                <div class="schedule-field">
                  <span class="schedule-field-label">
                    <span>Fonte do video</span>
                    <label class="schedule-toggle-switch schedule-sub-toggle" data-schedule-sub="source">
                      <input type="checkbox" name="scheduleSourceAuto" value="1" checked />
                      <span class="schedule-toggle-track"><span class="schedule-toggle-thumb"></span></span>
                      <span class="schedule-toggle-label">AUTO</span>
                    </label>
                  </span>
                  <select name="scheduleSource" disabled>
                    <option value="playlist">Pasta da playlist</option>
                    <option value="library">Library Media</option>
                  </select>
                  <small class="muted">AUTO = sorteia automatico. OFF = escolha manual.</small>
                </div>
                <div class="schedule-field schedule-field-wide">
                  <span class="schedule-field-label">
                    <span>Hora dos disparos</span>
                    <label class="schedule-toggle-switch schedule-sub-toggle" data-schedule-sub="hour">
                      <input type="checkbox" name="scheduleHourAuto" value="1" checked />
                      <span class="schedule-toggle-track"><span class="schedule-toggle-thumb"></span></span>
                      <span class="schedule-toggle-label">AUTO</span>
                    </label>
                  </span>
                  <div id="schedule-hours-container" class="schedule-hours-container" data-disabled="true">
                    <small class="muted">Defina o horario para cada disparo do dia.</small>
                  </div>
                  <small class="muted">AUTO = aleatorio. OFF = horario fixo para cada disparo do dia.</small>
                </div>
                <div class="schedule-field schedule-field-wide">
                  <span class="schedule-field-label">
                    <span>Dias com campanha</span>
                    <span class="schedule-badge">manual</span>
                  </span>
                  <div id="schedule-dates-container" class="schedule-dates-container">
                    <div class="schedule-dates-list" id="schedule-dates-list"></div>
                    <div class="inline-actions">
                      <input type="date" id="schedule-date-input" />
                      <button type="button" class="btn" id="schedule-date-add">+ Adicionar dia</button>
                    </div>
                  </div>
                  <small class="muted">Selecione um ou mais dias manualmente em que a campanha sera disparada.</small>
                </div>
                <div class="schedule-field schedule-field-wide">
                  <span class="schedule-field-label">
                    <span>Titulo aleatorio</span>
                    <label class="schedule-toggle-switch schedule-sub-toggle" data-schedule-sub="title">
                      <input type="checkbox" name="scheduleTitleEnabled" value="1" id="schedule-title-toggle" />
                      <span class="schedule-toggle-track"><span class="schedule-toggle-thumb"></span></span>
                      <span class="schedule-toggle-label">OFF</span>
                    </label>
                  </span>
                  <input type="text" name="scheduleTitleSeed" id="schedule-title-seed" placeholder="Ex: Reels engracado de gato" disabled />
                  <small class="muted">Quando ON, o "Campaign title" e desabilitado e cada disparo gera um titulo derivado do nome digitado, levando em conta o nome/duracao do video.</small>
                  <div id="schedule-title-preview" class="schedule-title-preview" hidden></div>
                </div>
              </div>
            </div>
            <input type="hidden" name="schedulePattern" id="schedule-pattern-hidden" />
          </fieldset>
          ` : ''}
          <label>
            Target video title
            <input name="videoTitle" required placeholder="Video title for selected channels" />
          </label>
          <label>
            Target video description
            <textarea name="videoDescription" required placeholder="Description for selected channels"></textarea>
          </label>
          <label>
            Tags (comma-separated)
            <input name="tags" placeholder="news, update, launch" />
          </label>
          <label>
            Publish at per target (optional)
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
            YouTube Playlist ID (opcional — ID da playlist do canal, nao da biblioteca)
            <input name="youtubePlaylistId" placeholder="PL..." />
          </label>
          <div class="inline-actions">
            <button class="btn-primary" type="submit" ${hasVideos ? '' : 'disabled'}>Save draft</button>
            <a class="btn" data-link href="/workspace/campanhas">Cancel</a>
          </div>
        </form>
      </section>
    `,
  });

  const form = document.getElementById('campaign-create-form');
  const videoSelect = form?.querySelector('select[name="videoAssetId"]');
  const publishFormatSelect = form?.querySelector('select[name="publishFormat"]');

  function applyPublishFormatFilter() {
    if (!(videoSelect instanceof HTMLSelectElement) || !(publishFormatSelect instanceof HTMLSelectElement)) {
      return;
    }
    const selectedFormat = publishFormatSelect.value || 'standard';
    Array.from(videoSelect.options).forEach((option, index) => {
      if (index === 0) {
        option.hidden = false;
        option.disabled = false;
        return;
      }
      const optionFormat = option.getAttribute('data-format') || 'standard';
      const visible = optionFormat === selectedFormat;
      option.hidden = !visible;
      option.disabled = !visible;
      if (!visible && option.selected) {
        videoSelect.value = '';
      }
    });
  }

  applyPublishFormatFilter();
  publishFormatSelect?.addEventListener('change', applyPublishFormatFilter);

  // Auto-mode is implicit: any playlist selected → auto pick a random video. No toggle needed.
  const autoToggle = form?.querySelector('#auto-mode-toggle');
  const playlistSelect = form?.querySelector('select[name="playlistId"]');
  if (playlistSelect) {
    const videoAssetField = form?.querySelector('#video-asset-field');
    const videoAssetSelect = form?.querySelector('select[name="videoAssetId"]');
    const videoAssetHint = form?.querySelector('#video-asset-hint');
    const tryPrefillPreset = async () => {
      const selectedPlaylistId = playlistSelect.value;
      if (!selectedPlaylistId) return;
      const nextResult = await api.nextPlaylistVideo(selectedPlaylistId);
      if (!nextResult.ok || !nextResult.body?.videoAssetId) return;
      const presetResult = await api.getPreset(nextResult.body.videoAssetId);
      if (!presetResult.ok || !presetResult.body?.preset) return;
      const preset = presetResult.body.preset;
      const titleInput = form.querySelector('input[name="videoTitle"]');
      const descTextarea = form.querySelector('textarea[name="videoDescription"]');
      const tagsInput = form.querySelector('input[name="tags"]');
      const privacySelect = form.querySelector('select[name="privacy"]');
      if (titleInput && !titleInput.value && preset.title) titleInput.value = preset.title;
      if (descTextarea && !descTextarea.value && preset.description) descTextarea.value = preset.description;
      if (tagsInput && !tagsInput.value && preset.tags?.length) tagsInput.value = preset.tags.join(', ');
      if (privacySelect && preset.privacy) privacySelect.value = preset.privacy;
    };
    const refreshFromPlaylist = () => {
      const hasPlaylist = !!playlistSelect.value;
      if (autoToggle) autoToggle.value = hasPlaylist ? '1' : '';
      if (videoAssetField) videoAssetField.setAttribute('data-disabled', hasPlaylist ? 'true' : 'false');
      if (videoAssetSelect) {
        videoAssetSelect.disabled = hasPlaylist;
        if (hasPlaylist) videoAssetSelect.value = '';
      }
      if (videoAssetHint) {
        videoAssetHint.textContent = hasPlaylist ? '— sera escolhido aleatoriamente da playlist' : '';
      }
      if (hasPlaylist) tryPrefillPreset();
    };
    playlistSelect.addEventListener('change', refreshFromPlaylist);
    refreshFromPlaylist();
  }

  const scheduleMasterToggle = form?.querySelector('#schedule-pattern-toggle');
  const schedulePanel = form?.querySelector('#schedule-pattern-panel');
  const timesPerDayInput = form?.querySelector('#schedule-times-per-day');
  const hoursContainer = form?.querySelector('#schedule-hours-container');
  const datesList = form?.querySelector('#schedule-dates-list');
  const dateInput = form?.querySelector('#schedule-date-input');
  const dateAddBtn = form?.querySelector('#schedule-date-add');
  const selectedDates = new Set();

  function isHourAuto() {
    return form?.querySelector('input[name="scheduleHourAuto"]')?.checked ?? true;
  }
  function isSourceAuto() {
    return form?.querySelector('input[name="scheduleSourceAuto"]')?.checked ?? true;
  }

  function renderHourInputs() {
    if (!hoursContainer) return;
    const hourAuto = isHourAuto();
    const masterOn = !!scheduleMasterToggle?.checked;
    if (hourAuto || !masterOn) {
      hoursContainer.innerHTML = `<small class="muted">${hourAuto ? 'Horarios serao sorteados aleatoriamente.' : 'Habilite o agendamento para configurar.'}</small>`;
      hoursContainer.setAttribute('data-disabled', 'true');
      return;
    }
    hoursContainer.setAttribute('data-disabled', 'false');
    const n = Math.max(1, parseInt(String(timesPerDayInput?.value ?? '1'), 10) || 1);
    const existingValues = Array.from(hoursContainer.querySelectorAll('input[type="time"]')).map((el) => el.value);
    const inputs = [];
    for (let i = 0; i < n; i++) {
      const def = existingValues[i] ?? (i === 0 ? '18:00' : '');
      inputs.push(`<label class="schedule-hour-row"><span class="schedule-hour-index">#${i + 1}</span><input type="time" name="scheduleHour" value="${escapeHtml(def)}" /></label>`);
    }
    hoursContainer.innerHTML = inputs.join('');
  }

  function renderDateChips() {
    if (!datesList) return;
    const arr = Array.from(selectedDates).sort();
    if (arr.length === 0) {
      datesList.innerHTML = '<small class="muted">Nenhum dia selecionado.</small>';
      return;
    }
    datesList.innerHTML = arr.map((d) => `
      <span class="schedule-date-chip">
        ${escapeHtml(d)}
        <button type="button" class="schedule-date-chip-remove" data-date="${escapeHtml(d)}" aria-label="Remover ${escapeHtml(d)}">×</button>
      </span>
    `).join('');
    datesList.querySelectorAll('.schedule-date-chip-remove').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedDates.delete(btn.getAttribute('data-date'));
        renderDateChips();
      });
    });
  }

  dateAddBtn?.addEventListener('click', () => {
    const v = String(dateInput?.value ?? '').trim();
    if (!v) return;
    selectedDates.add(v);
    if (dateInput) dateInput.value = '';
    renderDateChips();
  });

  timesPerDayInput?.addEventListener('input', renderHourInputs);

  function refreshScheduleMaster() {
    if (!scheduleMasterToggle || !schedulePanel) return;
    const enabled = scheduleMasterToggle.checked;
    schedulePanel.setAttribute('data-disabled', enabled ? 'false' : 'true');
    const masterWrap = scheduleMasterToggle.closest('.schedule-toggle-switch');
    masterWrap?.querySelector('.schedule-toggle-label')?.replaceChildren(document.createTextNode(enabled ? 'ON' : 'OFF'));
    schedulePanel.querySelectorAll('input, select, button').forEach((el) => {
      if (el === scheduleMasterToggle) return;
      const isSubToggle = el.closest('.schedule-sub-toggle');
      if (enabled) {
        if (isSubToggle) {
          el.disabled = false;
        } else {
          const subKey = el.closest('.schedule-field')?.querySelector('[data-schedule-sub]')?.getAttribute('data-schedule-sub');
          if (subKey) {
            const subInput = el.closest('.schedule-field')?.querySelector('[data-schedule-sub] input');
            el.disabled = subInput?.checked ?? false;
          } else {
            el.disabled = false;
          }
        }
      } else {
        el.disabled = true;
      }
    });
    renderHourInputs();
    if (typeof syncTitleAutoState === 'function') syncTitleAutoState();
  }
  scheduleMasterToggle?.addEventListener('change', refreshScheduleMaster);

  const campaignTitleInput = form?.querySelector('#campaign-title-input');
  const campaignTitleField = form?.querySelector('#campaign-title-field');
  const campaignTitleHint = form?.querySelector('#campaign-title-hint');
  const titleSeedInput = form?.querySelector('#schedule-title-seed');
  const titleToggle = form?.querySelector('#schedule-title-toggle');
  const titlePreview = form?.querySelector('#schedule-title-preview');

  function syncTitleAutoState() {
    const masterOn = !!scheduleMasterToggle?.checked;
    const titleOn = !!titleToggle?.checked && masterOn;
    if (campaignTitleInput) {
      campaignTitleInput.disabled = titleOn;
      if (titleOn) campaignTitleInput.placeholder = 'Gerado automaticamente para cada disparo';
      else campaignTitleInput.placeholder = 'My campaign';
    }
    if (campaignTitleField) campaignTitleField.setAttribute('data-disabled', titleOn ? 'true' : 'false');
    if (campaignTitleHint) campaignTitleHint.textContent = titleOn ? '— gerado automaticamente por disparo' : '';
    if (titleSeedInput) titleSeedInput.disabled = !titleOn;
    if (titlePreview) updateTitlePreview();
  }

  function updateTitlePreview() {
    if (!titlePreview || !titleSeedInput || !titleToggle?.checked) {
      if (titlePreview) titlePreview.hidden = true;
      return;
    }
    const seed = titleSeedInput.value.trim();
    if (!seed) {
      titlePreview.hidden = true;
      return;
    }
    const sampleVideo = videos[0];
    const samples = Array.from({ length: 3 }, () => generateRandomTitle(seed, sampleVideo));
    titlePreview.hidden = false;
    titlePreview.innerHTML = `
      <small class="muted">Exemplos:</small>
      <ul class="schedule-title-preview-list">
        ${samples.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}
      </ul>
    `;
  }
  titleSeedInput?.addEventListener('input', updateTitlePreview);

  form?.querySelectorAll('[data-schedule-sub]').forEach((wrap) => {
    const subInput = wrap.querySelector('input[type="checkbox"]');
    const label = wrap.querySelector('.schedule-toggle-label');
    const subKey = wrap.getAttribute('data-schedule-sub');
    const fieldEl = wrap.closest('.schedule-field');
    const sync = () => {
      if (!subInput) return;
      const on = subInput.checked;
      if (label) {
        if (subKey === 'title') {
          label.textContent = on ? 'ON' : 'OFF';
        } else {
          label.textContent = on ? 'AUTO' : 'OFF';
        }
      }
      if (scheduleMasterToggle?.checked) {
        if (subKey === 'hour') {
          renderHourInputs();
        } else if (subKey === 'title') {
          syncTitleAutoState();
        } else {
          const valueInput = fieldEl?.querySelector('input:not([type="checkbox"]), select');
          if (valueInput) valueInput.disabled = !on && subKey !== 'source' && subKey !== 'hour' ? false : on;
          // For source: AUTO checked = disable select; OFF = enable
          if (subKey === 'source') {
            const valSel = fieldEl?.querySelector('select');
            if (valSel) valSel.disabled = on;
          }
        }
      }
    };
    sync();
    subInput?.addEventListener('change', sync);
  });

  renderDateChips();
  refreshScheduleMaster();
  syncTitleAutoState();

  const channelToggleInputs = Array.from(form?.querySelectorAll('.channel-toggle-input') ?? []);
  const syncChannelToggleCards = () => {
    channelToggleInputs.forEach((input) => {
      const card = input.closest('[data-channel-toggle-card]');
      const switchLabel = card?.querySelector('.channel-toggle-switch-label');
      card?.classList.toggle('selected', input.checked);
      if (switchLabel) {
        switchLabel.textContent = input.checked ? 'ON' : 'OFF';
      }
    });
  };

  syncChannelToggleCards();
  channelToggleInputs.forEach((input) => {
    input.addEventListener('change', syncChannelToggleCards);
  });

  form?.querySelector('[data-action="select-all-campaign-channels"]')?.addEventListener('click', () => {
    channelToggleInputs.forEach((input) => {
      input.checked = true;
    });
    syncChannelToggleCards();
  });

  form?.querySelector('[data-action="clear-campaign-channels"]')?.addEventListener('click', () => {
    channelToggleInputs.forEach((input) => {
      input.checked = false;
    });
    syncChannelToggleCards();
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const submitButton = form.querySelector('button[type="submit"]');
    const selectedFormat = String(data.get('publishFormat') ?? 'standard');
    const selectedPlaylistId = String(data.get('playlistId') ?? '').trim();
    const isAutoMode = data.get('autoMode') === '1';

    let resolvedVideoAssetId = String(data.get('videoAssetId') ?? '');

    if (isAutoMode && selectedPlaylistId) {
      const next = await api.nextPlaylistVideo(selectedPlaylistId);
      if (!next.ok || !next.body?.videoAssetId) {
        setUiNotice('warning', 'Playlist vazia', 'Nao foi possivel selecionar um video da playlist (vazia ou todos ja postados).');
        return;
      }
      resolvedVideoAssetId = next.body.videoAssetId;
    } else if (!resolvedVideoAssetId) {
      setUiNotice('warning', 'Video required', 'Selecione um video asset ou ative o modo Auto com uma playlist.');
      return;
    }

    const selectedAsset = videos.find((asset) => asset.id === resolvedVideoAssetId);
    if (!selectedAsset) {
      setUiNotice('warning', 'Video required', 'Video asset invalido.');
      return;
    }
    const actualFormat = getVideoPublishFormat(selectedAsset);
    if (!isAutoMode && actualFormat !== selectedFormat) {
      setUiNotice('warning', 'Format mismatch', `The selected media is classified as ${getVideoPublishFormatLabel(actualFormat)}. Choose a matching asset or switch the publish format.`);
      return;
    }

    setButtonBusy(submitButton, true, 'Saving...');

    let schedulePattern = '';
    let scheduledLaunches = [];
    const baseScheduledAtRaw = data.get('scheduledAt') ? new Date(String(data.get('scheduledAt'))).toISOString() : undefined;
    if (data.get('schedulePatternEnabled') === '1') {
      const timesPerDay = Math.max(1, parseInt(String(data.get('scheduleTimesPerDay') ?? '1'), 10) || 1);
      const sourceAuto = data.get('scheduleSourceAuto') === '1';
      const hourAuto = data.get('scheduleHourAuto') === '1';
      const hours = hourAuto ? 'auto' : data.getAll('scheduleHour').map((v) => String(v)).filter(Boolean);
      const days = Array.from(selectedDates).sort();
      const cfg = {
        timesPerDay,
        source: sourceAuto ? 'auto' : (String(data.get('scheduleSource') ?? 'playlist')),
        hours,
        days,
      };
      schedulePattern = `random:${JSON.stringify(cfg)}`;

      // Build (day, hour) combinations into ISO datetimes
      const todayKey = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD in local TZ
      const daysList = days.length > 0 ? days : [todayKey];
      for (const day of daysList) {
        const hoursForDay = hourAuto
          ? generateSpacedHoursForDay(day, timesPerDay)
          : (Array.isArray(hours) && hours.length > 0 ? hours : ['18:00']);
        for (const hour of hoursForDay) {
          const iso = new Date(`${day}T${hour}:00`).toISOString();
          scheduledLaunches.push(iso);
        }
      }
    }

    const selectedDestinationRefs = data.getAll('destinationRef').map((entry) => String(entry));
    const tags = String(data.get('tags') ?? '').split(',').map((t) => t.trim()).filter(Boolean);
    const targetTemplate = {
      videoTitle: String(data.get('videoTitle') ?? ''),
      videoDescription: String(data.get('videoDescription') ?? ''),
      tags: tags.length > 0 ? tags : undefined,
      publishAt: data.get('publishAt') ? new Date(String(data.get('publishAt'))).toISOString() : undefined,
      playlistId: String(data.get('youtubePlaylistId') ?? '').trim() || undefined,
      privacy: String(data.get('privacy') ?? '').trim() || undefined,
    };

    const titleAutoEnabled = data.get('schedulePatternEnabled') === '1' && data.get('scheduleTitleEnabled') === '1';
    const titleSeed = String(data.get('scheduleTitleSeed') ?? '').trim();

    async function createOneCampaign(titleSuffix, scheduledAtIso, videoAssetIdForCampaign) {
      const baseTitle = String(data.get('title') ?? '');
      let resolvedTitle;
      if (titleAutoEnabled && titleSeed) {
        const assetForTitle = videos.find((a) => a.id === videoAssetIdForCampaign) ?? null;
        resolvedTitle = generateRandomTitle(titleSeed, assetForTitle);
      } else {
        resolvedTitle = `${baseTitle}${titleSuffix}`;
      }
      const campaignPayload = {
        title: resolvedTitle || `Campanha ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
        videoAssetId: videoAssetIdForCampaign,
        scheduledAt: scheduledAtIso ?? baseScheduledAtRaw,
        playlistId: selectedPlaylistId || undefined,
        autoMode: isAutoMode,
        schedulePattern: schedulePattern || undefined,
      };
      const created = await api.createCampaign(campaignPayload);
      if (!created.ok) return { ok: false, error: created.error };
      const newId = created.body?.campaign?.id;
      if (!newId) return { ok: false, error: 'Missing campaign id' };

      if (selectedDestinationRefs.length > 0) {
        await api.addTargetsBulk(
          newId,
          selectedDestinationRefs.map((destinationRef) => {
            const [platform, destinationId] = destinationRef.split(':');
            const destination = connectedChannels.find((entry) => entry.platform === platform && entry.destinationId === destinationId);
            return {
              platform,
              destinationId,
              destinationLabel: destination?.destinationLabel ?? destination?.title ?? destinationId,
              connectedAccountId: destination?.connectedAccountId ?? null,
              channelId: platform === 'youtube' ? destinationId : undefined,
              ...targetTemplate,
            };
          }),
        );
        const readyResponse = await api.markReady(newId);
        if (!readyResponse.ok) return { ok: false, error: readyResponse.error || 'Failed to mark campaign ready' };
      }
      return { ok: true, id: newId };
    }

    let firstCampaignId = null;
    if (scheduledLaunches.length <= 1) {
      const r = await createOneCampaign('', scheduledLaunches[0], resolvedVideoAssetId);
      if (!r.ok) {
        setButtonBusy(submitButton, false);
        setUiNotice('error', 'Campaign creation failed', r.error);
        return;
      }
      firstCampaignId = r.id;
    } else {
      // Multiple scheduled launches → one campaign per launch, each with its own video pick when auto+playlist
      let i = 0;
      for (const iso of scheduledLaunches) {
        i++;
        let videoIdForThis = resolvedVideoAssetId;
        if (isAutoMode && selectedPlaylistId && i > 1) {
          const next = await api.nextPlaylistVideo(selectedPlaylistId);
          if (next.ok && next.body?.videoAssetId) videoIdForThis = next.body.videoAssetId;
        }
        const suffix = ` #${i}/${scheduledLaunches.length} (${iso.slice(0, 16).replace('T', ' ')})`;
        const r = await createOneCampaign(suffix, iso, videoIdForThis);
        if (!r.ok) {
          setButtonBusy(submitButton, false);
          setUiNotice('warning', 'Algumas campanhas falharam', `Erro no disparo ${i}: ${r.error}`);
          break;
        }
        if (!firstCampaignId) firstCampaignId = r.id;
      }
    }

    setButtonBusy(submitButton, false);
    if (scheduledLaunches.length > 1) {
      setUiNotice('success', 'Campanhas criadas', `${scheduledLaunches.length} disparos agendados.`);
    } else {
      setUiNotice('success', 'Campaign created', 'The new campaign draft was created successfully.');
    }
    if (firstCampaignId) {
      navigate(`/workspace/campanhas/${encodeURIComponent(firstCampaignId)}`);
    } else {
      navigate('/workspace/campanhas');
    }
  });
}

function randomTimeString() {
  const h = Math.floor(Math.random() * 24);
  const m = Math.floor(Math.random() * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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
    () => `${baseSeed} | ${new Date().toLocaleDateString('pt-BR')}`,
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

function formatConnectedChannelOptionLabel(channel) {
  const title = String(channel?.title ?? channel?.id ?? 'Unknown channel');
  const secondary = channel?.handle
    ? channel.handle
    : channel?.youtubeChannelId
      ? `YT ${channel.youtubeChannelId}`
      : channel?.id ?? 'Unknown id';
  return `${title} (${secondary}) - ${channel?.id ?? 'unknown'}`;
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

async function loadActiveConnectedChannels() {
  const accountsResult = await api.accounts();
  if (!accountsResult.ok) {
    return {
      ok: false,
      status: accountsResult.status,
      error: accountsResult.error,
      channels: [],
    };
  }

  const accounts = Array.isArray(accountsResult.body?.accounts)
    ? accountsResult.body.accounts.filter((account) => isSupportedWorkspaceProvider(account.provider))
    : [];
  if (accounts.length === 0) {
    return {
      ok: true,
      channels: [],
    };
  }

  const channelResponses = await Promise.all(accounts.map((account) => api.accountChannels(account.id)));
  const unauthorized = channelResponses.find((response) => !response.ok && response.status === 401);
  if (unauthorized) {
    return {
      ok: false,
      status: 401,
      error: unauthorized.error,
      channels: [],
    };
  }

  const channels = channelResponses
    .filter((response) => response.ok)
    .flatMap((response) => Array.isArray(response.body?.channels) ? response.body.channels : [])
    .filter((channel) => channel.isActive);

  const failedResponse = channelResponses.find((response) => !response.ok);
  if (failedResponse && channels.length === 0) {
    return {
      ok: false,
      status: failedResponse.status,
      error: failedResponse.error,
      channels: [],
    };
  }

  channels.sort((left, right) => formatConnectedChannelOptionLabel(left).localeCompare(formatConnectedChannelOptionLabel(right)));

  return {
    ok: true,
    channels,
  };
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
    actions.push(`<button type="button" data-action="mark-ready" data-campaign-id="${escapeHtml(campaign.id)}">Mark ready</button>`);
  }
  if (campaign.status === 'ready' && (campaign.targets?.length ?? 0) > 0) {
    actions.push(`<button class="btn-primary" type="button" data-action="launch-campaign" data-campaign-id="${escapeHtml(campaign.id)}">Launch</button>`);
  }
  if (campaign.status === 'draft' || campaign.status === 'ready') {
    actions.push(`<button class="btn-danger" type="button" data-action="delete-campaign" data-campaign-id="${escapeHtml(campaign.id)}">Delete</button>`);
  }
  actions.push(`<button type="button" data-action="clone-campaign" data-campaign-id="${escapeHtml(campaign.id)}">Clone</button>`);
  actions.push(`<a class="btn" data-link href="/workspace/campanhas">Back</a>`);

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
      const actionButtons = [];
      if (target.status === 'erro') {
        actionButtons.push(`<button type="button" data-action="retry-target" data-campaign-id="${escapeHtml(campaign.id)}" data-target-id="${escapeHtml(target.id)}">Retry</button>`);
      }
      if (canMutateTargets) {
        actionButtons.push(`<button type="button" data-action="edit-target" data-target-id="${escapeHtml(target.id)}">Edit</button>`);
        actionButtons.push(`<button class="btn-danger" type="button" data-action="remove-target" data-target-id="${escapeHtml(target.id)}">Remove</button>`);
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
          <td>${target.reauthRequired ? statusPill('reauth_required') : '-'}</td>
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
            <button class="btn-primary" type="submit">Save campaign</button>
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
            <button class="btn-primary" type="submit" ${canSubmitConnectedTarget ? '' : 'disabled'}>Add target</button>
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
            <a class="btn ${activityFilter === 'all' ? 'btn-primary' : ''}" data-link href="${filterHrefs.all}">All</a>
            <a class="btn ${activityFilter === 'jobs' ? 'btn-primary' : ''}" data-link href="${filterHrefs.jobs}">Jobs</a>
            <a class="btn ${activityFilter === 'audit' ? 'btn-primary' : ''}" data-link href="${filterHrefs.audit}">Audit</a>
          </div>
        </div>
        <form id="timeline-filter-form" class="inline-actions">
          <input type="hidden" name="activity" value="${escapeHtml(activityFilter === 'all' ? '' : activityFilter)}" />
          <label>
            Target filter
            <select name="targetId">${targetOptions}</select>
          </label>
          <button type="submit">Apply</button>
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
  addTargetForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(addTargetForm);
    const submitButton = addTargetForm.querySelector('button[type="submit"]');
    const tags = String(data.get('tags') ?? '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
    const payload = {
      ...(data.get('destinationRef')
        ? (() => {
            const destinationRef = String(data.get('destinationRef') ?? '');
            const [platform, destinationId] = destinationRef.split(':');
            const destination = availableConnectedChannels.find((entry) => entry.platform === platform && entry.destinationId === destinationId);
            return {
              platform,
              destinationId,
              destinationLabel: destination?.destinationLabel ?? destination?.title ?? destinationId,
              connectedAccountId: destination?.connectedAccountId ?? null,
              channelId: platform === 'youtube' ? destinationId : undefined,
            };
          })()
        : {
            destinationId: String(data.get('destinationId') ?? ''),
            channelId: String(data.get('destinationId') ?? ''),
          }),
      videoTitle: String(data.get('videoTitle') ?? ''),
      videoDescription: String(data.get('videoDescription') ?? ''),
      tags: tags.length > 0 ? tags : undefined,
      publishAt: data.get('publishAt') ? new Date(String(data.get('publishAt'))).toISOString() : undefined,
      privacy: String(data.get('privacy') ?? '').trim() || undefined,
      playlistId: String(data.get('playlistId') ?? '').trim() || undefined,
      thumbnailAssetId: String(data.get('thumbnailAssetId') ?? '').trim() || undefined,
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
        title: 'Delete campaign',
        message: 'This will permanently remove the current campaign.',
        confirmLabel: 'Delete campaign',
        tone: 'warning',
      });
      if (!confirmed) return;
      setButtonBusy(button, true, 'Deleting...');
      const response = await api.deleteCampaign(campaign.id);
      setButtonBusy(button, false);
      if (!response.ok) {
        setUiNotice('error', 'Delete failed', response.error);
        await renderCampaignDetailPage(campaign.id);
        return;
      }
      setUiNotice('success', 'Campaign deleted', 'The campaign was deleted successfully.');
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
  state.routeInFlight = true;
  try {
    const path = window.location.pathname;
    if (path === '/') {
      renderLoading('Checking session...');
      const me = await ensureAuthenticated();
      navigate(me ? (me.needsPlanSelection ? '/onboarding/plan' : '/workspace/dashboard') : '/login', true);
      return;
    }

    if (path === '/login') {
      const me = await ensureAuthenticated();
      if (me) {
        navigate(me.needsPlanSelection ? '/onboarding/plan' : '/workspace/dashboard', true);
        return;
      }
      const query = parseCurrentQuery();
      renderLoginPage({ mode: query.get('mode') === 'register' ? 'register' : 'login' });
      return;
    }

    if (path === '/login/callback') {
      await renderGoogleAuthCallbackPage();
      return;
    }

    if (path === '/onboarding/plan') {
      const me = await ensureAuthenticated();
      if (!me) {
        unauthorizedRedirect();
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

      if (path === '/workspace/accounts/callback') {
        await renderAccountsOauthCallbackPage();
        return;
      }

      if (path === '/workspace/accounts') {
        await renderAccountsPage();
        return;
      }

      if (path === '/workspace/media') {
        await renderMediaPage();
        return;
      }

      if (path === '/workspace/playlists') {
        await renderPlaylistsPage();
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
applyFontTheme(state.fontTheme);
attachGlobalNavigation();
void renderRoute();
