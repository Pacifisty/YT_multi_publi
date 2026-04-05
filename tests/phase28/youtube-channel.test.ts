import { describe, it, expect, beforeEach } from 'vitest';
import {
  YouTubeChannelService,
  InMemoryYouTubeChannelRepository,
  type YouTubeChannelRepository,
  type CreateYouTubeChannelDto,
  type YouTubeChannel,
} from '../../apps/api/src/channels/youtube-channel.service';

function validDto(overrides: Partial<CreateYouTubeChannelDto> = {}): CreateYouTubeChannelDto {
  return {
    connectedAccountId: 'account-1',
    youtubeChannelId: 'UC123456',
    title: 'My Channel',
    handle: '@mychannel',
    thumbnailUrl: 'https://yt3.ggpht.com/thumb.jpg',
    ...overrides,
  };
}

describe('YouTubeChannelService', () => {
  let repo: YouTubeChannelRepository;
  let service: YouTubeChannelService;

  beforeEach(() => {
    repo = new InMemoryYouTubeChannelRepository();
    service = new YouTubeChannelService(repo);
  });

  describe('create', () => {
    it('creates a channel', async () => {
      const result = await service.create(validDto());

      expect(result.channel.id).toBeDefined();
      expect(result.channel.connectedAccountId).toBe('account-1');
      expect(result.channel.youtubeChannelId).toBe('UC123456');
      expect(result.channel.title).toBe('My Channel');
      expect(result.channel.handle).toBe('@mychannel');
      expect(result.channel.thumbnailUrl).toBe('https://yt3.ggpht.com/thumb.jpg');
      expect(result.channel.isActive).toBe(true);
    });

    it('rejects empty connectedAccountId', async () => {
      await expect(service.create(validDto({ connectedAccountId: '' }))).rejects.toThrow('connectedAccountId');
    });

    it('rejects empty youtubeChannelId', async () => {
      await expect(service.create(validDto({ youtubeChannelId: '' }))).rejects.toThrow('youtubeChannelId');
    });

    it('rejects empty title', async () => {
      await expect(service.create(validDto({ title: '' }))).rejects.toThrow('title');
    });

    it('allows null handle and thumbnailUrl', async () => {
      const result = await service.create(validDto({ handle: null, thumbnailUrl: null }));

      expect(result.channel.handle).toBeNull();
      expect(result.channel.thumbnailUrl).toBeNull();
    });

    it('rejects duplicate connectedAccountId + youtubeChannelId pair', async () => {
      await service.create(validDto());

      await expect(service.create(validDto())).rejects.toThrow('already exists');
    });
  });

  describe('getById', () => {
    it('returns channel by id', async () => {
      const { channel } = await service.create(validDto());
      const found = await service.getById(channel.id);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(channel.id);
    });

    it('returns null for nonexistent id', async () => {
      const found = await service.getById('nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('listByAccount', () => {
    it('returns channels for a given account', async () => {
      await service.create(validDto({ connectedAccountId: 'acc-1', youtubeChannelId: 'UC1' }));
      await service.create(validDto({ connectedAccountId: 'acc-1', youtubeChannelId: 'UC2' }));
      await service.create(validDto({ connectedAccountId: 'acc-2', youtubeChannelId: 'UC3' }));

      const channels = await service.listByAccount('acc-1');

      expect(channels).toHaveLength(2);
      channels.forEach((ch) => expect(ch.connectedAccountId).toBe('acc-1'));
    });

    it('returns empty array for account with no channels', async () => {
      const channels = await service.listByAccount('no-account');
      expect(channels).toEqual([]);
    });
  });

  describe('deactivate', () => {
    it('sets isActive to false', async () => {
      const { channel } = await service.create(validDto());

      const result = await service.deactivate(channel.id);

      expect(result).toBe(true);
      const found = await service.getById(channel.id);
      expect(found!.isActive).toBe(false);
    });

    it('returns false for nonexistent id', async () => {
      const result = await service.deactivate('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('activate', () => {
    it('sets isActive back to true', async () => {
      const { channel } = await service.create(validDto());
      await service.deactivate(channel.id);

      const result = await service.activate(channel.id);

      expect(result).toBe(true);
      const found = await service.getById(channel.id);
      expect(found!.isActive).toBe(true);
    });
  });

  describe('updateSync', () => {
    it('updates title and lastSyncedAt', async () => {
      const { channel } = await service.create(validDto());

      const updated = await service.updateSync(channel.id, {
        title: 'Updated Title',
        handle: '@newhandle',
        thumbnailUrl: 'https://new-thumb.jpg',
      });

      expect(updated).not.toBeNull();
      expect(updated!.title).toBe('Updated Title');
      expect(updated!.handle).toBe('@newhandle');
      expect(updated!.thumbnailUrl).toBe('https://new-thumb.jpg');
      expect(updated!.lastSyncedAt.getTime()).toBeGreaterThanOrEqual(channel.lastSyncedAt.getTime());
    });

    it('returns null for nonexistent id', async () => {
      const result = await service.updateSync('nonexistent', { title: 'x' });
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('deletes a channel', async () => {
      const { channel } = await service.create(validDto());

      const deleted = await service.delete(channel.id);

      expect(deleted).toBe(true);
      expect(await service.getById(channel.id)).toBeNull();
    });

    it('returns false for nonexistent id', async () => {
      const deleted = await service.delete('nonexistent');
      expect(deleted).toBe(false);
    });
  });

  describe('listActive', () => {
    it('returns only active channels', async () => {
      const { channel: ch1 } = await service.create(validDto({ youtubeChannelId: 'UC1' }));
      await service.create(validDto({ youtubeChannelId: 'UC2' }));
      await service.deactivate(ch1.id);

      const active = await service.listActive();

      expect(active).toHaveLength(1);
      expect(active[0].isActive).toBe(true);
    });
  });
});

describe('InMemoryYouTubeChannelRepository', () => {
  it('generates unique IDs', async () => {
    const repo = new InMemoryYouTubeChannelRepository();
    const c1 = await repo.create(validDto({ youtubeChannelId: 'UC1' }));
    const c2 = await repo.create(validDto({ youtubeChannelId: 'UC2' }));

    expect(c1.id).not.toBe(c2.id);
  });

  it('sets lastSyncedAt on creation', async () => {
    const repo = new InMemoryYouTubeChannelRepository();
    const channel = await repo.create(validDto());

    expect(channel.lastSyncedAt).toBeInstanceOf(Date);
  });
});
