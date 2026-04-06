import type { AdminSession } from './auth/session.guard';
import type { AuthModuleInstance } from './auth/auth.module';
import { createAuthModule } from './auth/auth.module';
import type { CampaignsModuleInstance, CampaignsModuleOptions } from './campaigns/campaigns.module';
import { createCampaignsModule } from './campaigns/campaigns.module';
import type { AccountsModuleInstance } from './accounts/accounts.module';
import { createAccountsModule } from './accounts/accounts.module';
import type { AccountsServiceOptions } from './accounts/accounts.service';
import type { MediaModuleInstance } from './media/media.module';
import { createMediaModule } from './media/media.module';
import type { MediaServiceOptions } from './media/media.service';
import { createApiRouter, type ApiRouter, type ApiResponse } from './router';

export interface AppConfig {
  env?: Record<string, string | undefined>;
  campaignsModuleOptions?: CampaignsModuleOptions;
  accountsModuleOptions?: AccountsServiceOptions;
  mediaModuleOptions?: MediaServiceOptions;
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
  accountsModule: AccountsModuleInstance;
  mediaModule: MediaModuleInstance;
  router: ApiRouter;
}

export function createApp(config: AppConfig = {}): AppInstance {
  const authModule = createAuthModule({ env: config.env });
  const campaignsModule = createCampaignsModule(config.campaignsModuleOptions);
  const accountsModule = createAccountsModule(config.accountsModuleOptions);
  const mediaModule = createMediaModule(config.mediaModuleOptions);
  const router = createApiRouter({
    campaignsModule,
    authController: authModule.authController,
    accountsController: accountsModule.accountsController,
    mediaController: mediaModule.mediaController,
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
    accountsModule,
    mediaModule,
    router,
  };
}
