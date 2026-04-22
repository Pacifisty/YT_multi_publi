import type { YouTubeChannelRepository, YouTubeChannel } from '../channels/youtube-channel.service';
import type { ChannelStore, ChannelRecord } from '../accounts/accounts.service';

function toChannelRecord(channel: YouTubeChannel): ChannelRecord {
  return {
    id: channel.id,
    connectedAccountId: channel.connectedAccountId,
    youtubeChannelId: channel.youtubeChannelId,
    title: channel.title,
    handle: channel.handle ?? undefined,
    thumbnailUrl: channel.thumbnailUrl ?? undefined,
    isActive: channel.isActive,
    lastSyncedAt: channel.lastSyncedAt.toISOString(),
  };
}

export function createChannelRepoAdapter(repo: YouTubeChannelRepository): ChannelStore {
  return {
    async upsert(record: ChannelRecord): Promise<ChannelRecord> {
      const existing = await repo.findByAccountAndChannelId(
        record.connectedAccountId,
        record.youtubeChannelId,
      );
      if (existing) {
        const updated = await repo.update(existing.id, {
          title: record.title,
          handle: record.handle ?? null,
          thumbnailUrl: record.thumbnailUrl ?? null,
          isActive: record.isActive,
          lastSyncedAt: new Date(record.lastSyncedAt),
        });
        return updated ? toChannelRecord(updated) : record;
      }
      const created = await repo.create({
        connectedAccountId: record.connectedAccountId,
        youtubeChannelId: record.youtubeChannelId,
        title: record.title,
        handle: record.handle ?? null,
        thumbnailUrl: record.thumbnailUrl ?? null,
      });
      return toChannelRecord(created);
    },

    async findByAccountId(accountId: string): Promise<ChannelRecord[]> {
      const channels = await repo.findByAccount(accountId);
      return channels.map(toChannelRecord);
    },

    async findById(channelId: string): Promise<ChannelRecord | null> {
      const channel = await repo.findById(channelId);
      return channel ? toChannelRecord(channel) : null;
    },

    async update(channelId: string, updates: Partial<ChannelRecord>): Promise<ChannelRecord | null> {
      const partialChannel: Partial<YouTubeChannel> = {};
      if (updates.title !== undefined) partialChannel.title = updates.title;
      if (updates.handle !== undefined) partialChannel.handle = updates.handle ?? null;
      if (updates.thumbnailUrl !== undefined) partialChannel.thumbnailUrl = updates.thumbnailUrl ?? null;
      if (updates.isActive !== undefined) partialChannel.isActive = updates.isActive;
      if (updates.lastSyncedAt !== undefined) partialChannel.lastSyncedAt = new Date(updates.lastSyncedAt);

      const result = await repo.update(channelId, partialChannel);
      return result ? toChannelRecord(result) : null;
    },

    async delete(channelId: string): Promise<boolean> {
      return repo.delete(channelId);
    },

    async deactivateAllForAccount(accountId: string): Promise<void> {
      const channels = await repo.findByAccount(accountId);
      await Promise.all(
        channels.map((ch) => repo.update(ch.id, { isActive: false })),
      );
    },
  };
}
