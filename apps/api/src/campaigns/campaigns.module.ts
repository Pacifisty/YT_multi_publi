import { SessionGuard } from '../auth/session.guard';
import { AuditEventService, InMemoryAuditEventRepository, type AuditEventRepository } from './audit-event.service';
import { CampaignService, type CampaignServiceOptions } from './campaign.service';
import { CampaignStatusService } from './campaign-status.service';
import { CampaignsController } from './campaigns.controller';
import { DashboardService } from './dashboard.service';
import { LaunchService } from './launch.service';
import { PublishJobService, type PublishJobServiceOptions } from './publish-job.service';
import type { AccountPlanService } from '../account-plan/account-plan.service';

export interface CampaignsModuleInstance {
  campaignService: CampaignService;
  campaignsController: CampaignsController;
  sessionGuard: SessionGuard;
  jobService: PublishJobService;
  launchService: LaunchService;
  statusService: CampaignStatusService;
  dashboardService: DashboardService;
  auditService: AuditEventService;
}

export interface CampaignsModuleOptions extends CampaignServiceOptions {
  jobServiceOptions?: PublishJobServiceOptions;
  auditRepository?: AuditEventRepository;
  accountPlanService?: AccountPlanService;
}

export function createCampaignsModule(options: CampaignsModuleOptions = {}): CampaignsModuleInstance {
  const campaignService = new CampaignService(options);
  const sessionGuard = new SessionGuard();
  const jobService = new PublishJobService(options.jobServiceOptions);
  const auditService = new AuditEventService({
    repository: options.auditRepository ?? new InMemoryAuditEventRepository(),
    now: options.now,
  });
  const launchService = new LaunchService({ campaignService, jobService, now: options.now });
  const statusService = new CampaignStatusService({ campaignService, jobService, now: options.now });
  const dashboardService = new DashboardService({ campaignService, jobService, auditService });
  const campaignsController = new CampaignsController(
    campaignService,
    sessionGuard,
    launchService,
    statusService,
    jobService,
    dashboardService,
    auditService,
    options.accountPlanService,
  );

  return {
    campaignService,
    campaignsController,
    sessionGuard,
    jobService,
    launchService,
    statusService,
    dashboardService,
    auditService,
  };
}
