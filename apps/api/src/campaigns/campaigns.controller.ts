import type { SessionRequestLike } from '../auth/session.guard';
import { SessionGuard } from '../auth/session.guard';
import type { CampaignRecord, CampaignTargetRecord } from './campaign.service';
import { CampaignService } from './campaign.service';
import type { LaunchService } from './launch.service';
import type { CampaignStatusService } from './campaign-status.service';
import type { PublishJobService, PublishJobRecord } from './publish-job.service';
import type { DashboardService, DashboardStats } from './dashboard.service';

export interface CampaignsRequest extends SessionRequestLike {
  body?: unknown;
  params?: Record<string, string>;
}

interface ControllerResponse<T = unknown> {
  status: number;
  body: T;
}

export class CampaignsController {
  constructor(
    private readonly campaignService: CampaignService,
    private readonly sessionGuard: SessionGuard,
    private readonly launchService?: LaunchService,
    private readonly statusService?: CampaignStatusService,
    private readonly jobService?: PublishJobService,
    private readonly dashboardService?: DashboardService,
  ) {}

  async create(request: CampaignsRequest): Promise<ControllerResponse<{ campaign?: CampaignRecord; error?: string }>> {
    const guardResult = this.sessionGuard.check(request);
    if (!guardResult.allowed) {
      return { status: guardResult.status, body: { error: guardResult.reason } };
    }

    const body = request.body as { title?: string; videoAssetId?: string; scheduledAt?: string } | undefined;
    if (!body?.title || typeof body.title !== 'string' || !body.title.trim()) {
      return { status: 400, body: { error: 'Missing required field: title' } };
    }
    if (!body?.videoAssetId || typeof body.videoAssetId !== 'string') {
      return { status: 400, body: { error: 'Missing required field: videoAssetId' } };
    }

    const result = await this.campaignService.createCampaign({
      title: body.title.trim(),
      videoAssetId: body.videoAssetId,
      scheduledAt: body.scheduledAt,
    });

    return { status: 201, body: result };
  }

  async list(request: SessionRequestLike & { query?: Record<string, string> }): Promise<ControllerResponse<{ campaigns: CampaignRecord[]; total: number; limit: number; offset: number; error?: string }>> {
    const guardResult = this.sessionGuard.check(request);
    if (!guardResult.allowed) {
      return { status: guardResult.status, body: { campaigns: [], total: 0, limit: 20, offset: 0, error: guardResult.reason } };
    }

    const filters: { status?: string; search?: string; limit?: number; offset?: number } = {};
    if (request.query?.status) filters.status = request.query.status;
    if (request.query?.search) filters.search = request.query.search;
    if (request.query?.limit) filters.limit = parseInt(request.query.limit, 10);
    if (request.query?.offset) filters.offset = parseInt(request.query.offset, 10);

    const result = await this.campaignService.listCampaigns(Object.keys(filters).length > 0 ? filters : undefined);
    return { status: 200, body: result };
  }

  async getById(request: CampaignsRequest): Promise<ControllerResponse<{ campaign?: CampaignRecord; error?: string }>> {
    const guardResult = this.sessionGuard.check(request);
    if (!guardResult.allowed) {
      return { status: guardResult.status, body: { error: guardResult.reason } };
    }

    const id = request.params?.id;
    if (!id) {
      return { status: 400, body: { error: 'Missing campaign id' } };
    }

    const result = await this.campaignService.getCampaign(id);
    if (!result) {
      return { status: 404, body: { error: 'Campaign not found' } };
    }

    return { status: 200, body: result };
  }

  async addTarget(request: CampaignsRequest): Promise<ControllerResponse<{ target?: CampaignTargetRecord; error?: string }>> {
    const guardResult = this.sessionGuard.check(request);
    if (!guardResult.allowed) {
      return { status: guardResult.status, body: { error: guardResult.reason } };
    }

    const campaignId = request.params?.id;
    if (!campaignId) {
      return { status: 400, body: { error: 'Missing campaign id' } };
    }

    const body = request.body as {
      channelId?: string;
      videoTitle?: string;
      videoDescription?: string;
      tags?: string[];
      privacy?: string;
      thumbnailAssetId?: string;
    } | undefined;

    if (!body?.channelId || !body?.videoTitle || !body?.videoDescription) {
      return { status: 400, body: { error: 'Missing required fields: channelId, videoTitle, videoDescription' } };
    }

    try {
      const result = await this.campaignService.addTarget(campaignId, {
        channelId: body.channelId,
        videoTitle: body.videoTitle,
        videoDescription: body.videoDescription,
        tags: body.tags,
        privacy: body.privacy,
        thumbnailAssetId: body.thumbnailAssetId,
      });

      return { status: 201, body: result };
    } catch {
      return { status: 404, body: { error: 'Campaign not found' } };
    }
  }

  async launch(request: CampaignsRequest): Promise<ControllerResponse<{ campaign?: CampaignRecord; error?: string }>> {
    const guardResult = this.sessionGuard.check(request);
    if (!guardResult.allowed) {
      return { status: guardResult.status, body: { error: guardResult.reason } };
    }

    const campaignId = request.params?.id;
    if (!campaignId) {
      return { status: 400, body: { error: 'Missing campaign id' } };
    }

    const result = this.launchService
      ? await this.launchService.launchCampaign(campaignId)
      : await this.campaignService.launch(campaignId);

    if ('error' in result) {
      if (result.error === 'NOT_FOUND') {
        return { status: 404, body: { error: 'Campaign not found' } };
      }
      return { status: 400, body: { error: `Cannot launch: campaign is not ready (${result.error})` } };
    }

    return { status: 200, body: result };
  }

  async getStatus(request: CampaignsRequest): Promise<ControllerResponse> {
    const guardResult = this.sessionGuard.check(request);
    if (!guardResult.allowed) {
      return { status: guardResult.status, body: { error: guardResult.reason } };
    }

    const campaignId = request.params?.id;
    if (!campaignId) {
      return { status: 400, body: { error: 'Missing campaign id' } };
    }

    if (!this.statusService) {
      return { status: 501, body: { error: 'Status service not available' } };
    }

    const result = await this.statusService.getStatus(campaignId);
    if (!result) {
      return { status: 404, body: { error: 'Campaign not found' } };
    }

    return { status: 200, body: result };
  }

  async removeTarget(request: CampaignsRequest): Promise<ControllerResponse<{ error?: string }>> {
    const guardResult = this.sessionGuard.check(request);
    if (!guardResult.allowed) {
      return { status: guardResult.status, body: { error: guardResult.reason } };
    }

    const campaignId = request.params?.id;
    const targetId = request.params?.targetId;
    if (!campaignId || !targetId) {
      return { status: 400, body: { error: 'Missing campaign or target id' } };
    }

    const removed = await this.campaignService.removeTarget(campaignId, targetId);
    if (!removed) {
      return { status: 404, body: { error: 'Target not found' } };
    }

    return { status: 200, body: {} };
  }

  async updateTarget(request: CampaignsRequest): Promise<ControllerResponse<{ target?: CampaignTargetRecord; error?: string }>> {
    const guardResult = this.sessionGuard.check(request);
    if (!guardResult.allowed) {
      return { status: guardResult.status, body: { error: guardResult.reason } };
    }

    const campaignId = request.params?.id;
    const targetId = request.params?.targetId;
    if (!campaignId || !targetId) {
      return { status: 400, body: { error: 'Missing campaign or target id' } };
    }

    const body = request.body as {
      videoTitle?: string;
      videoDescription?: string;
      tags?: string[];
      privacy?: string;
      thumbnailAssetId?: string;
    } | undefined;

    const hasUpdates = body && (body.videoTitle !== undefined || body.videoDescription !== undefined ||
      body.tags !== undefined || body.privacy !== undefined || body.thumbnailAssetId !== undefined);
    if (!hasUpdates) {
      return { status: 400, body: { error: 'No updatable fields provided' } };
    }

    const result = await this.campaignService.updateTarget(campaignId, targetId, body!);
    if ('error' in result) {
      return { status: 404, body: { error: 'Target not found' } };
    }

    return { status: 200, body: result };
  }

  async deleteCampaign(request: CampaignsRequest): Promise<ControllerResponse<{ error?: string }>> {
    const guardResult = this.sessionGuard.check(request);
    if (!guardResult.allowed) {
      return { status: guardResult.status, body: { error: guardResult.reason } };
    }

    const campaignId = request.params?.id;
    if (!campaignId) {
      return { status: 400, body: { error: 'Missing campaign id' } };
    }

    const result = await this.campaignService.deleteCampaign(campaignId);
    if ('error' in result) {
      if (result.error === 'NOT_FOUND') {
        return { status: 404, body: { error: 'Campaign not found' } };
      }
      return { status: 400, body: { error: 'Cannot delete an active campaign' } };
    }

    return { status: 200, body: {} };
  }

  async clone(request: CampaignsRequest): Promise<ControllerResponse<{ campaign?: CampaignRecord; error?: string }>> {
    const guardResult = this.sessionGuard.check(request);
    if (!guardResult.allowed) {
      return { status: guardResult.status, body: { error: guardResult.reason } };
    }

    const campaignId = request.params?.id;
    if (!campaignId) {
      return { status: 400, body: { error: 'Missing campaign id' } };
    }

    const body = request.body as { title?: string } | undefined;
    const result = await this.campaignService.cloneCampaign(campaignId, body?.title ? { title: body.title } : undefined);
    if ('error' in result) {
      return { status: 404, body: { error: 'Campaign not found' } };
    }

    return { status: 201, body: result };
  }

  async update(request: CampaignsRequest): Promise<ControllerResponse<{ campaign?: CampaignRecord; error?: string }>> {
    const guardResult = this.sessionGuard.check(request);
    if (!guardResult.allowed) {
      return { status: guardResult.status, body: { error: guardResult.reason } };
    }

    const campaignId = request.params?.id;
    if (!campaignId) {
      return { status: 400, body: { error: 'Missing campaign id' } };
    }

    const body = request.body as { title?: string; scheduledAt?: string } | undefined;
    const result = await this.campaignService.updateCampaign(campaignId, {
      title: body?.title,
      scheduledAt: body?.scheduledAt,
    });

    if ('error' in result) {
      if (result.error === 'NOT_FOUND') {
        return { status: 404, body: { error: 'Campaign not found' } };
      }
      return { status: 400, body: { error: 'Cannot update an active campaign' } };
    }

    return { status: 200, body: result };
  }

  async retryTarget(request: CampaignsRequest): Promise<ControllerResponse<{ job?: PublishJobRecord; error?: string }>> {
    const guardResult = this.sessionGuard.check(request);
    if (!guardResult.allowed) {
      return { status: guardResult.status, body: { error: guardResult.reason } };
    }

    const campaignId = request.params?.id;
    const targetId = request.params?.targetId;
    if (!campaignId || !targetId) {
      return { status: 400, body: { error: 'Missing campaign or target id' } };
    }

    if (!this.jobService) {
      return { status: 501, body: { error: 'Job service not available' } };
    }

    // Verify the target exists in this campaign
    const campaignResult = await this.campaignService.getCampaign(campaignId);
    if (!campaignResult) {
      return { status: 404, body: { error: 'Campaign not found' } };
    }
    const target = campaignResult.campaign.targets.find((t) => t.id === targetId);
    if (!target) {
      return { status: 404, body: { error: 'Target not found' } };
    }

    // Find the latest failed job for this target
    const jobs = await this.jobService.getJobsForTarget(targetId);
    const failedJob = [...jobs].reverse().find((j) => j.status === 'failed');
    if (!failedJob) {
      return { status: 400, body: { error: 'No failed job to retry' } };
    }

    const result = await this.jobService.retry(failedJob.id);
    if ('error' in result) {
      return { status: 400, body: { error: result.error } };
    }

    // Reset target status back to aguardando
    await this.campaignService.updateTargetStatus(campaignId, targetId, 'aguardando', {
      errorMessage: null,
    });

    return { status: 200, body: { job: result } };
  }

  async markReady(request: CampaignsRequest): Promise<ControllerResponse<{ campaign?: CampaignRecord; error?: string }>> {
    const guardResult = this.sessionGuard.check(request);
    if (!guardResult.allowed) {
      return { status: guardResult.status, body: { error: guardResult.reason } };
    }

    const campaignId = request.params?.id;
    if (!campaignId) {
      return { status: 400, body: { error: 'Missing campaign id' } };
    }

    const result = await this.campaignService.markReady(campaignId);
    if ('error' in result) {
      if (result.error === 'NOT_FOUND') {
        return { status: 404, body: { error: 'Campaign not found' } };
      }
      return { status: 400, body: { error: `Cannot mark ready: ${result.error}` } };
    }

    return { status: 200, body: result };
  }

  async getDashboard(request: SessionRequestLike): Promise<ControllerResponse<DashboardStats | { error: string }>> {
    const guardResult = this.sessionGuard.check(request);
    if (!guardResult.allowed) {
      return { status: guardResult.status, body: { error: guardResult.reason } };
    }

    if (!this.dashboardService) {
      return { status: 501, body: { error: 'Dashboard service not available' } };
    }

    return { status: 200, body: await this.dashboardService.getStats() };
  }
}
