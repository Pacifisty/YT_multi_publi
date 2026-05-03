import { describe, expect, it } from 'vitest';
import { createApiRouter } from '../../apps/api/src/router';
import { createCampaignsModule } from '../../apps/api/src/campaigns/campaigns.module';
import { SessionGuard } from '../../apps/api/src/auth/session.guard';
import { GrowthScriptController } from '../../apps/api/src/growth/growth-script.controller';
import { GrowthScriptService } from '../../apps/api/src/growth/growth-script.service';

const authedSession = { adminUser: { email: 'admin@test.com' } };

function createGrowthRouter() {
  const growthScriptController = new GrowthScriptController(
    new GrowthScriptService({
      now: () => new Date('2026-05-03T12:00:00.000Z'),
      dashboardService: {
        getStats: async () => ({
          campaigns: { total: 1, byStatus: { draft: 0, ready: 0, launching: 0, completed: 0, failed: 1 } },
          targets: { total: 2, byStatus: { aguardando: 0, enviando: 0, publicado: 1, erro: 1 }, successRate: 50 },
          jobs: { total: 0, byStatus: {}, totalRetries: 0 },
          quota: {
            dailyLimitUnits: 10000,
            estimatedConsumedUnits: 0,
            estimatedQueuedUnits: 0,
            estimatedProjectedUnits: 0,
            estimatedRemainingUnits: 10000,
            usagePercent: 0,
            projectedPercent: 0,
            warningState: 'healthy',
          },
          failures: { failedCampaigns: 1, failedTargets: 1, topReason: 'other_failure', reasons: [] },
          failedJobs: [],
          retries: { retriedTargets: 0, highestAttempt: 0, hotspotChannelId: null, hotspotRetryCount: 0 },
          audit: { totalEvents: 0, byType: {} as any, lastEventAt: null, lastEventType: null, lastActorEmail: null },
          reauth: { blockedCampaigns: 0, blockedTargets: 0, blockedChannelCount: 0, blockedChannelIds: [] },
          channels: [
            {
              channelId: 'yt-1',
              channelLabel: 'Canal Growth',
              totalTargets: 2,
              published: 1,
              failed: 0,
              successRate: 100,
              totalViews: 1200,
              topVideoId: 'vid-1',
              topVideoTitle: 'Gancho que segurou a audiencia',
              topVideoViews: 1200,
            },
          ],
          platformStats: [
            { platform: 'youtube', totalTargets: 2, published: 1, failed: 1, successRate: 50, retriedTargets: 0, topRetryDestination: null },
            { platform: 'tiktok', totalTargets: 4, published: 4, failed: 0, successRate: 100, retriedTargets: 0, topRetryDestination: null },
          ],
          destinationStats: [],
        }),
      } as any,
      campaignService: {
        listCampaigns: async () => ({
          campaigns: [
            {
              id: 'camp-1',
              ownerEmail: 'admin@test.com',
              title: 'Retencao nos primeiros segundos',
              videoAssetId: 'video-1',
              status: 'failed',
              scheduledAt: null,
              playlistId: null,
              autoMode: false,
              schedulePattern: null,
              targets: [
                {
                  id: 'target-1',
                  campaignId: 'camp-1',
                  platform: 'tiktok',
                  destinationId: 'dest-1',
                  destinationLabel: 'TikTok principal',
                  connectedAccountId: 'acct-1',
                  channelId: null,
                  videoTitle: 'Retencao',
                  videoDescription: 'Descricao',
                  tags: [],
                  publishAt: null,
                  playlistId: null,
                  privacy: 'public',
                  thumbnailAssetId: null,
                  status: 'erro',
                  externalPublishId: null,
                  youtubeVideoId: null,
                  errorMessage: 'Falha',
                  retryCount: 0,
                  createdAt: '2026-05-03T10:00:00.000Z',
                  updatedAt: '2026-05-03T10:00:00.000Z',
                },
              ],
              createdAt: '2026-05-03T10:00:00.000Z',
              updatedAt: '2026-05-03T10:00:00.000Z',
            },
          ],
        }),
      },
      accountsService: {
        listAccounts: async () => [
          {
            id: 'acct-1',
            provider: 'youtube',
            email: 'admin@test.com',
            displayName: 'Canal Growth',
            accessTokenEnc: 'enc',
            refreshTokenEnc: null,
            scopes: [],
            tokenExpiresAt: null,
            status: 'connected',
            connectedAt: '2026-05-03T10:00:00.000Z',
            updatedAt: '2026-05-03T10:00:00.000Z',
          },
        ],
        getChannelsForAccount: async () => [
          {
            id: 'channel-1',
            connectedAccountId: 'acct-1',
            youtubeChannelId: 'yt-1',
            title: 'Canal Growth',
            isActive: true,
            lastSyncedAt: '2026-05-03T10:00:00.000Z',
          },
        ],
      } as any,
    }),
    new SessionGuard(),
  );

  return createApiRouter({
    campaignsModule: createCampaignsModule(),
    growthScriptController,
  });
}

describe('Growth script API', () => {
  it('generates a topic brief, real workspace signals, and a publishable script', async () => {
    const router = createGrowthRouter();
    const response = await router.handle({
      method: 'POST',
      path: '/api/growth/script/generate',
      session: authedSession,
      body: {
        topic: 'Retencao em videos curtos',
        platform: 'Instagram',
        duration: '30 segundos',
        tone: 'Educativo',
        goal: 'aumentar retencao',
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.generatedAt).toBe('2026-05-03T12:00:00.000Z');
    expect(response.body.brief.summary).toContain('Retencao em videos curtos');
    expect(response.body.brief.relatedTerms).toContain('retencao');
    expect(response.body.signals.bestPlatform).toBe('TikTok');
    expect(response.body.signals.failedTargets).toBe(1);
    expect(response.body.signals.activeChannels).toBe(1);
    expect(response.body.signals.topContentTitle).toBe('Gancho que segurou a audiencia');
    expect(response.body.script.hooks).toHaveLength(3);
    expect(response.body.script.timeline).toHaveLength(4);
    expect(response.body.script.caption).toContain('Retencao em videos curtos');
    expect(response.body.script.platformAdaptation.join(' ')).toContain('Corte');
  });

  it('flags accented Portuguese sensitive topics in the brief risks', async () => {
    const router = createGrowthRouter();
    const response = await router.handle({
      method: 'POST',
      path: '/api/growth/script/generate',
      session: authedSession,
      body: {
        topic: 'Saúde e remédio para criadores',
        platform: 'YouTube',
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.brief.risks.join(' ')).toContain('Tema sensivel');
  });

  it('requires authentication', async () => {
    const router = createGrowthRouter();
    const response = await router.handle({
      method: 'POST',
      path: '/api/growth/script/generate',
      session: null,
      body: { topic: 'Retencao' },
    });

    expect(response.status).toBe(401);
  });
});
