import { describe, it, expect, beforeEach } from 'vitest';
import { createApiRouter } from '../../apps/api/src/router';
import { createCampaignsModule } from '../../apps/api/src/campaigns/campaigns.module';
import { UploadProgressService } from '../../apps/api/src/campaigns/upload-progress.service';

const authedSession = { adminUser: { email: 'admin@test.com' } };

describe('API Router — upload progress routes', () => {
  let router: ReturnType<typeof createApiRouter>;
  let progressService: UploadProgressService;

  beforeEach(() => {
    progressService = new UploadProgressService();

    router = createApiRouter({
      campaignsModule: createCampaignsModule(),
      uploadProgressService: progressService,
    });
  });

  describe('GET /api/jobs/:jobId/progress', () => {
    it('returns progress for a tracked job', async () => {
      progressService.startTracking('job-1', 5000);
      progressService.updateProgress('job-1', 2500);

      const res = await router.handle({
        method: 'GET',
        path: '/api/jobs/job-1/progress',
        session: authedSession,
      });

      expect(res.status).toBe(200);
      expect(res.body.progress.jobId).toBe('job-1');
      expect(res.body.progress.percent).toBe(50);
      expect(res.body.progress.bytesUploaded).toBe(2500);
      expect(res.body.progress.totalBytes).toBe(5000);
    });

    it('returns 404 for untracked job', async () => {
      const res = await router.handle({
        method: 'GET',
        path: '/api/jobs/unknown/progress',
        session: authedSession,
      });

      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
    });

    it('returns 401 for unauthenticated request', async () => {
      progressService.startTracking('job-1', 1000);

      const res = await router.handle({
        method: 'GET',
        path: '/api/jobs/job-1/progress',
        session: null,
      });

      expect(res.status).toBe(401);
    });

    it('returns completed status', async () => {
      progressService.startTracking('job-1', 1000);
      progressService.markCompleted('job-1');

      const res = await router.handle({
        method: 'GET',
        path: '/api/jobs/job-1/progress',
        session: authedSession,
      });

      expect(res.status).toBe(200);
      expect(res.body.progress.status).toBe('completed');
      expect(res.body.progress.percent).toBe(100);
    });

    it('returns failed status', async () => {
      progressService.startTracking('job-1', 1000);
      progressService.updateProgress('job-1', 300);
      progressService.markFailed('job-1');

      const res = await router.handle({
        method: 'GET',
        path: '/api/jobs/job-1/progress',
        session: authedSession,
      });

      expect(res.status).toBe(200);
      expect(res.body.progress.status).toBe('failed');
      expect(res.body.progress.percent).toBe(30);
    });
  });

  describe('GET /api/campaigns/:campaignId/upload-progress', () => {
    it('returns aggregate progress for campaign jobs', async () => {
      progressService.startTracking('job-1', 1000);
      progressService.startTracking('job-2', 2000);
      progressService.updateProgress('job-1', 500);
      progressService.updateProgress('job-2', 2000);
      progressService.markCompleted('job-2');

      const res = await router.handle({
        method: 'GET',
        path: '/api/campaigns/camp-1/upload-progress',
        session: authedSession,
        body: { jobIds: ['job-1', 'job-2'] },
      });

      expect(res.status).toBe(200);
      expect(res.body.aggregate.totalBytes).toBe(3000);
      expect(res.body.aggregate.uploadedBytes).toBe(2500);
      expect(res.body.aggregate.activeUploads).toBe(1);
      expect(res.body.aggregate.completedUploads).toBe(1);
    });

    it('returns 401 for unauthenticated request', async () => {
      const res = await router.handle({
        method: 'GET',
        path: '/api/campaigns/camp-1/upload-progress',
        session: null,
        body: { jobIds: [] },
      });

      expect(res.status).toBe(401);
    });

    it('returns 400 when jobIds not provided', async () => {
      const res = await router.handle({
        method: 'GET',
        path: '/api/campaigns/camp-1/upload-progress',
        session: authedSession,
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('returns zeroes when no jobs are tracked', async () => {
      const res = await router.handle({
        method: 'GET',
        path: '/api/campaigns/camp-1/upload-progress',
        session: authedSession,
        body: { jobIds: ['nonexistent-1', 'nonexistent-2'] },
      });

      expect(res.status).toBe(200);
      expect(res.body.aggregate.totalBytes).toBe(0);
      expect(res.body.aggregate.percent).toBe(0);
    });
  });

  describe('routes not registered without service', () => {
    it('returns 404 when uploadProgressService not provided', async () => {
      const routerNoProgress = createApiRouter({
        campaignsModule: createCampaignsModule(),
      });

      const res = await routerNoProgress.handle({
        method: 'GET',
        path: '/api/jobs/job-1/progress',
        session: authedSession,
      });

      expect(res.status).toBe(404);
    });
  });
});
