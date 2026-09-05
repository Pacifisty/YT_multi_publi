import { ServiceRequestController } from './service-request.controller';
import { ServiceRequestService, type ServiceRequestServiceOptions } from './service-request.service';

export function createServiceRequestModule(options: ServiceRequestServiceOptions = {}) {
  const service = new ServiceRequestService(options);
  const controller = new ServiceRequestController(service);
  return { service, controller };
}
