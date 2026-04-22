import { createRequire } from 'node:module';
import { PrismaConnectedAccountRepository } from '../accounts/prisma-connected-account.repository';
import { PrismaAccountPlanRepository } from '../account-plan/prisma-account-plan.repository';
import { PrismaAuthUserRepository } from '../auth/prisma-auth-user.repository';
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
  authUserRepository: PrismaAuthUserRepository | null;
  accountPlanRepository: PrismaAccountPlanRepository | null;
  connectedAccountRepository: PrismaConnectedAccountRepository | null;
  youtubeChannelRepository: PrismaYouTubeChannelRepository | null;
  mediaAssetRepository: PrismaMediaAssetRepository | null;
  isConnected(): boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

const REQUIRED_POSTGRES_TABLES = [
  'admin_users',
  'account_plans',
  'connected_accounts',
  'youtube_channels',
  'media_assets',
  'campaigns',
  'campaign_targets',
  'publish_jobs',
  'audit_events',
] as const;

function createPrismaUnavailableMessage(): string {
  return 'DATABASE_URL is configured, but Prisma Client is not available. Install dependencies and run Prisma generate before starting the server.';
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

async function verifyRequiredTables(prismaClient: any): Promise<void> {
  if (typeof prismaClient?.$queryRawUnsafe !== 'function') {
    return;
  }

  const rows = await prismaClient.$queryRawUnsafe<{ table_name: string }[]>(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name IN (${REQUIRED_POSTGRES_TABLES.map((name) => `'${name}'`).join(', ')})
  `);

  const existingTables = new Set(
    Array.isArray(rows)
      ? rows
          .map((row) => row?.table_name)
          .filter((tableName): tableName is string => typeof tableName === 'string')
      : [],
  );
  const missingTables = REQUIRED_POSTGRES_TABLES.filter((tableName) => !existingTables.has(tableName));

  if (missingTables.length > 0) {
    throw new Error(
      `Database schema is missing required tables: ${missingTables.join(', ')}. Run Prisma migrations before starting the server.`,
    );
  }
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
  let authUserRepository: PrismaAuthUserRepository | null = null;
  let accountPlanRepository: PrismaAccountPlanRepository | null = null;
  let connectedAccountRepository: PrismaConnectedAccountRepository | null = null;
  let youtubeChannelRepository: PrismaYouTubeChannelRepository | null = null;
  let mediaAssetRepository: PrismaMediaAssetRepository | null = null;
  let startupIssue: string | null = null;

  if (databaseUrl) {
    prismaClient = createPrismaClient(options);
    if (prismaClient) {
      campaignRepository = new PrismaCampaignRepository(prismaClient);
      publishJobRepository = new PrismaPublishJobRepository(prismaClient);
      auditEventRepository = new PrismaAuditEventRepository(prismaClient);
      authUserRepository = new PrismaAuthUserRepository(prismaClient);
      accountPlanRepository = new PrismaAccountPlanRepository(prismaClient);
      connectedAccountRepository = new PrismaConnectedAccountRepository(prismaClient);
      youtubeChannelRepository = new PrismaYouTubeChannelRepository(prismaClient);
      mediaAssetRepository = new PrismaMediaAssetRepository(prismaClient);
    } else {
      startupIssue = createPrismaUnavailableMessage();
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

    get authUserRepository() {
      return authUserRepository;
    },

    get accountPlanRepository() {
      return accountPlanRepository;
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

      if (!databaseUrl) return;
      if (startupIssue) {
        throw new Error(startupIssue);
      }
      if (!prismaClient) return;

      if (disconnectPromise) {
        await disconnectPromise;
      }

      if (!desiredConnected) return;
      if (connected) return;
      if (connectPromise) return connectPromise;

      connectPromise = (async () => {
        try {
          await prismaClient.$connect();
          await verifyRequiredTables(prismaClient);
          connected = true;
        } catch (error) {
          try {
            await prismaClient.$disconnect();
          } catch {
            // Best effort cleanup after a failed startup check.
          }

          connected = false;
          throw error;
        }
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
