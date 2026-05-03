import { SessionGuard, type SessionRequestLike } from '../auth/session.guard';
import type { GrowthScriptInput, GrowthScriptResult, GrowthScriptService } from './growth-script.service';

export interface GrowthScriptRequest extends SessionRequestLike {
  body?: unknown;
}

interface ControllerResponse<T = unknown> {
  status: number;
  body: T;
}

export class GrowthScriptController {
  constructor(
    private readonly growthScriptService: GrowthScriptService,
    private readonly sessionGuard: SessionGuard,
  ) {}

  async generate(
    request: GrowthScriptRequest,
  ): Promise<ControllerResponse<GrowthScriptResult | { error: string }>> {
    const guardResult = this.sessionGuard.check(request);
    if (!guardResult.allowed) {
      return { status: guardResult.status, body: { error: guardResult.reason } };
    }

    const body = request.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return { status: 400, body: { error: 'Request body must be an object.' } };
    }

    const result = await this.growthScriptService.generate(
      body as GrowthScriptInput,
      request.session?.adminUser?.email,
    );

    return { status: 200, body: result };
  }
}
