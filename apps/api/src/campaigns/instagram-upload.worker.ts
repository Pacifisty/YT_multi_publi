import type { AuditEventService } from './audit-event.service';
import type { CampaignService, CampaignTargetRecord } from './campaign.service';
import type { PublishJobRecord, PublishJobService } from './publish-job.service';
import { classifyInstagramError } from './error-classifier';
import { InstagramApiClient } from '../integrations/instagram/instagram-api.client';

const SYSTEM_AUDIT_ACTOR_EMAIL = 'system@internal';
const INSTAGRAM_MAX_STATUS_POLLS = 6;
const INSTAGRAM_STATUS_POLL_DELAY_MS = 5_000;

export interface InstagramPublishContext {
  accessToken: string;
  instagramBusinessAccountId: string;
  videoUrl: string;
  caption: string;
  shareToFeed: boolean;
}

export interface InstagramPublishResult {
  containerId: string;
  postId: string;
}

export type InstagramCreateContainerFn = (context: InstagramPublishContext) => Promise<{ containerId: string }>;
export type InstagramPublishContainerFn = (
  context: Pick<InstagramPublishContext, 'accessToken' | 'instagramBusinessAccountId'> & { containerId: string },
) => Promise<{ postId: string }>;
export type InstagramFetchContainerStatusFn = (
  accessToken: string,
  containerId: string,
  instagramBusinessAccountId: string,
) => Promise<{ status: string; errorMessage?: string | null }>;

export interface InstagramUploadWorkerOptions {
  jobService: PublishJobService;
  campaignService: CampaignService;
  auditService?: AuditEventService;
  createContainerFn?: InstagramCreateContainerFn;
  publishContainerFn?: InstagramPublishContainerFn;
  fetchContainerStatusFn?: InstagramFetchContainerStatusFn;
  getAccessToken: (connectedAccountId: string) => Promise<string>;
  getPublicVideoUrl: (videoAssetId: string) => Promise<string>;
  getInstagramBusinessAccountId?: (connectedAccountId: string) => Promise<string>;
  sleepMs?: (ms: number) => Promise<void>;
}

function normalizePublishErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }

  return 'Unknown error';
}

export class InstagramUploadWorker {
  private readonly jobService: PublishJobService;
  private readonly campaignService: CampaignService;
  private readonly auditService?: AuditEventService;
  private readonly createContainerFn: InstagramCreateContainerFn;
  private readonly publishContainerFn: InstagramPublishContainerFn;
  private readonly fetchContainerStatusFn: InstagramFetchContainerStatusFn;
  private readonly getAccessToken: (connectedAccountId: string) => Promise<string>;
  private readonly getPublicVideoUrl: (videoAssetId: string) => Promise<string>;
  private readonly getInstagramBusinessAccountId: (connectedAccountId: string) => Promise<string>;
  private readonly sleepMs: (ms: number) => Promise<void>;

  constructor(options: InstagramUploadWorkerOptions) {
    this.jobService = options.jobService;
    this.campaignService = options.campaignService;
    this.auditService = options.auditService;
    this.createContainerFn = options.createContainerFn ?? instagramCreateReelsContainer;
    this.publishContainerFn = options.publishContainerFn ?? instagramPublishReelsContainer;
    this.fetchContainerStatusFn = options.fetchContainerStatusFn ?? instagramFetchContainerStatus;
    this.getAccessToken = options.getAccessToken;
    this.getPublicVideoUrl = options.getPublicVideoUrl;
    this.getInstagramBusinessAccountId = options.getInstagramBusinessAccountId ?? (async (connectedAccountId) => connectedAccountId);
    this.sleepMs = options.sleepMs ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  async processPickedJob(
    job: PublishJobRecord,
    target: CampaignTargetRecord,
    campaignVideoAssetId: string,
  ): Promise<PublishJobRecord | null> {
    if (!target.connectedAccountId) {
      const failedJob = await this.jobService.markFailed(job.id, 'Instagram target is missing connectedAccountId', {
        errorClass: 'permanent',
      });
      await this.campaignService.updateTargetStatus(target.campaignId, target.id, 'erro', {
        errorMessage: 'Instagram target is missing connectedAccountId',
      });
      return failedJob;
    }

    try {
      const accessToken = await this.getAccessToken(target.connectedAccountId);
      const instagramBusinessAccountId = await this.getInstagramBusinessAccountId(target.connectedAccountId);
      const videoUrl = await this.getPublicVideoUrl(campaignVideoAssetId);
      const caption = buildInstagramCaption(target);
      const container = await this.createContainerFn({
        accessToken,
        instagramBusinessAccountId,
        videoUrl,
        caption,
        shareToFeed: target.instagramShareToFeed ?? true,
      });

      await this.waitForContainerReady(accessToken, container.containerId, instagramBusinessAccountId);
      const publish = await this.publishContainerFn({
        accessToken,
        instagramBusinessAccountId,
        containerId: container.containerId,
      });

      const completedJob = await this.jobService.markCompleted(job.id, publish.postId);
      await this.campaignService.updateTargetStatus(target.campaignId, target.id, 'publicado', {
        externalPublishId: publish.postId,
      });

      if (this.auditService) {
        await this.auditService.record({
          eventType: 'publish_completed',
          actorEmail: SYSTEM_AUDIT_ACTOR_EMAIL,
          campaignId: target.campaignId,
          targetId: target.id,
        });
      }

      return completedJob;
    } catch (error) {
      const errorMessage = normalizePublishErrorMessage(error);
      const failedJob = await this.jobService.markFailed(job.id, errorMessage, {
        errorClass: classifyInstagramError(error),
      });
      await this.campaignService.updateTargetStatus(target.campaignId, target.id, 'erro', {
        errorMessage,
      });

      if (this.auditService) {
        await this.auditService.record({
          eventType: 'publish_failed',
          actorEmail: SYSTEM_AUDIT_ACTOR_EMAIL,
          campaignId: target.campaignId,
          targetId: target.id,
        });
      }

      return failedJob;
    }
  }

  private async waitForContainerReady(
    accessToken: string,
    containerId: string,
    instagramBusinessAccountId: string,
  ): Promise<void> {
    for (let attempt = 0; attempt < INSTAGRAM_MAX_STATUS_POLLS; attempt += 1) {
      const status = await this.fetchContainerStatusFn(accessToken, containerId, instagramBusinessAccountId);
      if (status.status === 'FINISHED') {
        return;
      }

      if (status.status === 'ERROR') {
        throw new Error(status.errorMessage?.trim() || 'Instagram container processing failed.');
      }

      if (attempt < INSTAGRAM_MAX_STATUS_POLLS - 1) {
        await this.sleepMs(INSTAGRAM_STATUS_POLL_DELAY_MS);
      }
    }

    throw new Error('Instagram container processing did not finish before the polling limit.');
  }
}

function buildInstagramCaption(target: CampaignTargetRecord): string {
  const caption = target.instagramCaption ?? target.videoDescription ?? target.videoTitle;
  return caption.slice(0, 2200);
}

export async function instagramCreateReelsContainer(
  context: InstagramPublishContext,
): Promise<{ containerId: string }> {
  const client = new InstagramApiClient(context.accessToken, context.instagramBusinessAccountId);
  const response = await client.createReelsContainer({
    videoUrl: context.videoUrl,
    caption: context.caption,
    shareToFeed: context.shareToFeed,
  });
  if (!response.creation_id) {
    throw new Error('Instagram Reels container creation did not return a creation id.');
  }

  return { containerId: response.creation_id };
}

export async function instagramPublishReelsContainer(
  context: Pick<InstagramPublishContext, 'accessToken' | 'instagramBusinessAccountId'> & { containerId: string },
): Promise<{ postId: string }> {
  const client = new InstagramApiClient(context.accessToken, context.instagramBusinessAccountId);
  const response = await client.publishReelsContainer(context.containerId);
  if (!response.id) {
    throw new Error('Instagram Reels publish did not return a post id.');
  }

  return { postId: response.id };
}

export async function instagramFetchContainerStatus(
  accessToken: string,
  containerId: string,
  instagramBusinessAccountId: string,
): Promise<{ status: string; errorMessage?: string | null }> {
  const client = new InstagramApiClient(accessToken, instagramBusinessAccountId);
  const response = await client.fetchContainerStatus(containerId);

  return {
    status: response.status_code,
    errorMessage: response.error_message ?? null,
  };
}
