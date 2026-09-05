import { existsSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { LEGAL_DOCUMENTS, type LegalDocument, type LegalDocumentKey } from './legal-documents';

interface FrontendAsset {
  contentType: string;
  body: string | Buffer;
}

function preferBuiltAsset(builtPath: URL, sourcePath: URL): URL {
  return existsSync(builtPath) ? builtPath : sourcePath;
}

const APP_JS_SOURCE_PATH = new URL('./public/app.js', import.meta.url);
const APP_CSS_SOURCE_PATH = new URL('./public/app.css', import.meta.url);
const I18N_JS_SOURCE_PATH = new URL('./public/i18n.js', import.meta.url);
const APP_JS_PATH = preferBuiltAsset(new URL('./public/generated/app.min.js', import.meta.url), APP_JS_SOURCE_PATH);
const APP_CSS_PATH = preferBuiltAsset(new URL('./public/generated/app.min.css', import.meta.url), APP_CSS_SOURCE_PATH);
const I18N_JS_PATH = preferBuiltAsset(new URL('./public/generated/i18n.min.js', import.meta.url), I18N_JS_SOURCE_PATH);
const UNI_BACKGROUND_PATH = new URL('./public/assets/UNI.png', import.meta.url);
const PLANET_IMAGE_PATH = new URL('./public/assets/PLANETA.png', import.meta.url);
const SATELLITE_IMAGE_PATH = new URL('./public/assets/SAT.png', import.meta.url);
const SUN_IMAGE_PATH = new URL('./public/assets/SOL.png', import.meta.url);
const MOON_IMAGE_PATH = new URL('./public/assets/LUA.png', import.meta.url);
const PMP_LOGO_PATH = new URL('./public/assets/PMP.png', import.meta.url);
const PMP_PRIMARY_LOGO_PATH = new URL('./public/assets/PMP-logo.png', import.meta.url);
const PMP_TAGLINE_PATH = new URL('./public/assets/PMP-tagline.png', import.meta.url);
const UNI_BACKGROUND_WEBP_PATH = new URL('./public/assets/optimized/UNI.webp', import.meta.url);
const PLANET_IMAGE_WEBP_PATH = new URL('./public/assets/optimized/PLANETA.webp', import.meta.url);
const SATELLITE_IMAGE_WEBP_PATH = new URL('./public/assets/optimized/SAT.webp', import.meta.url);
const SUN_IMAGE_WEBP_PATH = new URL('./public/assets/optimized/SOL.webp', import.meta.url);
const MOON_IMAGE_WEBP_PATH = new URL('./public/assets/optimized/LUA.webp', import.meta.url);
const PMP_LOGO_WEBP_PATH = new URL('./public/assets/optimized/PMP.webp', import.meta.url);
const PMP_PRIMARY_LOGO_WEBP_PATH = new URL('./public/assets/optimized/PMP-logo.webp', import.meta.url);
const PMP_TAGLINE_WEBP_PATH = new URL('./public/assets/optimized/PMP-tagline.webp', import.meta.url);
const ACC_ICON_PATH = new URL('./public/assets/icons/ACC_contas_vinculadas.svg', import.meta.url);
const CAN_ICON_PATH = new URL('./public/assets/icons/CAN_canais_ativos.svg', import.meta.url);
const COTA_ICON_PATH = new URL('./public/assets/icons/COTA_medidor_api.svg', import.meta.url);
const CP_ICON_PATH = new URL('./public/assets/icons/CP_campanhas.svg', import.meta.url);
const CFG_ICON_PATH = new URL('./public/assets/icons/CFG_configuracoes.svg', import.meta.url);
const EU_ICON_PATH = new URL('./public/assets/icons/EU_usuario.svg', import.meta.url);
const IDI_ICON_PATH = new URL('./public/assets/icons/IDI_idioma.svg', import.meta.url);
const BG_ICON_PATH = new URL('./public/assets/icons/PMP_BG_Aparencia.svg', import.meta.url);
const VIS_ICON_PATH = new URL('./public/assets/icons/PMP_VIS_Visibilidade.svg', import.meta.url);
const RES_ICON_PATH = new URL('./public/assets/icons/PMP_RES_Preferencias_Salvas.svg', import.meta.url);
const OK_ICON_PATH = new URL('./public/assets/icons/OK_check.svg', import.meta.url);
const PRO_ICON_PATH = new URL('./public/assets/icons/PRO_cadeado_coroa.svg', import.meta.url);
const TOK_ICON_PATH = new URL('./public/assets/icons/TOK_token_raio.svg', import.meta.url);
const CTA_ICON_PATH = new URL('./public/assets/icons/CTA_atalhos_conta.svg', import.meta.url);
const RISK_ICON_PATH = new URL('./public/assets/icons/RISCO_lixeira_alerta.svg', import.meta.url);
const AUTH_ICON_PATH = new URL('./public/assets/icons/AUTH_escudo_oauth.svg', import.meta.url);
const QUEUE_ICON_PATH = new URL('./public/assets/icons/FILA_fila_campanhas.svg', import.meta.url);
const NEW_ICON_PATH = new URL('./public/assets/icons/NEW_adicionar.svg', import.meta.url);
const DOWN_ICON_PATH = new URL('./public/assets/icons/DN_queda.svg', import.meta.url);
const UP_ICON_PATH = new URL('./public/assets/icons/UP_crescimento.svg', import.meta.url);
const FOCUS_ICON_PATH = new URL('./public/assets/icons/FOCO_alvo.svg', import.meta.url);
const SYNC_ICON_PATH = new URL('./public/assets/icons/SYNC_sincronizacao.svg', import.meta.url);
const ACCOUNT_VISIBILITY_ICON_PATH = new URL('./public/assets/icons/VIS_olho.svg', import.meta.url);
const INSTAGRAM_ICON_PATH = new URL('./public/assets/icons/IG_instagram.svg', import.meta.url);
const TIKTOK_ICON_PATH = new URL('./public/assets/icons/TT_tiktok.svg', import.meta.url);
const YOUTUBE_ICON_PATH = new URL('./public/assets/icons/YT_youtube.svg', import.meta.url);
const DIRECTORY_ICON_PATH = new URL('./public/assets/icons/DIR_pasta.svg', import.meta.url);
const DURATION_ICON_PATH = new URL('./public/assets/icons/DUR_relogio.svg', import.meta.url);
const IMAGE_ICON_PATH = new URL('./public/assets/icons/IMG_imagem.svg', import.meta.url);
const LIBRARY_ICON_PATH = new URL('./public/assets/icons/LIB_biblioteca.svg', import.meta.url);
const STORAGE_ICON_PATH = new URL('./public/assets/icons/STO_armazenamento.svg', import.meta.url);
const VIDEO_ICON_PATH = new URL('./public/assets/icons/VID_video.svg', import.meta.url);
const ADD_ICON_PATH = new URL('./public/assets/icons/ADD_adicionar.svg', import.meta.url);
const PLAYLIST_ICON_PATH = new URL('./public/assets/icons/LIST_playlist.svg', import.meta.url);
const PUBLISHED_ICON_PATH = new URL('./public/assets/icons/PUB_publicacao.svg', import.meta.url);
const STAR_ICON_PATH = new URL('./public/assets/icons/TOP_estrela.svg', import.meta.url);
const CAMPAIGN_ERROR_ICON_PATH = new URL('./public/assets/icons/ER_erro.svg', import.meta.url);
const ALERT_ICON_PATH = new URL('./public/assets/icons/ALERTA_aviso.svg', import.meta.url);
const BLOCKED_ICON_PATH = new URL('./public/assets/icons/BLOQ_cadeado.svg', import.meta.url);
const NEW_CAMPAIGN_ICON_PATH = new URL('./public/assets/icons/NOVO_nova_campanha.svg', import.meta.url);
const CAMPAIGN_SUCCESS_ICON_PATH = new URL('./public/assets/icons/OK_sucesso.svg', import.meta.url);
const CAMPAIGN_PENDING_ICON_PATH = new URL('./public/assets/icons/PE_pendente.svg', import.meta.url);
const NO_PLATFORM_ICON_PATH = new URL('./public/assets/icons/SP_sem_plataforma.svg', import.meta.url);
const RECONNECT_ICON_PATH = new URL('./public/assets/icons/AU_chave_reconectar.svg', import.meta.url);
const AUTHENTICATION_ICON_PATH = new URL('./public/assets/icons/AUTH_escudo_autenticacao.svg', import.meta.url);
const ACTIVITY_ICON_PATH = new URL('./public/assets/icons/AT_atividade.svg', import.meta.url);
const AUTOMATION_PLAYLIST_ICON_PATH = new URL('./public/assets/icons/AUTO_automacao_playlist.svg', import.meta.url);
const FUTURE_CALENDAR_ICON_PATH = new URL('./public/assets/icons/D+_calendario_futuro.svg', import.meta.url);
const TODAY_ICON_PATH = new URL('./public/assets/icons/HJ_hoje.svg', import.meta.url);
const MEDIA_FILE_ICON_PATH = new URL('./public/assets/icons/MID_arquivo_video.svg', import.meta.url);
const APPLY_FILTERS_ICON_PATH = new URL('./public/assets/icons/FL_aplicar_filtros.svg', import.meta.url);
const SENDING_ICON_PATH = new URL('./public/assets/icons/FL_enviando.svg', import.meta.url);
const READY_ICON_PATH = new URL('./public/assets/icons/PR_pronta.svg', import.meta.url);
const DRAFT_ICON_PATH = new URL('./public/assets/icons/RA_rascunho.svg', import.meta.url);
const GENERIC_STATUS_ICON_PATH = new URL('./public/assets/icons/ST_estado_generico.svg', import.meta.url);
const CLEAR_FILTERS_ICON_PATH = new URL('./public/assets/icons/X_limpar_filtros.svg', import.meta.url);
const SITE_NAME = 'Platform Multi Publisher';
const DEFAULT_LOCALE = 'pt-BR';
const SUPPORTED_LOCALES = new Set(['pt-BR', 'en']);
export type FrontendLocale = 'pt-BR' | 'en';

const SEO_METADATA = {
  'pt-BR': {
    siteName: 'Platform Multi Publisher',
    title: 'Platform Multi Publisher | Publique vídeos no YouTube, TikTok e Instagram',
    description: 'Planeje, automatize e acompanhe publicações em vídeo no YouTube, TikTok e Instagram em um único painel, com campanhas, biblioteca de mídia e relatórios.',
    keywords: [
      'publicador multi plataforma',
      'publicar no YouTube TikTok Instagram',
      'automacao de campanhas de video',
      'gerenciador de midias sociais',
      'dashboard de publicacao',
    ],
    initialTitle: 'Publique vídeos no YouTube, TikTok e Instagram em um só painel',
    initialText: 'Organize campanhas, conecte suas contas, acompanhe falhas e mantenha sua rotina de conteúdo sem retrabalho.',
    initialPublicSectionTitle: 'Fluxo de publicacao multi plataforma',
    initialPublicSectionText: 'Conecte contas, crie campanhas, publique videos e acompanhe status em uma rotina unica para YouTube, TikTok e Instagram.',
    initialIndexSectionTitle: 'SEO e conversao da pagina inicial',
    initialIndexSectionText: 'Pagina publica com title, meta description, canonical, dados estruturados, H1 claro, CTAs e conteudo rastreavel para indexacao.',
  },
  en: {
    siteName: 'Platform Multi Publisher',
    title: 'Platform Multi Publisher | Publish to YouTube, TikTok and Instagram',
    description: 'Run publishing campaigns, media and scheduling workflows for YouTube, TikTok, and Instagram from one visual workspace.',
    keywords: [
      'multi-platform publishing',
      'publish to YouTube TikTok Instagram',
      'video publishing automation',
      'social media publishing dashboard',
      'campaign management',
    ],
    initialTitle: 'Plan and publish your videos on YouTube, TikTok and Instagram',
    initialText: 'An operational publishing workflow with campaigns, automation and cross-platform distribution.',
    initialPublicSectionTitle: 'Cross-platform publishing',
    initialPublicSectionText: 'Build campaigns for YouTube, TikTok and Instagram with a media library, connected destinations, publish queue and operational dashboard.',
    initialIndexSectionTitle: 'Technical SEO base',
    initialIndexSectionText: 'Public page, XML sitemap, robots.txt, metadata, canonical and structured data prepared for Google Search Console.',
  },
};

const APP_JS = readFileSync(APP_JS_PATH, 'utf-8');
const APP_CSS = readFileSync(APP_CSS_PATH, 'utf-8');
const FRONTEND_ASSET_VERSION = createHash('sha256').update([
  statSync(APP_JS_PATH).mtimeMs,
  statSync(APP_CSS_PATH).mtimeMs,
  statSync(I18N_JS_PATH).mtimeMs,
  statSync(UNI_BACKGROUND_PATH).mtimeMs,
  statSync(PLANET_IMAGE_PATH).mtimeMs,
  statSync(SATELLITE_IMAGE_PATH).mtimeMs,
  statSync(SUN_IMAGE_PATH).mtimeMs,
  statSync(MOON_IMAGE_PATH).mtimeMs,
  statSync(PMP_LOGO_PATH).mtimeMs,
  statSync(PMP_PRIMARY_LOGO_PATH).mtimeMs,
  statSync(PMP_TAGLINE_PATH).mtimeMs,
  statSync(ACC_ICON_PATH).mtimeMs,
  statSync(CFG_ICON_PATH).mtimeMs,
  statSync(EU_ICON_PATH).mtimeMs,
  statSync(IDI_ICON_PATH).mtimeMs,
  statSync(BG_ICON_PATH).mtimeMs,
  statSync(VIS_ICON_PATH).mtimeMs,
  statSync(RES_ICON_PATH).mtimeMs,
  statSync(OK_ICON_PATH).mtimeMs,
  statSync(PRO_ICON_PATH).mtimeMs,
  statSync(TOK_ICON_PATH).mtimeMs,
  statSync(CTA_ICON_PATH).mtimeMs,
  statSync(RISK_ICON_PATH).mtimeMs,
  statSync(AUTH_ICON_PATH).mtimeMs,
  statSync(QUEUE_ICON_PATH).mtimeMs,
  statSync(NEW_ICON_PATH).mtimeMs,
  statSync(DOWN_ICON_PATH).mtimeMs,
  statSync(UP_ICON_PATH).mtimeMs,
  statSync(FOCUS_ICON_PATH).mtimeMs,
  statSync(SYNC_ICON_PATH).mtimeMs,
  statSync(ACCOUNT_VISIBILITY_ICON_PATH).mtimeMs,
  statSync(INSTAGRAM_ICON_PATH).mtimeMs,
  statSync(TIKTOK_ICON_PATH).mtimeMs,
  statSync(YOUTUBE_ICON_PATH).mtimeMs,
  statSync(DIRECTORY_ICON_PATH).mtimeMs,
  statSync(DURATION_ICON_PATH).mtimeMs,
  statSync(IMAGE_ICON_PATH).mtimeMs,
  statSync(LIBRARY_ICON_PATH).mtimeMs,
  statSync(STORAGE_ICON_PATH).mtimeMs,
  statSync(VIDEO_ICON_PATH).mtimeMs,
  statSync(ADD_ICON_PATH).mtimeMs,
  statSync(PLAYLIST_ICON_PATH).mtimeMs,
  statSync(PUBLISHED_ICON_PATH).mtimeMs,
  statSync(STAR_ICON_PATH).mtimeMs,
  statSync(CAMPAIGN_ERROR_ICON_PATH).mtimeMs,
  statSync(ALERT_ICON_PATH).mtimeMs,
  statSync(BLOCKED_ICON_PATH).mtimeMs,
  statSync(NEW_CAMPAIGN_ICON_PATH).mtimeMs,
  statSync(CAMPAIGN_SUCCESS_ICON_PATH).mtimeMs,
  statSync(CAMPAIGN_PENDING_ICON_PATH).mtimeMs,
  statSync(NO_PLATFORM_ICON_PATH).mtimeMs,
  statSync(RECONNECT_ICON_PATH).mtimeMs,
  statSync(AUTHENTICATION_ICON_PATH).mtimeMs,
  statSync(ACTIVITY_ICON_PATH).mtimeMs,
  statSync(AUTOMATION_PLAYLIST_ICON_PATH).mtimeMs,
  statSync(FUTURE_CALENDAR_ICON_PATH).mtimeMs,
  statSync(TODAY_ICON_PATH).mtimeMs,
  statSync(MEDIA_FILE_ICON_PATH).mtimeMs,
  statSync(APPLY_FILTERS_ICON_PATH).mtimeMs,
  statSync(SENDING_ICON_PATH).mtimeMs,
  statSync(READY_ICON_PATH).mtimeMs,
  statSync(DRAFT_ICON_PATH).mtimeMs,
  statSync(GENERIC_STATUS_ICON_PATH).mtimeMs,
  statSync(CLEAR_FILTERS_ICON_PATH).mtimeMs,
].map((value) => Math.round(value)).join('.')).digest('hex').slice(0, 16);
const FRONTEND_STATIC_ASSETS = new Map<string, FrontendAsset>([
  ['/assets/optimized/UNI.webp', {
    contentType: 'image/webp',
    body: readFileSync(UNI_BACKGROUND_WEBP_PATH),
  }],
  ['/assets/optimized/PLANETA.webp', {
    contentType: 'image/webp',
    body: readFileSync(PLANET_IMAGE_WEBP_PATH),
  }],
  ['/assets/optimized/SAT.webp', {
    contentType: 'image/webp',
    body: readFileSync(SATELLITE_IMAGE_WEBP_PATH),
  }],
  ['/assets/optimized/SOL.webp', {
    contentType: 'image/webp',
    body: readFileSync(SUN_IMAGE_WEBP_PATH),
  }],
  ['/assets/optimized/LUA.webp', {
    contentType: 'image/webp',
    body: readFileSync(MOON_IMAGE_WEBP_PATH),
  }],
  ['/assets/optimized/PMP.webp', {
    contentType: 'image/webp',
    body: readFileSync(PMP_LOGO_WEBP_PATH),
  }],
  ['/assets/optimized/PMP-logo.webp', {
    contentType: 'image/webp',
    body: readFileSync(PMP_PRIMARY_LOGO_WEBP_PATH),
  }],
  ['/assets/optimized/PMP-tagline.webp', {
    contentType: 'image/webp',
    body: readFileSync(PMP_TAGLINE_WEBP_PATH),
  }],
  ['/assets/UNI.png', {
    contentType: 'image/png',
    body: readFileSync(UNI_BACKGROUND_PATH),
  }],
  ['/assets/PLANETA.png', {
    contentType: 'image/png',
    body: readFileSync(PLANET_IMAGE_PATH),
  }],
  ['/assets/SAT.png', {
    contentType: 'image/png',
    body: readFileSync(SATELLITE_IMAGE_PATH),
  }],
  ['/assets/SOL.png', {
    contentType: 'image/png',
    body: readFileSync(SUN_IMAGE_PATH),
  }],
  ['/assets/LUA.png', {
    contentType: 'image/png',
    body: readFileSync(MOON_IMAGE_PATH),
  }],
  ['/assets/PMP.png', {
    contentType: 'image/png',
    body: readFileSync(PMP_LOGO_PATH),
  }],
  ['/assets/PMP-logo.png', {
    contentType: 'image/png',
    body: readFileSync(PMP_PRIMARY_LOGO_PATH),
  }],
  ['/assets/PMP-tagline.png', {
    contentType: 'image/png',
    body: readFileSync(PMP_TAGLINE_PATH),
  }],
  ['/assets/icons/ACC_contas_vinculadas.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(ACC_ICON_PATH),
  }],
  ['/assets/icons/CAN_canais_ativos.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(CAN_ICON_PATH),
  }],
  ['/assets/icons/COTA_medidor_api.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(COTA_ICON_PATH),
  }],
  ['/assets/icons/CP_campanhas.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(CP_ICON_PATH),
  }],
  ['/assets/icons/CFG_configuracoes.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(CFG_ICON_PATH),
  }],
  ['/assets/icons/EU_usuario.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(EU_ICON_PATH),
  }],
  ['/assets/icons/IDI_idioma.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(IDI_ICON_PATH),
  }],
  ['/assets/icons/PMP_BG_Aparencia.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(BG_ICON_PATH),
  }],
  ['/assets/icons/PMP_VIS_Visibilidade.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(VIS_ICON_PATH),
  }],
  ['/assets/icons/PMP_RES_Preferencias_Salvas.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(RES_ICON_PATH),
  }],
  ['/assets/icons/OK_check.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(OK_ICON_PATH),
  }],
  ['/assets/icons/PRO_cadeado_coroa.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(PRO_ICON_PATH),
  }],
  ['/assets/icons/TOK_token_raio.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(TOK_ICON_PATH),
  }],
  ['/assets/icons/CTA_atalhos_conta.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(CTA_ICON_PATH),
  }],
  ['/assets/icons/RISCO_lixeira_alerta.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(RISK_ICON_PATH),
  }],
  ['/assets/icons/AUTH_escudo_oauth.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(AUTH_ICON_PATH),
  }],
  ['/assets/icons/FILA_fila_campanhas.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(QUEUE_ICON_PATH),
  }],
  ['/assets/icons/NEW_adicionar.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(NEW_ICON_PATH),
  }],
  ['/assets/icons/DN_queda.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(DOWN_ICON_PATH),
  }],
  ['/assets/icons/UP_crescimento.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(UP_ICON_PATH),
  }],
  ['/assets/icons/FOCO_alvo.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(FOCUS_ICON_PATH),
  }],
  ['/assets/icons/SYNC_sincronizacao.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(SYNC_ICON_PATH),
  }],
  ['/assets/icons/VIS_olho.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(ACCOUNT_VISIBILITY_ICON_PATH),
  }],
  ['/assets/icons/IG_instagram.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(INSTAGRAM_ICON_PATH),
  }],
  ['/assets/icons/TT_tiktok.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(TIKTOK_ICON_PATH),
  }],
  ['/assets/icons/YT_youtube.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(YOUTUBE_ICON_PATH),
  }],
  ['/assets/icons/DIR_pasta.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(DIRECTORY_ICON_PATH),
  }],
  ['/assets/icons/DUR_relogio.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(DURATION_ICON_PATH),
  }],
  ['/assets/icons/IMG_imagem.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(IMAGE_ICON_PATH),
  }],
  ['/assets/icons/LIB_biblioteca.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(LIBRARY_ICON_PATH),
  }],
  ['/assets/icons/STO_armazenamento.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(STORAGE_ICON_PATH),
  }],
  ['/assets/icons/VID_video.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(VIDEO_ICON_PATH),
  }],
  ['/assets/icons/ADD_adicionar.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(ADD_ICON_PATH),
  }],
  ['/assets/icons/LIST_playlist.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(PLAYLIST_ICON_PATH),
  }],
  ['/assets/icons/PUB_publicacao.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(PUBLISHED_ICON_PATH),
  }],
  ['/assets/icons/TOP_estrela.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(STAR_ICON_PATH),
  }],
  ['/assets/icons/ER_erro.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(CAMPAIGN_ERROR_ICON_PATH),
  }],
  ['/assets/icons/ALERTA_aviso.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(ALERT_ICON_PATH),
  }],
  ['/assets/icons/BLOQ_cadeado.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(BLOCKED_ICON_PATH),
  }],
  ['/assets/icons/NOVO_nova_campanha.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(NEW_CAMPAIGN_ICON_PATH),
  }],
  ['/assets/icons/OK_sucesso.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(CAMPAIGN_SUCCESS_ICON_PATH),
  }],
  ['/assets/icons/PE_pendente.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(CAMPAIGN_PENDING_ICON_PATH),
  }],
  ['/assets/icons/SP_sem_plataforma.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(NO_PLATFORM_ICON_PATH),
  }],
  ['/assets/icons/AU_chave_reconectar.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(RECONNECT_ICON_PATH),
  }],
  ['/assets/icons/AUTH_escudo_autenticacao.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(AUTHENTICATION_ICON_PATH),
  }],
  ['/assets/icons/AT_atividade.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(ACTIVITY_ICON_PATH),
  }],
  ['/assets/icons/FL_aplicar_filtros.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(APPLY_FILTERS_ICON_PATH),
  }],
  ['/assets/icons/FL_enviando.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(SENDING_ICON_PATH),
  }],
  ['/assets/icons/PR_pronta.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(READY_ICON_PATH),
  }],
  ['/assets/icons/RA_rascunho.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(DRAFT_ICON_PATH),
  }],
  ['/assets/icons/ST_estado_generico.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(GENERIC_STATUS_ICON_PATH),
  }],
  ['/assets/icons/X_limpar_filtros.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(CLEAR_FILTERS_ICON_PATH),
  }],
  ['/assets/icons/AUTO_automacao_playlist.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(AUTOMATION_PLAYLIST_ICON_PATH),
  }],
  ['/assets/icons/D+_calendario_futuro.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(FUTURE_CALENDAR_ICON_PATH),
  }],
  ['/assets/icons/HJ_hoje.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(TODAY_ICON_PATH),
  }],
  ['/assets/icons/MID_arquivo_video.svg', {
    contentType: 'image/svg+xml; charset=utf-8',
    body: readFileSync(MEDIA_FILE_ICON_PATH),
  }],
]);

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function normalizePublicBaseUrl(): string {
  const explicit = process.env.PUBLIC_APP_URL?.trim();
  const host = process.env.HOST?.trim() || '127.0.0.1';
  const port = process.env.PORT?.trim() || '3000';
  const candidate = explicit || `http://${host}:${port}`;

  try {
    return new URL(candidate).toString().replace(/\/+$/, '');
  } catch {
    return 'http://127.0.0.1:3000';
  }
}

function buildAbsoluteUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizePublicBaseUrl()}${normalizedPath}`;
}

function repairUtf8Mojibake(value: string): string {
  if (!/[ÃÂâð]/.test(value)) return value;
  try {
    return Buffer.from(value, 'latin1').toString('utf8');
  } catch {
    return value;
  }
}

const PUBLIC_INDEXABLE_PATHS = ['/', '/login', '/onboarding/plan', '/privacy', '/terms', '/data-deletion'] as const;
const LEGAL_PATH_TO_DOCUMENT_KEY: Partial<Record<string, LegalDocumentKey>> = {
  '/privacy': 'privacy',
  '/terms': 'terms',
  '/data-deletion': 'data-deletion',
};
function normalizeFrontendPath(path: string): string {
  if (path.length > 1 && path.endsWith('/')) {
    return path.replace(/\/+$/, '');
  }
  return path || '/';
}

function shouldIndexPath(path: string): boolean {
  const normalizedPath = normalizeFrontendPath(path);
  return PUBLIC_INDEXABLE_PATHS.includes(normalizedPath as (typeof PUBLIC_INDEXABLE_PATHS)[number]);
}

function getLegalDocumentKeyForPath(path: string): LegalDocumentKey | null {
  return LEGAL_PATH_TO_DOCUMENT_KEY[normalizeFrontendPath(path)] ?? null;
}

function getLegalDocumentTitle(document: LegalDocument, locale: FrontendLocale): string {
  if (locale === 'en') {
    const englishTitles: Record<LegalDocumentKey, string> = {
      privacy: 'Privacy Policy',
      terms: 'Terms of Service',
      'data-deletion': 'Data Deletion and Access Revocation',
    };
    return englishTitles[document.key];
  }
  return document.ptTitle || document.title;
}

function renderInitialLegalLinks(locale: FrontendLocale): string {
  const links = (locale === 'en'
    ? [
      ['/privacy', 'Privacy Policy'],
      ['/terms', 'Terms of Service'],
      ['/data-deletion', 'User Data Deletion'],
    ] as const
    : [
      ['/privacy', 'Política de Privacidade'],
      ['/terms', 'Termos de Uso'],
      ['/data-deletion', 'Exclusão de Dados'],
    ] as const)
    .map(([href, label]) => `<a href="${href}">${escapeHtml(label)}</a>`)
    .join('\n          ');
  return `<nav aria-label="Legal links">
          ${links}
        </nav>`;
}

function renderLegalDocumentBodyHtml(document: LegalDocument): string {
  return document.sections
    .map((section) => `
        <section>
          <h2>${escapeHtml(section.heading)}</h2>
          ${section.html}
        </section>
      `)
    .join('');
}

function renderLegalDocumentsInlineJson(): string {
  return JSON.stringify(LEGAL_DOCUMENTS)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
}

function buildRobotsTxt(): string {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /auth/',
    'Disallow: /workspace/',
    'Disallow: /media-files/',
    'Disallow: /public-media/',
    `Sitemap: ${buildAbsoluteUrl('/sitemap.xml')}`,
    '',
  ].join('\n');
}

function buildSitemapXml(): string {
  const entries = PUBLIC_INDEXABLE_PATHS
    .map((path) => {
      const priority = path === '/' ? '1.0' : '0.7';
      return [
        '  <url>',
        `    <loc>${escapeXml(buildAbsoluteUrl(path))}</loc>`,
        '    <changefreq>monthly</changefreq>',
        `    <priority>${priority}</priority>`,
        '  </url>',
      ].join('\n');
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entries,
    '</urlset>',
    '',
  ].join('\n');
}

function buildStructuredData(locale: FrontendLocale = DEFAULT_LOCALE): string {
  const seo = getSeoForLocale(locale);
  const json = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: seo.siteName,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: seo.description,
    url: buildAbsoluteUrl('/'),
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'BRL',
    },
    featureList: [
      'Publishing to YouTube, TikTok and Instagram',
      'Operational campaign dashboard',
      'Media and thumbnail library',
      'Scheduling and job tracking',
      'Connected account management',
    ],
  });

  return json.replaceAll('<', '\\u003c');
}

export function normalizeFrontendLocale(rawLocale: string | null | undefined): FrontendLocale {
  const normalized = String(rawLocale ?? '').trim().toLowerCase();
  if (normalized === 'pt-br' || normalized === 'pt') {
    return 'pt-BR';
  }
  if (normalized === 'en' || normalized.startsWith('en-')) {
    return 'en';
  }
  return DEFAULT_LOCALE;
}

function getSeoForLocale(locale: FrontendLocale) {
  const seo = SEO_METADATA[locale] ?? SEO_METADATA[DEFAULT_LOCALE];
  return {
    ...seo,
    title: repairUtf8Mojibake(seo.title),
    description: repairUtf8Mojibake(seo.description),
    keywords: seo.keywords.map(repairUtf8Mojibake),
    initialTitle: repairUtf8Mojibake(seo.initialTitle),
    initialText: repairUtf8Mojibake(seo.initialText),
    initialPublicSectionTitle: repairUtf8Mojibake(seo.initialPublicSectionTitle),
    initialPublicSectionText: repairUtf8Mojibake(seo.initialPublicSectionText),
    initialIndexSectionTitle: repairUtf8Mojibake(seo.initialIndexSectionTitle),
    initialIndexSectionText: repairUtf8Mojibake(seo.initialIndexSectionText),
  };
}

function getSeoForPath(path: string, locale: FrontendLocale) {
  const normalizedPath = normalizeFrontendPath(path);
  const base = getSeoForLocale(locale);
  const legalDocumentKey = getLegalDocumentKeyForPath(normalizedPath);
  if (legalDocumentKey) {
    const document = LEGAL_DOCUMENTS[legalDocumentKey];
    return {
      ...base,
      title: `${getLegalDocumentTitle(document, locale)} | Platform Multi Publisher`,
      description: document.subtitle,
    };
  }
  if (normalizedPath === '/' || normalizedPath === '/login' || normalizedPath === '/onboarding/plan') {
    return {
      ...base,
      title: locale === 'en'
        ? 'Platform Multi Publisher | Login, plans and publishing workspace'
        : 'Platform Multi Publisher | Login, planos e publicacao multi plataforma',
      description: locale === 'en'
        ? 'Main Platform Multi Publisher page with login, plans, terms, privacy, data deletion and publishing workflows for YouTube, TikTok and Instagram.'
        : 'Pagina principal do Platform Multi Publisher com login, planos, termos, privacidade, exclusao de dados e fluxo para publicar videos no YouTube, TikTok e Instagram.',
    };
  }
  return base;
}

function renderInitialLegalContent(path: string, locale: FrontendLocale): string {
  const legalDocumentKey = getLegalDocumentKeyForPath(path);
  if (!legalDocumentKey) return '';
  const document = LEGAL_DOCUMENTS[legalDocumentKey];
  const title = getLegalDocumentTitle(document, locale);
  const bodyHtml = renderLegalDocumentBodyHtml(document);

  return `
      <main class="seo-static-content legal-static-content">
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(document.subtitle)}</p>
        <p>Document last updated: ${escapeHtml(document.lastUpdated)}.</p>
        <p>${escapeHtml(document.reviewNote)}</p>
        <p>Platform Multi Publisher is not owned by, endorsed by, sponsored by, or officially operated by TikTok, YouTube, Google, Instagram, Meta, or their affiliates.</p>
        ${bodyHtml}
      </main>
    `;
}
function renderInitialAppContent(path: string, locale: FrontendLocale): string {
  const seo = getSeoForLocale(locale);
  const normalizedPath = normalizeFrontendPath(path);
  if (normalizedPath === '/privacy' || normalizedPath === '/terms' || normalizedPath === '/data-deletion') {
    return renderInitialLegalContent(normalizedPath, locale);
  }
  if (!shouldIndexPath(path)) {
    return '';
  }
  const publicSectionLabel = locale === 'en' ? 'Main features' : 'Recursos principais';
  const indexSectionLabel = locale === 'en' ? 'SEO base' : 'Base de SEO';
  return `
      <main class="seo-static-content">
        <h1>${escapeHtml(seo.initialTitle)}</h1>
        <p>${escapeHtml(seo.initialText)}</p>
        <section aria-label="${escapeHtml(publicSectionLabel)}">
          <h2>${escapeHtml(seo.initialPublicSectionTitle)}</h2>
          <p>${escapeHtml(seo.initialPublicSectionText)}</p>
        </section>
        <section aria-label="${escapeHtml(indexSectionLabel)}">
          <h2>${escapeHtml(seo.initialIndexSectionTitle)}</h2>
          <p>${escapeHtml(seo.initialIndexSectionText)}</p>
        </section>
        ${renderInitialLegalLinks(locale)}
      </main>
    `;
}

export function isFrontendRoute(path: string): boolean {
  const normalizedPath = normalizeFrontendPath(path);
  return normalizedPath === '/'
    || normalizedPath === '/privacy'
    || normalizedPath === '/terms'
    || normalizedPath === '/data-deletion'
    || normalizedPath === '/login'
    || normalizedPath === '/login/callback'
    || normalizedPath === '/onboarding/plan'
    || normalizedPath.startsWith('/workspace');
}

export function resolveFrontendAsset(path: string): FrontendAsset | null {
  if (path === '/app.js') {
    return {
      contentType: 'application/javascript; charset=utf-8',
      body: APP_JS,
    };
  }

  if (path === '/i18n.js') {
    return {
      contentType: 'application/javascript; charset=utf-8',
      body: readFileSync(I18N_JS_PATH, 'utf-8'),
    };
  }

  if (path === '/app.css') {
    return {
      contentType: 'text/css; charset=utf-8',
      body: APP_CSS,
    };
  }

  const staticAsset = FRONTEND_STATIC_ASSETS.get(path);
  if (staticAsset) {
    return staticAsset;
  }

  if (path === '/robots.txt') {
    return {
      contentType: 'text/plain; charset=utf-8',
      body: buildRobotsTxt(),
    };
  }

  if (path === '/sitemap.xml') {
    return {
      contentType: 'application/xml; charset=utf-8',
      body: buildSitemapXml(),
    };
  }

  if (path === '/tiktok8COodYfNAGHdJBdORbUZUwaC9XDJBjpn.txt') {
    return {
      contentType: 'text/plain; charset=utf-8',
      body: 'tiktok-developers-site-verification=8COodYfNAGHdJBdORbUZUwaC9XDJBjpn',
    };
  }

  if (path === '/tiktokY0qPZzbYMlseg8jR6X6IWUq4Z943nKtq.txt') {
    return {
      contentType: 'text/plain; charset=utf-8',
      body: 'tiktok-developers-site-verification=Y0qPZzbYMlseg8jR6X6IWUq4Z943nKtq',
    };
  }

  if (path === '/terms/tiktokyQY5fafpnYO0QynFIa9YoptEkeAOAm1p.txt') {
    return {
      contentType: 'text/plain; charset=utf-8',
      body: 'tiktok-developers-site-verification=yQY5fafpnYO0QynFIa9YoptEkeAOAm1p',
    };
  }

  if (path === '/privacy/tiktokh4lzAEArircjMLNxYEvA21NjqtOGoEzF.txt') {
    return {
      contentType: 'text/plain; charset=utf-8',
      body: 'tiktok-developers-site-verification=h4lzAEArircjMLNxYEvA21NjqtOGoEzF',
    };
  }

  if (path === '/tiktokNVSgdCAUsAxDS5TEw8yXUi7A1FSf6jKc.txt') {
    return {
      contentType: 'text/plain; charset=utf-8',
      body: 'tiktok-developers-site-verification=NVSgdCAUsAxDS5TEw8yXUi7A1FSf6jKc',
    };
  }

  if (path === '/privacy/tiktokXNH7PCMgnzRsFGVTsZ1YT3rs9gEuFJgv.txt') {
    return {
      contentType: 'text/plain; charset=utf-8',
      body: 'tiktok-developers-site-verification=XNH7PCMgnzRsFGVTsZ1YT3rs9gEuFJgv',
    };
  }

  if (
    path === '/tiktokzsdDYJcFSlyxl0sCmWarxBHG2i9LXTCl.txt' ||
    path === '/terms/tiktokzsdDYJcFSlyxl0sCmWarxBHG2i9LXTCl.txt' ||
    path === '/privacy/tiktokzsdDYJcFSlyxl0sCmWarxBHG2i9LXTCl.txt'
  ) {
    return {
      contentType: 'text/plain; charset=utf-8',
      body: 'tiktok-developers-site-verification=zsdDYJcFSlyxl0sCmWarxBHG2i9LXTCl',
    };
  }

  return null;
}

export function renderFrontendDocument(path: string, locale: FrontendLocale = DEFAULT_LOCALE): string {
  const safeLocale = normalizeFrontendLocale(locale);
  const normalizedPath = normalizeFrontendPath(path);
  const legalDocumentKey = getLegalDocumentKeyForPath(normalizedPath);
  const initialPath = escapeHtml(normalizedPath);
  const canonicalPath = normalizedPath === '/' ? '/' : normalizedPath;
  const canonicalUrl = escapeHtml(buildAbsoluteUrl(canonicalPath));
  const robotsMeta = shouldIndexPath(normalizedPath) ? 'index,follow' : 'noindex,nofollow';
  const seo = getSeoForPath(normalizedPath, safeLocale);
  const tiktokVerification = process.env.TIKTOK_DEVELOPER_VERIFICATION || '';
  const tiktokMetaTag = tiktokVerification
    ? `    <meta name="tiktok-developers-site-verification" content="${escapeHtml(tiktokVerification)}" />\n`
    : '';
  const googleVerification = process.env.GOOGLE_SITE_VERIFICATION || '';
  const googleMetaTag = googleVerification
    ? `    <meta name="google-site-verification" content="${escapeHtml(googleVerification)}" />\n`
    : '';
  const structuredData = buildStructuredData(safeLocale);
  const initialContent = renderInitialAppContent(normalizedPath, safeLocale);
  const needsLegalDocuments = Boolean(legalDocumentKey)
    || normalizedPath === '/'
    || normalizedPath === '/login';
  const legalDocumentsBootstrap = needsLegalDocuments
    ? `    <script>window.__PMP_LEGAL_DOCUMENTS__=${renderLegalDocumentsInlineJson()};</script>\n`
    : '';
  const criticalArtworkPreload = normalizedPath === '/' || normalizedPath === '/login'
    ? '    <link rel="preload" href="/assets/optimized/UNI.webp" as="image" type="image/webp" fetchpriority="high" />\n'
    : '';
  return `<!doctype html>
<html lang="${escapeHtml(safeLocale)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="referrer" content="no-referrer" />
    <title>${escapeHtml(seo.title)}</title>
    <meta name="description" content="${escapeHtml(seo.description)}" />
    <meta name="keywords" content="${escapeHtml(seo.keywords.join(', '))}" />
    <meta name="robots" content="${robotsMeta}" />
    <meta name="application-name" content="${escapeHtml(seo.siteName)}" />
    <meta name="theme-color" content="#0f766e" />
    <link rel="canonical" href="${canonicalUrl}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${escapeHtml(seo.siteName)}" />
    <meta property="og:title" content="${escapeHtml(seo.title)}" />
    <meta property="og:description" content="${escapeHtml(seo.description)}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeHtml(seo.title)}" />
    <meta name="twitter:description" content="${escapeHtml(seo.description)}" />
${googleMetaTag}${tiktokMetaTag}    <script type="application/ld+json">${structuredData}</script>
${criticalArtworkPreload}    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&family=Libre+Baskerville:wght@400;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/app.css?v=${FRONTEND_ASSET_VERSION}" />
  </head>
    <body data-initial-path="${initialPath}" data-initial-locale="${escapeHtml(safeLocale)}">
    <div id="app">${initialContent}</div>
${legalDocumentsBootstrap}    <script src="/i18n.js?v=${FRONTEND_ASSET_VERSION}"></script>
    <script type="module" src="/app.js?v=${FRONTEND_ASSET_VERSION}"></script>
  </body>
</html>`;
}
