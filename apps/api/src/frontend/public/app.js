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
  return durationSeconds > 0 && durationSeconds <= SHORT_FORM_MAX_DURATION_SECONDS ? 'short' : 'standard';
}

function getVideoPublishFormatLabel(format) {
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

async function buildUploadPayloadFromFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  return {
    originalName: file.name,
    mimeType: file.type || 'application/octet-stream',
    base64Data: arrayBufferToBase64(arrayBuffer),
    sizeBytes: file.size,
  };
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
    priceLabel: 'Gratis',
    description: 'Ideal para conhecer a plataforma e publicar no YouTube sem custo mensal.',
    tokenSummary: '80 tokens maximos',
    visitSummary: '+10 tokens por visita diaria',
    platformSummary: 'YouTube',
  },
  {
    id: 'BASIC',
    label: 'Basic',
    priceLabel: 'R$ 9,99 / mes',
    description: 'Mais folego para operacao recorrente com limite maior de campanhas.',
    tokenSummary: '250 tokens maximos',
    visitSummary: '+25 tokens por visita diaria',
    platformSummary: 'YouTube',
  },
  {
    id: 'PRO',
    label: 'Pro',
    priceLabel: 'R$ 19,99 / mes',
    description: 'Plano completo para publicar em YouTube, Instagram e TikTok.',
    tokenSummary: '600 tokens maximos',
    visitSummary: '+50 tokens por visita diaria',
    platformSummary: 'YouTube + Instagram + TikTok',
    featured: true,
  },
];
const BACKGROUND_THEME_OPTIONS = [
  {
    id: 'deep-black-blue',
    label: 'Deep Black Blue',
    type: 'dark',
    appearance: 'dark',
    code: '#0B0F1A -> #111827',
    description: 'Ideal para dashboard premium e operacao analitica.',
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
    description: 'Bom para produto SaaS e interface mais futurista.',
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
    description: 'Visual neutro e seguro para sistema interno.',
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
    description: 'Ideal para dashboard com destaque em dados.',
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
    description: 'Boa escolha para painel tecnico com energia visual.',
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
    description: 'Minimalista e elegante para sistema focado em conteudo.',
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
    description: 'Limpo e leve para escritorio e admin classico.',
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
    description: 'Equilibrado para dashboards densos e sistemas internos.',
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
    description: 'Otimo para workspace mais fresco e tecnico.',
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
    description: 'Mais editorial e humano para produto com narrativa.',
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
    description: 'Suave para produtos criativos e interface moderna.',
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
    description: 'Neutro e limpo para sistema com foco em produtividade.',
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
    description: 'Impactante para landing interna e dashboard hero.',
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
    description: 'Energetico para criacao, conteudo e marketing.',
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
    description: 'Equilibrado para operacao, crescimento e health metrics.',
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
    description: 'Bom para visual premium com mais profundidade.',
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
    description: 'Expressivo para campanhas, criacao e conteudo.',
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
    description: 'Leve e tecnologico para analytics e media hub.',
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
    description: 'Premium escuro com textura leve para administracao.',
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
    description: 'Otimo para sistema e dashboard com leitura organizada.',
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
    description: 'Mais artistico para workspace moderno e premium.',
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
    description: 'Elegante para interface premium com cara de app moderno.',
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
    description: 'Boa para criacao, campanhas e visual menos padrao.',
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
    description: 'Sutil e premium para painel corporativo serio.',
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
    return value === 'youtube' || value === 'google' ? value : null;
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
  selectAccountPlan: (plan) => apiRequest('POST', '/api/account/plan/select', { plan }),
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
  startInstagramOauth: () => apiRequest('GET', '/api/accounts/oauth/instagram/start'),
  startTikTokOauth: () => apiRequest('GET', '/api/accounts/oauth/tiktok/start'),
  accountOauthCallback: (code, stateParam) => apiRequest('GET', buildUrl('/api/accounts/oauth/google/callback', { code, state: stateParam })),
  accountYouTubeOauthCallback: (code, stateParam) => apiRequest('GET', buildUrl('/api/accounts/oauth/youtube/callback', { code, state: stateParam })),
  accountInstagramOauthCallback: (code, stateParam) => apiRequest('GET', buildUrl('/api/accounts/oauth/instagram/callback', { code, state: stateParam })),
  accountTikTokOauthCallback: (code, stateParam) => apiRequest('GET', buildUrl('/api/accounts/oauth/tiktok/callback', { code, state: stateParam })),
  accountChannels: (accountId) => apiRequest('GET', `/api/accounts/${encodeURIComponent(accountId)}/channels`),
  syncAccountChannels: (accountId) => apiRequest('POST', `/api/accounts/${encodeURIComponent(accountId)}/channels/sync`),
  toggleChannel: (accountId, channelId, isActive) => apiRequest('PATCH', `/api/accounts/${encodeURIComponent(accountId)}/channels/${encodeURIComponent(channelId)}`, { isActive }),
  disconnectAccount: (accountId) => apiRequest('DELETE', `/api/accounts/${encodeURIComponent(accountId)}`, { confirm: 'DISCONNECT' }),
  deleteAccount: (accountId) => apiRequest('DELETE', `/api/accounts/${encodeURIComponent(accountId)}/permanent`, { confirm: 'DELETE' }),
  media: () => apiRequest('GET', '/api/media'),
  uploadMedia: (payload) => apiRequest('POST', '/api/media', payload),
  deleteMedia: (id) => apiRequest('DELETE', `/api/media/${encodeURIComponent(id)}`),
};

const state = {
  me: null,
  routeInFlight: false,
  rerenderQueued: false,
  backgroundTheme: readStoredBackgroundTheme() ?? getSystemBackgroundTheme(),
  theme: 'light',
  fontTheme: readStoredFontTheme(),
  mediaPreviewSizes: readStoredMediaPreviewSizes(),
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

  const fontOptionsHtml = FONT_THEME_OPTIONS.map((option) => (
    `<option value="${option.id}" ${option.id === state.fontTheme ? 'selected' : ''}>${option.label}</option>`
  )).join('');

  return `
    <details class="settings-picker">
      <summary class="theme-toggle-btn">
        ⚙ Settings
        <span class="background-picker-current">${escapeHtml(selectedTheme.label)}</span>
      </summary>
      <div class="settings-panel">
        <div class="settings-section">
          <div class="settings-section-header">
            <strong>Background</strong>
            <span class="muted">Live preview on select.</span>
          </div>
          <div class="background-grid">
            ${cardsHtml}
          </div>
        </div>
        <div class="settings-section">
          <div class="settings-section-header">
            <strong>Text color</strong>
            <span class="muted">Applies globally.</span>
          </div>
          <select id="${escapeHtml(prefix)}-font-theme-select" class="font-theme-select-panel">
            ${fontOptionsHtml}
          </select>
        </div>
      </div>
    </details>
  `;
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
  if (pathname.startsWith('/workspace/media')) return 'media';
  if (pathname.startsWith('/workspace/campanhas')) return 'campanhas';
  return 'dashboard';
}

function renderWorkspaceShell(options) {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', href: '/workspace/dashboard' },
    { id: 'campanhas', label: 'Campanhas', href: '/workspace/campanhas' },
    { id: 'accounts', label: 'Accounts', href: '/workspace/accounts' },
    { id: 'media', label: 'Media', href: '/workspace/media' },
  ];
  const currentTab = activeTab(window.location.pathname);
  const navHtml = tabs.map((tab) => (
    `<a class="nav-link ${tab.id === currentTab ? 'active' : ''}" data-link href="${tab.href}">${tab.label}</a>`
  )).join('');
  const settingsPicker = settingsPickerHtml('workspace');
  const combinedNoticeHtml = `${renderUiNotice()}${options.noticeHtml ?? ''}`;

  root.innerHTML = `
    <div class="page">
      <header class="header">
        <div class="container header-shell">
          <div class="brand">
            YT Multi Publi
            <small>Admin Workspace</small>
          </div>
          <nav class="nav">${navHtml}</nav>
          <div class="nav">
            ${settingsPicker}
            <span class="user-email">${escapeHtml(state.me?.email ?? '')}</span>
            <button id="logout-btn" class="logout-btn" type="button">Logout</button>
          </div>
        </div>
      </header>
      <main class="container stack">
        <section class="title-row">
          <div>
            <h1 class="route-title">${escapeHtml(options.title)}</h1>
            ${options.subtitle ? `<p class="muted">${escapeHtml(options.subtitle)}</p>` : ''}
          </div>
          ${options.actionsHtml ?? ''}
        </section>
        ${combinedNoticeHtml}
        ${options.contentHtml}
      </main>
    </div>
  `;

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await api.logout();
      state.me = null;
      navigate('/login', true);
    });
  }

  const fontThemeSelect = document.getElementById('workspace-font-theme-select');
  if (fontThemeSelect) {
    fontThemeSelect.addEventListener('change', (event) => {
      applyFontTheme(event.target.value);
      void renderRoute();
    });
  }

  bindBackgroundPicker(() => {
    void renderRoute();
  });
  bindUiNoticeDismiss();
}

function renderLoginPage(options = {}) {
  const mode = options.mode === 'register' ? 'register' : 'login';
  const title = mode === 'register' ? 'Create your account' : 'Sign in to your workspace';
  const subtitle = mode === 'register'
    ? 'Create an account with email and password or continue with Google.'
    : 'Use your email and password or continue with Google to access the publishing workspace.';
  const submitLabel = mode === 'register' ? 'Create account' : 'Sign in';
  const settingsPicker = settingsPickerHtml('login');
  const combinedNoticeHtml = `${renderUiNotice()}${options.error ? `<div class="notice error">${escapeHtml(options.error)}</div>` : ''}`;

  root.innerHTML = `
    <div class="login-wrap">
      <div class="login-toolbar">
        ${settingsPicker}
      </div>
      <section class="login-card stack">
        ${combinedNoticeHtml}
        <div>
          <div class="auth-mode-switch" role="tablist" aria-label="Authentication mode">
            <button class="${mode === 'login' ? 'btn-primary' : 'btn'}" type="button" data-auth-mode="login">Sign in</button>
            <button class="${mode === 'register' ? 'btn-primary' : 'btn'}" type="button" data-auth-mode="register">Create account</button>
          </div>
          <h1>${escapeHtml(title)}</h1>
          <p class="muted">${escapeHtml(subtitle)}</p>
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
      </section>
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
  return `
    <article class="plan-card ${option.featured ? 'featured' : ''} ${isSelected ? 'selected' : ''}">
      <div class="stack">
        <div class="inline-actions">
          <span class="pill ${option.featured ? 'success' : 'info'}">${escapeHtml(option.label)}</span>
          ${option.featured ? '<span class="pill warning">Most complete</span>' : ''}
        </div>
        <div class="plan-price">${escapeHtml(option.priceLabel)}</div>
        <p class="muted">${escapeHtml(option.description)}</p>
      </div>
      <div class="stack plan-points">
        <span>${escapeHtml(option.tokenSummary)}</span>
        <span>${escapeHtml(option.visitSummary)}</span>
        <span>${escapeHtml(option.platformSummary)}</span>
      </div>
      <button class="${option.featured ? 'btn-primary' : 'btn'}" type="button" data-action="select-onboarding-plan" data-plan-id="${escapeHtml(option.id)}">
        ${isSelected ? 'Selected now' : `Choose ${escapeHtml(option.label)}`}
      </button>
    </article>
  `;
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

  const account = result.body?.account ?? null;
  const selectedPlan = account?.plan ?? 'FREE';
  const combinedNoticeHtml = `${renderUiNotice()}${options.error ? `<div class="notice error">${escapeHtml(options.error)}</div>` : ''}`;
  const planCardsHtml = ACCOUNT_PLAN_OPTIONS.map((option) => renderPlanCard(option, selectedPlan)).join('');
  const settingsPicker = settingsPickerHtml('plan-onboarding');

  root.innerHTML = `
    <div class="login-wrap">
      <div class="login-toolbar">
        ${settingsPicker}
      </div>
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
      setUiNotice('success', 'Plan selected', `The ${planId} plan is now active for your account.`);
      navigate('/workspace/dashboard', true);
    });
  });

  const planFontThemeSelect = document.getElementById('plan-onboarding-font-theme-select');
  planFontThemeSelect?.addEventListener('change', (event) => {
    applyFontTheme(event.target.value);
    void renderPlanSelectionPage(options);
  });

  bindBackgroundPicker(() => {
    void renderPlanSelectionPage(options);
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
  const primary = account?.displayName ?? account?.email ?? account?.id ?? 'Unknown account';
  const email = account?.email && account.email !== primary ? account.email : null;
  const providerLabel = getProviderLabel(account?.provider);
  const subjectSuffix = account?.providerSubject || account?.googleSubject
    ? `${providerLabel} ID ${account?.providerSubject ?? account?.googleSubject}`
    : null;
  const idSuffix = account?.id ? `Internal ID ${account.id}` : null;
  return {
    primary,
    secondary: [email, subjectSuffix, idSuffix].filter(Boolean).join(' | '),
  };
}

function getProviderLabel(provider) {
  switch ((provider ?? '').toLowerCase()) {
    case 'youtube':
      return 'YouTube';
    case 'instagram':
      return 'Instagram';
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
          preload="none"
          src="${escapeHtml(videoUrl)}"
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
  const result = await api.dashboard();
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
  channels.sort((left, right) => Number(right.published ?? 0) - Number(left.published ?? 0));

  const summaryCards = [
    { label: 'Campaigns', value: formatNumber(stats?.campaigns?.total ?? 0), hint: 'Total campaigns tracked', tone: 'info' },
    { label: 'Targets', value: formatNumber(stats?.targets?.total ?? 0), hint: 'All targets across campaigns', tone: 'info' },
    { label: 'Jobs', value: formatNumber(stats?.jobs?.total ?? 0), hint: 'Upload jobs queued + finished', tone: 'info' },
    { label: 'Published', value: formatNumber(targetsByStatus.publicado ?? 0), hint: 'Targets successfully published', tone: 'success' },
    { label: 'Failed', value: formatNumber(targetsByStatus.erro ?? 0), hint: 'Targets in error state', tone: 'danger' },
    { label: 'Success Rate', value: formatPercent(stats?.targets?.successRate ?? 0), hint: 'Published / terminal targets', tone: 'success' },
    { label: 'Retry Attempts', value: formatNumber(stats?.jobs?.totalRetries ?? 0), hint: 'Retries spent so far', tone: 'warning' },
    { label: 'Blocked Targets', value: formatNumber(stats?.reauth?.blockedTargets ?? 0), hint: 'Need account reauth', tone: 'danger' },
  ];

  const cardsHtml = summaryCards.map((card) => (
    `<article class="card" data-tone="${escapeHtml(card.tone)}">
      <div class="summary-value">${escapeHtml(card.value)}</div>
      <div class="summary-label">${escapeHtml(card.label)}</div>
      <div class="summary-hint">${escapeHtml(card.hint)}</div>
    </article>`
  )).join('');

  const channelsTable = channels.length === 0
    ? '<p class="muted">No channel metrics available yet.</p>'
    : `<table>
        <thead>
          <tr>
            <th>Channel</th>
            <th>Targets</th>
            <th>Published</th>
            <th>Failed</th>
            <th>Success</th>
          </tr>
        </thead>
        <tbody>
          ${channels.slice(0, 12).map((channel) => `
            <tr>
              <td>${escapeHtml(channel.channelId)}</td>
              <td>${formatNumber(channel.totalTargets)}</td>
              <td>${formatNumber(channel.published)}</td>
              <td>${formatNumber(channel.failed)}</td>
              <td>${escapeHtml(formatPercent(channel.successRate))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;

  const quotaWarningState = stats?.quota?.warningState ?? 'healthy';
  const quotaNoticeTone = quotaWarningState === 'critical' ? 'error' : quotaWarningState === 'warning' ? 'warning' : 'info';
  const quotaUsedPercent = clampPercent(stats?.quota?.usagePercent);
  const quotaProjectedPercent = clampPercent(stats?.quota?.projectedPercent);
  const failureReasons = Array.isArray(stats?.failures?.reasons) ? stats.failures.reasons : [];
  const failureReasonsTable = failureReasons.length === 0
    ? '<p class="muted">No failure reasons recorded.</p>'
    : `<table>
        <thead>
          <tr>
            <th>Reason</th>
            <th>Count</th>
          </tr>
        </thead>
        <tbody>
          ${failureReasons.map((entry) => `
            <tr>
              <td>${escapeHtml(normalizeLabel(entry.reason))}</td>
              <td>${formatNumber(entry.count)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;

  const auditByTypeRows = Object.entries(stats?.audit?.byType ?? {})
    .filter(([, count]) => Number(count ?? 0) > 0)
    .sort((left, right) => Number(right[1] ?? 0) - Number(left[1] ?? 0));
  const auditBreakdown = auditByTypeRows.length === 0
    ? '<p class="muted">No audit events yet.</p>'
    : `<table>
        <thead>
          <tr>
            <th>Event</th>
            <th>Count</th>
          </tr>
        </thead>
        <tbody>
          ${auditByTypeRows.map(([eventType, count]) => `
            <tr>
              <td>${escapeHtml(normalizeLabel(eventType))}</td>
              <td>${formatNumber(count)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;

  const notices = [];
  if (quotaWarningState !== 'healthy') {
    notices.push(`
      <div class="notice ${quotaNoticeTone}">
        <h4>Quota ${quotaWarningState === 'critical' ? 'critical' : 'warning'}</h4>
        <p>Projected usage is ${formatPercent(stats?.quota?.projectedPercent ?? 0)} of the daily limit.</p>
      </div>
    `);
  }
  if (Number(stats?.reauth?.blockedTargets ?? 0) > 0) {
    notices.push(`
      <div class="notice warning">
        <h4>Account reauthorization needed</h4>
        <p>${formatNumber(stats.reauth.blockedTargets)} targets are blocked across ${formatNumber(stats.reauth.blockedChannelCount ?? 0)} channels.</p>
      </div>
    `);
  }
  if (Number(stats?.failures?.failedTargets ?? 0) > 0) {
    notices.push(`
      <div class="notice warning">
        <h4>Failures detected</h4>
        <p>${formatNumber(stats.failures.failedTargets)} targets failed in ${formatNumber(stats.failures.failedCampaigns ?? 0)} campaigns.</p>
      </div>
    `);
  }

  renderWorkspaceShell({
    title: 'Dashboard',
    subtitle: 'Campaign health and operational summaries.',
    actionsHtml: `
      <div class="inline-actions">
        <a class="btn" data-link href="/workspace/campanhas">Open campaigns</a>
        <a class="btn" data-link href="/workspace/accounts">Review accounts</a>
        <a class="btn" data-link href="${escapeHtml(buildUrl('/workspace/dashboard'))}">Refresh</a>
      </div>
    `,
    noticeHtml: notices.join(''),
    contentHtml: `
      <section class="grid-4">${cardsHtml}</section>
      <section class="grid-2">
        <article class="card stack">
          <h3>Campaign pipeline</h3>
          <h4>Campaign status</h4>
          ${renderBreakdownList(campaignsByStatus, 'No campaigns in the pipeline yet.')}
          <h4>Target status</h4>
          ${renderBreakdownList(targetsByStatus, 'No targets available yet.')}
          <h4>Job status</h4>
          ${renderBreakdownList(jobsByStatus, 'No jobs recorded yet.')}
        </article>
        <article class="card stack">
          <h3>Quota forecast</h3>
          <div class="progress-block">
            <div class="progress-meta">
              <span>Consumed</span>
              <strong>${formatPercent(stats?.quota?.usagePercent ?? 0)}</strong>
            </div>
            <div class="progress-track"><span class="progress-fill" style="width:${quotaUsedPercent}%"></span></div>
          </div>
          <div class="progress-block">
            <div class="progress-meta">
              <span>Projected</span>
              <strong>${formatPercent(stats?.quota?.projectedPercent ?? 0)}</strong>
            </div>
            <div class="progress-track"><span class="progress-fill projected" style="width:${quotaProjectedPercent}%"></span></div>
          </div>
          <table>
            <tbody>
              <tr><th>Daily limit</th><td>${formatNumber(stats?.quota?.dailyLimitUnits ?? 0)}</td></tr>
              <tr><th>Consumed units</th><td>${formatNumber(stats?.quota?.estimatedConsumedUnits ?? 0)}</td></tr>
              <tr><th>Queued units</th><td>${formatNumber(stats?.quota?.estimatedQueuedUnits ?? 0)}</td></tr>
              <tr><th>Projected units</th><td>${formatNumber(stats?.quota?.estimatedProjectedUnits ?? 0)}</td></tr>
              <tr><th>Remaining units</th><td>${formatNumber(stats?.quota?.estimatedRemainingUnits ?? 0)}</td></tr>
            </tbody>
          </table>
        </article>
      </section>
      <section class="grid-3">
        <article class="card stack">
          <h3>Failures</h3>
          <div class="summary-inline">
            <span>Top reason: ${escapeHtml(normalizeLabel(stats?.failures?.topReason ?? 'none'))}</span>
            <span>Failed campaigns: ${formatNumber(stats?.failures?.failedCampaigns ?? 0)}</span>
            <span>Failed targets: ${formatNumber(stats?.failures?.failedTargets ?? 0)}</span>
          </div>
          ${failureReasonsTable}
        </article>
        <article class="card stack">
          <h3>Retries & reauth</h3>
          <div class="summary-inline">
            <span>Total retries: ${formatNumber(stats?.jobs?.totalRetries ?? 0)}</span>
            <span>Retried targets: ${formatNumber(stats?.retries?.retriedTargets ?? 0)}</span>
            <span>Highest attempt: ${formatNumber(stats?.retries?.highestAttempt ?? 0)}</span>
            <span>Hotspot channel: ${escapeHtml(stats?.retries?.hotspotChannelId ?? '-')}</span>
            <span>Hotspot retries: ${formatNumber(stats?.retries?.hotspotRetryCount ?? 0)}</span>
          </div>
          <div class="summary-inline">
            <span>Blocked campaigns: ${formatNumber(stats?.reauth?.blockedCampaigns ?? 0)}</span>
            <span>Blocked targets: ${formatNumber(stats?.reauth?.blockedTargets ?? 0)}</span>
            <span>Blocked channels: ${formatNumber(stats?.reauth?.blockedChannelCount ?? 0)}</span>
          </div>
        </article>
        <article class="card stack">
          <h3>Audit</h3>
          <div class="summary-inline">
            <span>Total events: ${formatNumber(stats?.audit?.totalEvents ?? 0)}</span>
            <span>Latest: ${escapeHtml(formatDate(stats?.audit?.lastEventAt))}</span>
            <span>Type: ${escapeHtml(normalizeLabel(stats?.audit?.lastEventType ?? '-'))}</span>
            <span>Actor: ${escapeHtml(stats?.audit?.lastActorEmail ?? '-')}</span>
          </div>
          ${auditBreakdown}
        </article>
      </section>
      <section class="card stack">
        <h3>Channel leaderboard</h3>
        ${channelsTable}
      </section>
    `,
  });

  if (shouldAutoRefreshDashboard(stats)) {
    clearAutoRefreshTimer();
    state.autoRefreshTimer = setTimeout(() => {
      if (window.location.pathname !== '/workspace/dashboard') {
        return;
      }
      void renderDashboardPage();
    }, 3000);
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
    case 'instagram':
      callbackRequest = api.accountInstagramOauthCallback(code, stateParam);
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

  const accounts = Array.isArray(listResult.body?.accounts) ? listResult.body.accounts : [];
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
        channelErrors.push(`${account.displayName ?? account.email ?? account.id}: ${channelResponse.error}`);
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
  const selectedAccountSupportsChannels = supportsChannels(selectedAccount?.provider);
  const selectedAccountChannelSummary = selectedAccountId
    ? {
        total: channels.length,
        active: channels.filter((channel) => channel.isActive).length,
      }
    : null;
  const allChannels = accounts.flatMap((account) => {
    const accountChannels = channelsByAccountId.get(account.id) ?? [];
    return accountChannels.map((channel) => ({
      ...channel,
      connectedAccountLabel: account.displayName ?? account.email ?? account.id,
      connectedAccountEmail: account.email ?? '',
      connectedAccountId: account.id,
    }));
  });

  const connectedCount = accounts.filter((account) => account.status === 'connected').length;
  const reauthCount = accounts.filter((account) => account.status === 'reauth_required').length;
  const disconnectedCount = accounts.filter((account) => account.status === 'disconnected').length;

  const metricsCards = [
    { label: 'Connected', value: connectedCount, hint: 'Accounts ready to publish', tone: 'success' },
    { label: 'Reauth Required', value: reauthCount, hint: 'Accounts needing reconnection', tone: 'warning' },
    { label: 'Disconnected', value: disconnectedCount, hint: 'Manually disconnected accounts', tone: 'danger' },
    { label: 'Active Channels', value: activeChannels, hint: `${formatNumber(totalChannels)} channels total`, tone: 'info' },
  ];

  const metricsHtml = metricsCards.map((card) => `
    <article class="card" data-tone="${escapeHtml(card.tone)}">
      <div class="summary-value">${formatNumber(card.value)}</div>
      <div class="summary-label">${escapeHtml(card.label)}</div>
      <div class="summary-hint">${escapeHtml(card.hint)}</div>
    </article>
  `).join('');
  const accountSwitcherHtml = filteredAccounts.length === 0
    ? '<div class="muted">No connected accounts available.</div>'
    : filteredAccounts.map((account) => {
      const isSelected = account.id === selectedAccountId;
      const href = buildUrl('/workspace/accounts', {
        account: account.id,
        search,
        status: statusFilter,
      });
      const accountChannels = channelsByAccountId.get(account.id) ?? [];
      const identity = formatAccountIdentityLabel(account);
      return `
        <a class="account-chip ${isSelected ? 'selected' : ''}" data-link href="${escapeHtml(href)}">
          <strong>${escapeHtml(identity.primary)}</strong>
          <span>${escapeHtml(getProviderLabel(account.provider))}</span>
          <span>${escapeHtml(identity.secondary || account.id)}</span>
          <small>${formatNumber(accountChannels.length)} channel${accountChannels.length === 1 ? '' : 's'}</small>
        </a>
      `;
    }).join('');

  const accountsRows = filteredAccounts.length === 0
    ? '<tr><td colspan="6" class="muted">No connected accounts.</td></tr>'
    : filteredAccounts.map((account) => {
      const channels = channelsByAccountId.get(account.id) ?? [];
      const activeCount = channels.filter((channel) => channel.isActive).length;
      const rowHref = buildUrl('/workspace/accounts', {
        account: account.id,
        search,
        status: statusFilter,
      });
      const identity = formatAccountIdentityLabel(account);

      return `
      <tr${account.id === selectedAccountId ? ' class="row-selected"' : ''}>
        <td>
          <strong>${escapeHtml(identity.primary)}</strong>
          <div class="muted">${escapeHtml(getProviderLabel(account.provider))}</div>
          <div class="muted">${escapeHtml(identity.secondary || account.id)}</div>
        </td>
        <td>${escapeHtml(account.email ?? '-')}</td>
        <td>${statusPill(account.status)}</td>
        <td>${formatNumber(activeCount)} / ${formatNumber(channels.length)}</td>
        <td>${escapeHtml(formatDate(account.connectedAt))}</td>
        <td>
          <div class="inline-actions">
            <a class="btn" data-link href="${rowHref}">View channels</a>
            <button class="btn" data-action="disconnect-account" data-account-id="${escapeHtml(account.id)}" type="button">Disconnect</button>
            <button class="btn-danger" data-action="delete-account" data-account-id="${escapeHtml(account.id)}" type="button">Delete</button>
          </div>
        </td>
      </tr>
    `;
    }).join('');

  const channelsRows = !selectedAccountId
    ? '<tr><td colspan="5" class="muted">Select an account to view channels.</td></tr>'
    : channels.length === 0
      ? '<tr><td colspan="5" class="muted">No channels returned for this account.</td></tr>'
      : channels.map((channel) => `
        <tr>
          <td>
            <div class="channel-cell">
              ${channel.thumbnailUrl ? `<img class="channel-avatar" src="${escapeHtml(channel.thumbnailUrl)}" alt="" />` : '<span class="channel-avatar placeholder">YT</span>'}
              <div>
                <strong>${escapeHtml(channel.title ?? channel.youtubeChannelId ?? channel.id)}</strong>
                <div class="muted">${escapeHtml(channel.id)}</div>
              </div>
            </div>
          </td>
          <td>${escapeHtml(channel.handle ?? '-')}</td>
          <td>${statusPill(channel.isActive ? 'active' : 'inactive')}</td>
          <td>${escapeHtml(channel.youtubeChannelId ?? '-')}</td>
          <td>
            <button data-action="toggle-channel" data-account-id="${escapeHtml(selectedAccountId)}" data-channel-id="${escapeHtml(channel.id)}" data-next-active="${channel.isActive ? 'false' : 'true'}" type="button">
              ${channel.isActive ? 'Deactivate' : 'Activate'}
            </button>
          </td>
        </tr>
      `).join('');
  const allChannelsRows = allChannels.length === 0
    ? '<tr><td colspan="6" class="muted">No channels discovered across the connected accounts yet.</td></tr>'
    : allChannels.map((channel) => `
        <tr>
          <td>${escapeHtml(channel.connectedAccountLabel)}</td>
          <td>${escapeHtml(channel.connectedAccountEmail || '-')}</td>
          <td>${escapeHtml(channel.title ?? channel.youtubeChannelId ?? channel.id)}</td>
          <td>${escapeHtml(channel.handle ?? '-')}</td>
          <td>${escapeHtml(channel.youtubeChannelId ?? '-')}</td>
          <td>${statusPill(channel.isActive ? 'active' : 'inactive')}</td>
        </tr>
      `).join('');

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
        message: 'Connect YouTube, Instagram, or TikTok accounts to centralize your publishing workspace.',
        tone: 'info',
        actionsHtml: `
          <button class="btn-primary" type="button" data-action="start-youtube-oauth">Connect YouTube</button>
          <button class="btn" type="button" data-action="start-instagram-oauth">Connect Instagram</button>
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

  renderWorkspaceShell({
    title: 'Accounts',
    subtitle: 'Connected social accounts and YouTube publishing channels.',
    actionsHtml: `
      <div class="inline-actions">
        <button class="btn-primary" type="button" data-action="start-youtube-oauth">Connect YouTube</button>
        <button class="btn" type="button" data-action="start-instagram-oauth">Connect Instagram</button>
        <button class="btn" type="button" data-action="start-tiktok-oauth">Connect TikTok</button>
        <a class="btn" data-link href="${escapeHtml(buildUrl('/workspace/accounts', { search, status: statusFilter }))}">Refresh</a>
      </div>
    `,
    noticeHtml: notices.join(''),
    contentHtml: `
      <section class="grid-4">${metricsHtml}</section>
      ${accountsSetupCard}
      <section class="card stack">
        <h3>Connected accounts</h3>
        <form id="account-filter-form" class="grid-3">
          <label>
            Search
            <input name="search" value="${escapeHtml(search)}" placeholder="Name, email, id..." />
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
        <table>
          <thead>
            <tr>
              <th>Account</th>
              <th>Email</th>
              <th>Status</th>
              <th>Channels (active / total)</th>
              <th>Connected</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>${accountsRows}</tbody>
        </table>
      </section>
      <section class="card stack">
        <h3>Channels — ${selectedAccount ? escapeHtml(formatAccountIdentityLabel(selectedAccount).primary) : 'select an account above'}</h3>
        <div class="inline-actions">
          ${selectedAccount ? `<span class="pill">${escapeHtml(getProviderLabel(selectedAccount.provider))}</span>` : ''}
          ${selectedAccount ? `<span class="muted">${formatNumber(selectedAccountChannelSummary?.active ?? 0)} active / ${formatNumber(selectedAccountChannelSummary?.total ?? 0)} total</span>` : ''}
          <button class="btn" data-action="sync-channels" data-account-id="${escapeHtml(selectedAccountId ?? '')}" type="button" ${selectedAccountId && selectedAccountSupportsChannels ? '' : 'disabled'}>
            Sync channels
          </button>
        </div>
        ${selectedAccount && !selectedAccountSupportsChannels ? `
          <div class="notice info">
            <h4>${escapeHtml(getProviderLabel(selectedAccount.provider))} does not expose channels here</h4>
            <p>This account is connected and saved correctly, but channel sync in this dashboard remains YouTube-only for now.</p>
          </div>
        ` : `
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Handle</th>
                <th>State</th>
                <th>YouTube ID</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>${channelsRows}</tbody>
          </table>
        `}
      </section>
      <section class="card stack">
        <h3>All Linked YouTube Channels</h3>
        <div class="summary-inline">
          <span>Google accounts: ${formatNumber(accounts.length)}</span>
          <span>Total discovered channels: ${formatNumber(allChannels.length)}</span>
          <span>Selected account: ${escapeHtml(selectedAccount ? formatAccountIdentityLabel(selectedAccount).primary : 'none')}</span>
        </div>
        ${channelsOverviewCard}
        <table>
          <thead>
            <tr>
              <th>Google account</th>
              <th>Email</th>
              <th>Channel</th>
              <th>Handle</th>
              <th>YouTube ID</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>${allChannelsRows}</tbody>
        </table>
      </section>
    `,
  });

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

  const metricsHtml = [
    { label: 'Assets', value: formatNumber(filteredAssets.length), hint: `of ${formatNumber(assets.length)} total`, tone: 'info' },
    { label: 'Storage', value: formatBytes(totalSize), hint: `${formatNumber(totalSize)} bytes`, tone: 'info' },
    { label: 'Duration', value: formatDurationSeconds(totalDurationSeconds), hint: 'Combined media duration', tone: 'info' },
    { label: 'Linked Thumbnails', value: formatNumber(linkedThumbnailAssets), hint: 'Video with thumbnail or thumbnail linked to video', tone: 'success' },
  ].map((card) => `
    <article class="card" data-tone="${escapeHtml(card.tone)}">
      <div class="summary-value">${escapeHtml(card.value)}</div>
      <div class="summary-label">${escapeHtml(card.label)}</div>
      <div class="summary-hint">${escapeHtml(card.hint)}</div>
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

  renderWorkspaceShell({
    title: 'Media',
    subtitle: 'Uploaded reusable assets.',
    actionsHtml: `
      <div class="inline-actions">
        <a class="btn" data-link href="${escapeHtml(buildUrl('/workspace/media', { search: searchInput, type: typeFilter }))}">Refresh</a>
      </div>
    `,
    contentHtml: `
      <section class="grid-4">${metricsHtml}</section>
      ${mediaEmptyState}
      <section class="card stack">
        <h3>Upload new media</h3>
        <form id="media-upload-form" class="form-grid">
          <label>
            Video file (required)
            <input name="video" type="file" accept="video/mp4,video/quicktime" required />
          </label>
          <label>
            Thumbnail file (optional)
            <input name="thumbnail" type="file" accept="image/jpeg,image/png" />
          </label>
          <div class="inline-actions">
            <button class="btn-primary" type="submit">Upload media</button>
          </div>
        </form>
      </section>
      <section class="card stack">
        <h3>Filters</h3>
        <form id="media-filter-form" class="grid-3">
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
      </section>
      <section class="card stack">
        <h3>Asset library (${formatNumber(filteredAssets.length)})</h3>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Preview</th>
                <th>Size</th>
                <th>Duration</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>
    `,
  });

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
      const payload = {
        video: await buildUploadPayloadFromFile(videoFile),
      };
      if (thumbnailFile) {
        payload.thumbnail = await buildUploadPayloadFromFile(thumbnailFile);
      }

      const uploadResult = await api.uploadMedia(payload);
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

  document.querySelectorAll('[data-media-preview-frame]').forEach((frame) => {
    const video = frame.querySelector('[data-preview-video]');
    if (!(video instanceof HTMLVideoElement)) {
      return;
    }

    const startPreview = () => {
      frame.setAttribute('data-preview-playing', 'true');
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {});
      }
    };

    const stopPreview = () => {
      frame.setAttribute('data-preview-playing', 'false');
      video.pause();
      if (video.currentTime > 0) {
        video.currentTime = 0;
      }
    };

    frame.addEventListener('mouseenter', startPreview);
    frame.addEventListener('mouseleave', stopPreview);
    frame.addEventListener('focusin', startPreview);
    frame.addEventListener('focusout', stopPreview);
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

  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  document.querySelectorAll('[data-action="open-media-preview"]').forEach((frame) => {
    const openPreview = async () => {
      const mediaId = frame.getAttribute('data-media-id');
      if (!mediaId) {
        return;
      }

      const asset = assetById.get(mediaId);
      if (!asset) {
        return;
      }

      const previewVideo = frame.querySelector('[data-preview-video]');
      if (previewVideo instanceof HTMLVideoElement) {
        frame.setAttribute('data-preview-playing', 'false');
        previewVideo.pause();
        if (previewVideo.currentTime > 0) {
          previewVideo.currentTime = 0;
        }
      }

      await openMediaPreviewDialog(asset);
    };

    frame.addEventListener('click', openPreview);
    frame.addEventListener('keydown', async (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }
      event.preventDefault();
      await openPreview();
    });
  });

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
    `<button type="button" data-action="clone-campaign" data-campaign-id="${escapeHtml(campaign.id)}">Clone</button>`,
  ];
  if (campaign.status === 'draft' && targetCount > 0) {
    buttons.push(`<button type="button" data-action="mark-ready" data-campaign-id="${escapeHtml(campaign.id)}">Mark ready</button>`);
  }
  if (campaign.status === 'ready' && targetCount > 0) {
    buttons.push(`<button class="btn-primary" type="button" data-action="launch-campaign" data-campaign-id="${escapeHtml(campaign.id)}">Launch</button>`);
  }
  if (campaign.status === 'draft' || campaign.status === 'ready') {
    buttons.push(`<button class="btn-danger" type="button" data-action="delete-campaign" data-campaign-id="${escapeHtml(campaign.id)}">Delete</button>`);
  }
  return `<div class="inline-actions">${buttons.join('')}</div>`;
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

  const statusTotals = {
    draft: campaigns.filter((campaign) => campaign.status === 'draft').length,
    ready: campaigns.filter((campaign) => campaign.status === 'ready').length,
    launching: campaigns.filter((campaign) => campaign.status === 'launching').length,
    completed: campaigns.filter((campaign) => campaign.status === 'completed').length,
    failed: campaigns.filter((campaign) => campaign.status === 'failed').length,
  };

  const metricsHtml = [
    { label: 'Results', value: formatNumber(total), hint: 'Total campaigns matching filters' },
    { label: 'Showing', value: `${formatNumber(pageStart)}-${formatNumber(pageEnd)}`, hint: `Page ${formatNumber(currentPage)} of ${formatNumber(totalPages)}` },
    { label: 'Draft/Ready', value: `${formatNumber(statusTotals.draft)} / ${formatNumber(statusTotals.ready)}`, hint: 'Current page' },
    { label: 'Launching', value: formatNumber(statusTotals.launching), hint: 'Current page' },
    { label: 'Completed', value: formatNumber(statusTotals.completed), hint: 'Current page' },
    { label: 'Failed', value: formatNumber(statusTotals.failed), hint: 'Current page' },
  ].map((card) => `
    <article class="card">
      <div class="summary-value">${escapeHtml(card.value)}</div>
      <div class="summary-label">${escapeHtml(card.label)}</div>
      <div class="summary-hint">${escapeHtml(card.hint)}</div>
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

  renderWorkspaceShell({
    title: 'Campanhas',
    subtitle: 'Campaign list and lifecycle actions.',
    actionsHtml: `
      <div class="inline-actions">
        <a class="btn btn-primary" data-link href="/workspace/campanhas/nova">Create campaign</a>
        <a class="btn" data-link href="${escapeHtml(buildUrl('/workspace/campanhas', {
          status: filters.status,
          search: filters.search,
          limit: pageLimit,
          offset: pageOffset,
        }))}">Refresh</a>
      </div>
    `,
    contentHtml: `
      <section class="grid-3">${metricsHtml}</section>
      ${campaignsEmptyState}
      <section class="card stack">
        <form id="campaign-filter-form" class="grid-3">
          <label>
            Status
            <select name="status">
              <option value="">All</option>
              <option value="draft" ${filters.status === 'draft' ? 'selected' : ''}>draft</option>
              <option value="ready" ${filters.status === 'ready' ? 'selected' : ''}>ready</option>
              <option value="launching" ${filters.status === 'launching' ? 'selected' : ''}>launching</option>
              <option value="completed" ${filters.status === 'completed' ? 'selected' : ''}>completed</option>
              <option value="failed" ${filters.status === 'failed' ? 'selected' : ''}>failed</option>
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
          <div class="inline-actions">
            <button class="btn-primary" type="submit">Apply filters</button>
            <a class="btn" data-link href="/workspace/campanhas">Clear</a>
          </div>
        </form>
      </section>
      <section class="card stack">
        <div class="title-row">
          <h3>Campaigns (${formatNumber(total)})</h3>
          <div class="inline-actions">
            ${previousHref
              ? `<a class="btn" data-link href="${previousHref}">Previous</a>`
              : '<button class="btn" type="button" disabled>Previous</button>'}
            ${nextHref
              ? `<a class="btn" data-link href="${nextHref}">Next</a>`
              : '<button class="btn" type="button" disabled>Next</button>'}
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Format</th>
              <th>Status</th>
              <th>Scheduled</th>
              <th>Targets</th>
              <th>Outcome</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p class="muted">Showing ${formatNumber(pageStart)}-${formatNumber(pageEnd)} of ${formatNumber(total)} campaigns.</p>
      </section>
    `,
  });

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
  const [mediaResult, destinationsResult] = await Promise.all([api.media(), loadConnectedPublishDestinations()]);
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
  const connectedChannels = destinationsResult.destinations;
  const activeChannels = connectedChannels.filter((channel) => channel.platform === 'youtube');
  const hasVideos = videos.length > 0;
  const hasChannels = connectedChannels.length > 0;

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
          hint: hasChannels ? `${formatNumber(activeChannels.length)} YouTube channels and ${formatNumber(connectedChannels.length - activeChannels.length)} social destinations are available for this campaign.` : 'Connect YouTube, Instagram, or TikTok accounts to target publications directly from the composer.',
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
            <div class="summary-hint">Available in the media library</div>
          </article>
        </div>
        <form id="campaign-create-form" class="form-grid">
          <label>
            Campaign title
            <input name="title" required placeholder="My campaign" />
          </label>
          <label>
            Publish format
            <select name="publishFormat" required>
              <option value="standard">Video normal</option>
              <option value="short">Reels / Shorts</option>
            </select>
          </label>
          <label>
            Video asset
            <select name="videoAssetId" required>
              <option value="">Select a video</option>
              ${videoOptions}
            </select>
          </label>
          <label>
            Scheduled at (optional)
            <input name="scheduledAt" type="datetime-local" />
          </label>
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
            Playlist ID (optional)
            <input name="playlistId" />
          </label>
          <fieldset class="card">
            <legend>Connected publishing destinations</legend>
            <div class="inline-actions">
              <button class="btn" type="button" data-action="select-all-campaign-channels">Turn all ON</button>
              <button class="btn" type="button" data-action="clear-campaign-channels">Turn all OFF</button>
            </div>
            <div class="notice info">Use the toggle to decide exactly which connected channels or social accounts will receive this campaign.</div>
            <div class="channel-toggle-grid">${channelToggleCards}</div>
          </fieldset>
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
    const selectedVideoAssetId = String(data.get('videoAssetId') ?? '');
    const selectedFormat = String(data.get('publishFormat') ?? 'standard');
    const selectedAsset = videos.find((asset) => asset.id === selectedVideoAssetId);
    if (!selectedAsset) {
      setUiNotice('warning', 'Video required', 'Select a valid video asset before saving the campaign.');
      await renderCampaignComposerPage();
      return;
    }
    const actualFormat = getVideoPublishFormat(selectedAsset);
    if (actualFormat !== selectedFormat) {
      setUiNotice('warning', 'Format mismatch', `The selected media is classified as ${getVideoPublishFormatLabel(actualFormat)}. Choose a matching asset or switch the publish format.`);
      await renderCampaignComposerPage();
      return;
    }
    setButtonBusy(submitButton, true, 'Saving...');
    const campaignPayload = {
      title: String(data.get('title') ?? ''),
      videoAssetId: selectedVideoAssetId,
      scheduledAt: data.get('scheduledAt') ? new Date(String(data.get('scheduledAt'))).toISOString() : undefined,
    };
    const created = await api.createCampaign(campaignPayload);
    if (!created.ok) {
      setButtonBusy(submitButton, false);
      setUiNotice('error', 'Campaign creation failed', created.error);
      await renderCampaignComposerPage();
      return;
    }

    const selectedDestinationRefs = data.getAll('destinationRef').map((entry) => String(entry));
    const newCampaignId = created.body?.campaign?.id;
    if (!newCampaignId) {
      setButtonBusy(submitButton, false);
      setUiNotice('error', 'Campaign created with missing id', 'The API returned success but did not include the campaign id.');
      await renderCampaignComposerPage();
      return;
    }

    if (selectedDestinationRefs.length > 0) {
      const tags = String(data.get('tags') ?? '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
      const targetTemplate = {
        videoTitle: String(data.get('videoTitle') ?? ''),
        videoDescription: String(data.get('videoDescription') ?? ''),
        tags: tags.length > 0 ? tags : undefined,
        publishAt: data.get('publishAt') ? new Date(String(data.get('publishAt'))).toISOString() : undefined,
        playlistId: String(data.get('playlistId') ?? '').trim() || undefined,
        privacy: String(data.get('privacy') ?? '').trim() || undefined,
      };

      const addTargets = await api.addTargetsBulk(
        newCampaignId,
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
      if (!addTargets.ok) {
        setUiNotice('warning', 'Campaign created with target issues', `Targets could not be added: ${addTargets.error}`);
      }
    }

    setButtonBusy(submitButton, false);
    setUiNotice('success', 'Campaign created', 'The new campaign draft was created successfully.');
    navigate(`/workspace/campanhas/${encodeURIComponent(newCampaignId)}`);
  });
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

  const accounts = Array.isArray(accountsResult.body?.accounts) ? accountsResult.body.accounts : [];
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

  const accounts = Array.isArray(accountsResult.body?.accounts) ? accountsResult.body.accounts : [];
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
