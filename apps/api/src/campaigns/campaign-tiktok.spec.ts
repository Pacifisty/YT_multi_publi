import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CampaignService,
  type CampaignRepository,
  type AccountServiceProvider,
  type ConnectedAccountRecord,
  type CampaignRecord,
  type CreateTikTokTargetInput,
  InMemoryCampaignRepository,
} from './campaign.service';

describe('CampaignService - TikTok Targeting', () => {
  let service: CampaignService;
  let repository: CampaignRepository;
  let accountService: AccountServiceProvider;
  const now = () => new Date('2026-04-28T09:00:00Z');

  const mockTikTokAccount: ConnectedAccountRecord = {
    id: 'tiktok-account-1',
    provider: 'tiktok',
    displayName: '@test_creator',
    email: 'creator@tiktok.com',
    status: 'connected',
    ownerEmail: 'user@example.com',
  };

  const mockYouTubeAccount: ConnectedAccountRecord = {
    id: 'youtube-account-1',
    provider: 'youtube',
    displayName: 'My Channel',
    status: 'connected',
    ownerEmail: 'user@example.com',
  };

  beforeEach(() => {
    repository = new InMemoryCampaignRepository();

    // Mock account service
    accountService = {
      getConnectedAccount: vi.fn(async (id: string) => {
        if (id === mockTikTokAccount.id) return mockTikTokAccount;
        if (id === mockYouTubeAccount.id) return mockYouTubeAccount;
        return null;
      }),
      listConnectedAccounts: vi.fn(async (ownerEmail: string, provider: string) => {
        if (provider === 'tiktok' && ownerEmail === 'user@example.com') {
          return [mockTikTokAccount];
        }
        return [];
      }),
    };

    service = new CampaignService({
      repository,
      accountService,
      now,
    });
  });

  describe('validateTikTokAccount', () => {
    it('should validate valid TikTok account', async () => {
      const result = await service.validateTikTokAccount(
        mockTikTokAccount.id,
        'user@example.com'
      );

      expect(result.valid).toBe(true);
      expect(result.displayName).toBe('@test_creator');
    });

    it('should reject non-existent account', async () => {
      const result = await service.validateTikTokAccount('invalid-id', 'user@example.com');

      expect(result.valid).toBe(false);
      expect(result.displayName).toBeUndefined();
    });

    it('should reject YouTube account when TikTok expected', async () => {
      await expect(
        service.validateTikTokAccount(mockYouTubeAccount.id, 'user@example.com')
      ).rejects.toThrow('Account is not a TikTok account');
    });

    it('should reject account from different user', async () => {
      const result = await service.validateTikTokAccount(
        mockTikTokAccount.id,
        'other@example.com'
      );

      expect(result.valid).toBe(false);
    });

    it('should throw error if account service not configured', async () => {
      const serviceWithoutAccountService = new CampaignService({ repository });

      await expect(
        serviceWithoutAccountService.validateTikTokAccount(
          mockTikTokAccount.id,
          'user@example.com'
        )
      ).rejects.toThrow('Account service not configured');
    });
  });

  describe('listConnectedTikTokAccounts', () => {
    it('should list user TikTok accounts', async () => {
      const accounts = await service.listConnectedTikTokAccounts('user@example.com');

      expect(accounts).toHaveLength(1);
      expect(accounts[0].id).toBe(mockTikTokAccount.id);
      expect(accounts[0].provider).toBe('tiktok');
    });

    it('should return empty list for user with no TikTok accounts', async () => {
      const accounts = await service.listConnectedTikTokAccounts('other@example.com');

      expect(accounts).toHaveLength(0);
    });

    it('should throw error if account service not configured', async () => {
      const serviceWithoutAccountService = new CampaignService({ repository });

      await expect(
        serviceWithoutAccountService.listConnectedTikTokAccounts('user@example.com')
      ).rejects.toThrow('Account service not configured');
    });
  });

  describe('getTikTokTargetsForCampaign', () => {
    it('should return TikTok targets from campaign', async () => {
      // Create campaign with mixed targets
      const { campaign: created } = await service.createCampaign({
        title: 'Mixed Campaign',
        videoAssetId: 'video-1',
        ownerEmail: 'user@example.com',
      });

      // Add TikTok target
      await service.createTikTokTarget(
        created.id,
        {
          connectedAccountId: mockTikTokAccount.id,
          videoTitle: 'Test Video',
          privacy: 'PUBLIC_TO_EVERYONE',
        },
        'user@example.com'
      );

      // Get TikTok targets
      const targets = await service.getTikTokTargetsForCampaign(
        created.id,
        'user@example.com'
      );

      expect(targets).toHaveLength(1);
      expect(targets[0].platform).toBe('tiktok');
      expect(targets[0].connectedAccountId).toBe(mockTikTokAccount.id);
    });

    it('should return empty array for non-existent campaign', async () => {
      const targets = await service.getTikTokTargetsForCampaign('invalid-id', 'user@example.com');

      expect(targets).toHaveLength(0);
    });

    it('should return empty array for campaign with no TikTok targets', async () => {
      const { campaign: created } = await service.createCampaign({
        title: 'YouTube Only',
        videoAssetId: 'video-1',
        ownerEmail: 'user@example.com',
      });

      const targets = await service.getTikTokTargetsForCampaign(
        created.id,
        'user@example.com'
      );

      expect(targets).toHaveLength(0);
    });
  });

  describe('createTikTokTarget', () => {
    it('should create TikTok target with all fields', async () => {
      const { campaign: created } = await service.createCampaign({
        title: 'TikTok Campaign',
        videoAssetId: 'video-1',
        ownerEmail: 'user@example.com',
      });

      const input: CreateTikTokTargetInput = {
        connectedAccountId: mockTikTokAccount.id,
        videoTitle: 'My Awesome Video #hashtag',
        privacy: 'PUBLIC_TO_EVERYONE',
        disableComment: false,
        disableDuet: false,
        disableStitch: true,
      };

      const { target } = await service.createTikTokTarget(
        created.id,
        input,
        'user@example.com'
      );

      expect(target.platform).toBe('tiktok');
      expect(target.connectedAccountId).toBe(mockTikTokAccount.id);
      expect(target.videoTitle).toBe(input.videoTitle);
      expect(target.videoDescription).toBe(''); // TikTok has no description
      expect(target.tiktokPrivacyLevel).toBe('PUBLIC_TO_EVERYONE');
      expect(target.tiktokDisableComment).toBe(false);
      expect(target.tiktokDisableDuet).toBe(false);
      expect(target.tiktokDisableStitch).toBe(true);
      expect(target.status).toBe('aguardando');
      expect(target.destinationLabel).toBe('@test_creator');
    });

    it('should truncate title if longer than 2200 characters', async () => {
      const { campaign: created } = await service.createCampaign({
        title: 'Campaign',
        videoAssetId: 'video-1',
        ownerEmail: 'user@example.com',
      });

      const longTitle = 'a'.repeat(2500);
      const { target } = await service.createTikTokTarget(
        created.id,
        {
          connectedAccountId: mockTikTokAccount.id,
          videoTitle: longTitle,
          privacy: 'SELF_ONLY',
        },
        'user@example.com'
      );

      expect(target.videoTitle.length).toBe(2200);
      expect(target.videoTitle).toBe('a'.repeat(2200));
    });

    it('should reject non-existent campaign', async () => {
      const input: CreateTikTokTargetInput = {
        connectedAccountId: mockTikTokAccount.id,
        videoTitle: 'Video',
        privacy: 'PUBLIC_TO_EVERYONE',
      };

      await expect(
        service.createTikTokTarget('invalid-id', input, 'user@example.com')
      ).rejects.toThrow('Campaign invalid-id not found');
    });

    it('should reject non-TikTok account', async () => {
      const { campaign: created } = await service.createCampaign({
        title: 'Campaign',
        videoAssetId: 'video-1',
        ownerEmail: 'user@example.com',
      });

      const input: CreateTikTokTargetInput = {
        connectedAccountId: mockYouTubeAccount.id,
        videoTitle: 'Video',
        privacy: 'PUBLIC_TO_EVERYONE',
      };

      await expect(
        service.createTikTokTarget(created.id, input, 'user@example.com')
      ).rejects.toThrow('Account is not a TikTok account');
    });

    it('should reject account from different user', async () => {
      const { campaign: created } = await service.createCampaign({
        title: 'Campaign',
        videoAssetId: 'video-1',
        ownerEmail: 'user@example.com',
      });

      const input: CreateTikTokTargetInput = {
        connectedAccountId: mockTikTokAccount.id,
        videoTitle: 'Video',
        privacy: 'PUBLIC_TO_EVERYONE',
      };

      await expect(
        service.createTikTokTarget(created.id, input, 'other@example.com')
      ).rejects.toThrow('Account not found or not accessible');
    });

    it('should reject duplicate TikTok target for same account', async () => {
      const { campaign: created } = await service.createCampaign({
        title: 'Campaign',
        videoAssetId: 'video-1',
        ownerEmail: 'user@example.com',
      });

      const input: CreateTikTokTargetInput = {
        connectedAccountId: mockTikTokAccount.id,
        videoTitle: 'Video 1',
        privacy: 'PUBLIC_TO_EVERYONE',
      };

      // Create first target
      await service.createTikTokTarget(created.id, input, 'user@example.com');

      // Try to create duplicate
      const input2: CreateTikTokTargetInput = {
        connectedAccountId: mockTikTokAccount.id,
        videoTitle: 'Video 2',
        privacy: 'SELF_ONLY',
      };

      await expect(
        service.createTikTokTarget(created.id, input2, 'user@example.com')
      ).rejects.toThrow('Target for this TikTok account already exists in the campaign');
    });

    it('should reject target creation on active campaign', async () => {
      const { campaign: created } = await service.createCampaign({
        title: 'Campaign',
        videoAssetId: 'video-1',
        ownerEmail: 'user@example.com',
      });

      // Mark as ready
      await service.markReady(created.id, 'user@example.com');

      // Try to add TikTok target
      const input: CreateTikTokTargetInput = {
        connectedAccountId: mockTikTokAccount.id,
        videoTitle: 'Video',
        privacy: 'PUBLIC_TO_EVERYONE',
      };

      await expect(
        service.createTikTokTarget(created.id, input, 'user@example.com')
      ).rejects.toThrow('Cannot add targets to an active campaign');
    });

    it('should use default values for optional fields', async () => {
      const { campaign: created } = await service.createCampaign({
        title: 'Campaign',
        videoAssetId: 'video-1',
        ownerEmail: 'user@example.com',
      });

      const { target } = await service.createTikTokTarget(
        created.id,
        {
          connectedAccountId: mockTikTokAccount.id,
          videoTitle: 'Simple Video',
          privacy: 'FOLLOWER_OF_CREATOR',
        },
        'user@example.com'
      );

      expect(target.tiktokDisableComment).toBe(false);
      expect(target.tiktokDisableDuet).toBe(false);
      expect(target.tiktokDisableStitch).toBe(false);
    });

    it('should preserve TikTok fields when cloning campaign', async () => {
      const { campaign: original } = await service.createCampaign({
        title: 'Original',
        videoAssetId: 'video-1',
        ownerEmail: 'user@example.com',
      });

      // Add TikTok target
      await service.createTikTokTarget(
        original.id,
        {
          connectedAccountId: mockTikTokAccount.id,
          videoTitle: 'Video',
          privacy: 'PUBLIC_TO_EVERYONE',
          disableStitch: true,
        },
        'user@example.com'
      );

      // Clone campaign
      const { campaign: cloned } = await service.cloneCampaign(original.id, {
        ownerEmail: 'user@example.com',
      });

      expect(cloned.targets).toHaveLength(1);
      const target = cloned.targets[0];
      expect(target.platform).toBe('tiktok');
      expect(target.tiktokPrivacyLevel).toBe('PUBLIC_TO_EVERYONE');
      expect(target.tiktokDisableStitch).toBe(true);
    });
  });
});
