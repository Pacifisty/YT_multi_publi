import { buildCampaignDetailView, type CampaignDetailData, type CampaignDetailView } from '../../../../components/campaigns/campaign-detail';
import { campaignsApiClient, type CampaignAuditEvent, type CampaignAuditEventType, type CampaignStatusData, type CampaignTargetJob } from '../../../../lib/campaigns-client';
import type { AuthFetch } from '../../../../lib/auth-client';

const SYSTEM_AUDIT_ACTOR_EMAIL = 'system@internal';

export interface CampaignDetailAuditSummary {
  totalEvents: number;
  operatorEventCount: number;
  systemEventCount: number;
  lastEventType: CampaignAuditEventType;
  lastActorEmail: string;
  lastCreatedAt: string;
}

export interface CampaignDetailAuditTimelineEntry {
  id: string;
  eventType: CampaignAuditEventType;
  actorEmail: string;
  targetId: string | null;
  createdAt: string;
}

export interface CampaignDetailPageData {
  campaign: CampaignDetailData;
  liveStatus?: CampaignStatusData;
  targetJobs?: Record<string, CampaignTargetJob[]>;
  auditEvents?: CampaignAuditEvent[];
}

export interface CampaignDetailPageView {
  detail: CampaignDetailView;
  polling: {
    enabled: boolean;
    intervalMs: number;
    nextScheduledAt: string | null;
  };
  targetHistory?: Array<{
    targetId: string;
    jobs: Array<{
      id: string;
      status: CampaignTargetJob['status'];
      attempt: number;
      startedAt: string | null;
      completedAt: string | null;
      errorMessage: string | null;
      youtubeVideoId: string | null;
    }>;
  }>;
  postUploadWarnings?: {
    count: number;
    targetIds: string[];
  };
  auditSummary?: CampaignDetailAuditSummary;
  auditTimeline?: CampaignDetailAuditTimelineEntry[];
}

export interface CampaignDetailPageLoadResult {
  page?: CampaignDetailPageView;
  error?: string;
}

function mergeCampaignWithLiveStatus(campaign: CampaignDetailData, liveStatus?: CampaignStatusData): CampaignDetailData {
  if (!liveStatus) {
    return campaign;
  }

  const targets = campaign.targets.map((target) => {
    const liveTarget = liveStatus.targets.find((entry) => entry.targetId === target.id);
    if (!liveTarget) {
      return target;
    }

    return {
      ...target,
      videoTitle: liveTarget.videoTitle,
      status: liveTarget.status as CampaignDetailData['targets'][number]['status'],
      publishAt: liveTarget.publishAt,
      scheduledPending: liveTarget.scheduledPending,
      youtubeVideoId: liveTarget.youtubeVideoId,
      errorMessage: liveTarget.errorMessage,
      reauthRequired: liveTarget.reauthRequired,
      hasPostUploadWarning: liveTarget.hasPostUploadWarning,
      reviewYoutubeUrl: liveTarget.reviewYoutubeUrl,
    };
  });

  return {
    ...campaign,
    status: liveStatus.campaignStatus,
    targets,
  };
}

export function buildCampaignDetailPageView(
  data: CampaignDetailPageData,
  options: { now?: () => Date } = {},
): CampaignDetailPageView {
  const mergedCampaign = mergeCampaignWithLiveStatus(data.campaign, data.liveStatus);
  const detail = buildCampaignDetailView(mergedCampaign, { now: options.now });
  const warningTargets = detail.targets.filter((target) => Boolean(target.partialFailureYoutubeUrl));
  const targetHistory = detail.targets
    .map((target) => ({
      targetId: target.id,
      jobs: (data.targetJobs?.[target.id] ?? []).map((job) => ({
        id: job.id,
        status: job.status,
        attempt: job.attempt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        errorMessage: job.errorMessage,
        youtubeVideoId: job.youtubeVideoId,
      })),
    }))
    .filter((entry) => entry.jobs.length > 0);

  const view: CampaignDetailPageView = {
    detail,
    polling: {
      enabled: data.liveStatus?.shouldPoll ?? detail.pollingEnabled,
      intervalMs: detail.pollingIntervalMs,
      nextScheduledAt: data.liveStatus?.nextScheduledAt ?? detail.nextScheduledAt,
    },
  };

  if (targetHistory.length > 0) {
    view.targetHistory = targetHistory;
  }

  if (warningTargets.length > 0) {
    view.postUploadWarnings = {
      count: warningTargets.length,
      targetIds: warningTargets.map((target) => target.id),
    };
  }

  if ((data.auditEvents?.length ?? 0) > 0) {
    const [latestEvent] = data.auditEvents!;
    view.auditSummary = {
      totalEvents: data.auditEvents!.length,
      operatorEventCount: data.auditEvents!.filter((event) => event.actorEmail !== SYSTEM_AUDIT_ACTOR_EMAIL).length,
      systemEventCount: data.auditEvents!.filter((event) => event.actorEmail === SYSTEM_AUDIT_ACTOR_EMAIL).length,
      lastEventType: latestEvent.eventType,
      lastActorEmail: latestEvent.actorEmail,
      lastCreatedAt: latestEvent.createdAt,
    };
    view.auditTimeline = data.auditEvents!.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      actorEmail: event.actorEmail,
      targetId: event.targetId,
      createdAt: event.createdAt,
    }));
  }

  return view;
}

export async function buildCampaignDetailPage(
  options: { campaignId: string; fetcher?: AuthFetch; now?: () => Date },
): Promise<CampaignDetailPageLoadResult> {
  const client = campaignsApiClient(options.fetcher ?? globalThis.fetch as AuthFetch);
  const campaignResult = await client.getCampaign(options.campaignId);

  if (!campaignResult.ok) {
    return { error: campaignResult.error };
  }

  const hasTargets = (campaignResult.campaign.targets?.length ?? 0) > 0;
  const statusPromise = client.getStatus(options.campaignId);
  const campaignJobsPromise = hasTargets
    ? client.getCampaignJobs(options.campaignId)
    : Promise.resolve(undefined);
  const auditPromise = client.getCampaignAudit(options.campaignId);
  const [statusResult, campaignJobsResult, auditResult] = await Promise.allSettled([
    statusPromise,
    campaignJobsPromise,
    auditPromise,
  ]);
  const liveStatus = statusResult.status === 'fulfilled' && statusResult.value.ok
    ? statusResult.value.data
    : undefined;
  const targetJobs = campaignJobsResult.status === 'fulfilled' && campaignJobsResult.value?.ok
    ? campaignJobsResult.value.jobsByTarget
    : undefined;
  const auditEvents = auditResult.status === 'fulfilled' && auditResult.value.ok
    ? auditResult.value.events
    : undefined;

  return {
    page: buildCampaignDetailPageView({
      campaign: campaignResult.campaign as CampaignDetailData,
      liveStatus,
      targetJobs,
      auditEvents,
    }, { now: options.now }),
  };
}
