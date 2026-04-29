import type { CampaignTargetData, CampaignsApiClient } from '../../lib/campaigns-client';

export type WizardDestinationPlatform = 'youtube' | 'tiktok' | 'instagram';

export interface WizardVideoOption {
  id: string;
  original_name: string;
  duration_seconds: number;
}

export interface WizardChannelOption {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  isActive: boolean;
  platform?: WizardDestinationPlatform;
  destinationId?: string;
  destinationLabel?: string | null;
  connectedAccountId?: string | null;
}

export interface MetadataFieldDef {
  required: boolean;
  options?: string[];
}

export interface WizardChannelMetadataSection {
  channelId: string;
  channelTitle: string;
  thumbnailUrl: string | null;
  platform: WizardDestinationPlatform;
  metadataFields: Record<string, MetadataFieldDef>;
}

export interface CampaignWizardReviewSummary {
  selectedVideoName: string;
  selectedChannelTitles: string[];
  videoTitle: string;
  videoDescription: string;
  tags: string[];
  publishAt: string | null;
  playlistId: string | null;
  privacy: string;
  thumbnailAssetName: string | null;
}

export interface CampaignWizardChecklistItem {
  label: string;
  value: string;
}

export interface WizardStep {
  label: string;
  clickable: boolean;
  videos?: WizardVideoOption[];
  channels?: WizardChannelOption[];
  metadataFields?: Record<string, MetadataFieldDef>;
  channelMetadataSections?: WizardChannelMetadataSection[];
  confirmationMessage?: string;
  reviewSummary?: CampaignWizardReviewSummary;
  preflightChecklist?: CampaignWizardChecklistItem[];
}

export interface CampaignWizardData {
  availableVideos: WizardVideoOption[];
  availableChannels: WizardChannelOption[];
  selectedChannelIds?: string[];
  review?: CampaignWizardReviewSummary;
}

export interface CampaignWizardView {
  steps: WizardStep[];
  currentStep: number;
  autoSaveDraftStatus: 'draft';
}

export interface CampaignWizardDraftSubmissionInput {
  title: string;
  videoAssetId: string;
  scheduledAt?: string;
  selectedChannelIds?: string[];
  selectedDestinations?: Array<{
    id: string;
    platform?: WizardDestinationPlatform;
    destinationId?: string;
    destinationLabel?: string | null;
    connectedAccountId?: string | null;
  }>;
  targetTemplate: {
    videoTitle: string;
    videoDescription: string;
    tags?: string[];
    publishAt?: string;
    playlistId?: string;
    privacy?: string;
    thumbnailAssetId?: string;
    instagramCaption?: string;
    instagramShareToFeed?: boolean;
  };
}

export type CampaignWizardDraftSubmissionResult =
  | {
    ok: true;
    campaign: { id: string } & Record<string, unknown>;
    targets: CampaignTargetData[];
  }
  | {
    ok: false;
    error: string;
    stage: 'create_campaign' | 'add_targets';
  };

function buildPreflightChecklist(review: CampaignWizardReviewSummary | undefined): CampaignWizardChecklistItem[] | undefined {
  if (!review) {
    return undefined;
  }

  return [
    { label: 'Video selected', value: review.selectedVideoName },
    {
      label: 'Channels selected',
      value: `${review.selectedChannelTitles.length} ${review.selectedChannelTitles.length === 1 ? 'channel' : 'channels'}`,
    },
    {
      label: 'Target channels',
      value: review.selectedChannelTitles.length > 0
        ? review.selectedChannelTitles.join(', ')
        : 'Not configured',
    },
    { label: 'Tags', value: review.tags.length > 0 ? review.tags.join(', ') : 'Not configured' },
    { label: 'Publish time', value: review.publishAt ?? 'Immediately' },
    { label: 'Playlist', value: review.playlistId ?? 'Not configured' },
    { label: 'Thumbnail', value: review.thumbnailAssetName ?? 'Not configured' },
    { label: 'Privacy', value: review.privacy },
  ];
}

function buildMetadataFields(platform: WizardDestinationPlatform = 'youtube'): Record<string, MetadataFieldDef> {
  const fields: Record<string, MetadataFieldDef> = {
    videoTitle: { required: true },
    videoDescription: { required: true },
    tags: { required: false },
    publishAt: { required: false },
    playlistId: { required: false },
    thumbnailAssetId: { required: false },
    privacy: { required: false, options: ['public', 'unlisted', 'private'] },
  };

  if (platform === 'instagram') {
    fields.instagramCaption = { required: false };
    fields.instagramShareToFeed = { required: false, options: ['true', 'false'] };
  }

  return fields;
}

function mergeMetadataFieldsForDestinations(destinations: WizardChannelOption[]): Record<string, MetadataFieldDef> {
  return destinations.reduce<Record<string, MetadataFieldDef>>(
    (fields, destination) => ({
      ...fields,
      ...buildMetadataFields(destination.platform ?? 'youtube'),
    }),
    buildMetadataFields(),
  );
}

export function buildCampaignWizardView(data: CampaignWizardData): CampaignWizardView {
  const selectedDestinationIds = data.selectedChannelIds ?? [];
  const selectedDestinations = selectedDestinationIds
    .map((channelId) => data.availableChannels.find((channel) => channel.id === channelId))
    .filter((channel): channel is WizardChannelOption => Boolean(channel));
  const metadataFields = mergeMetadataFieldsForDestinations(selectedDestinations);
  const channelMetadataSections = selectedDestinations
    .map((channel) => ({
      channelId: channel.id,
      channelTitle: channel.title,
      thumbnailUrl: channel.thumbnailUrl,
      platform: channel.platform ?? 'youtube',
      metadataFields: buildMetadataFields(channel.platform ?? 'youtube'),
    }));
  const steps: WizardStep[] = [
    {
      label: 'Select video',
      clickable: true,
      videos: data.availableVideos,
    },
    {
      label: 'Select destinations',
      clickable: true,
      channels: data.availableChannels.filter((ch) => ch.isActive),
    },
    {
      label: 'Metadata',
      clickable: true,
      metadataFields,
      channelMetadataSections,
    },
    {
      label: 'Review & launch',
      clickable: true,
      confirmationMessage: 'Tem certeza? Isso vai iniciar a publicacao nas plataformas selecionadas.',
      reviewSummary: data.review,
      preflightChecklist: buildPreflightChecklist(data.review),
    },
  ];

  return {
    steps,
    currentStep: 0,
    autoSaveDraftStatus: 'draft',
  };
}

export async function submitCampaignWizardDraft(
  client: Pick<CampaignsApiClient, 'createCampaign' | 'addTargets'>,
  input: CampaignWizardDraftSubmissionInput,
): Promise<CampaignWizardDraftSubmissionResult> {
  const createResult = await client.createCampaign({
    title: input.title,
    videoAssetId: input.videoAssetId,
    scheduledAt: input.scheduledAt,
  });

  if (!createResult.ok) {
    return {
      ok: false,
      error: createResult.error,
      stage: 'create_campaign',
    };
  }

  const selectedTargets = buildDraftTargetPayloads(input);
  if (selectedTargets.length === 0) {
    return {
      ok: true,
      campaign: createResult.campaign,
      targets: [],
    };
  }

  const addTargetsResult = await client.addTargets(
    createResult.campaign.id,
    selectedTargets,
  );

  if (!addTargetsResult.ok) {
    return {
      ok: false,
      error: addTargetsResult.error,
      stage: 'add_targets',
    };
  }

  return {
    ok: true,
    campaign: createResult.campaign,
    targets: addTargetsResult.targets,
  };
}

function buildDraftTargetPayloads(
  input: CampaignWizardDraftSubmissionInput,
): Parameters<CampaignsApiClient['addTargets']>[1] {
  if (input.selectedDestinations && input.selectedDestinations.length > 0) {
    const { instagramCaption, instagramShareToFeed, ...sharedTemplate } = input.targetTemplate;

    return input.selectedDestinations.map((destination) => {
      const platform = destination.platform ?? 'youtube';
      const destinationId = destination.destinationId ?? destination.id;
      const baseTarget = {
        ...sharedTemplate,
        platform,
        destinationId,
        destinationLabel: destination.destinationLabel ?? undefined,
        connectedAccountId: destination.connectedAccountId ?? undefined,
      };

      if (platform === 'youtube') {
        return {
          ...sharedTemplate,
          channelId: destinationId,
        };
      }

      if (platform === 'instagram') {
        return {
          ...baseTarget,
          instagramCaption: instagramCaption ?? input.targetTemplate.videoDescription,
          instagramShareToFeed: instagramShareToFeed ?? true,
        };
      }

      return baseTarget;
    });
  }

  return (input.selectedChannelIds ?? []).map((channelId) => ({
    channelId,
    ...input.targetTemplate,
  }));
}
