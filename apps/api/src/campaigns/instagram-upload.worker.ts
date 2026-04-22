import type { PublishJobRecord, PublishJobService } from './publish-job.service';
import type { CampaignService, CampaignTargetRecord } from './campaign.service';
import type { AuditEventService } from './audit-event.service';

const SYSTEM_AUDIT_ACTOR_EMAIL = 'system@internal';

export interface InstagramPublishContext {
  accessToken: string;
  instagramAccountId: string;
  videoUrl: string;
  caption: string;
}

export interface InstagramPublishResult {
  mediaId: string;
}

export type InstagramPublishFn = (context: InstagramPublishContext) => Promise<InstagramPublishResult>;

export interface InstagramUploadWorkerOptions {
  jobService: PublishJobService;
  campaignService: CampaignService;
  auditService?: AuditEventService;
  publishFn: InstagramPublishFn;
  getAccessToken: (connectedAccountId: string) => Promise<string>;
  getPublicVideoUrl: (videoAssetId: string) => Promise<string>;
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
  private readonly publishFn: InstagramPublishFn;
  private readonly getAccessToken: (connectedAccountId: string) => Promise<string>;
  private readonly getPublicVideoUrl: (videoAssetId: string) => Promise<string>;

  constructor(options: InstagramUploadWorkerOptions) {
    this.jobService = options.jobService;
    this.campaignService = options.campaignService;
    this.auditService = options.auditService;
    this.publishFn = options.publishFn;
    this.getAccessToken = options.getAccessToken;
    this.getPublicVideoUrl = options.getPublicVideoUrl;
  }

  async processPickedJob(
    job: PublishJobRecord,
    target: CampaignTargetRecord,
    campaignVideoAssetId: string,
  ): Promise<PublishJobRecord | null> {
    if (!target.connectedAccountId) {
      const failedJob = await this.jobService.markFailed(job.id, 'Instagram target is missing connectedAccountId');
      await this.campaignService.updateTargetStatus(target.campaignId, target.id, 'erro', {
        errorMessage: 'Instagram target is missing connectedAccountId',
      });
      return failedJob;
    }

    try {
      const accessToken = await this.getAccessToken(target.connectedAccountId);
      const videoUrl = await this.getPublicVideoUrl(campaignVideoAssetId);
      const result = await this.publishFn({
        accessToken,
        instagramAccountId: target.destinationId,
        videoUrl,
        caption: [target.videoTitle, target.videoDescription].filter(Boolean).join('\n\n'),
      });

      const completedJob = await this.jobService.markCompleted(job.id, result.mediaId);
      await this.campaignService.updateTargetStatus(target.campaignId, target.id, 'publicado', {
        externalPublishId: result.mediaId,
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
      const failedJob = await this.jobService.markFailed(job.id, errorMessage);
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
}

export async function instagramGraphPublish(context: InstagramPublishContext): Promise<InstagramPublishResult> {
  const createContainerUrl = new URL(`https://graph.facebook.com/v23.0/${encodeURIComponent(context.instagramAccountId)}/media`);
  createContainerUrl.searchParams.set('media_type', 'REELS');
  createContainerUrl.searchParams.set('video_url', context.videoUrl);
  createContainerUrl.searchParams.set('caption', context.caption);
  createContainerUrl.searchParams.set('access_token', context.accessToken);

  const containerResponse = await fetch(createContainerUrl, { method: 'POST' });
  const containerPayload = await containerResponse.json().catch(() => null) as Record<string, unknown> | null;
  const creationId = typeof containerPayload?.id === 'string' ? containerPayload.id : null;
  if (!containerResponse.ok || !creationId) {
    throw new Error(readGraphError(containerPayload) ?? 'Instagram media container creation failed.');
  }

  const publishUrl = new URL(`https://graph.facebook.com/v23.0/${encodeURIComponent(context.instagramAccountId)}/media_publish`);
  publishUrl.searchParams.set('creation_id', creationId);
  publishUrl.searchParams.set('access_token', context.accessToken);

  const publishResponse = await fetch(publishUrl, { method: 'POST' });
  const publishPayload = await publishResponse.json().catch(() => null) as Record<string, unknown> | null;
  const mediaId = typeof publishPayload?.id === 'string' ? publishPayload.id : null;
  if (!publishResponse.ok || !mediaId) {
    throw new Error(readGraphError(publishPayload) ?? 'Instagram media publish failed.');
  }

  return { mediaId };
}

function readGraphError(payload: Record<string, unknown> | null): string | null {
  const error = payload?.error;
  if (!error || typeof error !== 'object') {
    return null;
  }
  const message = (error as Record<string, unknown>).message;
  return typeof message === 'string' && message.trim() ? message : null;
}
