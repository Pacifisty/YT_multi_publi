import type { AuditEventService } from './audit-event.service';
import type { CampaignService, CampaignTargetRecord } from './campaign.service';
import type { PublishJobRecord, PublishJobService } from './publish-job.service';

const SYSTEM_AUDIT_ACTOR_EMAIL = 'system@internal';

export interface TikTokCreatorInfo {
  privacyLevelOptions: string[];
  commentDisabled: boolean;
  duetDisabled: boolean;
  stitchDisabled: boolean;
}

export interface TikTokPublishContext {
  accessToken: string;
  videoUrl: string;
  title: string;
  privacy: string;
}

export interface TikTokPublishResult {
  publishId: string;
  publiclyAvailablePostId?: string | null;
}

export type TikTokQueryCreatorInfoFn = (accessToken: string) => Promise<TikTokCreatorInfo>;
export type TikTokPublishFn = (context: TikTokPublishContext) => Promise<{ publishId: string }>;
export type TikTokFetchStatusFn = (
  accessToken: string,
  publishId: string,
) => Promise<{ status: string; failReason?: string | null; publiclyAvailablePostId?: string | null }>;

export interface TikTokUploadWorkerOptions {
  jobService: PublishJobService;
  campaignService: CampaignService;
  auditService?: AuditEventService;
  queryCreatorInfoFn?: TikTokQueryCreatorInfoFn;
  publishFn?: TikTokPublishFn;
  fetchStatusFn?: TikTokFetchStatusFn;
  getAccessToken: (connectedAccountId: string) => Promise<string>;
  getPublicVideoUrl: (videoAssetId: string) => Promise<string>;
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

export class TikTokUploadWorker {
  private readonly jobService: PublishJobService;
  private readonly campaignService: CampaignService;
  private readonly auditService?: AuditEventService;
  private readonly queryCreatorInfoFn: TikTokQueryCreatorInfoFn;
  private readonly publishFn: TikTokPublishFn;
  private readonly fetchStatusFn: TikTokFetchStatusFn;
  private readonly getAccessToken: (connectedAccountId: string) => Promise<string>;
  private readonly getPublicVideoUrl: (videoAssetId: string) => Promise<string>;
  private readonly sleepMs: (ms: number) => Promise<void>;

  constructor(options: TikTokUploadWorkerOptions) {
    this.jobService = options.jobService;
    this.campaignService = options.campaignService;
    this.auditService = options.auditService;
    this.queryCreatorInfoFn = options.queryCreatorInfoFn ?? tiktokQueryCreatorInfo;
    this.publishFn = options.publishFn ?? tiktokDirectPostFromUrl;
    this.fetchStatusFn = options.fetchStatusFn ?? tiktokFetchPublishStatus;
    this.getAccessToken = options.getAccessToken;
    this.getPublicVideoUrl = options.getPublicVideoUrl;
    this.sleepMs = options.sleepMs ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  async processPickedJob(
    job: PublishJobRecord,
    target: CampaignTargetRecord,
    campaignVideoAssetId: string,
  ): Promise<PublishJobRecord | null> {
    if (!target.connectedAccountId) {
      const failedJob = await this.jobService.markFailed(job.id, 'TikTok target is missing connectedAccountId');
      await this.campaignService.updateTargetStatus(target.campaignId, target.id, 'erro', {
        errorMessage: 'TikTok target is missing connectedAccountId',
      });
      return failedJob;
    }

    try {
      const accessToken = await this.getAccessToken(target.connectedAccountId);
      const creatorInfo = await this.queryCreatorInfoFn(accessToken);
      const videoUrl = await this.getPublicVideoUrl(campaignVideoAssetId);
      const publishResponse = await this.publishFn({
        accessToken,
        videoUrl,
        title: buildTikTokTitle(target.videoTitle, target.videoDescription, target.tags),
        privacy: selectTikTokPrivacyLevel(target.privacy, creatorInfo.privacyLevelOptions),
      });

      const completion = await this.waitForPublishCompletion(accessToken, publishResponse.publishId);
      const completedJob = await this.jobService.markCompleted(job.id, completion.publiclyAvailablePostId ?? publishResponse.publishId);
      await this.campaignService.updateTargetStatus(target.campaignId, target.id, 'publicado', {
        externalPublishId: completion.publiclyAvailablePostId ?? publishResponse.publishId,
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

  private async waitForPublishCompletion(accessToken: string, publishId: string): Promise<TikTokPublishResult> {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const status = await this.fetchStatusFn(accessToken, publishId);
      if (status.status === 'PUBLISH_COMPLETE') {
        return {
          publishId,
          publiclyAvailablePostId: status.publiclyAvailablePostId ?? null,
        };
      }

      if (status.status === 'FAILED') {
        throw new Error(status.failReason?.trim() || 'TikTok publish failed.');
      }

      if (attempt < 5) {
        await this.sleepMs(5_000);
      }
    }

    return { publishId };
  }
}

function buildTikTokTitle(videoTitle: string, videoDescription: string, tags: string[]): string {
  const tagSuffix = tags
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => (entry.startsWith('#') ? entry : `#${entry}`))
    .join(' ');

  const parts = [videoTitle, videoDescription, tagSuffix]
    .map((entry) => entry.trim())
    .filter(Boolean);

  return parts.join('\n\n').slice(0, 2200);
}

function selectTikTokPrivacyLevel(
  campaignPrivacy: string,
  availableOptions: string[],
): string {
  const normalized = campaignPrivacy.trim().toLowerCase();
  const options = new Set(availableOptions);
  const preferred = normalized === 'public'
    ? 'PUBLIC_TO_EVERYONE'
    : normalized === 'unlisted'
      ? 'FOLLOWER_OF_CREATOR'
      : 'SELF_ONLY';

  if (options.has(preferred)) {
    return preferred;
  }

  if (options.has('SELF_ONLY')) {
    return 'SELF_ONLY';
  }

  const fallback = availableOptions.find(Boolean);
  if (!fallback) {
    throw new Error('TikTok creator info did not return any privacy options.');
  }

  return fallback;
}

export async function tiktokQueryCreatorInfo(accessToken: string): Promise<TikTokCreatorInfo> {
  const response = await fetch('https://open.tiktokapis.com/v2/post/publish/creator_info/query/', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({}),
  });

  const payload = await readTikTokJson(response, 'TikTok creator info query failed.');
  const data = readObjectField(payload, 'data');
  return {
    privacyLevelOptions: readStringArrayField(data, 'privacy_level_options'),
    commentDisabled: readBooleanField(data, 'comment_disabled') ?? false,
    duetDisabled: readBooleanField(data, 'duet_disabled') ?? false,
    stitchDisabled: readBooleanField(data, 'stitch_disabled') ?? false,
  };
}

export async function tiktokDirectPostFromUrl(context: TikTokPublishContext): Promise<{ publishId: string }> {
  const response = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${context.accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({
      post_info: {
        title: context.title,
        privacy_level: context.privacy,
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
      },
      source_info: {
        source: 'PULL_FROM_URL',
        video_url: context.videoUrl,
      },
    }),
  });

  const payload = await readTikTokJson(response, 'TikTok direct post initialization failed.');
  const data = readObjectField(payload, 'data');
  const publishId = readStringField(data, 'publish_id');
  if (!publishId) {
    throw new Error('TikTok direct post did not return a publish_id.');
  }

  return { publishId };
}

export async function tiktokFetchPublishStatus(
  accessToken: string,
  publishId: string,
): Promise<{ status: string; failReason?: string | null; publiclyAvailablePostId?: string | null }> {
  const response = await fetch('https://open.tiktokapis.com/v2/post/publish/status/fetch/', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({
      publish_id: publishId,
    }),
  });

  const payload = await readTikTokJson(response, 'TikTok publish status lookup failed.');
  const data = readObjectField(payload, 'data');
  const status = readStringField(data, 'status');
  if (!status) {
    throw new Error('TikTok publish status lookup did not return a status.');
  }

  const postData = readObjectField(data, 'post.publish.publicly_available');
  const publiclyAvailablePostId = readStringField(postData, 'post_id')
    ?? readFirstStringFromArray(data?.publicaly_available_post_id)
    ?? null;

  return {
    status,
    failReason: readStringField(data, 'fail_reason'),
    publiclyAvailablePostId,
  };
}

async function readTikTokJson(response: Response, fallbackMessage: string): Promise<Record<string, unknown>> {
  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  const error = readObjectField(payload, 'error');
  const code = readStringField(error, 'code');

  if (response.ok && (!code || code === 'ok')) {
    return payload ?? {};
  }

  const message = readStringField(error, 'message')
    ?? readStringField(payload, 'message')
    ?? fallbackMessage;

  throw new Error(message);
}

function readObjectField(value: Record<string, unknown> | null | undefined, key: string): Record<string, unknown> | null {
  const raw = value?.[key];
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
}

function readStringField(value: Record<string, unknown> | null | undefined, key: string): string | null {
  const raw = value?.[key];
  return typeof raw === 'string' && raw.trim() ? raw : null;
}

function readBooleanField(value: Record<string, unknown> | null | undefined, key: string): boolean | null {
  const raw = value?.[key];
  return typeof raw === 'boolean' ? raw : null;
}

function readStringArrayField(value: Record<string, unknown> | null | undefined, key: string): string[] {
  const raw = value?.[key];
  return Array.isArray(raw) ? raw.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0) : [];
}

function readFirstStringFromArray(value: unknown): string | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const first = value.find((entry) => typeof entry === 'string' && entry.trim());
  return typeof first === 'string' ? first : null;
}
