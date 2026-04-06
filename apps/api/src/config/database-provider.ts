import { PrismaConnectedAccountRepository } from '../accounts/prisma-connected-account.repository';
import { PrismaCampaignRepository } from '../campaigns/prisma-campaign.repository';
import { PrismaPublishJobRepository } from '../campaigns/prisma-publish-job.repository';
import { PrismaYouTubeChannelRepository } from '../channels/prisma-youtube-channel.repository';

export interface DatabaseProviderOptions {
  databaseUrl?: string;
  _prismaFactory?: () => any;
}

export interface DatabaseProviderInstance {
  campaignRepository: PrismaCampaignRepository | null;
  publishJobRepository: PrismaPublishJobRepository | null;
  connectedAccountRepository: PrismaConnectedAccountRepository | null;
  youtubeChannelRepository: PrismaYouTubeChannelRepository | null;
  isConnected(): boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

export function createDatabaseProvider(options: DatabaseProviderOptions): DatabaseProviderInstance {
  const { databaseUrl, _prismaFactory } = options;

  let connected = false;
  let prismaClient: any = null;
  let campaignRepository: PrismaCampaignRepository | null = null;
  let publishJobRepository: PrismaPublishJobRepository | null = null;
  let connectedAccountRepository: PrismaConnectedAccountRepository | null = null;
  let youtubeChannelRepository: PrismaYouTubeChannelRepository | null = null;

  if (databaseUrl) {
    if (_prismaFactory) {
      prismaClient = _prismaFactory();
      campaignRepository = new PrismaCampaignRepository(prismaClient);
      publishJobRepository = new PrismaPublishJobRepository(prismaClient);
      connectedAccountRepository = new PrismaConnectedAccountRepository(prismaClient);
      youtubeChannelRepository = new PrismaYouTubeChannelRepository(prismaClient);
    }
  }

  return {
    get campaignRepository() {
      return campaignRepository;
    },

    get publishJobRepository() {
      return publishJobRepository;
    },

    get connectedAccountRepository() {
      return connectedAccountRepository;
    },

    get youtubeChannelRepository() {
      return youtubeChannelRepository;
    },

    isConnected() {
      return connected;
    },

    async connect() {
      if (!databaseUrl || !prismaClient) return;
      await prismaClient.$connect();
      connected = true;
    },

    async disconnect() {
      if (!connected || !prismaClient) return;
      await prismaClient.$disconnect();
      connected = false;
    },
  };
}
