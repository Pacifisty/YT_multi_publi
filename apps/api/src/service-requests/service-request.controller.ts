import type { AdminSession } from '../auth/session.guard';
import type { CreateServiceRequestDto, ServiceRequestService } from './service-request.service';
import { ServiceRequestError } from './service-request.service';

interface ServiceRequestControllerRequest {
  session?: AdminSession | null;
  body?: Partial<CreateServiceRequestDto>;
  params?: { protocol?: string };
  query?: { key?: string };
}

export class ServiceRequestController {
  constructor(private readonly service: ServiceRequestService) {}

  async createPublic(request: ServiceRequestControllerRequest) {
    return this.handle(async () => {
      const result = await this.service.create(request.body as CreateServiceRequestDto);
      return { status: 201, body: result };
    });
  }

  async trackPublic(request: ServiceRequestControllerRequest) {
    return this.handle(async () => ({
      status: 200,
      body: {
        request: await this.service.track(request.params?.protocol ?? '', request.query?.key ?? ''),
      },
    }));
  }

  async createAuthenticated(request: ServiceRequestControllerRequest) {
    const email = request.session?.adminUser?.email;
    if (!email) return { status: 401, body: { error: 'Unauthorized' } };
    return this.handle(async () => {
      const result = await this.service.create({
        ...(request.body as CreateServiceRequestDto),
        email,
      });
      return { status: 201, body: result };
    });
  }

  async listMine(request: ServiceRequestControllerRequest) {
    const email = request.session?.adminUser?.email;
    if (!email) return { status: 401, body: { error: 'Unauthorized' } };
    return this.handle(async () => ({
      status: 200,
      body: { requests: await this.service.listForOwner(email) },
    }));
  }

  async getMine(request: ServiceRequestControllerRequest) {
    const email = request.session?.adminUser?.email;
    if (!email) return { status: 401, body: { error: 'Unauthorized' } };
    return this.handle(async () => ({
      status: 200,
      body: { request: await this.service.getForOwner(email, request.params?.protocol ?? '') },
    }));
  }

  private async handle<T>(operation: () => Promise<T>): Promise<T | { status: number; body: { error: string } }> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof ServiceRequestError) {
        return { status: error.status, body: { error: error.message } };
      }
      throw error;
    }
  }
}
