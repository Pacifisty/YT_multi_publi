export interface CampaignDetailTarget {
  id: string;
  channelTitle: string;
  videoTitle: string;
  status: 'aguardando' | 'enviando' | 'publicado' | 'erro';
  publishAt?: string | null;
  youtubeVideoId: string | null;
  errorMessage: string | null;
  reauthRequired?: boolean;
  hasPostUploadWarning?: boolean;
  reviewYoutubeUrl?: string | null;
  youtubeUrl?: string;
  partialFailureYoutubeUrl?: string;
  partialFailureWarning?: string;
  retryAvailable?: boolean;
  scheduledPending?: boolean;
}

export interface CampaignDetailData {
  id: string;
  title: string;
  videoAssetName: string;
  status: string;
  targets: (Omit<CampaignDetailTarget, 'youtubeUrl' | 'partialFailureYoutubeUrl' | 'partialFailureWarning' | 'retryAvailable'> & {
    retryCount?: number;
    maxRetries?: number;
  })[];
  createdAt: string;
}

export interface CampaignDetailView {
  header: {
    title: string;
    status: string;
    videoAssetName: string;
  };
  targets: CampaignDetailTarget[];
  pollingEnabled: boolean;
  pollingIntervalMs: number;
  nextScheduledAt: string | null;
  progress: {
    completed: number;
    total: number;
  };
}

function isTerminalTarget(target: Pick<CampaignDetailTarget, 'status' | 'youtubeVideoId' | 'errorMessage'>): boolean {
  return (target.status === 'erro' && Boolean(target.errorMessage)) || (target.status === 'publicado' && Boolean(target.youtubeVideoId));
}

const POLLING_INTERVAL_MS = 3000;
const DEFAULT_MAX_RETRIES = 3;
const PARTIAL_FAILURE_WARNING = 'Upload completed, but a post-upload step failed. Review the published video before retrying.';

function hasUploadedVideoForPartialFailure(target: Pick<CampaignDetailTarget, 'status' | 'youtubeVideoId' | 'errorMessage'>): boolean {
  return target.status === 'erro' &&
    Boolean(target.youtubeVideoId) &&
    typeof target.errorMessage === 'string' &&
    target.errorMessage.includes(`Video uploaded as ${target.youtubeVideoId}, but `);
}

function isReauthRequiredTarget(target: Pick<CampaignDetailTarget, 'status' | 'errorMessage' | 'reauthRequired'>): boolean {
  return target.reauthRequired === true || (target.status === 'erro' && target.errorMessage === 'REAUTH_REQUIRED');
}

export interface CampaignDetailViewOptions {
  now?: () => Date;
}

export function buildCampaignDetailView(data: CampaignDetailData, options: CampaignDetailViewOptions = {}): CampaignDetailView {
  const nowMs = (options.now ?? (() => new Date()))().getTime();

  const targets: CampaignDetailTarget[] = data.targets.map((t) => {
    const retryCount = typeof t.retryCount === 'number' ? t.retryCount : 0;
    const maxRetries = typeof t.maxRetries === 'number' ? t.maxRetries : DEFAULT_MAX_RETRIES;
    const scheduledPending = typeof t.scheduledPending === 'boolean'
      ? t.scheduledPending
      : t.status === 'aguardando' &&
        typeof t.publishAt === 'string' &&
        new Date(t.publishAt).getTime() > nowMs;
    const partialFailureYoutubeUrl = t.hasPostUploadWarning && t.reviewYoutubeUrl
      ? t.reviewYoutubeUrl
      : hasUploadedVideoForPartialFailure(t)
        ? `https://www.youtube.com/watch?v=${t.youtubeVideoId}`
        : undefined;
    const reauthRequired = isReauthRequiredTarget(t);

    return ({
      ...t,
      errorMessage: t.status === 'erro' ? t.errorMessage : null,
      reauthRequired,
      youtubeUrl: t.status === 'publicado' && t.youtubeVideoId
        ? `https://www.youtube.com/watch?v=${t.youtubeVideoId}`
        : undefined,
      partialFailureYoutubeUrl,
      partialFailureWarning: partialFailureYoutubeUrl ? PARTIAL_FAILURE_WARNING : undefined,
      scheduledPending,
      retryAvailable:
        t.status === 'erro' &&
        !reauthRequired &&
        retryCount < maxRetries,
    });
  });

  const allTerminal = targets.length > 0 && targets.every((t) => isTerminalTarget(t));
  const completedCount = targets.filter((t) => t.status === 'publicado' && t.youtubeVideoId).length;
  const hasActivePendingTargets = targets.some((target) => {
    if (target.scheduledPending) {
      return false;
    }

    return !isTerminalTarget(target);
  });
  const nextScheduledAt = targets
    .filter((target) => target.scheduledPending && typeof target.publishAt === 'string')
    .sort((left, right) => new Date(left.publishAt!).getTime() - new Date(right.publishAt!).getTime())[0]
    ?.publishAt ?? null;

  return {
    header: {
      title: data.title,
      status: data.status,
      videoAssetName: data.videoAssetName,
    },
    targets,
    pollingEnabled: data.status === 'launching' && targets.length > 0 && !allTerminal && hasActivePendingTargets,
    pollingIntervalMs: POLLING_INTERVAL_MS,
    nextScheduledAt,
    progress: {
      completed: completedCount,
      total: targets.length,
    },
  };
}
