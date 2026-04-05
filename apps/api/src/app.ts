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
  const router = createApiRouter({
    campaignsModule,
    authController: authModule.authController,
  });

  async function handleRequest(request: HttpRequest): Promise<HttpResponse> {
    // Delegate all routes to the unified API router
    const apiResult = await router.handle({
      method: request.method,
      path: request.path,
      session: request.session,
      body: request.body,
    });

    return { status: apiResult.status, body: apiResult.body, cookies: apiResult.cookies };
  }

  return {
    handleRequest,
    authModule,
    campaignsModule,
    router,
  };
}
