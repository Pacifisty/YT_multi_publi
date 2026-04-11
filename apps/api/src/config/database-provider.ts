import { createRequire } from 'node:module';
import { PrismaConnectedAccountRepository } from '../accounts/prisma-connected-account.repository';
import { PrismaAuditEventRepository } from '../campaigns/prisma-audit-event.repository';
import { PrismaCampaignRepository } from '../campaigns/prisma-campaign.repository';
import { PrismaPublishJobRepository } from '../campaigns/prisma-publish-job.repository';
import { PrismaYouTubeChannelRepository } from '../channels/prisma-youtube-channel.repository';
import { PrismaMediaAssetRepository } from '../media/prisma-media-asset.repository';

const require = createRequire(import.meta.url);

type PrismaModuleLike = {
  PrismaClient: new (options?: {
    datasources?: {
      db?: {
        url?: string;
      };
    };
  }) => any;
};

export interface DatabaseProviderOptions {
  databaseUrl?: string;
  _prismaFactory?: () => any;
  _prismaModule?: PrismaModuleLike;
}

export interface DatabaseProviderInstance {
  campaignRepository: PrismaCampaignRepository | null;
  publishJobRepository: PrismaPublishJobRepository | null;
  auditEventRepository: PrismaAuditEventRepository | null;
  connectedAccountRepository: PrismaConnectedAccountRepository | null;
  youtubeChannelRepository: PrismaYouTubeChannelRepository | null;
  mediaAssetRepository: PrismaMediaAssetRepository | null;
  isConnected(): boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

function loadPrismaModule(moduleOverride?: PrismaModuleLike): PrismaModuleLike | null {
  if (moduleOverride) {
    return moduleOverride;
  }

  try {
    return require('@prisma/client') as PrismaModuleLike;
  } catch {
    return null;
  }
}

function createPrismaClient(options: DatabaseProviderOptions): any | null {
  if (!options.databaseUrl) {
    return null;
  }

  if (options._prismaFactory) {
    return options._prismaFactory();
  }

  const prismaModule = loadPrismaModule(options._prismaModule);
  if (!prismaModule) {
    return null;
  }

  return new prismaModule.PrismaClient({
    datasources: {
      db: {
        url: options.databaseUrl,
      },
    },
  });
}

export function createDatabaseProvider(options: DatabaseProviderOptions): DatabaseProviderInstance {
  const { databaseUrl } = options;

  let connected = false;
  let desiredConnected = false;
  let connectPromise: Promise<void> | null = null;
  let disconnectPromise: Promise<void> | null = null;
  let prismaClient: any = null;
  let campaignRepository: PrismaCampaignRepository | null = null;
  let publishJobRepository: PrismaPublishJobRepository | null = null;
  let auditEventRepository: PrismaAuditEventRepository | null = null;
  let connectedAccountRepository: PrismaConnectedAccountRepository | null = null;
  let youtubeChannelRepository: PrismaYouTubeChannelRepository | null = null;
  let mediaAssetRepository: PrismaMediaAssetRepository | null = null;

  if (databaseUrl) {
    prismaClient = createPrismaClient(options);
    if (prismaClient) {
      campaignRepository = new PrismaCampaignRepository(prismaClient);
      publishJobRepository = new PrismaPublishJobRepository(prismaClient);
      auditEventRepository = new PrismaAuditEventRepository(prismaClient);
      connectedAccountRepository = new PrismaConnectedAccountRepository(prismaClient);
      youtubeChannelRepository = new PrismaYouTubeChannelRepository(prismaClient);
      mediaAssetRepository = new PrismaMediaAssetRepository(prismaClient);
    }
  }

  return {
    get campaignRepository() {
      return campaignRepository;
    },

    get publishJobRepository() {
      return publishJobRepository;
    },

    get auditEventRepository() {
      return auditEventRepository;
    },

    get connectedAccountRepository() {
      return connectedAccountRepository;
    },

    get youtubeChannelRepository() {
      return youtubeChannelRepository;
    },

    get mediaAssetRepository() {
      return mediaAssetRepository;
    },

    isConnected() {
      return connected;
    },

    async connect() {
      desiredConnected = true;

      if (!databaseUrl || !prismaClient) return;

      if (disconnectPromise) {
        await disconnectPromise;
      }

      if (!desiredConnected) return;
      if (connected) return;
      if (connectPromise) return connectPromise;

      connectPromise = (async () => {
        await prismaClient.$connect();
        connected = true;
      })();

      try {
        await connectPromise;
      } finally {
        connectPromise = null;
      }
    },

    async disconnect() {
      desiredConnected = false;

      if (!prismaClient) return;
      if (disconnectPromise) return disconnectPromise;

      disconnectPromise = (async () => {
        if (connectPromise && !connected) {
          try {
            await connectPromise;
          } catch {
            return;
          }
        }

        if (!connected) return;

        await prismaClient.$disconnect();
        connected = false;
      })();

      try {
        await disconnectPromise;
      } finally {
        disconnectPromise = null;
      }
    },
  };
}
