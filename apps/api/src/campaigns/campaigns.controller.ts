import type { SessionRequestLike } from '../auth/session.guard';
import { SessionGuard } from '../auth/session.guard';
import type { AuditEventRecord, AuditEventService } from './audit-event.service';
import type { CampaignRecord, CampaignTargetPlatform, CampaignTargetRecord } from './campaign.service';
import {
  CampaignService,
  DUPLICATE_CAMPAIGN_TARGET_CHANNEL_ERROR,
  DUPLICATE_CAMPAIGN_TARGET_DESTINATION_ERROR,
} from './campaign.service';
import type { LaunchService } from './launch.service';
import type { CampaignStatusService } from './campaign-status.service';
import type { PublishJobService, PublishJobRecord } from './publish-job.service';
import type { DashboardService, DashboardStats } from './dashboard.service';
import {
  AccountPlanAccessError,
  AccountPlanService,
  AccountPlanTokenError,
} from '../account-plan/account-plan.service';

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

function normalizePlatformValue(rawValue: unknown): CampaignTargetPlatform | undefined {
  const normalized = normalizeNonEmptyString(rawValue)?.toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (normalized === 'youtube' || normalized === 'tiktok' || normalized === 'instagram') {
    return normalized;
  }

  return undefined;
}

function normalizeOptionalBoolean(rawValue: unknown): boolean | undefined | null {
  if (rawValue === undefined) {
    return undefined;
  }

  return typeof rawValue === 'boolean' ? rawValue : null;
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

interface TargetCreateRequestBody {
  platform?: CampaignTargetPlatform;
  destinationId?: string;
  destinationLabel?: string;
  connectedAccountId?: string;
  channelId?: string;
  videoTitle?: string;
  videoDescription?: string;
  tags?: string[];
  publishAt?: string;
  playlistId?: string;
  privacy?: string;
  thumbnailAssetId?: string;
  instagramCaption?: string;
  instagramShareToFeed?: boolean;
}

function normalizeTargetCreateBody(body: TargetCreateRequestBody | undefined):
  | {
    ok: true;
    value: {
      platform: CampaignTargetPlatform;
      destinationId: string;
      destinationLabel?: string;
      connectedAccountId?: string;
      channelId?: string;
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
  | { ok: false; error: string } {
  const platform = normalizePlatformValue(body?.platform) ?? 'youtube';
  const channelId = normalizeNonEmptyString(body?.channelId);
  const destinationId = normalizeNonEmptyString(body?.destinationId) ?? channelId;
  const destinationLabel = body?.destinationLabel === undefined ? undefined : normalizeNonEmptyString(body.destinationLabel);
  const connectedAccountId = body?.connectedAccountId === undefined ? undefined : normalizeNonEmptyString(body.connectedAccountId);
  const videoTitle = normalizeNonEmptyString(body?.videoTitle);
  const videoDescription = normalizeNonEmptyString(body?.videoDescription);
  const publishAt = normalizeScheduledAt(body?.publishAt);
  const playlistId = body?.playlistId === undefined ? undefined : normalizeNonEmptyString(body.playlistId);
  const thumbnailAssetId = body?.thumbnailAssetId === undefined ? undefined : normalizeNonEmptyString(body.thumbnailAssetId);
  const instagramCaption = body?.instagramCaption === undefined ? undefined : normalizeNonEmptyString(body.instagramCaption);
  const instagramShareToFeed = normalizeOptionalBoolean(body?.instagramShareToFeed);

  if (!destinationId || !videoTitle || !videoDescription) {
    return { ok: false, error: 'Missing required fields: destinationId/channelId, videoTitle, videoDescription' };
  }

  if (body?.thumbnailAssetId !== undefined && !thumbnailAssetId) {
    return { ok: false, error: 'Invalid thumbnailAssetId: value must not be blank' };
  }

  if (body?.instagramCaption !== undefined && !instagramCaption) {
    return { ok: false, error: 'Invalid instagramCaption: value must not be blank' };
  }

  if (instagramShareToFeed === null) {
    return { ok: false, error: 'Invalid instagramShareToFeed: value must be a boolean.' };
  }

  if (body?.publishAt !== undefined && !publishAt) {
    return { ok: false, error: 'Invalid publishAt: use a valid date-time string' };
  }

  if (body?.playlistId !== undefined && !playlistId) {
    return { ok: false, error: 'Invalid playlistId: value must not be blank' };
  }

  const privacy = body?.privacy === undefined ? undefined : normalizePrivacyValue(body.privacy);
  if (body?.privacy !== undefined && !privacy) {
    return { ok: false, error: 'Invalid privacy value. Use public, unlisted, or private.' };
  }

  const tags = normalizeTags(body?.tags);
  if (body?.tags !== undefined && tags === null) {
    return { ok: false, error: 'Invalid tags payload. Use an array of strings.' };
  }

  return {
    ok: true,
    value: {
      platform,
      destinationId,
      destinationLabel,
      connectedAccountId,
      channelId: platform === 'youtube' ? destinationId : undefined,
      videoTitle,
      videoDescription,
      tags: tags ?? undefined,
      publishAt: publishAt ?? undefined,
      playlistId,
      privacy,
      thumbnailAssetId,
      instagramCaption,
      instagramShareToFeed,
    },
  };
}

function isDuplicateTargetChannelError(error: unknown): boolean {
  return error instanceof Error && (
    error.message === DUPLICATE_CAMPAIGN_TARGET_CHANNEL_ERROR ||
    error.message === DUPLICATE_CAMPAIGN_TARGET_DESTINATION_ERROR
  );
}

function isReauthRequiredTarget(target: CampaignTargetRecord): boolean {
  return target.status === 'erro' && target.errorMessage === 'REAUTH_REQUIRED';
}

interface ReauthRequiredTargetSummary {
  campaignId: string;
  campaignTitle: string;
  targetId: string;
  platform: CampaignTargetPlatform;
  destinationId: string;
  destinationLabel: string | null;
  connectedAccountId: string | null;
  retryCount: number;
  latestFailedJobId: string | null;
}

interface ReauthRequiredPlatformSummary {
  platform: CampaignTargetPlatform;
  targets: number;
  campaigns: number;
  accounts: number;
}

interface ReauthRequiredOverview {
  totalTargets: number;
  totalCampaigns: number;
  platforms: ReauthRequiredPlatformSummary[];
  targets: ReauthRequiredTargetSummary[];
}

interface ReauthRequiredRetryError {
  campaignId: string;
  targetId: string;
  error: string;
}

export class CampaignsController {
  constructor(
    private readonly campaignService: CampaignService,
    private readonly sessionGuard: SessionGuard,
    private readonly launchService?: LaunchService,
    private readonly statusService?: CampaignStatusService,
    private readonly jobService?: PublishJobService,
    private readonly dashboardService?: DashboardService,
    private readonly auditService?: AuditEventService,
    private readonly accountPlanService?: AccountPlanService,
  ) {}

  private async findReauthRequiredTargets(ownerEmail?: string): Promise<Array<{ campaign: CampaignRecord; target: CampaignTargetRecord }>> {
    const campaigns = await this.campaignService.listAllCampaigns({ ownerEmail });
    return campaigns.flatMap((campaign) => (
      campaign.targets
        .filter(isReauthRequiredTarget)
        .map((target) => ({ campaign, target }))
    ));
  }

  async create(request: CampaignsRequest): Promise<ControllerResponse<{ campaign?: CampaignRecord; error?: string }>> {
    const guardResult = this.sessionGuard.check(request);
    if (!guardResult.allowed) {
      return { status: guardResult.status, body: { error: guardResult.reason } };
    }

    const body = request.body as { title?: string; videoAssetId?: string; scheduledAt?: string; playlistId?: string; autoMode?: boolean; schedulePattern?: string } | undefined;
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
      ownerEmail: request.session?.adminUser?.email,
      title,
      videoAssetId,
      scheduledAt: scheduledAt ?? undefined,
      playlistId: typeof body?.playlistId === 'string' ? body.playlistId : undefined,
      autoMode: typeof body?.autoMode === 'boolean' ? body.autoMode : false,
      schedulePattern: typeof body?.schedulePattern === 'string' ? body.schedulePattern : undefined,
    });

    return { status: 201, body: result };
  }

  async list(request: SessionRequestLike & { query?: Record<string, string> }): Promise<ControllerResponse<{ campaigns: CampaignRecord[]; total: number; limit: number; offset: number; error?: string }>> {
    const guardResult = this.sessionGuard.check(request);
    if (!guardResult.allowed) {
      return { status: guardResult.status, body: { campaigns: [], total: 0, limit: 20, offset: 0, error: guardResult.reason } };
    }

    const filters: { status?: string; search?: string; limit?: number; offset?: number; ownerEmail?: string } = {
      ownerEmail: request.session?.adminUser?.email,
    };
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

    const result = await this.campaignService.getCampaign(id, request.session?.adminUser?.email);
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

    const actorEmail = request.session?.adminUser?.email;
    const campaignResult = await this.campaignService.getCampaign(campaignId, actorEmail);
    if (!campaignResult) {
      return { status: 404, body: { error: 'Campaign not found' } };
    }

    if (!canMutateTargets(campaignResult.campaign.status)) {
      return { status: 400, body: { error: 'Cannot add targets to an active campaign' } };
    }

    const normalizedBody = normalizeTargetCreateBody(request.body as TargetCreateRequestBody | undefined);
    if (!normalizedBody.ok) {
      return { status: 400, body: { error: normalizedBody.error } };
    }

    if (actorEmail && this.accountPlanService) {
      try {
        await this.accountPlanService.assertPlatformAccess(actorEmail, normalizedBody.value.platform);
      } catch (error) {
        if (error instanceof AccountPlanAccessError) {
          return { status: error.statusCode, body: { error: error.message } };
        }
        throw error;
      }
    }

    try {
      const result = await this.campaignService.addTarget(campaignId, normalizedBody.value, actorEmail);

      if (request.session?.adminUser?.email && this.auditService) {
        await this.auditService.record({
          eventType: 'add_target',
          actorEmail: request.session.adminUser.email,
          campaignId,
          targetId: result.target.id,
        });
      }

      return { status: 201, body: result };
    } catch (error) {
      if (isDuplicateTargetChannelError(error)) {
        return { status: 400, body: { error: DUPLICATE_CAMPAIGN_TARGET_CHANNEL_ERROR } };
      }
      return { status: 404, body: { error: 'Campaign not found' } };
    }
  }

  async addTargetsBulk(request: CampaignsRequest): Promise<ControllerResponse<{ targets?: CampaignTargetRecord[]; error?: string }>> {
    const guardResult = this.sessionGuard.check(request);
    if (!guardResult.allowed) {
      return { status: guardResult.status, body: { error: guardResult.reason } };
    }

    const campaignId = request.params?.id;
    if (!campaignId) {
      return { status: 400, body: { error: 'Missing campaign id' } };
    }

    const actorEmail = request.session?.adminUser?.email;
    const campaignResult = await this.campaignService.getCampaign(campaignId, actorEmail);
    if (!campaignResult) {
      return { status: 404, body: { error: 'Campaign not found' } };
    }

    if (!canMutateTargets(campaignResult.campaign.status)) {
      return { status: 400, body: { error: 'Cannot add targets to an active campaign' } };
    }

    const body = request.body as { targets?: TargetCreateRequestBody[] } | undefined;
    if (!Array.isArray(body?.targets) || body.targets.length === 0) {
      return { status: 400, body: { error: 'Invalid targets payload. Use a non-empty array.' } };
    }

    const normalizedTargets = [];
    const seenDestinationRefs = new Set<string>();
    const existingDestinationRefs = new Set(
      campaignResult.campaign.targets.map((target) => `${target.platform ?? 'youtube'}:${target.destinationId ?? target.channelId}`),
    );
    for (let index = 0; index < body.targets.length; index += 1) {
      const normalizedTarget = normalizeTargetCreateBody(body.targets[index]);
      if (!normalizedTarget.ok) {
        return { status: 400, body: { error: `Invalid target at index ${index}: ${normalizedTarget.error}` } };
      }
      const destinationRef = `${normalizedTarget.value.platform}:${normalizedTarget.value.destinationId}`;
      if (seenDestinationRefs.has(destinationRef)) {
        const duplicateMessage = normalizedTarget.value.platform === 'youtube'
          ? `Duplicate channelId in targets payload: ${normalizedTarget.value.destinationId}`
          : `Duplicate destination in targets payload: ${destinationRef}`;
        return { status: 400, body: { error: duplicateMessage } };
      }
      if (existingDestinationRefs.has(destinationRef)) {
        return { status: 400, body: { error: `Target for destination already exists in campaign: ${destinationRef}` } };
      }
      seenDestinationRefs.add(destinationRef);
      normalizedTargets.push(normalizedTarget.value);
    }

    if (actorEmail && this.accountPlanService) {
      for (const normalizedTarget of normalizedTargets) {
        try {
          await this.accountPlanService.assertPlatformAccess(actorEmail, normalizedTarget.platform);
        } catch (error) {
          if (error instanceof AccountPlanAccessError) {
            return { status: error.statusCode, body: { error: error.message } };
          }
          throw error;
        }
      }
    }

    try {
      const createdTargets: CampaignTargetRecord[] = [];
      for (const normalizedTarget of normalizedTargets) {
        const result = await this.campaignService.addTarget(campaignId, normalizedTarget, actorEmail);
        createdTargets.push(result.target);
      }

      if (request.session?.adminUser?.email && this.auditService) {
        await this.auditService.record({
          eventType: 'add_targets_bulk',
          actorEmail: request.session.adminUser.email,
          campaignId,
        });
      }

      return { status: 201, body: { targets: createdTargets } };
    } catch (error) {
      if (isDuplicateTargetChannelError(error)) {
        return { status: 400, body: { error: DUPLICATE_CAMPAIGN_TARGET_CHANNEL_ERROR } };
      }
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

    const actorEmail = request.session?.adminUser?.email;
    const campaignResult = await this.campaignService.getCampaign(campaignId, actorEmail);
    if (!campaignResult) {
      return { status: 404, body: { error: 'Campaign not found' } };
    }

    if (actorEmail && this.accountPlanService) {
      try {
        await this.accountPlanService.authorizeCampaignLaunch(actorEmail, campaignResult.campaign);
      } catch (error) {
        if (error instanceof AccountPlanAccessError || error instanceof AccountPlanTokenError) {
          return { status: error.statusCode, body: { error: error.message } };
        }
        throw error;
      }
    }

    const result = this.launchService
      ? await this.launchService.launchCampaign(campaignId)
      : await this.campaignService.launch(campaignId, actorEmail);

    if ('error' in result) {
      if (result.error === 'NOT_FOUND') {
        return { status: 404, body: { error: 'Campaign not found' } };
      }
      return { status: 400, body: { error: `Cannot launch: campaign is not ready (${result.error})` } };
    }

    if (request.session?.adminUser?.email && this.auditService) {
      await this.auditService.record({
        eventType: 'launch_campaign',
        actorEmail: request.session.adminUser.email,
        campaignId,
      });
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

    const campaignResult = await this.campaignService.getCampaign(campaignId, request.session?.adminUser?.email);
    if (!campaignResult) {
      return { status: 404, body: { error: 'Campaign not found' } };
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

    const actorEmail = request.session?.adminUser?.email;
    const campaignResult = await this.campaignService.getCampaign(campaignId, actorEmail);
    if (!campaignResult) {
      return { status: 404, body: { error: 'Campaign not found' } };
    }

    if (!canMutateTargets(campaignResult.campaign.status)) {
      return { status: 400, body: { error: 'Cannot remove targets from an active campaign' } };
    }

    const removed = await this.campaignService.removeTarget(campaignId, targetId, actorEmail);
    if (!removed) {
      return { status: 404, body: { error: 'Target not found' } };
    }

    if (request.session?.adminUser?.email && this.auditService) {
      await this.auditService.record({
        eventType: 'remove_target',
        actorEmail: request.session.adminUser.email,
        campaignId,
        targetId,
      });
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

    const actorEmail = request.session?.adminUser?.email;
    const campaignResult = await this.campaignService.getCampaign(campaignId, actorEmail);
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
      publishAt?: string;
      playlistId?: string;
      privacy?: string;
      thumbnailAssetId?: string;
    } | undefined;

    if (body?.videoTitle !== undefined && !normalizeNonEmptyString(body.videoTitle)) {
      return { status: 400, body: { error: 'Invalid target update: text fields must not be blank' } };
    }

    if (body?.videoDescription !== undefined && !normalizeNonEmptyString(body.videoDescription)) {
      return { status: 400, body: { error: 'Invalid target update: text fields must not be blank' } };
    }

    const playlistId = body?.playlistId === undefined ? undefined : normalizeNonEmptyString(body.playlistId);
    if (body?.playlistId !== undefined && !playlistId) {
      return { status: 400, body: { error: 'Invalid playlistId: value must not be blank' } };
    }

    const publishAt = normalizeScheduledAt(body?.publishAt);
    if (body?.publishAt !== undefined && !publishAt) {
      return { status: 400, body: { error: 'Invalid publishAt: use a valid date-time string' } };
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
      body.tags !== undefined || body.publishAt !== undefined || body.playlistId !== undefined || body.privacy !== undefined || body.thumbnailAssetId !== undefined);
    if (!hasUpdates) {
      return { status: 400, body: { error: 'No updatable fields provided' } };
    }

    const result = await this.campaignService.updateTarget(
      campaignId,
      targetId,
      {
        ...body,
        videoTitle: body?.videoTitle !== undefined ? normalizeNonEmptyString(body.videoTitle) : undefined,
        videoDescription: body?.videoDescription !== undefined ? normalizeNonEmptyString(body.videoDescription) : undefined,
        tags: body?.tags !== undefined ? (tags ?? undefined) : undefined,
        publishAt: body?.publishAt !== undefined ? (publishAt ?? undefined) : undefined,
        playlistId,
        privacy,
        thumbnailAssetId,
      },
      actorEmail,
    );
    if ('error' in result) {
      return { status: 404, body: { error: 'Target not found' } };
    }

    if (request.session?.adminUser?.email && this.auditService) {
      await this.auditService.record({
        eventType: 'update_target',
        actorEmail: request.session.adminUser.email,
        campaignId,
        targetId,
      });
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

    const ownerEmail = request.session?.adminUser?.email;
    const result = await this.campaignService.deleteCampaign(campaignId, ownerEmail);
    if ('error' in result) {
      if (result.error === 'NOT_FOUND') {
        return { status: 404, body: { error: 'Campaign not found' } };
      }
      return { status: 400, body: { error: 'Cannot delete an active campaign' } };
    }

    if (request.session?.adminUser?.email && this.auditService) {
      await this.auditService.record({
        eventType: 'delete_campaign',
        actorEmail: request.session.adminUser.email,
        campaignId,
      });
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

    const ownerEmail = request.session?.adminUser?.email;
    const result = await this.campaignService.cloneCampaign(campaignId, {
      ownerEmail,
      ...(title ? { title } : {}),
    });
    if ('error' in result) {
      return { status: 404, body: { error: 'Campaign not found' } };
    }

    if (request.session?.adminUser?.email && this.auditService) {
      await this.auditService.record({
        eventType: 'clone_campaign',
        actorEmail: request.session.adminUser.email,
        campaignId,
      });
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

    const body = request.body as { title?: string; scheduledAt?: string; playlistId?: string | null; autoMode?: boolean; schedulePattern?: string | null } | undefined;
    const hasUpdates = body && (body.title !== undefined || body.scheduledAt !== undefined || body.playlistId !== undefined || body.autoMode !== undefined || body.schedulePattern !== undefined);
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

    const ownerEmail = request.session?.adminUser?.email;
    const result = await this.campaignService.updateCampaign(campaignId, {
      title: body?.title?.trim(),
      scheduledAt: scheduledAt ?? undefined,
      playlistId: body?.playlistId !== undefined ? (body.playlistId ?? null) : undefined,
      autoMode: typeof body?.autoMode === 'boolean' ? body.autoMode : undefined,
      schedulePattern: body?.schedulePattern !== undefined ? (body.schedulePattern ?? null) : undefined,
    }, ownerEmail);

    if ('error' in result) {
      if (result.error === 'NOT_FOUND') {
        return { status: 404, body: { error: 'Campaign not found' } };
      }
      return { status: 400, body: { error: 'Cannot update an active campaign' } };
    }

    if (request.session?.adminUser?.email && this.auditService) {
      await this.auditService.record({
        eventType: 'update_campaign',
        actorEmail: request.session.adminUser.email,
        campaignId,
      });
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
    const ownerEmail = request.session?.adminUser?.email;
    const campaignResult = await this.campaignService.getCampaign(campaignId, ownerEmail);
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

    if (request.session?.adminUser?.email && this.auditService) {
      await this.auditService.record({
        eventType: 'retry_target',
        actorEmail: request.session.adminUser.email,
        campaignId,
        targetId,
      });
    }

    return { status: 200, body: { job: result } };
  }

  async getReauthRequiredOverview(request: CampaignsRequest): Promise<ControllerResponse<{ overview?: ReauthRequiredOverview; error?: string }>> {
    const guardResult = this.sessionGuard.check(request);
    if (!guardResult.allowed) {
      return { status: guardResult.status, body: { error: guardResult.reason } };
    }

    const ownerEmail = request.session?.adminUser?.email;
    const reauthTargets = await this.findReauthRequiredTargets(ownerEmail);
    const platformOrder: CampaignTargetPlatform[] = ['youtube', 'tiktok', 'instagram'];
    const platformMap = new Map<CampaignTargetPlatform, { targets: number; campaignIds: Set<string>; accountIds: Set<string> }>();

    const targets = await Promise.all(reauthTargets.map(async ({ campaign, target }) => {
      const existing = platformMap.get(target.platform) ?? {
        targets: 0,
        campaignIds: new Set<string>(),
        accountIds: new Set<string>(),
      };
      existing.targets += 1;
      existing.campaignIds.add(campaign.id);
      if (target.connectedAccountId) {
        existing.accountIds.add(target.connectedAccountId);
      }
      platformMap.set(target.platform, existing);

      let latestFailedJobId: string | null = null;
      if (this.jobService) {
        const jobs = await this.jobService.getJobsForTarget(target.id);
        latestFailedJobId = [...jobs].reverse().find((job) => job.status === 'failed')?.id ?? null;
      }

      return {
        campaignId: campaign.id,
        campaignTitle: campaign.title,
        targetId: target.id,
        platform: target.platform,
        destinationId: target.destinationId,
        destinationLabel: target.destinationLabel,
        connectedAccountId: target.connectedAccountId,
        retryCount: target.retryCount,
        latestFailedJobId,
      };
    }));

    const platforms = platformOrder
      .filter((platform) => platformMap.has(platform))
      .map((platform) => {
        const summary = platformMap.get(platform)!;
        return {
          platform,
          targets: summary.targets,
          campaigns: summary.campaignIds.size,
          accounts: summary.accountIds.size,
        };
      });

    return {
      status: 200,
      body: {
        overview: {
          totalTargets: targets.length,
          totalCampaigns: new Set(targets.map((target) => target.campaignId)).size,
          platforms,
          targets,
        },
      },
    };
  }

  async retryReauthRequiredTargets(
    request: CampaignsRequest,
  ): Promise<ControllerResponse<{ jobs?: PublishJobRecord[]; retried?: number; skipped?: number; errors?: ReauthRequiredRetryError[]; error?: string }>> {
    const guardResult = this.sessionGuard.check(request);
    if (!guardResult.allowed) {
      return { status: guardResult.status, body: { error: guardResult.reason } };
    }

    if (!this.jobService) {
      return { status: 501, body: { error: 'Job service not available' } };
    }

    const ownerEmail = request.session?.adminUser?.email;
    const reauthTargets = await this.findReauthRequiredTargets(ownerEmail);
    const jobs: PublishJobRecord[] = [];
    const errors: ReauthRequiredRetryError[] = [];
    let skipped = 0;

    for (const { campaign, target } of reauthTargets) {
      if (target.status === 'enviando' || target.status === 'publicado') {
        skipped += 1;
        errors.push({
          campaignId: campaign.id,
          targetId: target.id,
          error: 'Cannot retry a target that is already in progress or published',
        });
        continue;
      }

      const targetJobs = await this.jobService.getJobsForTarget(target.id);
      const failedJob = [...targetJobs].reverse().find((job) => job.status === 'failed');
      if (!failedJob) {
        skipped += 1;
        errors.push({
          campaignId: campaign.id,
          targetId: target.id,
          error: 'No failed job to retry',
        });
        continue;
      }

      const result = await this.jobService.retry(failedJob.id);
      if ('error' in result) {
        skipped += 1;
        errors.push({
          campaignId: campaign.id,
          targetId: target.id,
          error: result.error,
        });
        continue;
      }

      await this.campaignService.updateTargetStatus(campaign.id, target.id, 'aguardando', {
        errorMessage: null,
        retryCount: result.attempt - 1,
      });
      jobs.push(result);

      if (request.session?.adminUser?.email && this.auditService) {
        await this.auditService.record({
          eventType: 'retry_target',
          actorEmail: request.session.adminUser.email,
          campaignId: campaign.id,
          targetId: target.id,
        });
      }
    }

    return {
      status: 200,
      body: {
        jobs,
        retried: jobs.length,
        skipped,
        errors,
      },
    };
  }

  async getTargetJobs(request: CampaignsRequest): Promise<ControllerResponse<{ jobs?: PublishJobRecord[]; error?: string }>> {
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

    const ownerEmail = request.session?.adminUser?.email;
    const campaignResult = await this.campaignService.getCampaign(campaignId, ownerEmail);
    if (!campaignResult) {
      return { status: 404, body: { error: 'Campaign not found' } };
    }

    const target = campaignResult.campaign.targets.find((t) => t.id === targetId);
    if (!target) {
      return { status: 404, body: { error: 'Target not found' } };
    }

    return {
      status: 200,
      body: {
        jobs: await this.jobService.getJobsForTarget(targetId),
      },
    };
  }

  async getCampaignJobs(request: CampaignsRequest): Promise<ControllerResponse<{ jobsByTarget?: Record<string, PublishJobRecord[]>; error?: string }>> {
    const guardResult = this.sessionGuard.check(request);
    if (!guardResult.allowed) {
      return { status: guardResult.status, body: { error: guardResult.reason } };
    }

    const campaignId = request.params?.id;
    if (!campaignId) {
      return { status: 400, body: { error: 'Missing campaign id' } };
    }

    if (!this.jobService) {
      return { status: 501, body: { error: 'Job service not available' } };
    }

    const ownerEmail = request.session?.adminUser?.email;
    const campaignResult = await this.campaignService.getCampaign(campaignId, ownerEmail);
    if (!campaignResult) {
      return { status: 404, body: { error: 'Campaign not found' } };
    }

    const jobsByTargetEntries = await Promise.all(
      campaignResult.campaign.targets.map(async (target) => [target.id, await this.jobService!.getJobsForTarget(target.id)] as const),
    );

    return {
      status: 200,
      body: {
        jobsByTarget: Object.fromEntries(jobsByTargetEntries),
      },
    };
  }

  async getCampaignAudit(request: CampaignsRequest): Promise<ControllerResponse<{ events?: AuditEventRecord[]; error?: string }>> {
    const guardResult = this.sessionGuard.check(request);
    if (!guardResult.allowed) {
      return { status: guardResult.status, body: { error: guardResult.reason } };
    }

    const campaignId = request.params?.id;
    if (!campaignId) {
      return { status: 400, body: { error: 'Missing campaign id' } };
    }

    if (!this.auditService) {
      return { status: 501, body: { error: 'Audit service not available' } };
    }

    const ownerEmail = request.session?.adminUser?.email;
    const campaignResult = await this.campaignService.getCampaign(campaignId, ownerEmail);
    if (!campaignResult) {
      return { status: 404, body: { error: 'Campaign not found' } };
    }

    return {
      status: 200,
      body: {
        events: await this.auditService.listEventsForCampaign(campaignId),
      },
    };
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

    const ownerEmail = request.session?.adminUser?.email;
    const result = await this.campaignService.markReady(campaignId, ownerEmail);
    if ('error' in result) {
      if (result.error === 'NOT_FOUND') {
        return { status: 404, body: { error: 'Campaign not found' } };
      }
      return { status: 400, body: { error: `Cannot mark ready: ${result.error}` } };
    }

    if (request.session?.adminUser?.email && this.auditService) {
      await this.auditService.record({
        eventType: 'mark_ready',
        actorEmail: request.session.adminUser.email,
        campaignId,
      });
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

    return { status: 200, body: await this.dashboardService.getStats(request.session?.adminUser?.email) };
  }
}
