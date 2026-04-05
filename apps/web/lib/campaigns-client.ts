import type { AuthFetch } from './auth-client';

export interface CampaignsApiClient {
  listCampaigns(): Promise<{ ok: true; campaigns: any[] } | { ok: false; error: string }>;
  createCampaign(data: { title: string; videoAssetId: string; scheduledAt?: string }): Promise<{ ok: true; campaign: any } | { ok: false; error: string }>;
  getCampaign(id: string): Promise<{ ok: true; campaign: any } | { ok: false; error: string }>;
  launchCampaign(id: string): Promise<{ ok: true } | { ok: false; error: string }>;
  deleteCampaign(id: string): Promise<{ ok: true } | { ok: false; error: string }>;
  getDashboard(): Promise<{ ok: true; data: any } | { ok: false; error: string }>;
  retryTarget(campaignId: string, targetId: string): Promise<{ ok: true } | { ok: false; error: string }>;
  getStatus(id: string): Promise<{ ok: true; data: any } | { ok: false; error: string }>;
}

async function request(
  fetcher: AuthFetch,
  method: string,
  url: string,
  body?: unknown,
): Promise<{ ok: true; body: any } | { ok: false; error: string }> {
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
}

export function campaignsApiClient(fetcher: AuthFetch): CampaignsApiClient {
  return {
    async listCampaigns() {
      const res = await request(fetcher, 'GET', '/api/campaigns');
      if (!res.ok) return res;
      return { ok: true, campaigns: res.body.campaigns };
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

    async launchCampaign(id) {
      const res = await request(fetcher, 'POST', `/api/campaigns/${id}/launch`);
      if (!res.ok) return res;
      return { ok: true };
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
      return { ok: true };
    },

    async getStatus(id) {
      const res = await request(fetcher, 'GET', `/api/campaigns/${id}/status`);
      if (!res.ok) return res;
      return { ok: true, data: res.body };
    },
  };
}
