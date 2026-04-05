import { describe, expect, test } from 'vitest';

import {
  createApp,
  type AppConfig,
  type AppInstance,
  type HttpRequest,
} from '../../apps/api/src/app';

function makeRequest(overrides: Partial<HttpRequest> = {}): HttpRequest {
  return {
    method: 'GET',
    path: '/',
    session: null,
    body: undefined,
    ...overrides,
  };
}

function authenticatedRequest(overrides: Partial<HttpRequest> = {}): HttpRequest {
  return makeRequest({
    session: { adminUser: { email: 'admin@test.com' } },
    ...overrides,
  });
}

describe('App server bootstrap', () => {
  test('createApp returns an app with handleRequest method', () => {
    const app = createApp();
    expect(app.handleRequest).toBeTypeOf('function');
  });

  test('app routes GET /api/campaigns to campaign controller', async () => {
    const app = createApp();

    const res = await app.handleRequest(authenticatedRequest({
      method: 'GET',
      path: '/api/campaigns',
    }));

    expect(res.status).toBe(200);
    expect(res.body.campaigns).toBeDefined();
  });

  test('app routes POST /api/campaigns to create campaign', async () => {
    const app = createApp();

    const res = await app.handleRequest(authenticatedRequest({
      method: 'POST',
      path: '/api/campaigns',
      body: { title: 'Test Campaign', videoAssetId: 'v1' },
    }));

    expect(res.status).toBe(201);
    expect(res.body.campaign.title).toBe('Test Campaign');
  });

  test('app routes GET /api/dashboard to dashboard controller', async () => {
    const app = createApp();

    // Create a campaign first so there's data
    await app.handleRequest(authenticatedRequest({
      method: 'POST',
      path: '/api/campaigns',
      body: { title: 'C1', videoAssetId: 'v1' },
    }));

    const res = await app.handleRequest(authenticatedRequest({
      method: 'GET',
      path: '/api/dashboard',
    }));

    expect(res.status).toBe(200);
    expect(res.body.campaigns.total).toBe(1);
  });

  test('app routes auth endpoints: POST /auth/login', async () => {
    const app = createApp({
      env: {
        ADMIN_EMAIL: 'admin@example.com',
        ADMIN_PASSWORD_HASH: 'plain:secret123',
      },
    });

    const res = await app.handleRequest(makeRequest({
      method: 'POST',
      path: '/auth/login',
      body: { email: 'wrong@test.com', password: 'wrong' },
    }));

    // Should return 401 for invalid credentials (not 404 for unmatched route)
    expect(res.status).toBe(401);
  });

  test('app routes GET /auth/me', async () => {
    const app = createApp();

    const res = await app.handleRequest(makeRequest({
      method: 'GET',
      path: '/auth/me',
    }));

    // Unauthenticated = 401
    expect(res.status).toBe(401);
  });

  test('app routes POST /auth/logout', async () => {
    const app = createApp();

    const res = await app.handleRequest(authenticatedRequest({
      method: 'POST',
      path: '/auth/logout',
    }));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('app returns 404 for unknown routes', async () => {
    const app = createApp();

    const res = await app.handleRequest(makeRequest({
      method: 'GET',
      path: '/unknown',
    }));

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });

  test('app rejects unauthenticated API requests', async () => {
    const app = createApp();

    const res = await app.handleRequest(makeRequest({
      method: 'GET',
      path: '/api/campaigns',
    }));

    expect(res.status).toBe(401);
  });

  test('app exposes modules for direct access', () => {
    const app = createApp();

    expect(app.authModule).toBeDefined();
    expect(app.campaignsModule).toBeDefined();
    expect(app.router).toBeDefined();
  });

  test('full lifecycle: create campaign, add target, mark ready, launch', async () => {
    const app = createApp();

    // Create
    const createRes = await app.handleRequest(authenticatedRequest({
      method: 'POST',
      path: '/api/campaigns',
      body: { title: 'E2E Campaign', videoAssetId: 'v1' },
    }));
    expect(createRes.status).toBe(201);
    const campaignId = createRes.body.campaign.id;

    // Add target
    const addTargetRes = await app.handleRequest(authenticatedRequest({
      method: 'POST',
      path: `/api/campaigns/${campaignId}/targets`,
      body: { channelId: 'ch1', videoTitle: 'V', videoDescription: 'D' },
    }));
    expect(addTargetRes.status).toBe(201);

    // Get campaign to verify target
    const getRes = await app.handleRequest(authenticatedRequest({
      method: 'GET',
      path: `/api/campaigns/${campaignId}`,
    }));
    expect(getRes.body.campaign.targets).toHaveLength(1);

    // Mark ready
    const readyRes = await app.handleRequest(authenticatedRequest({
      method: 'POST',
      path: `/api/campaigns/${campaignId}/ready`,
    }));
    expect(readyRes.status).toBe(200);
    expect(readyRes.body.campaign.status).toBe('ready');

    // Launch
    const launchRes = await app.handleRequest(authenticatedRequest({
      method: 'POST',
      path: `/api/campaigns/${campaignId}/launch`,
    }));
    expect(launchRes.status).toBe(200);
    expect(launchRes.body.campaign.status).toBe('launching');

    // Check status
    const statusRes = await app.handleRequest(authenticatedRequest({
      method: 'GET',
      path: `/api/campaigns/${campaignId}/status`,
    }));
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.shouldPoll).toBe(true);
  });
});
