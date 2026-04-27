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
import { SessionGuard } from './auth/session.guard';

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
}

export function createApp(config: AppConfig = {}): AppInstance {
  const publicMediaUrlService = createPublicMediaUrlService(config.env);
  const authModule = createAuthModule({
    env: config.env,
    ...config.authModuleOptions,
  });
  const accountPlanService = new AccountPlanService({
    store: config.accountPlanStore,
  });
  const accountPlanController = new AccountPlanController(
    accountPlanService,
    new SessionGuard({ allowPendingPlanSelection: true }),
    authModule.authController,
  );
  const accountsModule = createAccountsModule(config.accountsModuleOptions);
  const campaignsModule = createCampaignsModule({
    ...config.campaignsModuleOptions,
    accountPlanService,
    getAccessTokenForChannel: (channelId, options) =>
      accountsModule.accountsService.resolveAccessTokenForChannel(channelId, options),
  });
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
        throw new Error('PUBLIC_APP_URL is required for TikTok publishing.');
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
  });

  async function handleRequest(request: HttpRequest): Promise<HttpResponse> {
    // Delegate all routes to the unified API router
    const apiResult = await router.handle({
      method: request.method,
      path: request.path,
      session: request.session,
      body: request.body,
      query: request.query,
    });

    return { status: apiResult.status, body: apiResult.body, cookies: apiResult.cookies, redirect: (apiResult as any).redirect };
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
  };
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
