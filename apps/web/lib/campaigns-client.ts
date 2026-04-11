import type { AuthFetch } from './auth-client';

export interface CampaignStatusTarget {
  targetId: string;
  channelId: string;
  videoTitle: string;
  status: string;
  publishAt: string | null;
  scheduledPending: boolean;
  youtubeVideoId: string | null;
  errorMessage: string | null;
  latestJobStatus: string | null;
  reauthRequired: boolean;
  hasPostUploadWarning: boolean;
  reviewYoutubeUrl: string | null;
}

export interface CampaignStatusData {
  campaignId: string;
  campaignStatus: string;
  targets: CampaignStatusTarget[];
  shouldPoll: boolean;
  nextScheduledAt: string | null;
  progress: {
    completed: number;
    failed: number;
    total: number;
  };
}

export interface CampaignTargetJob {
  id: string;
  campaignTargetId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  attempt: number;
  progressPercent: number;
  youtubeVideoId: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export type CampaignAuditEventType =
  | 'launch_campaign'
  | 'retry_target'
  | 'mark_ready'
  | 'clone_campaign'
  | 'delete_campaign'
  | 'update_campaign'
  | 'remove_target'
  | 'update_target'
  | 'add_target'
  | 'add_targets_bulk'
  | 'publish_completed'
  | 'publish_failed'
  | 'publish_partial_failure';

export interface CampaignAuditEvent {
  id: string;
  eventType: CampaignAuditEventType;
  actorEmail: string;
  campaignId: string;
  targetId: string | null;
  createdAt: string;
}

export interface CampaignTargetData {
  id: string;
  campaignId: string;
  channelId: string;
  videoTitle: string;
  videoDescription: string;
  tags: string[];
  publishAt: string | null;
  playlistId: string | null;
  privacy: string;
  thumbnailAssetId: string | null;
  status: 'aguardando' | 'enviando' | 'publicado' | 'erro';
  youtubeVideoId: string | null;
  errorMessage: string | null;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignsApiClient {
  listCampaigns(filters?: {
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ ok: true; campaigns: any[]; total: number; limit: number; offset: number } | { ok: false; error: string }>;
  createCampaign(data: { title: string; videoAssetId: string; scheduledAt?: string }): Promise<{ ok: true; campaign: any } | { ok: false; error: string }>;
  getCampaign(id: string): Promise<{ ok: true; campaign: any } | { ok: false; error: string }>;
  updateCampaign(id: string, data: { title?: string; scheduledAt?: string }): Promise<{ ok: true; campaign: any } | { ok: false; error: string }>;
  addTarget(campaignId: string, data: {
    channelId: string;
    videoTitle: string;
    videoDescription: string;
    tags?: string[];
    publishAt?: string;
    playlistId?: string;
    privacy?: string;
    thumbnailAssetId?: string;
  }): Promise<{ ok: true; target: CampaignTargetData } | { ok: false; error: string }>;
  addTargets(campaignId: string, targets: Array<{
    channelId: string;
    videoTitle: string;
    videoDescription: string;
    tags?: string[];
    publishAt?: string;
    playlistId?: string;
    privacy?: string;
    thumbnailAssetId?: string;
  }>): Promise<{ ok: true; targets: CampaignTargetData[] } | { ok: false; error: string }>;
  updateTarget(campaignId: string, targetId: string, data: {
    videoTitle?: string;
    videoDescription?: string;
    tags?: string[];
    publishAt?: string;
    playlistId?: string;
    privacy?: string;
    thumbnailAssetId?: string;
  }): Promise<{ ok: true; target: CampaignTargetData } | { ok: false; error: string }>;
  removeTarget(campaignId: string, targetId: string): Promise<{ ok: true } | { ok: false; error: string }>;
  cloneCampaign(id: string, data?: { title?: string }): Promise<{ ok: true; campaign: any } | { ok: false; error: string }>;
  markReadyCampaign(id: string): Promise<{ ok: true; campaign: any } | { ok: false; error: string }>;
  launchCampaign(id: string): Promise<{ ok: true; campaign: any } | { ok: false; error: string }>;
  deleteCampaign(id: string): Promise<{ ok: true } | { ok: false; error: string }>;
  getDashboard(): Promise<{ ok: true; data: any } | { ok: false; error: string }>;
  retryTarget(campaignId: string, targetId: string): Promise<{ ok: true; job: CampaignTargetJob } | { ok: false; error: string }>;
  getStatus(id: string): Promise<{ ok: true; data: CampaignStatusData } | { ok: false; error: string }>;
  getCampaignJobs(campaignId: string): Promise<{ ok: true; jobsByTarget: Record<string, CampaignTargetJob[]> } | { ok: false; error: string }>;
  getCampaignAudit(campaignId: string): Promise<{ ok: true; events: CampaignAuditEvent[] } | { ok: false; error: string }>;
  getTargetJobs(campaignId: string, targetId: string): Promise<{ ok: true; jobs: CampaignTargetJob[] } | { ok: false; error: string }>;
}

async function request(
  fetcher: AuthFetch,
  method: string,
  url: string,
  body?: unknown,
): Promise<{ ok: true; body: any } | { ok: false; error: string }> {
  try {
    const init: any = { method, credentials: 'include' as const };
    if (body !== undefined) {
      init.headers = { 'content-type': 'application/json' };
      init.body = JSON.stringify(body);
    }
    const response = await fetcher(url, init);
    const json = (await response.json()) as any;
    if (response.status >= 400) {
      return { ok: false, error: json.error ?? 'Request failed' };
    }
    return { ok: true, body: json };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Request failed',
    };
  }
}

export function campaignsApiClient(fetcher: AuthFetch): CampaignsApiClient {
  return {
    async listCampaigns(filters) {
      const params = new URLSearchParams();
      if (filters?.status !== undefined) params.set('status', filters.status);
      if (filters?.search !== undefined) params.set('search', filters.search);
      if (filters?.limit !== undefined) params.set('limit', String(filters.limit));
      if (filters?.offset !== undefined) params.set('offset', String(filters.offset));
      const query = params.toString();
      const url = query ? `/api/campaigns?${query}` : '/api/campaigns';

      const res = await request(fetcher, 'GET', url);
      if (!res.ok) return res;
      return {
        ok: true,
        campaigns: res.body.campaigns,
        total: res.body.total,
        limit: res.body.limit,
        offset: res.body.offset,
      };
    },

    async createCampaign(data) {
      const res = await request(fetcher, 'POST', '/api/campaigns', data);
      if (!res.ok) return res;
      return { ok: true, campaign: res.body.campaign };
    },

    async getCampaign(id) {
      const res = await request(fetcher, 'GET', `/api/campaigns/${id}`);
      if (!res.ok) return res;
      return { ok: true, campaign: res.body.campaign };
    },

    async updateCampaign(id, data) {
      const res = await request(fetcher, 'PATCH', `/api/campaigns/${id}`, data);
      if (!res.ok) return res;
      return { ok: true, campaign: res.body.campaign };
    },

    async addTarget(campaignId, data) {
      const res = await request(fetcher, 'POST', `/api/campaigns/${campaignId}/targets`, data);
      if (!res.ok) return res;
      return { ok: true, target: res.body.target as CampaignTargetData };
    },

    async addTargets(campaignId, targets) {
      const res = await request(fetcher, 'POST', `/api/campaigns/${campaignId}/targets/bulk`, { targets });
      if (!res.ok) return res;
      return { ok: true, targets: res.body.targets as CampaignTargetData[] };
    },

    async updateTarget(campaignId, targetId, data) {
      const res = await request(fetcher, 'PATCH', `/api/campaigns/${campaignId}/targets/${targetId}`, data);
      if (!res.ok) return res;
      return { ok: true, target: res.body.target as CampaignTargetData };
    },

    async removeTarget(campaignId, targetId) {
      const res = await request(fetcher, 'DELETE', `/api/campaigns/${campaignId}/targets/${targetId}`);
      if (!res.ok) return res;
      return { ok: true };
    },

    async cloneCampaign(id, data) {
      const res = await request(fetcher, 'POST', `/api/campaigns/${id}/clone`, data);
      if (!res.ok) return res;
      return { ok: true, campaign: res.body.campaign };
    },

    async markReadyCampaign(id) {
      const res = await request(fetcher, 'POST', `/api/campaigns/${id}/ready`);
      if (!res.ok) return res;
      return { ok: true, campaign: res.body.campaign };
    },

    async launchCampaign(id) {
      const res = await request(fetcher, 'POST', `/api/campaigns/${id}/launch`);
      if (!res.ok) return res;
      return { ok: true, campaign: res.body.campaign };
    },

    async deleteCampaign(id) {
      const res = await request(fetcher, 'DELETE', `/api/campaigns/${id}`);
      if (!res.ok) return res;
      return { ok: true };
    },

    async getDashboard() {
      const res = await request(fetcher, 'GET', '/api/dashboard');
      if (!res.ok) return res;
      return { ok: true, data: res.body };
    },

    async retryTarget(campaignId, targetId) {
      const res = await request(fetcher, 'POST', `/api/campaigns/${campaignId}/targets/${targetId}/retry`);
      if (!res.ok) return res;
      return { ok: true, job: res.body.job as CampaignTargetJob };
    },

    async getStatus(id) {
      const res = await request(fetcher, 'GET', `/api/campaigns/${id}/status`);
      if (!res.ok) return res;
      return { ok: true, data: res.body as CampaignStatusData };
    },

    async getCampaignJobs(campaignId) {
      const res = await request(fetcher, 'GET', `/api/campaigns/${campaignId}/jobs`);
      if (!res.ok) return res;
      return { ok: true, jobsByTarget: res.body.jobsByTarget as Record<string, CampaignTargetJob[]> };
    },

    async getCampaignAudit(campaignId) {
      const res = await request(fetcher, 'GET', `/api/campaigns/${campaignId}/audit`);
      if (!res.ok) return res;
      return { ok: true, events: res.body.events as CampaignAuditEvent[] };
    },

    async getTargetJobs(campaignId, targetId) {
      const res = await request(fetcher, 'GET', `/api/campaigns/${campaignId}/targets/${targetId}/jobs`);
      if (!res.ok) return res;
      return { ok: true, jobs: res.body.jobs as CampaignTargetJob[] };
    },
  };
}
