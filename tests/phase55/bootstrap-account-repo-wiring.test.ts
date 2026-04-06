import { describe, it, expect, vi } from 'vitest';
import { bootstrap } from '../../apps/api/src/bootstrap';
import { createAccountRepoAdapter } from '../../apps/api/src/config/account-repo-adapter';
import type { ConnectedAccountRepository, ConnectedAccount } from '../../apps/api/src/accounts/connected-account.service';

const baseEnv = {
  OAUTH_TOKEN_KEY: 'a]3Fk9$2mP!xL7nQ&vR4wY6zA0cE8gI5',
  NODE_ENV: 'development',
  ADMIN_EMAIL: 'admin@example.com',
  ADMIN_PASSWORD_HASH: 'plain:secret123',
  DATABASE_URL: 'postgresql://localhost:5432/test',
  GOOGLE_CLIENT_ID: 'google-client-id',
  GOOGLE_CLIENT_SECRET: 'google-client-secret',
  GOOGLE_REDIRECT_URI: 'http://localhost:3000/auth/callback',
};

const testAccount: ConnectedAccount = {
  id: 'acc-1',
  provider: 'google',
  email: 'test@example.com',
  displayName: 'Test User',
  accessTokenEnc: 'encrypted-access',
  refreshTokenEnc: 'encrypted-refresh',
  scopes: ['youtube.readonly'],
  tokenExpiresAt: new Date('2025-01-01T00:00:00Z'),
  status: 'connected',
  connectedAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-06-01T00:00:00Z'),
};

function makeMockRepo(overrides: Partial<ConnectedAccountRepository> = {}): ConnectedAccountRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(async () => null),
    findAll: vi.fn(async () => []),
    findByProvider: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    ...overrides,
  };
}

// ── Adapter unit tests ──

describe('createAccountRepoAdapter', () => {
  it('getConnectedAccount delegates to repo.findById and adapts result', async () => {
    const repo = makeMockRepo({ findById: vi.fn(async () => testAccount) });
    const adapter = createAccountRepoAdapter(repo);

    const result = await adapter.getConnectedAccount('acc-1');

    expect(repo.findById).toHaveBeenCalledWith('acc-1');
    expect(result).toEqual({
      id: 'acc-1',
      provider: 'google',
      email: 'test@example.com',
      displayName: 'Test User',
      accessTokenEnc: 'encrypted-access',
      refreshTokenEnc: 'encrypted-refresh',
      scopes: ['youtube.readonly'],
      tokenExpiresAt: '2025-01-01T00:00:00.000Z',
      status: 'connected',
      connectedAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-06-01T00:00:00.000Z',
    });
  });

  it('getConnectedAccount returns null when repo returns null', async () => {
    const repo = makeMockRepo({ findById: vi.fn(async () => null) });
    const adapter = createAccountRepoAdapter(repo);

    const result = await adapter.getConnectedAccount('nonexistent');
    expect(result).toBeNull();
  });

  it('listConnectedAccounts delegates to repo.findAll and adapts results', async () => {
    const repo = makeMockRepo({ findAll: vi.fn(async () => [testAccount]) });
    const adapter = createAccountRepoAdapter(repo);

    const results = await adapter.listConnectedAccounts();

    expect(repo.findAll).toHaveBeenCalled();
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('acc-1');
    expect(results[0].connectedAt).toBe('2024-01-01T00:00:00.000Z');
  });

  it('updateConnectedAccount delegates to repo.update with adapted data', async () => {
    const updatedAccount: ConnectedAccount = { ...testAccount, status: 'disconnected' };
    const repo = makeMockRepo({ update: vi.fn(async () => updatedAccount) });
    const adapter = createAccountRepoAdapter(repo);

    const result = await adapter.updateConnectedAccount('acc-1', {
      status: 'disconnected',
      updatedAt: '2024-07-01T00:00:00.000Z',
    });

    expect(repo.update).toHaveBeenCalledWith('acc-1', expect.objectContaining({
      status: 'disconnected',
    }));
    expect(result.id).toBe('acc-1');
    expect(result.status).toBe('disconnected');
  });

  it('handles null optional fields in ConnectedAccount', async () => {
    const accountWithNulls: ConnectedAccount = {
      ...testAccount,
      email: null,
      displayName: null,
      tokenExpiresAt: null,
      refreshTokenEnc: null,
    };
    const repo = makeMockRepo({ findById: vi.fn(async () => accountWithNulls) });
    const adapter = createAccountRepoAdapter(repo);

    const result = await adapter.getConnectedAccount('acc-1');

    expect(result!.email).toBeUndefined();
    expect(result!.displayName).toBeUndefined();
    expect(result!.tokenExpiresAt).toBeNull();
    expect(result!.refreshTokenEnc).toBeNull();
  });
});

// ── Bootstrap wiring integration tests ──

describe('Bootstrap wires Prisma account repos', () => {
  function makeMockPrisma(seedAccounts: any[] = []) {
    const accounts = [...seedAccounts];
    return {
      $connect: vi.fn(),
      $disconnect: vi.fn(),
      campaign: {
        create: vi.fn(async ({ data }: any) => data),
        findUnique: vi.fn(async () => null),
        findMany: vi.fn(async () => []),
        update: vi.fn(async () => null),
        delete: vi.fn(async () => null),
      },
      campaignTarget: {
        create: vi.fn(async ({ data }: any) => data),
        delete: vi.fn(async () => null),
        update: vi.fn(async () => null),
      },
      publishJob: {
        create: vi.fn(async ({ data }: any) => data),
        findUnique: vi.fn(async () => null),
        findMany: vi.fn(async () => []),
        update: vi.fn(async () => null),
        delete: vi.fn(async () => null),
      },
      connectedAccount: {
        create: vi.fn(async ({ data }: any) => {
          accounts.push(data);
          return data;
        }),
        findUnique: vi.fn(async ({ where }: any) => {
          return accounts.find((a: any) => a.id === where.id) ?? null;
        }),
        findMany: vi.fn(async () => [...accounts]),
        update: vi.fn(async ({ where, data }: any) => {
          const a = accounts.find((a: any) => a.id === where.id);
          if (!a) throw { code: 'P2025' };
          Object.assign(a, data);
          return { ...a };
        }),
        delete: vi.fn(async ({ where }: any) => {
          const idx = accounts.findIndex((a: any) => a.id === where.id);
          if (idx === -1) throw { code: 'P2025' };
          return accounts.splice(idx, 1)[0];
        }),
      },
      youtubeChannel: {
        create: vi.fn(async ({ data }: any) => data),
        findUnique: vi.fn(async () => null),
        findMany: vi.fn(async () => []),
        update: vi.fn(async () => null),
        delete: vi.fn(async () => null),
      },
      mediaAsset: {
        create: vi.fn(async ({ data }: any) => data),
        findUnique: vi.fn(async () => null),
        findMany: vi.fn(async () => []),
        update: vi.fn(async () => null),
        delete: vi.fn(async () => null),
      },
    };
  }

  it('listAccounts returns Prisma-backed data through bootstrap', async () => {
    const seedAccount = {
      id: 'acc-1',
      provider: 'google',
      email: 'test@example.com',
      displayName: 'Test User',
      accessTokenEnc: 'enc-access',
      refreshTokenEnc: 'enc-refresh',
      scopes: ['youtube.readonly'],
      tokenExpiresAt: new Date('2025-01-01T00:00:00Z'),
      status: 'connected',
      connectedAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-06-01T00:00:00Z'),
    };
    const mockPrisma = makeMockPrisma([seedAccount]);

    const result = bootstrap({
      env: baseEnv,
      _prismaFactory: () => mockPrisma,
    });

    const accounts = await result.server.app.accountsModule.accountsService.listAccounts();
    expect(accounts).toHaveLength(1);
    expect(accounts[0].id).toBe('acc-1');
    expect(accounts[0].provider).toBe('google');
    expect(mockPrisma.connectedAccount.findMany).toHaveBeenCalled();
  });

  it('getAccount returns Prisma-backed data through bootstrap', async () => {
    const seedAccount = {
      id: 'acc-2',
      provider: 'google',
      email: 'user@example.com',
      displayName: 'User',
      accessTokenEnc: 'enc-access',
      refreshTokenEnc: null,
      scopes: [],
      tokenExpiresAt: null,
      status: 'connected',
      connectedAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-06-01T00:00:00Z'),
    };
    const mockPrisma = makeMockPrisma([seedAccount]);

    const result = bootstrap({
      env: baseEnv,
      _prismaFactory: () => mockPrisma,
    });

    const account = await result.server.app.accountsModule.accountsService.getAccount('acc-2');
    expect(account).not.toBeNull();
    expect(account!.id).toBe('acc-2');
    expect(account!.email).toBe('user@example.com');
    expect(mockPrisma.connectedAccount.findUnique).toHaveBeenCalledWith({ where: { id: 'acc-2' } });
  });

  it('disconnectAccountAsync delegates update to Prisma through bootstrap', async () => {
    const seedAccount = {
      id: 'acc-3',
      provider: 'google',
      email: 'disc@example.com',
      displayName: 'Disc User',
      accessTokenEnc: 'enc-access',
      refreshTokenEnc: null,
      scopes: [],
      tokenExpiresAt: null,
      status: 'connected',
      connectedAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-06-01T00:00:00Z'),
    };
    const mockPrisma = makeMockPrisma([seedAccount]);

    const result = bootstrap({
      env: baseEnv,
      _prismaFactory: () => mockPrisma,
    });

    const disconnectResult = await result.server.app.accountsModule.accountsService.disconnectAccountAsync('acc-3');
    expect(disconnectResult.disconnected).toBe(true);
    expect(disconnectResult.account).toBeDefined();
    expect(disconnectResult.account!.status).toBe('disconnected');
    expect(mockPrisma.connectedAccount.update).toHaveBeenCalled();
  });

  it('defaults to in-memory behavior without database', async () => {
    const result = bootstrap({
      env: { ...baseEnv, DATABASE_URL: undefined },
    });

    const accounts = await result.server.app.accountsModule.accountsService.listAccounts();
    expect(accounts).toEqual([]);

    const account = await result.server.app.accountsModule.accountsService.getAccount('nonexistent');
    expect(account).toBeNull();
  });
});
