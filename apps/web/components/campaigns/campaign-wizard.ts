import type { CampaignTargetData, CampaignsApiClient } from '../../lib/campaigns-client';

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
}

export interface MetadataFieldDef {
  required: boolean;
  options?: string[];
}

export interface WizardChannelMetadataSection {
  channelId: string;
  channelTitle: string;
  thumbnailUrl: string | null;
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
  selectedChannelIds: string[];
  targetTemplate: {
    videoTitle: string;
    videoDescription: string;
    tags?: string[];
    publishAt?: string;
    playlistId?: string;
    privacy?: string;
    thumbnailAssetId?: string;
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

function buildMetadataFields(): Record<string, MetadataFieldDef> {
  return {
    videoTitle: { required: true },
    videoDescription: { required: true },
    tags: { required: false },
    publishAt: { required: false },
    playlistId: { required: false },
    thumbnailAssetId: { required: false },
    privacy: { required: false, options: ['public', 'unlisted', 'private'] },
  };
}

export function buildCampaignWizardView(data: CampaignWizardData): CampaignWizardView {
  const metadataFields = buildMetadataFields();
  const channelMetadataSections = (data.selectedChannelIds ?? [])
    .map((channelId) => data.availableChannels.find((channel) => channel.id === channelId))
    .filter((channel): channel is WizardChannelOption => Boolean(channel))
    .map((channel) => ({
      channelId: channel.id,
      channelTitle: channel.title,
      thumbnailUrl: channel.thumbnailUrl,
      metadataFields,
    }));
  const steps: WizardStep[] = [
    {
      label: 'Select video',
      clickable: true,
      videos: data.availableVideos,
    },
    {
      label: 'Select channels',
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
      confirmationMessage: 'Tem certeza? Isso vai iniciar o upload para o YouTube.',
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

  if (input.selectedChannelIds.length === 0) {
    return {
      ok: true,
      campaign: createResult.campaign,
      targets: [],
    };
  }

  const addTargetsResult = await client.addTargets(
    createResult.campaign.id,
    input.selectedChannelIds.map((channelId) => ({
      channelId,
      ...input.targetTemplate,
    })),
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
