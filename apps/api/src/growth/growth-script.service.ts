import type { AccountsService, ChannelRecord, ConnectedAccountRecord } from '../accounts/accounts.service';
import type { CampaignRecord, CampaignTargetPlatform } from '../campaigns/campaign.service';
import type { ChannelStats, DashboardService, DashboardStats, PlatformStats } from '../campaigns/dashboard.service';

export interface GrowthScriptInput {
  topic?: unknown;
  platform?: unknown;
  duration?: unknown;
  tone?: unknown;
  goal?: unknown;
}

export interface GrowthScriptBrief {
  summary: string;
  relatedTerms: string[];
  commonQuestions: string[];
  risks: string[];
  currentAngles: string[];
}

export interface GrowthScriptSignals {
  bestPlatform: string;
  bestPlatformReason: string;
  failedCampaigns: number;
  failedTargets: number;
  activeChannels: number;
  connectedAccounts: number;
  topContentTitle: string | null;
  topContentViews: number;
  recentCampaignTitles: string[];
}

export interface GrowthScriptTimelineBlock {
  time: string;
  speech: string;
  onScreen: string;
}

export interface GrowthGeneratedScript {
  hooks: string[];
  promise: string;
  timeline: GrowthScriptTimelineBlock[];
  cta: string;
  caption: string;
  hashtags: string[];
  platformAdaptation: string[];
}

export interface GrowthScriptResult {
  generatedAt: string;
  brief: GrowthScriptBrief;
  signals: GrowthScriptSignals;
  script: GrowthGeneratedScript;
}

interface GrowthScriptServiceOptions {
  dashboardService: DashboardService;
  campaignService: {
    listCampaigns(filters?: { limit?: number; offset?: number; ownerEmail?: string }): Promise<{ campaigns: CampaignRecord[] }>;
  };
  accountsService: Pick<AccountsService, 'listAccounts' | 'getChannelsForAccount'>;
  now?: () => Date;
}

interface GrowthWorkspaceSnapshot {
  stats: DashboardStats | null;
  campaigns: CampaignRecord[];
  accounts: ConnectedAccountRecord[];
  channels: ChannelRecord[];
}

const DEFAULT_TOPIC = 'conteudo educativo';
const STOP_WORDS = new Set([
  'a',
  'as',
  'com',
  'como',
  'da',
  'das',
  'de',
  'do',
  'dos',
  'e',
  'em',
  'na',
  'no',
  'o',
  'os',
  'para',
  'por',
  'que',
  'sem',
  'sobre',
  'um',
  'uma',
]);

export class GrowthScriptService {
  constructor(private readonly options: GrowthScriptServiceOptions) {}

  async generate(input: GrowthScriptInput, ownerEmail?: string): Promise<GrowthScriptResult> {
    const normalized = normalizeInput(input);
    const snapshot = await this.loadWorkspaceSnapshot(ownerEmail);
    const signals = buildSignals(snapshot, normalized.platform);
    const brief = buildBrief(normalized, signals);

    return {
      generatedAt: this.options.now?.().toISOString() ?? new Date().toISOString(),
      brief,
      signals,
      script: buildScript(normalized, brief, signals),
    };
  }

  private async loadWorkspaceSnapshot(ownerEmail?: string): Promise<GrowthWorkspaceSnapshot> {
    const [statsResult, campaignsResult, accountsResult] = await Promise.allSettled([
      this.options.dashboardService.getStats(ownerEmail),
      this.options.campaignService.listCampaigns({ limit: 50, offset: 0, ownerEmail }),
      this.options.accountsService.listAccounts(ownerEmail),
    ]);

    const stats = statsResult.status === 'fulfilled' ? statsResult.value : null;
    const campaigns = campaignsResult.status === 'fulfilled' && Array.isArray(campaignsResult.value.campaigns)
      ? campaignsResult.value.campaigns
      : [];
    const accounts = accountsResult.status === 'fulfilled' && Array.isArray(accountsResult.value)
      ? accountsResult.value
      : [];
    const connectedAccounts = accounts.filter((account) => account.status === 'connected');
    const channelResults = await Promise.allSettled(
      connectedAccounts.map((account) => this.options.accountsService.getChannelsForAccount(account.id)),
    );
    const channels = channelResults.flatMap((result) => (
      result.status === 'fulfilled' && Array.isArray(result.value) ? result.value : []
    ));

    return { stats, campaigns, accounts, channels };
  }
}

function normalizeInput(input: GrowthScriptInput): {
  topic: string;
  platform: string;
  duration: string;
  tone: string;
  goal: string;
} {
  return {
    topic: normalizeText(input.topic, DEFAULT_TOPIC, 140),
    platform: normalizeText(input.platform, 'YouTube', 40),
    duration: normalizeText(input.duration, '30 segundos', 40),
    tone: normalizeText(input.tone, 'Direto', 40),
    goal: normalizeText(input.goal, 'Educacao e retencao', 120),
  };
}

function normalizeText(value: unknown, fallback: string, maxLength: number): string {
  const normalized = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  return (normalized || fallback).slice(0, maxLength);
}

function buildSignals(snapshot: GrowthWorkspaceSnapshot, requestedPlatform: string): GrowthScriptSignals {
  const connectedAccounts = snapshot.accounts.filter((account) => account.status === 'connected');
  const failedTargetsFromCampaigns = snapshot.campaigns.reduce((sum, campaign) => (
    sum + campaign.targets.filter((target) => target.status === 'erro').length
  ), 0);
  const failedCampaigns = snapshot.campaigns.filter((campaign) => (
    campaign.status === 'failed' || campaign.targets.some((target) => target.status === 'erro')
  )).length;
  const bestPlatform = pickBestPlatform(snapshot.stats?.platformStats ?? [], requestedPlatform);
  const topContent = pickTopContent(snapshot.stats?.channels ?? []);

  return {
    bestPlatform: platformLabel(bestPlatform.platform),
    bestPlatformReason: bestPlatform.reason,
    failedCampaigns,
    failedTargets: snapshot.stats?.failures.failedTargets ?? failedTargetsFromCampaigns,
    activeChannels: snapshot.channels.filter((channel) => channel.isActive).length,
    connectedAccounts: connectedAccounts.length,
    topContentTitle: topContent?.title ?? null,
    topContentViews: topContent?.views ?? 0,
    recentCampaignTitles: snapshot.campaigns.slice(0, 3).map((campaign) => campaign.title),
  };
}

function pickBestPlatform(stats: PlatformStats[], requestedPlatform: string): { platform: CampaignTargetPlatform; reason: string } {
  const ranked = stats
    .filter((entry) => entry.totalTargets > 0)
    .sort((left, right) => (
      right.successRate - left.successRate
      || right.published - left.published
      || right.totalTargets - left.totalTargets
    ));

  if (ranked[0]) {
    return {
      platform: ranked[0].platform,
      reason: `${Math.round(ranked[0].successRate)}% de sucesso em ${ranked[0].totalTargets} destino${ranked[0].totalTargets === 1 ? '' : 's'} recentes.`,
    };
  }

  return {
    platform: normalizePlatform(requestedPlatform),
    reason: 'Sem historico suficiente; usando a plataforma escolhida no formulario.',
  };
}

function pickTopContent(channels: ChannelStats[]): { title: string; views: number } | null {
  const ranked = channels
    .map((channel) => ({
      title: channel.topVideoTitle || channel.channelLabel || channel.channelId,
      views: Number(channel.topVideoViews || channel.totalViews || 0),
    }))
    .filter((entry) => entry.title)
    .sort((left, right) => right.views - left.views);
  return ranked[0] ?? null;
}

function normalizePlatform(platform: string): CampaignTargetPlatform {
  const normalized = platform.trim().toLowerCase();
  if (normalized.includes('instagram')) return 'instagram';
  if (normalized.includes('tiktok')) return 'tiktok';
  return 'youtube';
}

function platformLabel(platform: CampaignTargetPlatform): string {
  if (platform === 'instagram') return 'Instagram';
  if (platform === 'tiktok') return 'TikTok';
  return 'YouTube';
}

function buildBrief(
  input: ReturnType<typeof normalizeInput>,
  signals: GrowthScriptSignals,
): GrowthScriptBrief {
  const terms = extractTopicTerms(input.topic);
  const primaryTerm = terms[0] ?? input.topic;
  const accountSignal = signals.connectedAccounts > 0
    ? `${signals.connectedAccounts} conta${signals.connectedAccounts === 1 ? '' : 's'} conectada${signals.connectedAccounts === 1 ? '' : 's'}`
    : 'nenhuma conta conectada';
  const channelSignal = signals.activeChannels > 0
    ? `${signals.activeChannels} ${signals.activeChannels === 1 ? 'canal ativo' : 'canais ativos'}`
    : 'sem canais ativos sincronizados';

  return {
    summary: `O tema "${input.topic}" deve ser tratado como promessa operacional: explicar o problema, mostrar um criterio simples e entregar uma acao verificavel para ${signals.bestPlatform}. Contexto do workspace: ${accountSignal}, ${channelSignal}.`,
    relatedTerms: uniqueList([
      primaryTerm,
      ...terms.slice(1, 5),
      'retencao',
      'consistencia',
      'gancho',
      'prova operacional',
      signals.bestPlatform.toLowerCase(),
    ]).slice(0, 8),
    commonQuestions: [
      `Qual erro mais comum impede resultado em ${primaryTerm}?`,
      `Como aplicar ${primaryTerm} sem depender de promessa de engajamento?`,
      `Que sinal simples mostra se o conteudo funcionou?`,
    ],
    risks: buildRisks(input.topic, signals),
    currentAngles: buildAngles(input.topic, signals),
  };
}

function extractTopicTerms(topic: string): string[] {
  return uniqueList(
    topic
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .map((term) => term.trim())
      .filter((term) => term.length > 2 && !STOP_WORDS.has(term)),
  );
}

function buildRisks(topic: string, signals: GrowthScriptSignals): string[] {
  const normalized = topic
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const risks = [
    'Evitar prometer alcance, views ou engajamento garantido.',
    'Separar opiniao, exemplo operacional e fato verificavel.',
  ];

  if (signals.failedTargets > 0) {
    risks.push('Nao recomendar publicar mais antes de revisar campanhas com falha.');
  }

  if (/(saude|medico|financeiro|juridico|legal|investimento|remedio)/i.test(normalized)) {
    risks.push('Tema sensivel: incluir aviso de contexto geral e evitar orientacao profissional conclusiva.');
  }

  return risks;
}

function buildAngles(topic: string, signals: GrowthScriptSignals): string[] {
  const angles = [
    `Transformar "${topic}" em checklist rapido para ${signals.bestPlatform}.`,
    `Abrir com um erro concreto e fechar com uma acao de 10 minutos.`,
    `Comparar antes/depois usando um sinal operacional, nao promessa de viralizacao.`,
  ];

  if (signals.topContentTitle) {
    angles.unshift(`Reaproveitar o aprendizado de "${signals.topContentTitle}" como prova interna.`);
  }

  if (signals.failedCampaigns > 0) {
    angles.unshift(`Usar falhas recentes como gancho de confianca: o que corrigir antes de escalar.`);
  }

  return angles.slice(0, 4);
}

function buildScript(
  input: ReturnType<typeof normalizeInput>,
  brief: GrowthScriptBrief,
  signals: GrowthScriptSignals,
): GrowthGeneratedScript {
  const topic = input.topic;
  const platform = signals.bestPlatform || input.platform;
  const timeBlocks = getTimeBlocks(input.duration);
  const firstTerm = brief.relatedTerms[0] ?? topic;
  const signalLine = signals.topContentTitle
    ? `Use o aprendizado de "${signals.topContentTitle}" como referencia, sem copiar o formato inteiro.`
    : `Use ${signals.bestPlatformReason.toLowerCase()} como criterio para escolher onde testar.`;
  const failureLine = signals.failedTargets > 0
    ? `Antes de escalar, cite que ${signals.failedTargets} destino${signals.failedTargets === 1 ? '' : 's'} com falha precisa${signals.failedTargets === 1 ? '' : 'm'} ser corrigido.`
    : 'Mostre que a rotina esta limpa e que o proximo passo e testar uma melhoria especifica.';

  return {
    hooks: [
      `Se voce fala de ${topic} e ainda publica no escuro, este ajuste muda a decisao antes do post.`,
      `O erro em ${topic} nao e falta de ideia; e falta de sinal para decidir o proximo conteudo.`,
      `Antes de criar outro post sobre ${topic}, confira este checklist de ${platform}.`,
    ],
    promise: `Em ${input.duration}, entregar um criterio simples para transformar ${firstTerm} em conteudo mais consistente, sem prometer engajamento artificial.`,
    timeline: [
      {
        time: timeBlocks[0],
        speech: `Comece direto: "Se voce esta tentando melhorar ${topic}, pare de medir so pela vontade de postar."`,
        onScreen: `Tema: ${topic}`,
      },
      {
        time: timeBlocks[1],
        speech: `Explique o problema em uma frase e conecte ao sinal real: ${signalLine}`,
        onScreen: `Sinal: ${signals.bestPlatform}`,
      },
      {
        time: timeBlocks[2],
        speech: `Entregue o metodo: escolha um gancho, publique em ${platform}, acompanhe retencao/sucesso e repita apenas o que tiver sinal.`,
        onScreen: 'Metodo: gancho > teste > sinal > repeticao',
      },
      {
        time: timeBlocks[3],
        speech: `${failureLine} Feche convidando a pessoa a salvar o checklist.`,
        onScreen: 'Proximo passo: corrigir, testar, repetir',
      },
    ],
    cta: `Salve este roteiro e teste uma versao em ${platform}; depois compare o sinal antes de criar a proxima campanha.`,
    caption: `Roteiro operacional sobre ${topic}: menos chute, mais sinal. Use um criterio simples, teste em ${platform} e repita apenas o que o dado sustentar.`,
    hashtags: buildHashtags(brief.relatedTerms, platform),
    platformAdaptation: buildPlatformAdaptation(platform, input.duration),
  };
}

function getTimeBlocks(duration: string): string[] {
  const normalized = duration.toLowerCase();
  if (normalized.includes('15')) return ['0-2s', '2-6s', '6-11s', '11-15s'];
  if (normalized.includes('60')) return ['0-5s', '5-18s', '18-45s', '45-60s'];
  if (normalized.includes('5')) return ['0:00-0:15', '0:15-1:20', '1:20-4:20', '4:20-5:00'];
  return ['0-3s', '3-9s', '9-20s', '20-30s'];
}

function buildPlatformAdaptation(platform: string, duration: string): string[] {
  const normalized = platform.toLowerCase();
  if (normalized.includes('tiktok')) {
    return [
      'Corte seco no primeiro segundo e legenda grande no topo.',
      'Use exemplo visual rapido antes da explicacao.',
      'Feche com pergunta direta para comentario real.',
    ];
  }
  if (normalized.includes('instagram')) {
    return [
      'Transforme o metodo em carrossel de apoio nos comentarios ou legenda.',
      'Use texto na tela em frases curtas para aumentar salvamentos.',
      'CTA principal: salvar e enviar para alguem que publica conteudo.',
    ];
  }
  return [
    `Se for Shorts, mantenha ${duration}; se for video longo, abra com o mesmo gancho e expanda os exemplos.`,
    'Use titulo com problema + criterio, nao promessa ampla.',
    'Inclua descricao com checklist e links internos de campanha quando existir.',
  ];
}

function buildHashtags(terms: string[], platform: string): string[] {
  const base = terms
    .slice(0, 4)
    .map((term) => `#${term.replace(/[^a-z0-9]/gi, '').toLowerCase()}`)
    .filter((tag) => tag.length > 1);
  return uniqueList([
    ...base,
    '#conteudodigital',
    '#socialmedia',
    '#crescimentoorganico',
    platform.toLowerCase().includes('youtube') ? '#youtube' : '',
    platform.toLowerCase().includes('instagram') ? '#instagram' : '',
    platform.toLowerCase().includes('tiktok') ? '#tiktok' : '',
  ].filter(Boolean)).slice(0, 8);
}

function uniqueList(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}
