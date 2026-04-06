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

const TERMINAL_STATUSES = new Set(['publicado', 'erro']);
const POLLING_INTERVAL_MS = 3000;

export function buildCampaignDetailView(data: CampaignDetailData): CampaignDetailView {
  const targets: CampaignDetailTarget[] = data.targets.map((t) => ({
    ...t,
    youtubeUrl: t.youtubeVideoId
      ? `https://www.youtube.com/watch?v=${t.youtubeVideoId}`
      : undefined,
    retryAvailable:
      t.status === 'erro' &&
      typeof t.retryCount === 'number' &&
      typeof t.maxRetries === 'number' &&
      t.retryCount < t.maxRetries,
  }));

  const allTerminal = targets.length > 0 && targets.every((t) => TERMINAL_STATUSES.has(t.status));
  const completedCount = targets.filter((t) => t.status === 'publicado').length;

  return {
    header: {
      title: data.title,
      status: data.status,
      videoAssetName: data.videoAssetName,
    },
    targets,
    pollingEnabled: data.status === 'launching' && !allTerminal,
    pollingIntervalMs: POLLING_INTERVAL_MS,
    progress: {
      completed: completedCount,
      total: targets.length,
    },
  };
}
