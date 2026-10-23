import { describe, expect, test } from 'vitest';

import {
  AccountsService,
  type ConnectedAccountRecord,
} from '../../apps/api/src/accounts/accounts.service';
import {
  CampaignService,
  InMemoryCampaignRepository,
} from '../../apps/api/src/campaigns/campaign.service';

function connectedAccount(id: string, ownerEmail?: string | null): ConnectedAccountRecord {
  return {
    id,
    ownerEmail,
    provider: 'youtube',
    googleSubject: `subject-${id}`,
    accessTokenEnc: 'encrypted-access-token',
    refreshTokenEnc: null,
    scopes: [],
    tokenExpiresAt: null,
    status: 'connected',
    connectedAt: '2026-10-10T00:00:00.000Z',
    updatedAt: '2026-10-10T00:00:00.000Z',
  };
}

describe('authenticated account data isolation', () => {
  test('connected accounts require an exact owner match', async () => {
    const records = [
      connectedAccount('legacy', null),
      connectedAccount('owner-a', 'owner-a@example.com'),
    ];
    const service = new AccountsService({
      listConnectedAccounts: async () => records,
      getConnectedAccount: async (id) => records.find((record) => record.id === id) ?? null,
    });

    expect(await service.listAccounts('owner-b@example.com')).toEqual([]);
    expect(await service.getAccount('legacy', 'owner-b@example.com')).toBeNull();
    expect((await service.listAccounts('OWNER-A@example.com')).map((record) => record.id)).toEqual(['owner-a']);
  });

  test('campaigns without the authenticated owner are neither listed nor mutable', async () => {
    const service = new CampaignService({ repository: new InMemoryCampaignRepository() });
    const legacy = await service.createCampaign({
      title: 'Campanha antiga sem dono',
      videoAssetId: 'video-legacy',
    });
    const owned = await service.createCampaign({
      title: 'Campanha A',
      videoAssetId: 'video-a',
      ownerEmail: 'owner-a@example.com',
    });

    expect((await service.listCampaigns({ ownerEmail: 'owner-b@example.com' })).campaigns).toEqual([]);
    expect(await service.getCampaign(legacy.campaign.id, 'owner-b@example.com')).toBeNull();
    expect(await service.getCampaign(owned.campaign.id, 'owner-b@example.com')).toBeNull();
    expect(await service.getCampaign(owned.campaign.id, 'OWNER-A@example.com')).not.toBeNull();
  });
});
