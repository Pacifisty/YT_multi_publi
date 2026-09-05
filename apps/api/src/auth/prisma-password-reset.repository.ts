import type {
  CreatePasswordResetTokenInput,
  PasswordResetRepository,
  PasswordResetTokenRecord,
} from './password-reset.repository';

interface PrismaClientLike {
  passwordResetToken: {
    create(args: { data: Record<string, unknown> }): Promise<any>;
    findUnique(args: { where: { tokenHash: string } }): Promise<any>;
    updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>;
    deleteMany(args: { where: Record<string, unknown> }): Promise<{ count: number }>;
  };
}

export class PrismaPasswordResetRepository implements PasswordResetRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async create(input: CreatePasswordResetTokenInput): Promise<PasswordResetTokenRecord> {
    const row = await this.prisma.passwordResetToken.create({
      data: {
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        createdAt: input.createdAt,
      },
    });
    return toRecord(row);
  }

  async consume(tokenHash: string, now: Date): Promise<PasswordResetTokenRecord | null> {
    const claimed = await this.prisma.passwordResetToken.updateMany({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: now },
      },
      data: { usedAt: now },
    });
    if (claimed.count !== 1) return null;
    const row = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    return row ? toRecord(row) : null;
  }

  async invalidateForUser(userId: string, now: Date): Promise<number> {
    const result = await this.prisma.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: now },
    });
    return result.count;
  }

  async purgeExpired(now: Date): Promise<number> {
    const result = await this.prisma.passwordResetToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lte: now } },
          { usedAt: { not: null } },
        ],
      },
    });
    return result.count;
  }
}

function toRecord(row: any): PasswordResetTokenRecord {
  return {
    id: row.id,
    userId: row.userId,
    tokenHash: row.tokenHash,
    expiresAt: row.expiresAt instanceof Date ? row.expiresAt : new Date(row.expiresAt),
    usedAt: row.usedAt ? (row.usedAt instanceof Date ? row.usedAt : new Date(row.usedAt)) : null,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
  };
}
