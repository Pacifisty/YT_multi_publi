import type { AuthFetch } from '../../../../../lib/auth-client';
import {
  buildCampaignComposerPage,
  submitCampaignComposerDraft,
  type CampaignComposerDraftSubmitResult,
  type CampaignComposerPageView,
} from '../composer-page';
import type { CampaignWizardDraftSubmissionInput } from '../../../../../components/campaigns/campaign-wizard';

export interface CampaignComposerRouteView {
  route: '/workspace/campanhas/nova';
  backHref: '/workspace/campanhas';
  loadState: 'ready' | 'blocked' | 'error';
  blockingReason?: 'missing_videos' | 'missing_active_channels';
  loadMessage?: string;
  statusKind?: 'ready' | 'blocked' | 'error';
  statusTone?: 'neutral' | 'warning' | 'error';
  statusMessage?: string;
  statusDetail?: string;
  ctaLayout?: 'primary_only' | 'primary_secondary';
  primaryCta?:
    | {
      kind: 'save_draft';
      label: 'Save draft';
      pendingLabel: 'Saving draft...';
    }
    | {
      kind: 'open_media_library';
      label: 'Open media library';
      href: '/workspace/media';
    }
    | {
      kind: 'manage_channels';
      label: 'Manage channels';
      href: '/workspace/accounts';
    }
    | {
      kind: 'back_to_campaigns';
      label: 'Back to campaigns';
      href: '/workspace/campanhas';
    };
  secondaryCta?: {
    kind: 'cancel_composer';
    label: 'Cancel';
    href: '/workspace/campanhas';
  };
  actions: {
    cancelHref: '/workspace/campanhas';
    submitDraft?: {
      kind: 'save_draft';
      label: 'Save draft';
      pendingLabel: 'Saving draft...';
      successRedirectPattern: '/workspace/campanhas/:campaignId';
      disabledState?: 'missing_videos' | 'missing_active_channels';
      disabledReason?: string;
    };
  };
  page?: CampaignComposerPageView;
  errorState?: {
    heading: string;
    body: string;
    cta: string;
  };
}

type CampaignComposerRouteStatusView = Pick<
  CampaignComposerRouteView,
  | 'loadState'
  | 'blockingReason'
  | 'loadMessage'
  | 'statusKind'
  | 'statusTone'
  | 'statusMessage'
  | 'statusDetail'
  | 'ctaLayout'
  | 'primaryCta'
  | 'secondaryCta'
>;

type CampaignComposerRouteActionsView = CampaignComposerRouteView['actions'];
type CampaignComposerRouteErrorStateView = NonNullable<CampaignComposerRouteView['errorState']>;

function getCampaignComposerSubmitDisabledState(
  page: CampaignComposerPageView,
): 'missing_videos' | 'missing_active_channels' | undefined {
  if (!page.emptyState) {
    return undefined;
  }

  if (page.emptyState.heading === 'No videos available') {
    return 'missing_videos';
  }

  if (page.emptyState.heading === 'No active channels available') {
    return 'missing_active_channels';
  }

  return undefined;
}

export function buildCampaignComposerRouteStatus(options: {
  page?: CampaignComposerPageView;
  error?: string;
}): CampaignComposerRouteStatusView {
  if (options.error) {
    return {
      loadState: 'error',
      blockingReason: undefined,
      loadMessage: options.error,
      statusKind: 'error',
      statusTone: 'error',
      statusMessage: 'Campaign composer unavailable',
      statusDetail: options.error,
      ctaLayout: 'primary_only',
      primaryCta: {
        kind: 'back_to_campaigns',
        label: 'Back to campaigns',
        href: '/workspace/campanhas',
      },
      secondaryCta: undefined,
    };
  }

  const page = options.page;
  if (!page) {
    return {
      loadState: 'error',
      blockingReason: undefined,
      loadMessage: 'Campaign composer unavailable',
      statusKind: 'error',
      statusTone: 'error',
      statusMessage: 'Campaign composer unavailable',
      statusDetail: 'Campaign composer data is unavailable.',
      ctaLayout: 'primary_only',
      primaryCta: {
        kind: 'back_to_campaigns',
        label: 'Back to campaigns',
        href: '/workspace/campanhas',
      },
      secondaryCta: undefined,
    };
  }

  const blockingReason = getCampaignComposerSubmitDisabledState(page);
  if (blockingReason === 'missing_videos') {
    return {
      loadState: 'blocked',
      blockingReason,
      loadMessage: 'No videos available',
      statusKind: 'blocked',
      statusTone: 'warning',
      statusMessage: 'No videos available',
      statusDetail: page.emptyState?.body ?? 'Upload a video in Media before creating a campaign.',
      ctaLayout: 'primary_secondary',
      primaryCta: {
        kind: 'open_media_library',
        label: 'Open media library',
        href: '/workspace/media',
      },
      secondaryCta: {
        kind: 'cancel_composer',
        label: 'Cancel',
        href: '/workspace/campanhas',
      },
    };
  }

  if (blockingReason === 'missing_active_channels') {
    return {
      loadState: 'blocked',
      blockingReason,
      loadMessage: 'No active channels available',
      statusKind: 'blocked',
      statusTone: 'warning',
      statusMessage: 'No active channels available',
      statusDetail: page.emptyState?.body ?? 'Activate at least one YouTube channel before creating a campaign.',
      ctaLayout: 'primary_secondary',
      primaryCta: {
        kind: 'manage_channels',
        label: 'Manage channels',
        href: '/workspace/accounts',
      },
      secondaryCta: {
        kind: 'cancel_composer',
        label: 'Cancel',
        href: '/workspace/campanhas',
      },
    };
  }

  return {
    loadState: 'ready',
    blockingReason: undefined,
    loadMessage: 'Campaign composer is ready',
    statusKind: 'ready',
    statusTone: 'neutral',
    statusMessage: 'Campaign composer is ready',
    statusDetail: 'Videos and active channels are available.',
    ctaLayout: 'primary_secondary',
    primaryCta: {
      kind: 'save_draft',
      label: 'Save draft',
      pendingLabel: 'Saving draft...',
    },
    secondaryCta: {
      kind: 'cancel_composer',
      label: 'Cancel',
      href: '/workspace/campanhas',
    },
  };
}

export function buildCampaignComposerRouteActions(options: {
  page?: CampaignComposerPageView;
}): CampaignComposerRouteActionsView {
  const page = options.page;
  if (!page) {
    return {
      cancelHref: '/workspace/campanhas',
      submitDraft: undefined,
    };
  }

  return {
    cancelHref: '/workspace/campanhas',
    submitDraft: {
      kind: 'save_draft',
      label: page.actions.saveDraftLabel,
      pendingLabel: 'Saving draft...',
      successRedirectPattern: '/workspace/campanhas/:campaignId',
      disabledState: getCampaignComposerSubmitDisabledState(page),
      disabledReason: page.emptyState?.heading,
    },
  };
}

export function buildCampaignComposerRouteErrorState(options: {
  error?: string;
}): CampaignComposerRouteErrorStateView {
  return {
    heading: 'Campaign composer unavailable',
    body: options.error ?? 'Campaign composer data is unavailable.',
    cta: 'Back to campaigns',
  };
}

export function buildCampaignComposerRouteView(options: {
  page?: CampaignComposerPageView;
  error?: string;
}): CampaignComposerRouteView {
  const view: CampaignComposerRouteView = {
    route: '/workspace/campanhas/nova',
    backHref: '/workspace/campanhas',
    loadState: 'error',
    blockingReason: undefined,
    loadMessage: undefined,
    statusKind: undefined,
    statusTone: undefined,
    statusMessage: undefined,
    statusDetail: undefined,
    ctaLayout: undefined,
    primaryCta: undefined,
    secondaryCta: undefined,
    actions: buildCampaignComposerRouteActions({}),
  };

  if (options.error) {
    Object.assign(view, buildCampaignComposerRouteStatus({ error: options.error }));
    view.errorState = buildCampaignComposerRouteErrorState({ error: options.error });
    return view;
  }

  if (options.page) {
    view.page = options.page;
    Object.assign(view, buildCampaignComposerRouteStatus({ page: options.page }));
    view.actions = buildCampaignComposerRouteActions({ page: options.page });
  }

  return view;
}

export function buildCampaignComposerSubmitErrorState(
  result: Extract<CampaignComposerDraftSubmitResult, { ok: false }>,
): {
  stage: 'create_campaign' | 'add_targets';
  nextStep: 'retry_submit' | 'review_channels';
  heading: string;
  body: string;
  cta: string;
} {
  if (result.stage === 'create_campaign') {
    return {
      stage: result.stage,
      nextStep: 'retry_submit',
      heading: 'Campaign draft could not be created',
      body: result.error,
      cta: 'Try again',
    };
  }

  return {
    stage: result.stage,
    nextStep: 'review_channels',
    heading: 'Campaign targets could not be saved',
    body: result.error,
    cta: 'Review channels',
  };
}

export function buildCampaignComposerSubmitSuccessState(
  result: Extract<CampaignComposerDraftSubmitResult, { ok: true }>,
): {
  nextStep: 'open_campaign';
  heading: string;
  body: string;
  cta: string;
  href: string;
} {
  const campaignTitle = typeof result.campaign.title === 'string' && result.campaign.title.trim()
    ? result.campaign.title.trim()
    : 'Campaign draft';

  return {
    nextStep: 'open_campaign',
    heading: 'Campaign draft saved',
    body: `${campaignTitle} is ready for review and launch setup.`,
    cta: 'Open campaign',
    href: result.redirectHref,
  };
}

type CampaignComposerSubmitStatusView =
  | {
    statusKind: 'success';
    statusTone: 'success';
    statusMessage: string;
    statusDetail: string;
    nextStep: 'open_campaign';
    ctaLayout: 'primary_secondary';
    primaryCta: {
      kind: 'open_campaign';
      label: 'Open campaign';
      href: string;
    };
    secondaryCta: {
      kind: 'back_to_campaigns';
      label: 'Back to campaigns';
      href: '/workspace/campanhas';
    };
  }
  | {
    statusKind: 'error';
    statusTone: 'error';
    statusMessage: string;
    statusDetail: string;
    nextStep: 'retry_submit' | 'review_channels';
    ctaLayout: 'primary_secondary';
    primaryCta:
      | {
        kind: 'retry_submit';
        label: 'Try again';
      }
      | {
        kind: 'review_channels';
        label: 'Review channels';
      };
    secondaryCta: {
      kind: 'back_to_campaigns';
      label: 'Back to campaigns';
      href: '/workspace/campanhas';
    };
  };

export function buildCampaignComposerSubmitStatus(
  result: CampaignComposerDraftSubmitResult,
): CampaignComposerSubmitStatusView {
  if (result.ok) {
    const successState = buildCampaignComposerSubmitSuccessState(result);
    return {
      statusKind: 'success',
      statusTone: 'success',
      statusMessage: successState.heading,
      statusDetail: successState.body,
      nextStep: successState.nextStep,
      ctaLayout: 'primary_secondary',
      primaryCta: {
        kind: 'open_campaign',
        label: successState.cta,
        href: successState.href,
      },
      secondaryCta: {
        kind: 'back_to_campaigns',
        label: 'Back to campaigns',
        href: '/workspace/campanhas',
      },
    };
  }

  const errorState = buildCampaignComposerSubmitErrorState(result);
  return {
    statusKind: 'error',
    statusTone: 'error',
    statusMessage: errorState.heading,
    statusDetail: errorState.body,
    nextStep: errorState.nextStep,
    ctaLayout: 'primary_secondary',
    primaryCta: errorState.nextStep === 'retry_submit'
      ? {
        kind: 'retry_submit',
        label: errorState.cta,
      }
      : {
        kind: 'review_channels',
        label: errorState.cta,
      },
    secondaryCta: {
      kind: 'back_to_campaigns',
      label: 'Back to campaigns',
      href: '/workspace/campanhas',
    },
  };
}

export function buildCampaignComposerSubmitView(
  result: CampaignComposerDraftSubmitResult,
):
  | (Extract<CampaignComposerDraftSubmitResult, { ok: true }> & CampaignComposerSubmitStatusView & {
    successState: ReturnType<typeof buildCampaignComposerSubmitSuccessState>;
  })
  | (Extract<CampaignComposerDraftSubmitResult, { ok: false }> & CampaignComposerSubmitStatusView & {
    errorState: ReturnType<typeof buildCampaignComposerSubmitErrorState>;
  }) {
  if (result.ok) {
    return {
      ...result,
      ...buildCampaignComposerSubmitStatus(result),
      successState: buildCampaignComposerSubmitSuccessState(result),
    };
  }

  return {
    ...result,
    ...buildCampaignComposerSubmitStatus(result),
    errorState: buildCampaignComposerSubmitErrorState(result),
  };
}

export function buildCampaignComposerSubmitModel(
  result: CampaignComposerDraftSubmitResult,
):
  | (Extract<CampaignComposerDraftSubmitResult, { ok: true }> & CampaignComposerSubmitStatusView & {
    successState: ReturnType<typeof buildCampaignComposerSubmitSuccessState>;
  })
  | (Extract<CampaignComposerDraftSubmitResult, { ok: false }> & CampaignComposerSubmitStatusView & {
    errorState: ReturnType<typeof buildCampaignComposerSubmitErrorState>;
  }) {
  return buildCampaignComposerSubmitView(result);
}

export async function buildCampaignComposerRoute(options?: {
  fetcher?: AuthFetch;
}): Promise<CampaignComposerRouteView> {
  const result = await buildCampaignComposerPage({ fetcher: options?.fetcher });
  if (result.error) {
    return buildCampaignComposerRouteView({ error: result.error });
  }

  return buildCampaignComposerRouteView({ page: result.page });
}

export async function submitCampaignComposerRouteDraft(options: {
  draft: CampaignWizardDraftSubmissionInput;
  fetcher?: AuthFetch;
}): Promise<CampaignComposerDraftSubmitResult> {
  return submitCampaignComposerDraft(options);
}
