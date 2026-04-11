import type { AdminSession } from './auth/session.guard';
import type { CampaignsModuleInstance } from './campaigns/campaigns.module';
import type { CampaignsRequest } from './campaigns/campaigns.controller';
import type { AccountsController, AccountsRequest } from './accounts/accounts.controller';
import type { MediaController, MediaRequest } from './media/media.controller';
import type { UploadProgressService } from './campaigns/upload-progress.service';
import type { AuthController } from './auth/auth.controller';

export interface ApiRequest {
  method: string;
  path: string;
  session: AdminSession | null;
  body?: unknown;
  query?: Record<string, string>;
}

export interface ApiResponse {
  status: number;
  body: any;
  cookies?: any[];
}

interface Route {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: (request: any) => Promise<{ status: number; body: any; cookies?: any[] }> | { status: number; body: any; cookies?: any[] };
}

export interface ApiRouter {
  handle(request: ApiRequest): Promise<ApiResponse>;
}

export function createApiRouter(options: {
  campaignsModule: CampaignsModuleInstance;
  accountsController?: AccountsController;
  mediaController?: MediaController;
  uploadProgressService?: UploadProgressService;
  authController?: AuthController;
}): ApiRouter {
  const { campaignsModule, accountsController, mediaController, uploadProgressService, authController } = options;
  const ctrl = campaignsModule.campaignsController;

  const routes: Route[] = [];

  // Auth routes
  if (authController) {
    routes.push(
      {
        method: 'POST',
        pattern: /^\/auth\/login$/,
        paramNames: [],
        handler: (req) => authController.login(req),
      },
      {
        method: 'POST',
        pattern: /^\/auth\/logout$/,
        paramNames: [],
        handler: (req) => authController.logout(req),
      },
      {
        method: 'GET',
        pattern: /^\/auth\/me$/,
        paramNames: [],
        handler: (req) => authController.me(req),
      },
    );
  }

  // Campaign routes
  routes.push(
    {
      method: 'GET',
      pattern: /^\/api\/dashboard$/,
      paramNames: [],
      handler: (req) => ctrl.getDashboard(req),
    },
    {
      method: 'DELETE',
      pattern: /^\/api\/campaigns\/([^/]+)\/targets\/([^/]+)$/,
      paramNames: ['id', 'targetId'],
      handler: (req) => ctrl.removeTarget(req),
    },
    {
      method: 'PATCH',
      pattern: /^\/api\/campaigns\/([^/]+)\/targets\/([^/]+)$/,
      paramNames: ['id', 'targetId'],
      handler: (req) => ctrl.updateTarget(req),
    },
    {
      method: 'POST',
      pattern: /^\/api\/campaigns\/([^/]+)\/targets\/([^/]+)\/retry$/,
      paramNames: ['id', 'targetId'],
      handler: (req) => ctrl.retryTarget(req),
    },
    {
      method: 'GET',
      pattern: /^\/api\/campaigns\/([^/]+)\/targets\/([^/]+)\/jobs$/,
      paramNames: ['id', 'targetId'],
      handler: (req) => ctrl.getTargetJobs(req),
    },
    {
      method: 'POST',
      pattern: /^\/api\/campaigns\/([^/]+)\/targets$/,
      paramNames: ['id'],
      handler: (req) => ctrl.addTarget(req),
    },
    {
      method: 'POST',
      pattern: /^\/api\/campaigns\/([^/]+)\/targets\/bulk$/,
      paramNames: ['id'],
      handler: (req) => ctrl.addTargetsBulk(req),
    },
    {
      method: 'POST',
      pattern: /^\/api\/campaigns\/([^/]+)\/ready$/,
      paramNames: ['id'],
      handler: (req) => ctrl.markReady(req),
    },
    {
      method: 'POST',
      pattern: /^\/api\/campaigns\/([^/]+)\/launch$/,
      paramNames: ['id'],
      handler: (req) => ctrl.launch(req),
    },
    {
      method: 'GET',
      pattern: /^\/api\/campaigns\/([^/]+)\/status$/,
      paramNames: ['id'],
      handler: (req) => ctrl.getStatus(req),
    },
    {
      method: 'GET',
      pattern: /^\/api\/campaigns\/([^/]+)\/jobs$/,
      paramNames: ['id'],
      handler: (req) => ctrl.getCampaignJobs(req),
    },
    {
      method: 'GET',
      pattern: /^\/api\/campaigns\/([^/]+)\/audit$/,
      paramNames: ['id'],
      handler: (req) => ctrl.getCampaignAudit(req),
    },
    {
      method: 'GET',
      pattern: /^\/api\/campaigns\/([^/]+)$/,
      paramNames: ['id'],
      handler: (req) => ctrl.getById(req),
    },
    {
      method: 'PATCH',
      pattern: /^\/api\/campaigns\/([^/]+)$/,
      paramNames: ['id'],
      handler: (req) => ctrl.update(req),
    },
    {
      method: 'DELETE',
      pattern: /^\/api\/campaigns\/([^/]+)$/,
      paramNames: ['id'],
      handler: (req) => ctrl.deleteCampaign(req),
    },
    {
      method: 'POST',
      pattern: /^\/api\/campaigns\/([^/]+)\/clone$/,
      paramNames: ['id'],
      handler: (req) => ctrl.clone(req),
    },
    {
      method: 'POST',
      pattern: /^\/api\/campaigns$/,
      paramNames: [],
      handler: (req) => ctrl.create(req),
    },
    {
      method: 'GET',
      pattern: /^\/api\/campaigns$/,
      paramNames: [],
      handler: (req) => ctrl.list(req),
    },
  );

  // Account routes
  if (accountsController) {
    routes.push(
      {
        method: 'GET',
        pattern: /^\/api\/accounts\/oauth\/google\/start$/,
        paramNames: [],
        handler: (req: AccountsRequest) => accountsController.startGoogleOauth(req),
      },
      {
        method: 'GET',
        pattern: /^\/api\/accounts\/oauth\/google\/callback$/,
        paramNames: [],
        handler: (req: AccountsRequest) => accountsController.handleGoogleOauthCallback(req),
      },
      {
        method: 'PATCH',
        pattern: /^\/api\/accounts\/([^/]+)\/channels\/([^/]+)$/,
        paramNames: ['accountId', 'channelId'],
        handler: (req: AccountsRequest) => accountsController.toggleChannel(req),
      },
      {
        method: 'GET',
        pattern: /^\/api\/accounts\/([^/]+)\/channels$/,
        paramNames: ['accountId'],
        handler: (req: AccountsRequest) => accountsController.getChannels(req),
      },
      {
        method: 'GET',
        pattern: /^\/api\/accounts\/([^/]+)$/,
        paramNames: ['accountId'],
        handler: (req: AccountsRequest) => accountsController.getAccount(req),
      },
      {
        method: 'DELETE',
        pattern: /^\/api\/accounts\/([^/]+)$/,
        paramNames: ['accountId'],
        handler: (req: AccountsRequest) => accountsController.disconnectAccount(req),
      },
      {
        method: 'GET',
        pattern: /^\/api\/accounts$/,
        paramNames: [],
        handler: (req: AccountsRequest) => accountsController.listAccounts(req),
      },
    );
  }

  // Media routes
  if (mediaController) {
    routes.push(
      {
        method: 'POST',
        pattern: /^\/api\/media$/,
        paramNames: [],
        handler: (req: MediaRequest) => mediaController.createAsset(req),
      },
      {
        method: 'POST',
        pattern: /^\/api\/media\/([^/]+)\/link-thumbnail$/,
        paramNames: ['id'],
        handler: (req: MediaRequest) => mediaController.linkThumbnail(req),
      },
      {
        method: 'GET',
        pattern: /^\/api\/media\/([^/]+)$/,
        paramNames: ['id'],
        handler: (req: MediaRequest) => mediaController.getAsset(req),
      },
      {
        method: 'DELETE',
        pattern: /^\/api\/media\/([^/]+)$/,
        paramNames: ['id'],
        handler: (req: MediaRequest) => mediaController.deleteAsset(req),
      },
      {
        method: 'GET',
        pattern: /^\/api\/media$/,
        paramNames: [],
        handler: (req: MediaRequest) => mediaController.listAssets(req),
      },
    );
  }

  // Upload progress routes
  if (uploadProgressService) {
    routes.push(
      {
        method: 'GET',
        pattern: /^\/api\/jobs\/([^/]+)\/progress$/,
        paramNames: ['jobId'],
        handler: (req: { session: AdminSession | null; params: Record<string, string> }) => {
          if (!req.session?.adminUser) {
            return { status: 401, body: { error: 'Authentication required.' } };
          }
          const progress = uploadProgressService.getProgress(req.params.jobId);
          if (!progress) {
            return { status: 404, body: { error: 'No progress tracking for this job.' } };
          }
          return { status: 200, body: { progress } };
        },
      },
      {
        method: 'GET',
        pattern: /^\/api\/campaigns\/([^/]+)\/upload-progress$/,
        paramNames: ['campaignId'],
        handler: (req: { session: AdminSession | null; body?: unknown }) => {
          if (!req.session?.adminUser) {
            return { status: 401, body: { error: 'Authentication required.' } };
          }
          const body = req.body as Record<string, unknown> | undefined;
          if (!body || !Array.isArray(body.jobIds)) {
            return { status: 400, body: { error: 'Request body must include jobIds array.' } };
          }
          const aggregate = uploadProgressService.getAggregateProgress(body.jobIds as string[]);
          return { status: 200, body: { aggregate } };
        },
      },
    );
  }

  return {
    async handle(request: ApiRequest): Promise<ApiResponse> {
      for (const route of routes) {
        if (request.method !== route.method) continue;

        const match = route.pattern.exec(request.path);
        if (!match) continue;

        const params: Record<string, string> = {};
        route.paramNames.forEach((name, i) => {
          params[name] = match[i + 1];
        });

        const controllerRequest = {
          session: request.session,
          body: request.body,
          params,
          query: request.query,
        };

        const result = await route.handler(controllerRequest);
        return { status: result.status, body: result.body, cookies: result.cookies };
      }

      return { status: 404, body: { error: 'Not found' } };
    },
  };
}
