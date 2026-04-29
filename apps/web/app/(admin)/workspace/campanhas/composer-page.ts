import {
  buildCampaignWizardView,
  submitCampaignWizardDraft,
  type CampaignWizardDraftSubmissionInput,
  type CampaignWizardView,
  type WizardDestinationPlatform,
} from '../../../../components/campaigns/campaign-wizard';
import type { AuthFetch } from '../../../../lib/auth-client';
import { campaignsApiClient, type CampaignTargetData } from '../../../../lib/campaigns-client';

interface ComposerMediaAsset {
  id: string;
  asset_type?: 'video' | 'thumbnail';
  original_name: string;
  duration_seconds: number;
}

interface ComposerAccount {
  id: string;
  provider?: string;
  email?: string;
  displayName?: string;
  status?: string;
}

interface ComposerChannel {
  id: string;
  title: string;
  thumbnailUrl?: string | null;
  isActive: boolean;
  platform?: WizardDestinationPlatform;
  destinationId?: string;
  destinationLabel?: string | null;
  connectedAccountId?: string | null;
}

export interface CampaignComposerPageView {
  wizard: CampaignWizardView;
  summary: {
    availableVideoCount: number;
    availableChannelCount: number;
    activeChannelCount: number;
    availableDestinationCount: number;
    activeDestinationCount: number;
  };
  actions: {
    cancelHref: '/workspace/campanhas';
    saveDraftLabel: 'Save draft';
  };
  emptyState?: {
    heading: string;
    body: string;
    cta: string;
    ctaHref: string;
  };
}

export interface CampaignComposerPageLoadResult {
  page?: CampaignComposerPageView;
  error?: string;
}

export type CampaignComposerDraftSubmitResult =
  | {
    ok: true;
    campaign: { id: string } & Record<string, unknown>;
    targets: CampaignTargetData[];
    redirectHref: string;
  }
  | {
    ok: false;
    error: string;
    stage: 'create_campaign' | 'add_targets';
  };

async function loadJson(
  fetcher: AuthFetch,
  url: string,
): Promise<{ ok: true; body: any } | { ok: false; error: string }> {
  try {
    const response = await fetcher(url, {
      method: 'GET',
      credentials: 'include',
    });
    const body = await response.json();
    if (response.status >= 400) {
      return { ok: false, error: body.error ?? 'Request failed' };
    }
    return { ok: true, body };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Request failed',
    };
  }
}

export async function buildCampaignComposerPage(options?: {
  fetcher?: AuthFetch;
}): Promise<CampaignComposerPageLoadResult> {
  const fetcher = options?.fetcher ?? globalThis.fetch as AuthFetch;
  const [mediaResult, accountsResult] = await Promise.all([
    loadJson(fetcher, '/api/media'),
    loadJson(fetcher, '/api/accounts'),
  ]);

  if (!mediaResult.ok) {
    return { error: mediaResult.error };
  }

  if (!accountsResult.ok) {
    return { error: accountsResult.error };
  }

  const accounts = Array.isArray(accountsResult.body.accounts)
    ? accountsResult.body.accounts as ComposerAccount[]
    : [];

  const channelAccounts = accounts.filter((account) => {
    const provider = normalizeProvider(account.provider) ?? 'google';
    return provider === 'youtube' || provider === 'google';
  });
  const channelResults = await Promise.all(
    channelAccounts.map(async (account) => ({
      account,
      result: await loadJson(fetcher, `/api/accounts/${account.id}/channels`),
    })),
  );

  const failedChannelResult = channelResults.find((entry) => !entry.result.ok);
  if (failedChannelResult && !failedChannelResult.result.ok) {
    return { error: failedChannelResult.result.error };
  }

  const availableVideos = (Array.isArray(mediaResult.body.assets) ? mediaResult.body.assets : [])
    .filter((asset: ComposerMediaAsset) => asset.asset_type === undefined || asset.asset_type === 'video')
    .map((asset: ComposerMediaAsset) => ({
      id: asset.id,
      original_name: asset.original_name,
      duration_seconds: asset.duration_seconds,
    }));

  const availableChannels = channelResults
    .flatMap((entry) => entry.result.ok && Array.isArray(entry.result.body.channels) ? entry.result.body.channels as ComposerChannel[] : [])
    .map((channel) => ({
      id: channel.id,
      title: channel.title,
      thumbnailUrl: channel.thumbnailUrl ?? null,
      isActive: channel.isActive,
      platform: 'youtube' as const,
      destinationId: channel.id,
      destinationLabel: channel.title,
    }));

  const platformDestinations = accounts
    .map(buildPlatformDestinationFromAccount)
    .filter((destination): destination is NonNullable<ReturnType<typeof buildPlatformDestinationFromAccount>> => Boolean(destination));
  const availableDestinations = [...availableChannels, ...platformDestinations];
  const activeChannelCount = availableDestinations.filter((channel) => channel.isActive).length;
  const page: CampaignComposerPageView = {
    wizard: buildCampaignWizardView({
      availableVideos,
      availableChannels: availableDestinations,
    }),
    summary: {
      availableVideoCount: availableVideos.length,
      availableChannelCount: availableDestinations.length,
      activeChannelCount,
      availableDestinationCount: availableDestinations.length,
      activeDestinationCount: activeChannelCount,
    },
    actions: {
      cancelHref: '/workspace/campanhas',
      saveDraftLabel: 'Save draft',
    },
  };

  if (availableVideos.length === 0) {
    page.emptyState = {
      heading: 'No videos available',
      body: 'Upload a video in Media before creating a campaign.',
      cta: 'Open media library',
      ctaHref: '/workspace/media',
    };
  } else if (activeChannelCount === 0) {
    page.emptyState = {
      heading: 'No active destinations available',
      body: 'Connect or activate at least one YouTube, TikTok, or Instagram destination before creating a campaign.',
      cta: 'Manage accounts',
      ctaHref: '/workspace/accounts',
    };
  }

  return { page };
}

function normalizeProvider(provider?: string): WizardDestinationPlatform | 'google' | null {
  const normalized = (provider ?? '').trim().toLowerCase();
  if (normalized === 'youtube' || normalized === 'tiktok' || normalized === 'instagram' || normalized === 'google') {
    return normalized;
  }

  return null;
}

function getPlatformLabel(platform: WizardDestinationPlatform): string {
  if (platform === 'tiktok') return 'TikTok';
  if (platform === 'instagram') return 'Instagram';
  return 'YouTube';
}

function buildPlatformDestinationFromAccount(account: ComposerAccount): ComposerChannel | null {
  const platform = normalizeProvider(account.provider);
  if (platform !== 'tiktok' && platform !== 'instagram') {
    return null;
  }

  const displayName = account.displayName?.trim() || account.email?.trim() || `${getPlatformLabel(platform)} account`;
  return {
    id: account.id,
    title: displayName,
    thumbnailUrl: null,
    isActive: account.status !== 'reauth_required' && account.status !== 'disconnected',
    platform,
    destinationId: account.id,
    destinationLabel: displayName,
    connectedAccountId: account.id,
  };
}

export async function submitCampaignComposerDraft(options: {
  draft: CampaignWizardDraftSubmissionInput;
  fetcher?: AuthFetch;
}): Promise<CampaignComposerDraftSubmitResult> {
  const client = campaignsApiClient(options.fetcher ?? globalThis.fetch as AuthFetch);
  const result = await submitCampaignWizardDraft(client, options.draft);

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    campaign: result.campaign,
    targets: result.targets,
    redirectHref: `/workspace/campanhas/${result.campaign.id}`,
  };
}
