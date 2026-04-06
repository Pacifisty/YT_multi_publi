import { PrismaCampaignRepository } from '../campaigns/prisma-campaign.repository';
import { PrismaPublishJobRepository } from '../campaigns/prisma-publish-job.repository';

export interface DatabaseProviderOptions {
  databaseUrl?: string;
  _prismaFactory?: () => any;
}

export interface DatabaseProviderInstance {
  campaignRepository: PrismaCampaignRepository | null;
  publishJobRepository: PrismaPublishJobRepository | null;
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

  if (databaseUrl) {
    if (_prismaFactory) {
      prismaClient = _prismaFactory();
      campaignRepository = new PrismaCampaignRepository(prismaClient);
      publishJobRepository = new PrismaPublishJobRepository(prismaClient);
    }
  }

  return {
    get campaignRepository() {
      return campaignRepository;
    },

    get publishJobRepository() {
      return publishJobRepository;
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
