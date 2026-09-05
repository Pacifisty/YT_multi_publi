import { randomUUID } from 'node:crypto';

export interface PasswordResetTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export interface CreatePasswordResetTokenInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface PasswordResetRepository {
  create(input: CreatePasswordResetTokenInput): Promise<PasswordResetTokenRecord>;
  consume(tokenHash: string, now: Date): Promise<PasswordResetTokenRecord | null>;
  invalidateForUser(userId: string, now: Date): Promise<number>;
  purgeExpired(now: Date): Promise<number>;
}

export class InMemoryPasswordResetRepository implements PasswordResetRepository {
  private readonly records = new Map<string, PasswordResetTokenRecord>();

  async create(input: CreatePasswordResetTokenInput): Promise<PasswordResetTokenRecord> {
    const record: PasswordResetTokenRecord = {
      id: randomUUID(),
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: new Date(input.expiresAt),
      usedAt: null,
      createdAt: new Date(input.createdAt),
    };
    this.records.set(record.id, record);
    return cloneRecord(record);
  }

  async consume(tokenHash: string, now: Date): Promise<PasswordResetTokenRecord | null> {
    for (const [id, record] of this.records.entries()) {
      if (record.tokenHash !== tokenHash || record.usedAt || record.expiresAt.getTime() <= now.getTime()) {
        continue;
      }
      const consumed = { ...record, usedAt: new Date(now) };
      this.records.set(id, consumed);
      return cloneRecord(consumed);
    }
    return null;
  }

  async invalidateForUser(userId: string, now: Date): Promise<number> {
    let count = 0;
    for (const [id, record] of this.records.entries()) {
      if (record.userId !== userId || record.usedAt) continue;
      this.records.set(id, { ...record, usedAt: new Date(now) });
      count += 1;
    }
    return count;
  }

  async purgeExpired(now: Date): Promise<number> {
    let count = 0;
    for (const [id, record] of this.records.entries()) {
      if (record.expiresAt.getTime() > now.getTime() && !record.usedAt) continue;
      this.records.delete(id);
      count += 1;
    }
    return count;
  }
}

function cloneRecord(record: PasswordResetTokenRecord): PasswordResetTokenRecord {
  return {
    ...record,
    expiresAt: new Date(record.expiresAt),
    usedAt: record.usedAt ? new Date(record.usedAt) : null,
    createdAt: new Date(record.createdAt),
  };
}
