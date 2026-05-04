import type { AccountDeletionFinalizationResult, AuthUser, AuthUserRepository, CreateAuthUserDto } from './auth-user.repository';
import { createAnonymizedEmail } from './auth-user.repository';

interface PrismaClient {
  $transaction<T>(fn: (tx: PrismaClient) => Promise<T>): Promise<T>;
  adminUser: {
    create(args: { data: any }): Promise<any>;
    findUnique(args: { where: { id?: string; email?: string; googleSubject?: string } }): Promise<any>;
    findMany(args?: any): Promise<any[]>;
    update(args: { where: { id: string }; data: any }): Promise<any>;
  };
  accountPlan: {
    deleteMany(args: any): Promise<{ count: number }>;
  };
  connectedAccount: {
    findMany(args: any): Promise<any[]>;
    deleteMany(args: any): Promise<{ count: number }>;
  };
  youTubeChannel: {
    findMany(args: any): Promise<any[]>;
    deleteMany(args: any): Promise<{ count: number }>;
  };
  mediaAsset: {
    findMany(args: any): Promise<any[]>;
    deleteMany(args: any): Promise<{ count: number }>;
  };
  mediaAssetPreset: {
    deleteMany(args: any): Promise<{ count: number }>;
  };
  playlist: {
    findMany(args: any): Promise<any[]>;
    deleteMany(args: any): Promise<{ count: number }>;
  };
  playlistItem: {
    deleteMany(args: any): Promise<{ count: number }>;
  };
  campaign: {
    findMany(args: any): Promise<any[]>;
    deleteMany(args: any): Promise<{ count: number }>;
  };
  campaignTarget: {
    findMany(args: any): Promise<any[]>;
    deleteMany(args: any): Promise<{ count: number }>;
  };
  publishJob: {
    deleteMany(args: any): Promise<{ count: number }>;
  };
  auditEvent: {
    deleteMany(args: any): Promise<{ count: number }>;
  };
}

function toAuthUser(row: any): AuthUser {
  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName ?? null,
    passwordHash: row.passwordHash ?? null,
    googleSubject: row.googleSubject ?? null,
    isActive: Boolean(row.isActive),
    planSelectionCompleted: Boolean(row.planSelectionCompleted),
    accountDeletionRequestedAt: row.accountDeletionRequestedAt ? new Date(row.accountDeletionRequestedAt) : null,
    accountDeactivationScheduledAt: row.accountDeactivationScheduledAt ? new Date(row.accountDeactivationScheduledAt) : null,
    accountDeletionScheduledAt: row.accountDeletionScheduledAt ? new Date(row.accountDeletionScheduledAt) : null,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt),
  };
}

export class PrismaAuthUserRepository implements AuthUserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(dto: CreateAuthUserDto): Promise<AuthUser> {
    const row = await this.prisma.adminUser.create({
      data: {
        email: dto.email.trim().toLowerCase(),
        fullName: dto.fullName?.trim() || null,
        passwordHash: dto.passwordHash ?? null,
        googleSubject: dto.googleSubject?.trim() || null,
        isActive: dto.isActive ?? true,
        planSelectionCompleted: dto.planSelectionCompleted ?? false,
        accountDeletionRequestedAt: dto.accountDeletionRequestedAt ?? null,
        accountDeactivationScheduledAt: dto.accountDeactivationScheduledAt ?? null,
        accountDeletionScheduledAt: dto.accountDeletionScheduledAt ?? null,
      },
    });
    return toAuthUser(row);
  }

  async findById(id: string): Promise<AuthUser | null> {
    const row = await this.prisma.adminUser.findUnique({ where: { id } });
    return row ? toAuthUser(row) : null;
  }

  async findByEmail(email: string): Promise<AuthUser | null> {
    const row = await this.prisma.adminUser.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    return row ? toAuthUser(row) : null;
  }

  async findByGoogleSubject(googleSubject: string): Promise<AuthUser | null> {
    const row = await this.prisma.adminUser.findUnique({
      where: { googleSubject: googleSubject.trim() },
    });
    return row ? toAuthUser(row) : null;
  }

  async update(id: string, data: Partial<AuthUser>): Promise<AuthUser | null> {
    try {
      const row = await this.prisma.adminUser.update({
        where: { id },
        data: {
          ...(data.email !== undefined ? { email: data.email.trim().toLowerCase() } : {}),
          ...(data.fullName !== undefined ? { fullName: data.fullName?.trim() || null } : {}),
          ...(data.passwordHash !== undefined ? { passwordHash: data.passwordHash } : {}),
          ...(data.googleSubject !== undefined ? { googleSubject: data.googleSubject?.trim() || null } : {}),
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
          ...(data.planSelectionCompleted !== undefined ? { planSelectionCompleted: data.planSelectionCompleted } : {}),
          ...(data.accountDeletionRequestedAt !== undefined ? { accountDeletionRequestedAt: data.accountDeletionRequestedAt } : {}),
          ...(data.accountDeactivationScheduledAt !== undefined ? { accountDeactivationScheduledAt: data.accountDeactivationScheduledAt } : {}),
          ...(data.accountDeletionScheduledAt !== undefined ? { accountDeletionScheduledAt: data.accountDeletionScheduledAt } : {}),
          ...(data.updatedAt !== undefined ? { updatedAt: data.updatedAt } : {}),
        },
      });
      return toAuthUser(row);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return null;
      }
      throw error;
    }
  }

  async list(): Promise<AuthUser[]> {
    const rows = await this.prisma.adminUser.findMany();
    return rows.map(toAuthUser);
  }

  async listDueForAccountDeletion(now: Date): Promise<AuthUser[]> {
    const rows = await this.prisma.adminUser.findMany({
      where: {
        accountDeletionScheduledAt: {
          lte: now,
        },
        NOT: {
          email: {
            startsWith: 'deleted-',
          },
        },
      },
    });
    return rows.map(toAuthUser);
  }

  async finalizeAccountDeletion(user: AuthUser, now: Date): Promise<AccountDeletionFinalizationResult> {
    const email = user.email.trim().toLowerCase();
    const anonymizedEmail = createAnonymizedEmail(user.id);

    return this.prisma.$transaction(async (tx) => {
      const connectedAccounts = await tx.connectedAccount.findMany({
        where: { ownerEmail: email },
        select: { id: true },
      });
      const connectedAccountIds = idsFromRows(connectedAccounts);

      const channels = connectedAccountIds.length > 0
        ? await tx.youTubeChannel.findMany({
            where: { connectedAccountId: { in: connectedAccountIds } },
            select: { id: true },
          })
        : [];
      const channelIds = idsFromRows(channels);

      const campaigns = await tx.campaign.findMany({
        where: { ownerEmail: email },
        select: { id: true },
      });
      const campaignIds = idsFromRows(campaigns);

      const directMediaAssets = await tx.mediaAsset.findMany({
        where: { ownerEmail: email },
        select: { id: true },
      });
      const directMediaAssetIds = idsFromRows(directMediaAssets);

      const linkedThumbnails = directMediaAssetIds.length > 0
        ? await tx.mediaAsset.findMany({
            where: { linkedVideoAssetId: { in: directMediaAssetIds } },
            select: { id: true },
          })
        : [];
      const mediaAssetIds = uniqueIds([
        ...directMediaAssetIds,
        ...idsFromRows(linkedThumbnails),
      ]);

      const playlists = await tx.playlist.findMany({
        where: { ownerEmail: email },
        select: { id: true },
      });
      const playlistIds = idsFromRows(playlists);

      const targetWhere = buildOrWhere([
        inCondition('campaignId', campaignIds),
        inCondition('connectedAccountId', connectedAccountIds),
        inCondition('channelId', channelIds),
        inCondition('thumbnailAssetId', mediaAssetIds),
      ]);
      const targets = targetWhere
        ? await tx.campaignTarget.findMany({
            where: targetWhere,
            select: { id: true },
          })
        : [];
      const targetIds = idsFromRows(targets);

      const auditEventsDeleted = await tx.auditEvent.deleteMany({
        where: buildOrWhere([
          { actorEmail: email },
          inCondition('campaignId', campaignIds),
          inCondition('targetId', targetIds),
        ]) ?? { actorEmail: email },
      });
      const publishJobsDeleted = targetIds.length > 0
        ? await tx.publishJob.deleteMany({ where: { campaignTargetId: { in: targetIds } } })
        : { count: 0 };
      const campaignTargetsDeleted = targetIds.length > 0
        ? await tx.campaignTarget.deleteMany({ where: { id: { in: targetIds } } })
        : { count: 0 };
      const campaignsDeleted = campaignIds.length > 0
        ? await tx.campaign.deleteMany({ where: { id: { in: campaignIds } } })
        : { count: 0 };

      if (playlistIds.length > 0 || mediaAssetIds.length > 0) {
        await tx.playlistItem.deleteMany({
          where: buildOrWhere([
            inCondition('playlistId', playlistIds),
            inCondition('videoAssetId', mediaAssetIds),
          ]) ?? { id: { in: [] } },
        });
      }

      const playlistsDeleted = playlistIds.length > 0
        ? await tx.playlist.deleteMany({ where: { id: { in: playlistIds } } })
        : { count: 0 };
      if (mediaAssetIds.length > 0) {
        await tx.mediaAssetPreset.deleteMany({ where: { videoAssetId: { in: mediaAssetIds } } });
      }
      const mediaAssetsDeleted = mediaAssetIds.length > 0
        ? await tx.mediaAsset.deleteMany({ where: { id: { in: mediaAssetIds } } })
        : { count: 0 };
      const channelsDeleted = channelIds.length > 0
        ? await tx.youTubeChannel.deleteMany({ where: { id: { in: channelIds } } })
        : { count: 0 };
      const connectedAccountsDeleted = connectedAccountIds.length > 0
        ? await tx.connectedAccount.deleteMany({ where: { id: { in: connectedAccountIds } } })
        : { count: 0 };
      const accountPlansDeleted = await tx.accountPlan.deleteMany({ where: { email } });

      await tx.adminUser.update({
        where: { id: user.id },
        data: {
          email: anonymizedEmail,
          fullName: null,
          passwordHash: null,
          googleSubject: null,
          isActive: false,
          planSelectionCompleted: false,
          updatedAt: now,
        },
      });

      return {
        userId: user.id,
        email,
        anonymizedEmail,
        authUsersAnonymized: 1,
        accountPlansDeleted: accountPlansDeleted.count,
        connectedAccountsDeleted: connectedAccountsDeleted.count,
        channelsDeleted: channelsDeleted.count,
        campaignsDeleted: campaignsDeleted.count,
        campaignTargetsDeleted: campaignTargetsDeleted.count,
        publishJobsDeleted: publishJobsDeleted.count,
        mediaAssetsDeleted: mediaAssetsDeleted.count,
        playlistsDeleted: playlistsDeleted.count,
        auditEventsDeleted: auditEventsDeleted.count,
      };
    });
  }
}

function idsFromRows(rows: Array<{ id?: string }>): string[] {
  return rows
    .map((row) => row.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
}

function uniqueIds(ids: string[]): string[] {
  return Array.from(new Set(ids));
}

function inCondition(field: string, ids: string[]): Record<string, unknown> | null {
  return ids.length > 0 ? { [field]: { in: ids } } : null;
}

function buildOrWhere(conditions: Array<Record<string, unknown> | null>): { OR: Record<string, unknown>[] } | null {
  const activeConditions = conditions.filter((condition): condition is Record<string, unknown> => Boolean(condition));
  return activeConditions.length > 0 ? { OR: activeConditions } : null;
}
