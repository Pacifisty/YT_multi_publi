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

function parseQueryInteger(rawValue: string | undefined, options?: { allowNegative?: boolean }): number | undefined {
  if (rawValue === undefined) {
    return undefined;
  }

  const normalized = rawValue.trim();
  const pattern = options?.allowNegative ? /^-?\d+$/ : /^\d+$/;

  if (!pattern.test(normalized)) {
    return undefined;
  }

  return Number(normalized);
}

const VALID_TARGET_PRIVACY_VALUES = new Set(['public', 'unlisted', 'private']);

function normalizeNonEmptyString(rawValue: unknown): string | undefined {
  if (typeof rawValue !== 'string') {
    return undefined;
  }

  const normalized = rawValue.trim();
  return normalized ? normalized : undefined;
}

function normalizePrivacyValue(rawValue: unknown): string | undefined {
  const normalized = normalizeNonEmptyString(rawValue)?.toLowerCase();
  if (!normalized) {
    return undefined;
  }

  return VALID_TARGET_PRIVACY_VALUES.has(normalized) ? normalized : undefined;
}

function normalizeTags(rawValue: unknown): string[] | undefined | null {
  if (rawValue === undefined) {
    return undefined;
  }

  if (!Array.isArray(rawValue)) {
    return null;
  }

  const normalizedTags: string[] = [];
  for (const entry of rawValue) {
    if (typeof entry !== 'string') {
      return null;
    }

    const normalized = entry.trim();
    if (normalized) {
      normalizedTags.push(normalized);
    }
  }

  return normalizedTags;
}

function normalizeScheduledAt(rawValue: unknown): string | undefined | null {
  if (rawValue === undefined) {
    return undefined;
  }

  if (typeof rawValue !== 'string') {
    return null;
  }

  const normalized = rawValue.trim();
  if (!normalized) {
    return null;
  }

  return Number.isNaN(Date.parse(normalized)) ? null : normalized;
}

function canMutateTargets(status: CampaignRecord['status']): boolean {
  return status === 'draft' || status === 'ready';
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
    const title = normalizeNonEmptyString(body?.title);
    if (!title) {
      return { status: 400, body: { error: 'Missing required field: title' } };
    }

    const videoAssetId = normalizeNonEmptyString(body?.videoAssetId);
    if (!videoAssetId) {
      return { status: 400, body: { error: 'Missing required field: videoAssetId' } };
    }

    const scheduledAt = normalizeScheduledAt(body?.scheduledAt);
    if (body?.scheduledAt !== undefined && !scheduledAt) {
      return { status: 400, body: { error: 'Invalid scheduledAt: use a valid date-time string' } };
    }

    const result = await this.campaignService.createCampaign({
      title,
      videoAssetId,
      scheduledAt: scheduledAt ?? undefined,
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

    const parsedLimit = parseQueryInteger(request.query?.limit);
    if (parsedLimit !== undefined) {
      filters.limit = parsedLimit;
    }

    const parsedOffset = parseQueryInteger(request.query?.offset, { allowNegative: true });
    if (parsedOffset !== undefined) {
      filters.offset = parsedOffset;
    }

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

    const campaignResult = await this.campaignService.getCampaign(campaignId);
    if (!campaignResult) {
      return { status: 404, body: { error: 'Campaign not found' } };
    }

    if (!canMutateTargets(campaignResult.campaign.status)) {
      return { status: 400, body: { error: 'Cannot add targets to an active campaign' } };
    }

    const body = request.body as {
      channelId?: string;
      videoTitle?: string;
      videoDescription?: string;
      tags?: string[];
      privacy?: string;
      thumbnailAssetId?: string;
    } | undefined;

    const channelId = normalizeNonEmptyString(body?.channelId);
    const videoTitle = normalizeNonEmptyString(body?.videoTitle);
    const videoDescription = normalizeNonEmptyString(body?.videoDescription);
    const thumbnailAssetId = body?.thumbnailAssetId === undefined ? undefined : normalizeNonEmptyString(body.thumbnailAssetId);

    if (!channelId || !videoTitle || !videoDescription) {
      return { status: 400, body: { error: 'Missing required fields: channelId, videoTitle, videoDescription' } };
    }

    if (body?.thumbnailAssetId !== undefined && !thumbnailAssetId) {
      return { status: 400, body: { error: 'Invalid thumbnailAssetId: value must not be blank' } };
    }

    const privacy = body?.privacy === undefined ? undefined : normalizePrivacyValue(body.privacy);
    if (body?.privacy !== undefined && !privacy) {
      return { status: 400, body: { error: 'Invalid privacy value. Use public, unlisted, or private.' } };
    }

    const tags = normalizeTags(body?.tags);
    if (body?.tags !== undefined && tags === null) {
      return { status: 400, body: { error: 'Invalid tags payload. Use an array of strings.' } };
    }

    try {
      const result = await this.campaignService.addTarget(campaignId, {
        channelId,
        videoTitle,
        videoDescription,
        tags: tags ?? undefined,
        privacy,
        thumbnailAssetId,
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

    const campaignResult = await this.campaignService.getCampaign(campaignId);
    if (!campaignResult) {
      return { status: 404, body: { error: 'Campaign not found' } };
    }

    if (!canMutateTargets(campaignResult.campaign.status)) {
      return { status: 400, body: { error: 'Cannot remove targets from an active campaign' } };
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

    const campaignResult = await this.campaignService.getCampaign(campaignId);
    if (!campaignResult) {
      return { status: 404, body: { error: 'Campaign not found' } };
    }

    if (!canMutateTargets(campaignResult.campaign.status)) {
      return { status: 400, body: { error: 'Cannot update targets on an active campaign' } };
    }

    const body = request.body as {
      videoTitle?: string;
      videoDescription?: string;
      tags?: string[];
      privacy?: string;
      thumbnailAssetId?: string;
    } | undefined;

    if (body?.videoTitle !== undefined && !normalizeNonEmptyString(body.videoTitle)) {
      return { status: 400, body: { error: 'Invalid target update: text fields must not be blank' } };
    }

    if (body?.videoDescription !== undefined && !normalizeNonEmptyString(body.videoDescription)) {
      return { status: 400, body: { error: 'Invalid target update: text fields must not be blank' } };
    }

    const thumbnailAssetId = body?.thumbnailAssetId === undefined ? undefined : normalizeNonEmptyString(body.thumbnailAssetId);
    if (body?.thumbnailAssetId !== undefined && !thumbnailAssetId) {
      return { status: 400, body: { error: 'Invalid thumbnailAssetId: value must not be blank' } };
    }

    const privacy = body?.privacy === undefined ? undefined : normalizePrivacyValue(body.privacy);
    if (body?.privacy !== undefined && !privacy) {
      return { status: 400, body: { error: 'Invalid privacy value. Use public, unlisted, or private.' } };
    }

    const tags = normalizeTags(body?.tags);
    if (body?.tags !== undefined && tags === null) {
      return { status: 400, body: { error: 'Invalid tags payload. Use an array of strings.' } };
    }

    const hasUpdates = body && (body.videoTitle !== undefined || body.videoDescription !== undefined ||
      body.tags !== undefined || body.privacy !== undefined || body.thumbnailAssetId !== undefined);
    if (!hasUpdates) {
      return { status: 400, body: { error: 'No updatable fields provided' } };
    }

    const result = await this.campaignService.updateTarget(campaignId, targetId, {
      ...body,
      videoTitle: body?.videoTitle !== undefined ? normalizeNonEmptyString(body.videoTitle) : undefined,
      videoDescription: body?.videoDescription !== undefined ? normalizeNonEmptyString(body.videoDescription) : undefined,
      tags: body?.tags !== undefined ? (tags ?? undefined) : undefined,
      privacy,
      thumbnailAssetId,
    });
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
    const title = body?.title === undefined ? undefined : normalizeNonEmptyString(body.title);
    if (body?.title !== undefined && !title) {
      return { status: 400, body: { error: 'Invalid title: title must not be blank' } };
    }

    const result = await this.campaignService.cloneCampaign(campaignId, title ? { title } : undefined);
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
    const hasUpdates = body && (body.title !== undefined || body.scheduledAt !== undefined);
    if (!hasUpdates) {
      return { status: 400, body: { error: 'No updatable fields provided' } };
    }

    if (body?.title !== undefined) {
      if (typeof body.title !== 'string' || !body.title.trim()) {
        return { status: 400, body: { error: 'Invalid title: title must not be blank' } };
      }
    }

    const scheduledAt = normalizeScheduledAt(body?.scheduledAt);
    if (body?.scheduledAt !== undefined && !scheduledAt) {
      return { status: 400, body: { error: 'Invalid scheduledAt: use a valid date-time string' } };
    }

    const result = await this.campaignService.updateCampaign(campaignId, {
      title: body?.title?.trim(),
      scheduledAt: scheduledAt ?? undefined,
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

    if (target.status === 'enviando' || target.status === 'publicado') {
      return { status: 400, body: { error: 'Cannot retry a target that is already in progress or published' } };
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

    // Reset target status back to aguardando and track the retry count
    await this.campaignService.updateTargetStatus(campaignId, targetId, 'aguardando', {
      errorMessage: null,
      retryCount: result.attempt - 1,
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
