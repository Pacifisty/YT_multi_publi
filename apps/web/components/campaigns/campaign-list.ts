export interface CampaignListRow {
  id: string;
  title: string;
  videoAssetName: string;
  targetCount: number;
  status: string;
  createdAt: string;
  scheduledAt?: string;
  readyState?: 'scheduled' | 'immediate';
  schedulePosition?: number;
  detailHref?: string;
  reviewScheduleHref?: string;
  markReadyHref?: string;
  launchHref?: string;
  primaryAction?: {
    kind: 'review_schedule' | 'mark_ready' | 'launch_campaign' | 'reauth_accounts' | 'review_mixed_campaign' | 'review_failed_campaign' | 'review_pending_campaign';
    href: string;
  };
  reauthRequiredCount?: number;
  reauthHref?: string;
  targets?: Array<{
    status: string;
    youtubeVideoId?: string | null;
    errorMessage?: string | null;
    reauthRequired?: boolean;
  }>;
  outcomeSummary?: {
    publishedCount: number;
    failedCount: number;
    pendingCount: number;
  };
  outcomeState?: 'mixed' | 'failed' | 'pending' | 'healthy';
  outcomeAction?: {
    kind: 'review_mixed_campaign' | 'review_failed_campaign' | 'review_pending_campaign';
    href: string;
  };
  cloneHref?: string;
  deleteHref?: string;
}

export interface CampaignListView {
  columns: string[];
  rows: CampaignListRow[];
  isEmpty: boolean;
}

function isReauthRequiredTarget(target: NonNullable<CampaignListRow['targets']>[number]): boolean {
  return target.reauthRequired === true || target.errorMessage === 'REAUTH_REQUIRED';
}

export function buildCampaignListView(data: { rows: CampaignListRow[] }): CampaignListView {
  const scheduledPositions = new Map(
    data.rows
      .filter((row) => row.status === 'ready' && typeof row.scheduledAt === 'string')
      .sort((left, right) =>
        left.scheduledAt!.localeCompare(right.scheduledAt!)
        || left.id.localeCompare(right.id))
      .map((row, index) => [row.id, index + 1]),
  );

  return {
    columns: ['Title', 'Video', 'Targets', 'Status', 'Created'],
    rows: data.rows.map((row) => {
      const readyState = row.readyState ?? (row.status === 'ready'
        ? (row.scheduledAt ? 'scheduled' : 'immediate')
        : undefined);
      const schedulePosition = row.schedulePosition ?? scheduledPositions.get(row.id);
      const detailHref = row.detailHref ?? `/workspace/campanhas/${row.id}`;
      const reviewScheduleHref = row.reviewScheduleHref ?? (row.status === 'ready' && row.scheduledAt
        ? `/workspace/campanhas/${row.id}`
        : undefined);
      const markReadyHref = row.markReadyHref ?? (row.status === 'draft' && row.targetCount > 0
        ? `/api/campaigns/${row.id}/ready`
        : undefined);
      const launchHref = row.launchHref ?? (row.status === 'ready' && row.targetCount > 0
        ? `/api/campaigns/${row.id}/launch`
        : undefined);
      const outcomeSummary = row.outcomeSummary ?? (row.targets
        ? {
          publishedCount: row.targets.filter((target) =>
            target.status === 'publicado' && Boolean(target.youtubeVideoId)).length,
          failedCount: row.targets.filter((target) =>
            target.status === 'erro' && Boolean(target.errorMessage)).length,
          pendingCount: row.targets.filter((target) =>
            !((target.status === 'publicado' && Boolean(target.youtubeVideoId))
              || (target.status === 'erro' && Boolean(target.errorMessage)))).length,
        }
        : undefined);
      const reauthRequiredCount = row.reauthRequiredCount ?? (row.targets
        ? row.targets.filter((target) => isReauthRequiredTarget(target)).length
        : undefined);
      const reauthHref = row.reauthHref ?? ((reauthRequiredCount ?? 0) > 0
        ? '/workspace/accounts'
        : undefined);
      const outcomeState = row.outcomeState ?? (outcomeSummary
        ? outcomeSummary.failedCount > 0
          ? outcomeSummary.pendingCount > 0
            ? 'mixed'
            : 'failed'
          : outcomeSummary.pendingCount > 0
            ? 'pending'
            : 'healthy'
        : undefined);
      const outcomeAction = row.outcomeAction ?? (detailHref && outcomeState
        ? outcomeState === 'mixed'
          ? {
            kind: 'review_mixed_campaign' as const,
            href: detailHref,
          }
          : outcomeState === 'failed'
          ? {
            kind: 'review_failed_campaign' as const,
            href: detailHref,
          }
          : outcomeState === 'pending'
            ? {
              kind: 'review_pending_campaign' as const,
              href: detailHref,
            }
            : undefined
        : undefined);

      return {
        ...row,
        readyState,
        schedulePosition,
        detailHref,
        reviewScheduleHref,
        markReadyHref,
        launchHref,
        primaryAction: row.primaryAction
          ?? (reviewScheduleHref
            ? { kind: 'review_schedule', href: reviewScheduleHref }
            : markReadyHref
              ? { kind: 'mark_ready', href: markReadyHref }
              : launchHref
                ? { kind: 'launch_campaign', href: launchHref }
                : reauthHref
                  ? { kind: 'reauth_accounts', href: reauthHref }
                : outcomeAction),
        reauthRequiredCount,
        reauthHref,
        outcomeSummary,
        outcomeState,
        outcomeAction,
        cloneHref: row.cloneHref ?? `/api/campaigns/${row.id}/clone`,
        deleteHref: row.deleteHref ?? (row.status === 'draft' || row.status === 'ready'
        ? `/api/campaigns/${row.id}`
        : undefined),
      };
    }),
    isEmpty: data.rows.length === 0,
  };
}
