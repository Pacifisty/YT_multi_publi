import type { ConnectedAccount, CreateConnectedAccountDto, ConnectedAccountRepository } from './connected-account.service';
import { randomUUID } from 'node:crypto';

interface PrismaClient {
  connectedAccount: {
    create(args: { data: any }): Promise<any>;
    findUnique(args: { where: { id: string } }): Promise<any>;
    findMany(args: { where?: any }): Promise<any[]>;
    update(args: { where: { id: string }; data: any }): Promise<any>;
    delete(args: { where: { id: string } }): Promise<any>;
  };
}

function toConnectedAccount(row: any): ConnectedAccount {
  return {
    id: row.id,
    provider: row.provider,
    email: row.email ?? null,
    displayName: row.displayName ?? null,
    accessTokenEnc: row.accessTokenEnc,
    refreshTokenEnc: row.refreshTokenEnc ?? null,
    scopes: row.scopes ?? [],
    tokenExpiresAt: row.tokenExpiresAt instanceof Date ? row.tokenExpiresAt : row.tokenExpiresAt ? new Date(row.tokenExpiresAt) : null,
    status: row.status,
    connectedAt: row.connectedAt instanceof Date ? row.connectedAt : new Date(row.connectedAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt),
  };
}

export class PrismaConnectedAccountRepository implements ConnectedAccountRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(dto: CreateConnectedAccountDto): Promise<ConnectedAccount> {
    const now = new Date();
    const row = await this.prisma.connectedAccount.create({
      data: {
        id: randomUUID(),
        provider: dto.provider,
        email: dto.email ?? null,
        displayName: dto.displayName ?? null,
        accessTokenEnc: dto.accessTokenEnc,
        refreshTokenEnc: dto.refreshTokenEnc ?? null,
        scopes: dto.scopes ?? [],
        tokenExpiresAt: dto.tokenExpiresAt ?? null,
        status: 'connected',
        connectedAt: now,
        updatedAt: now,
      },
    });
    return toConnectedAccount(row);
  }

  async findById(id: string): Promise<ConnectedAccount | null> {
    const row = await this.prisma.connectedAccount.findUnique({ where: { id } });
    if (!row) return null;
    return toConnectedAccount(row);
  }

  async findAll(): Promise<ConnectedAccount[]> {
    const rows = await this.prisma.connectedAccount.findMany();
    return rows.map(toConnectedAccount);
  }

  async findByProvider(provider: string): Promise<ConnectedAccount[]> {
    const rows = await this.prisma.connectedAccount.findMany({ where: { provider } });
    return rows.map(toConnectedAccount);
  }

  async update(id: string, data: Partial<ConnectedAccount>): Promise<ConnectedAccount | null> {
    try {
      const row = await this.prisma.connectedAccount.update({
        where: { id },
        data,
      });
      return toConnectedAccount(row);
    } catch (error: any) {
      if (error.code === 'P2025') return null;
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.connectedAccount.delete({ where: { id } });
      return true;
    } catch (error: any) {
      if (error.code === 'P2025') return false;
      throw error;
    }
  }
}
