import { randomUUID } from 'node:crypto';

export interface ConnectedAccount {
  id: string;
  ownerEmail?: string | null;
  provider: string;
  googleSubject: string | null;
  providerSubject?: string | null;
  email: string | null;
  displayName: string | null;
  accessTokenEnc: string;
  refreshTokenEnc: string | null;
  scopes: string[];
  tokenExpiresAt: Date | null;
  status: string;
  connectedAt: Date;
  updatedAt: Date;
}

export interface CreateConnectedAccountDto {
  ownerEmail?: string | null;
  provider: string;
  googleSubject?: string | null;
  providerSubject?: string | null;
  email?: string | null;
  displayName?: string | null;
  accessTokenEnc: string;
  refreshTokenEnc?: string | null;
  scopes?: string[];
  tokenExpiresAt?: Date | null;
}

export interface UpdateTokensDto {
  accessTokenEnc?: string;
  refreshTokenEnc?: string | null;
  tokenExpiresAt?: Date | null;
}

export interface ConnectedAccountRepository {
  create(dto: CreateConnectedAccountDto): Promise<ConnectedAccount>;
  findById(id: string): Promise<ConnectedAccount | null>;
  findAll(): Promise<ConnectedAccount[]>;
  findByProvider(provider: string): Promise<ConnectedAccount[]>;
  update(id: string, data: Partial<ConnectedAccount>): Promise<ConnectedAccount | null>;
  delete(id: string): Promise<boolean>;
}

function validate(dto: CreateConnectedAccountDto): void {
  if (!dto.provider) {
    throw new Error('provider is required');
  }
  if (!dto.accessTokenEnc) {
    throw new Error('accessTokenEnc is required');
  }
}

export class ConnectedAccountService {
  constructor(private readonly repo: ConnectedAccountRepository) {}

  async create(dto: CreateConnectedAccountDto): Promise<{ account: ConnectedAccount }> {
    validate(dto);
    const account = await this.repo.create(dto);
    return { account };
  }

  async getById(id: string): Promise<ConnectedAccount | null> {
    return this.repo.findById(id);
  }

  async list(): Promise<ConnectedAccount[]> {
    return this.repo.findAll();
  }

  async listByProvider(provider: string): Promise<ConnectedAccount[]> {
    return this.repo.findByProvider(provider);
  }

  async updateTokens(id: string, tokens: UpdateTokensDto): Promise<ConnectedAccount | null> {
    return this.repo.update(id, { ...tokens, updatedAt: new Date() });
  }

  async disconnect(id: string): Promise<boolean> {
    const result = await this.repo.update(id, { status: 'disconnected', updatedAt: new Date() });
    return result !== null;
  }

  async reconnect(id: string): Promise<boolean> {
    const result = await this.repo.update(id, { status: 'connected', updatedAt: new Date() });
    return result !== null;
  }

  async delete(id: string): Promise<boolean> {
    return this.repo.delete(id);
  }
}

export class InMemoryConnectedAccountRepository implements ConnectedAccountRepository {
  private accounts = new Map<string, ConnectedAccount>();

  async create(dto: CreateConnectedAccountDto): Promise<ConnectedAccount> {
    const now = new Date();
    const account: ConnectedAccount = {
      id: randomUUID(),
      ownerEmail: dto.ownerEmail ?? null,
      provider: dto.provider,
      googleSubject: dto.providerSubject ?? dto.googleSubject ?? null,
      providerSubject: dto.providerSubject ?? dto.googleSubject ?? null,
      email: dto.email ?? null,
      displayName: dto.displayName ?? null,
      accessTokenEnc: dto.accessTokenEnc,
      refreshTokenEnc: dto.refreshTokenEnc ?? null,
      scopes: dto.scopes ?? [],
      tokenExpiresAt: dto.tokenExpiresAt ?? null,
      status: 'connected',
      connectedAt: now,
      updatedAt: now,
    };
    this.accounts.set(account.id, account);
    return { ...account };
  }

  async findById(id: string): Promise<ConnectedAccount | null> {
    const account = this.accounts.get(id);
    return account ? { ...account } : null;
  }

  async findAll(): Promise<ConnectedAccount[]> {
    return [...this.accounts.values()].map((a) => ({ ...a }));
  }

  async findByProvider(provider: string): Promise<ConnectedAccount[]> {
    return [...this.accounts.values()]
      .filter((a) => a.provider === provider)
      .map((a) => ({ ...a }));
  }

  async update(id: string, data: Partial<ConnectedAccount>): Promise<ConnectedAccount | null> {
    const account = this.accounts.get(id);
    if (!account) return null;
    Object.assign(account, data);
    return { ...account };
  }

  async delete(id: string): Promise<boolean> {
    return this.accounts.delete(id);
  }
}
