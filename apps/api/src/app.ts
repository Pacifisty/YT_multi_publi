import { createRequire } from 'node:module';
import type { AdminSession } from './auth/session.guard';
import type { AuthModuleInstance } from './auth/auth.module';
import { createAuthModule } from './auth/auth.module';
import type { AuthServiceOptions } from './auth/auth.service';
import type { CampaignsModuleInstance, CampaignsModuleOptions } from './campaigns/campaigns.module';
import { createCampaignsModule } from './campaigns/campaigns.module';
import type { AccountsModuleInstance } from './accounts/accounts.module';
import { createAccountsModule } from './accounts/accounts.module';
import type { AccountsServiceOptions } from './accounts/accounts.service';
import type { MediaModuleInstance } from './media/media.module';
import { createMediaModule } from './media/media.module';
import type { MediaModuleOptions } from './media/media.module';
import { createApiRouter, type ApiRouter, type ApiResponse } from './router';
import { createIntegratedWorker } from './campaigns/integrated-worker';
import { youtubeResumableUpload } from './campaigns/youtube-upload.worker';
import { ResilientJobRunner } from './campaigns/resilient-job-runner';
import { ScheduledLaunchChecker } from './campaigns/scheduled-launch-checker';
import { PublicMediaUrlService } from './media/public-media-url.service';
import { AccountPlanService, type AccountPlanStore } from './account-plan/account-plan.service';
import { AccountPlanController } from './account-plan/account-plan.controller';
import { PaymentService } from './account-plan/payment.service';
import { MercadoPagoPaymentProviderAdapter } from './account-plan/mercadopago-payment.adapter';
import type { WebhookDeduplicator } from './account-plan/webhook-deduplication';
import { validatePaymentConfig } from './startup/payment-startup-validator';
import { SessionGuard } from './auth/session.guard';
import { EmailService, selectEmailProvider } from './integrations/email/email-service';
import { GrowthScriptController } from './growth/growth-script.controller';
import { GrowthScriptService } from './growth/growth-script.service';

const optionalRequire = createRequire(import.meta.url);

type OptionalSentry = {
  init(options: Record<string, unknown>): void;
  captureException(error: unknown, context?: Record<string, unknown>): void;
  Integrations?: Record<string, new (...args: any[]) => unknown>;
};

export interface BackgroundProcessor {
  kick(): Promise<void>;
}

export interface AppConfig {
  env?: Record<string, string | undefined>;
  authModuleOptions?: AuthServiceOptions;
  campaignsModuleOptions?: CampaignsModuleOptions;
  accountsModuleOptions?: AccountsServiceOptions;
  mediaModuleOptions?: MediaModuleOptions;
  accountPlanStore?: AccountPlanStore;
  paymentWebhookDeduplicator?: WebhookDeduplicator | null;
}

export interface HttpRequest {
  method: string;
  path: string;
  session: AdminSession | null;
  body?: unknown;
  query?: Record<string, string>;
}

export interface HttpResponse {
  status: number;
  body: any;
  cookies?: any[];
  redirect?: string;
}

export interface AppInstance {
  handleRequest(request: HttpRequest): Promise<HttpResponse>;
  authModule: AuthModuleInstance;
  campaignsModule: CampaignsModuleInstance;
  accountsModule: AccountsModuleInstance;
  mediaModule: MediaModuleInstance;
  router: ApiRouter;
  backgroundProcessor: BackgroundProcessor | null;
  publicMediaUrlService?: PublicMediaUrlService;
  accountPlanService: AccountPlanService;
  accountPlanController: AccountPlanController;
  growthScriptController: GrowthScriptController;
}

/**
 * Creates the application instance.
 * May throw Error if payment config is invalid in production.
 * Initializes Sentry error tracking if SENTRY_DSN is configured.
 */
export function createApp(config: AppConfig = {}): AppInstance {
  const env = config.env ?? process.env;
  const nodeEnv = (env.NODE_ENV ?? 'development') as string;
  const sentry = env.SENTRY_DSN && nodeEnv === 'production'
    ? loadOptionalSentry()
    : null;

  // Initialize Sentry error tracking (only if DSN is configured)
  if (sentry) {
    const integrations = createSentryIntegrations(sentry);
    sentry.init({
      dsn: env.SENTRY_DSN,
      environment: nodeEnv,
      tracesSampleRate: 1.0,
      ...(integrations.length > 0 ? { integrations } : {}),
    });
    console.log('[api] Sentry error tracking initialized');
  } else if (env.SENTRY_DSN && nodeEnv === 'production') {
    console.warn('[api] WARNING: SENTRY_DSN configured, but @sentry/node is not installed. Error tracking is disabled.');
  } else if (nodeEnv === 'production') {
    console.warn('[api] WARNING: SENTRY_DSN not configured. Error tracking is disabled.');
  }

  // Validate payment config early; abort startup if critical vars missing
  validatePaymentConfig(env as Record<string, string | undefined>, nodeEnv);

  const publicMediaUrlService = createPublicMediaUrlService(config.env);
  const authModule = createAuthModule({
    env: config.env,
    ...config.authModuleOptions,
  });
  const accountPlanService = new AccountPlanService({
    store: config.accountPlanStore,
  });
  const mercadopagoAccessToken = config.env?.MERCADOPAGO_ACCESS_TOKEN;
  const MERCADOPAGO_TIMEOUT_MS = 10000;
  const paymentProvider = mercadopagoAccessToken
    ? new MercadoPagoPaymentProviderAdapter({
        accessToken: mercadopagoAccessToken,
        webhookSecret: config.env?.MERCADOPAGO_WEBHOOK_SECRET,
        timeoutMs: MERCADOPAGO_TIMEOUT_MS,
      })
    : undefined;
  const paymentProviderName = paymentProvider?.name ?? 'mock';
  const paymentWebhookDeduplicator = config.paymentWebhookDeduplicator ?? null;
  console.log(`[api] payment provider: ${paymentProviderName}`);
  console.log(`[api] mercadopago api timeout: ${MERCADOPAGO_TIMEOUT_MS}ms`);
  console.log(`[api] webhook deduplication: ${paymentWebhookDeduplicator ? 'enabled' : 'disabled (no persistent deduplicator configured)'}`);

  // Initialize email service
  const emailProvider = selectEmailProvider();
  const emailService = new EmailService({ provider: emailProvider });
  const emailProviderType = config.env?.EMAIL_PROVIDER || 'mock';
  console.log(`[api] email provider: ${emailProviderType}`);

  const paymentService = new PaymentService({
    provider: paymentProvider,
    webhookDeduplicator: paymentWebhookDeduplicator,
    emailService,
    accountPlanService,
    defaultSuccessUrl: config.env?.PAYMENT_SUCCESS_URL,
    defaultCancelUrl: config.env?.PAYMENT_CANCEL_URL,
    defaultNotificationUrl: config.env?.PAYMENT_WEBHOOK_URL,
  });
  const accountPlanController = new AccountPlanController(
    accountPlanService,
    new SessionGuard({ allowPendingPlanSelection: true }),
    authModule.authController,
    paymentService,
  );
  const accountsModule = createAccountsModule(config.accountsModuleOptions);
  const campaignsModule = createCampaignsModule({
    ...config.campaignsModuleOptions,
    accountPlanService,
    emailService,
    getAccessTokenForChannel: (channelId, options) =>
      accountsModule.accountsService.resolveAccessTokenForChannel(channelId, options),
  });
  const growthScriptController = new GrowthScriptController(
    new GrowthScriptService({
      dashboardService: campaignsModule.dashboardService,
      campaignService: campaignsModule.campaignService,
      accountsService: accountsModule.accountsService,
    }),
    new SessionGuard(),
  );
  const mediaModule = createMediaModule(config.mediaModuleOptions);
  let processingQueue = false;

  const integratedWorker = createIntegratedWorker({
    campaignService: campaignsModule.campaignService,
    jobService: campaignsModule.jobService,
    auditService: campaignsModule.auditService,
    uploadFn: youtubeResumableUpload,
    channelTokenResolver: {
      resolve: (channelId, options) =>
        accountsModule.accountsService.resolveAccessTokenForChannel(channelId, options).then((accessToken) => ({ accessToken })),
    },
    videoFileResolver: {
      resolve: async (videoAssetId) => {
        const asset = await mediaModule.mediaService.getAsset(videoAssetId);
        if (!asset) {
          throw new Error(`Media asset not found: ${videoAssetId}`);
        }
        if (asset.asset_type !== 'video') {
          throw new Error(`Media asset ${videoAssetId} is not a video asset`);
        }
        return asset.storage_path;
      },
    },
    thumbnailFileResolver: {
      resolve: async (thumbnailAssetId) => {
        const asset = await mediaModule.mediaService.getAsset(thumbnailAssetId);
        if (!asset) {
          throw new Error(`Thumbnail asset not found: ${thumbnailAssetId}`);
        }
        if (asset.asset_type !== 'thumbnail') {
          throw new Error(`Media asset ${thumbnailAssetId} is not a thumbnail asset`);
        }
        return asset.storage_path;
      },
    },
    getAccessTokenForConnectedAccount: (connectedAccountId) =>
      accountsModule.accountsService.resolveAccessTokenForConnectedAccount(connectedAccountId),
    getPublicVideoUrl: async (videoAssetId) => {
      if (!publicMediaUrlService) {
        throw new Error('PUBLIC_APP_URL is required for TikTok and Instagram publishing.');
      }

      const asset = await mediaModule.mediaService.getAsset(videoAssetId);
      if (!asset) {
        throw new Error(`Media asset not found: ${videoAssetId}`);
      }
      if (asset.asset_type !== 'video') {
        throw new Error(`Media asset ${videoAssetId} is not a video asset`);
      }

      return publicMediaUrlService.createUrl(videoAssetId);
    },
  });
  const scheduledLaunchChecker = new ScheduledLaunchChecker({
    campaignService: campaignsModule.campaignService,
    launchService: campaignsModule.launchService,
  });
  const resilientJobRunner = new ResilientJobRunner({
    processNext: () => integratedWorker.worker.processNext(),
    retryJob: (jobId) => campaignsModule.jobService.retry(jobId),
  });

  const backgroundProcessor: BackgroundProcessor = {
    async kick() {
      if (processingQueue) {
        return;
      }

      processingQueue = true;
      try {
        await scheduledLaunchChecker.checkAndLaunch();
        await resilientJobRunner.processAll();
      } finally {
        processingQueue = false;
      }
    },
  };

  const router = createApiRouter({
    campaignsModule,
    authController: authModule.authController,
    accountsController: accountsModule.accountsController,
    mediaController: mediaModule.mediaController,
    playlistController: mediaModule.playlistController,
    backgroundProcessor,
    accountPlanController,
    growthScriptController,
  });

  async function handleRequest(request: HttpRequest): Promise<HttpResponse> {
    try {
      // Delegate all routes to the unified API router
      const apiResult = await router.handle({
        method: request.method,
        path: request.path,
        session: request.session,
        body: request.body,
        query: request.query,
      });

      return { status: apiResult.status, body: apiResult.body, cookies: apiResult.cookies, redirect: (apiResult as any).redirect };
    } catch (error) {
      // Capture errors in Sentry with context
      if (sentry) {
        sentry.captureException(error, {
          contexts: {
            http: {
              method: request.method,
              url: request.path,
              status_code: 500,
            },
          },
          tags: {
            component: 'handleRequest',
          },
        });
      }

      // Re-throw to maintain existing error handling behavior
      throw error;
    }
  }

  return {
    handleRequest,
    authModule,
    campaignsModule,
    accountsModule,
    mediaModule,
    router,
    backgroundProcessor,
    publicMediaUrlService,
    accountPlanService,
    accountPlanController,
    growthScriptController,
  };
}

function loadOptionalSentry(): OptionalSentry | null {
  try {
    return optionalRequire('@sentry/node') as OptionalSentry;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND') {
      return null;
    }

    throw error;
  }
}

function createSentryIntegrations(sentry: OptionalSentry): unknown[] {
  const integrations = sentry.Integrations ?? {};
  const result: unknown[] = [];

  if (typeof integrations.Http === 'function') {
    result.push(new integrations.Http({ tracing: true }));
  }
  if (typeof integrations.OnUncaughtException === 'function') {
    result.push(new integrations.OnUncaughtException());
  }
  if (typeof integrations.OnUnhandledRejection === 'function') {
    result.push(new integrations.OnUnhandledRejection());
  }

  return result;
}

function createPublicMediaUrlService(env: Record<string, string | undefined> | undefined): PublicMediaUrlService | undefined {
  if (!env?.OAUTH_TOKEN_KEY) {
    return undefined;
  }

  const baseUrl = normalizePublicBaseUrl(env);
  if (!baseUrl) {
    return undefined;
  }

  return new PublicMediaUrlService({
    baseUrl,
    secret: env.OAUTH_TOKEN_KEY,
  });
}

function normalizePublicBaseUrl(env: Record<string, string | undefined>): string | undefined {
  const explicit = env.PUBLIC_APP_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/+$/, '');
  }

  const host = env.HOST?.trim() || '127.0.0.1';
  const port = env.PORT?.trim() || '3000';
  return `http://${host}:${port}`;
}
