import type { AdminSession } from './auth/session.guard';
import type { AuthModuleInstance } from './auth/auth.module';
import { createAuthModule } from './auth/auth.module';
import type { CampaignsModuleInstance } from './campaigns/campaigns.module';
import { createCampaignsModule } from './campaigns/campaigns.module';
import { createApiRouter, type ApiRouter, type ApiResponse } from './router';

export interface AppConfig {
  env?: Record<string, string | undefined>;
}

export interface HttpRequest {
  method: string;
  path: string;
  session: AdminSession | null;
  body?: unknown;
}

export interface HttpResponse {
  status: number;
  body: any;
  cookies?: any[];
}

export interface AppInstance {
  handleRequest(request: HttpRequest): Promise<HttpResponse>;
  authModule: AuthModuleInstance;
  campaignsModule: CampaignsModuleInstance;
  router: ApiRouter;
}

export function createApp(config: AppConfig = {}): AppInstance {
  const authModule = createAuthModule({ env: config.env });
  const campaignsModule = createCampaignsModule();
  const router = createApiRouter({ campaignsModule });

  async function handleRequest(request: HttpRequest): Promise<HttpResponse> {
    // Auth routes
    if (request.path === '/auth/login' && request.method === 'POST') {
      const result = await authModule.authController.login({
        session: request.session,
        body: request.body as any,
      });
      return { status: result.status, body: result.body, cookies: result.cookies };
    }

    if (request.path === '/auth/logout' && request.method === 'POST') {
      const result = await authModule.authController.logout({
        session: request.session,
      });
      return { status: result.status, body: result.body, cookies: result.cookies };
    }

    if (request.path === '/auth/me' && request.method === 'GET') {
      const result = await authModule.authController.me({
        session: request.session,
      });
      return { status: result.status, body: result.body, cookies: result.cookies };
    }

    // Campaign add-target route
    const addTargetMatch = /^\/api\/campaigns\/([^/]+)\/targets$/.exec(request.path);
    if (addTargetMatch && request.method === 'POST') {
      const result = await campaignsModule.campaignsController.addTarget({
        session: request.session,
        body: request.body,
        params: { id: addTargetMatch[1] },
      });
      return { status: result.status, body: result.body };
    }

    // Campaign mark-ready route
    const readyMatch = /^\/api\/campaigns\/([^/]+)\/ready$/.exec(request.path);
    if (readyMatch && request.method === 'POST') {
      const result = await campaignsModule.campaignsController.markReady({
        session: request.session,
        body: request.body,
        params: { id: readyMatch[1] },
      });
      return { status: result.status, body: result.body };
    }

    // Campaign update route
    const updateMatch = /^\/api\/campaigns\/([^/]+)$/.exec(request.path);
    if (updateMatch && request.method === 'PATCH') {
      const result = await campaignsModule.campaignsController.update({
        session: request.session,
        body: request.body,
        params: { id: updateMatch[1] },
      });
      return { status: result.status, body: result.body };
    }

    // Delegate to the API router for remaining campaign routes
    const apiResult = await router.handle({
      method: request.method,
      path: request.path,
      session: request.session,
      body: request.body,
    });

    return { status: apiResult.status, body: apiResult.body };
  }

  return {
    handleRequest,
    authModule,
    campaignsModule,
    router,
  };
}
