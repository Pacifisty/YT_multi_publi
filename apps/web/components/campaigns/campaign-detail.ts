export interface CampaignDetailTarget {
  id: string;
  channelTitle: string;
  videoTitle: string;
  status: 'aguardando' | 'enviando' | 'publicado' | 'erro';
  youtubeVideoId: string | null;
  errorMessage: string | null;
  youtubeUrl?: string;
  retryAvailable?: boolean;
}

export interface CampaignDetailData {
  id: string;
  title: string;
  videoAssetName: string;
  status: string;
  targets: (Omit<CampaignDetailTarget, 'youtubeUrl' | 'retryAvailable'> & {
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

export function buildCampaignDetailView(data: CampaignDetailData): CampaignDetailView {
  const targets: CampaignDetailTarget[] = data.targets.map((t) => {
    const retryCount = typeof t.retryCount === 'number' ? t.retryCount : 0;
    const maxRetries = typeof t.maxRetries === 'number' ? t.maxRetries : DEFAULT_MAX_RETRIES;

    return ({
      ...t,
      errorMessage: t.status === 'erro' ? t.errorMessage : null,
      youtubeUrl: t.status === 'publicado' && t.youtubeVideoId
        ? `https://www.youtube.com/watch?v=${t.youtubeVideoId}`
        : undefined,
      retryAvailable:
        t.status === 'erro' &&
        retryCount < maxRetries,
    });
  });

  const allTerminal = targets.length > 0 && targets.every((t) => isTerminalTarget(t));
  const completedCount = targets.filter((t) => t.status === 'publicado' && t.youtubeVideoId).length;

  return {
    header: {
      title: data.title,
      status: data.status,
      videoAssetName: data.videoAssetName,
    },
    targets,
    pollingEnabled: data.status === 'launching' && targets.length > 0 && !allTerminal,
    pollingIntervalMs: POLLING_INTERVAL_MS,
    progress: {
      completed: completedCount,
      total: targets.length,
    },
  };
}
