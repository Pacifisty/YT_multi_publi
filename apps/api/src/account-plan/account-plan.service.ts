import type { CampaignRecord } from '../campaigns/campaign.service';

export type AccountPlanType = 'FREE' | 'BASIC' | 'PRO';
export type AccountDepthProfile = 'light' | 'balanced' | 'deep';

export interface AccountPlanDefinition {
  code: AccountPlanType;
  label: string;
  priceBrl: number | null;
  durationDays: number | null;
  maxTokens: number;
  dailyVisitTokens: number;
  campaignPublishCostTokens: number;
  allowedPlatforms: string[];
  depthProfile: AccountDepthProfile;
}

export interface AccountPlanRecord {
  email: string;
  plan: AccountPlanType;
  tokens: number;
  lastDailyVisitAt: string | null;
  billingStartedAt: string | null;
  billingExpiresAt: string | null;
  selectedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccountPlanSummary {
  email: string;
  plan: AccountPlanType;
  planLabel: string;
  tokens: number;
  maxTokens: number;
  dailyVisitTokens: number;
  campaignPublishCostTokens: number;
  priceBrl: number | null;
  durationDays: number | null;
  billingStartedAt: string | null;
  billingExpiresAt: string | null;
  expiresSoon: boolean;
  dailyVisitClaimedToday: boolean;
  allowedPlatforms: string[];
  depthProfile: AccountDepthProfile;
}

export interface AccountPlanStore {
  findByEmail(email: string): Promise<AccountPlanRecord | null> | AccountPlanRecord | null;
  save(record: AccountPlanRecord): Promise<AccountPlanRecord> | AccountPlanRecord;
}

export interface AccountPlanServiceOptions {
  now?: () => Date;
  store?: AccountPlanStore;
}

export const ACCOUNT_PLAN_DEFINITIONS: Record<AccountPlanType, AccountPlanDefinition> = {
  FREE: {
    code: 'FREE',
    label: 'Free',
    priceBrl: null,
    durationDays: null,
    maxTokens: 80,
    dailyVisitTokens: 10,
    campaignPublishCostTokens: 5,
    allowedPlatforms: ['youtube'],
    depthProfile: 'light',
  },
  BASIC: {
    code: 'BASIC',
    label: 'Basic',
    priceBrl: 9.99,
    durationDays: 30,
    maxTokens: 250,
    dailyVisitTokens: 25,
    campaignPublishCostTokens: 5,
    allowedPlatforms: ['youtube'],
    depthProfile: 'balanced',
  },
  PRO: {
    code: 'PRO',
    label: 'Pro',
    priceBrl: 19.99,
    durationDays: 30,
    maxTokens: 600,
    dailyVisitTokens: 50,
    campaignPublishCostTokens: 5,
    allowedPlatforms: ['youtube', 'instagram', 'tiktok'],
    depthProfile: 'deep',
  },
};

export interface DailyVisitGrantResult {
  claimed: boolean;
  grantedTokens: number;
  account: AccountPlanSummary;
}

export interface PlanSelectionResult {
  account: AccountPlanSummary;
}

export interface CampaignLaunchAuthorizationResult {
  ok: true;
  chargedTokens: number;
  account: AccountPlanSummary;
}

export class AccountPlanAccessError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 403) {
    super(message);
    this.name = 'AccountPlanAccessError';
    this.statusCode = statusCode;
  }
}

export class AccountPlanTokenError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 402) {
    super(message);
    this.name = 'AccountPlanTokenError';
    this.statusCode = statusCode;
  }
}

export class AccountPlanService {
  private readonly now: () => Date;
  private readonly store: AccountPlanStore;

  constructor(options: AccountPlanServiceOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.store = options.store ?? new InMemoryAccountPlanStore();
  }

  async getAccount(email: string): Promise<AccountPlanSummary> {
    const record = await this.getOrCreateRecord(email);
    return this.toSummary(record);
  }

  async claimDailyVisit(email: string): Promise<DailyVisitGrantResult> {
    const record = await this.getOrCreateRecord(email);
    const definition = ACCOUNT_PLAN_DEFINITIONS[record.plan];
    const today = this.getBusinessDate();
    const alreadyClaimed = this.toBusinessDate(record.lastDailyVisitAt) === today;

    if (alreadyClaimed) {
      return {
        claimed: false,
        grantedTokens: 0,
        account: this.toSummary(record),
      };
    }

    const nextTokens = Math.min(record.tokens + definition.dailyVisitTokens, definition.maxTokens);
    const grantedTokens = Math.max(nextTokens - record.tokens, 0);
    const updated = await this.store.save({
      ...record,
      tokens: nextTokens,
      lastDailyVisitAt: this.now().toISOString(),
      updatedAt: this.now().toISOString(),
    });

    return {
      claimed: true,
      grantedTokens,
      account: this.toSummary(updated),
    };
  }

  async selectPlan(email: string, plan: AccountPlanType): Promise<PlanSelectionResult> {
    const current = await this.getOrCreateRecord(email);
    const definition = ACCOUNT_PLAN_DEFINITIONS[plan];
    const nowIso = this.now().toISOString();

    const updated = await this.store.save({
      ...current,
      plan,
      tokens: Math.min(current.tokens, definition.maxTokens),
      billingStartedAt: definition.durationDays ? nowIso : null,
      billingExpiresAt: definition.durationDays ? new Date(this.now().getTime() + definition.durationDays * 24 * 60 * 60 * 1000).toISOString() : null,
      selectedAt: nowIso,
      updatedAt: nowIso,
    });

    return { account: this.toSummary(updated) };
  }

  async assertPlatformAccess(email: string, platform: string): Promise<void> {
    const account = await this.getAccount(email);
    if (account.allowedPlatforms.includes(platform)) {
      return;
    }

    throw new AccountPlanAccessError(
      platform === 'instagram' || platform === 'tiktok'
        ? 'Seu plano atual nao permite publicar no Instagram ou TikTok. Faça upgrade para o plano PRO.'
        : 'Seu plano atual nao permite usar este destino de publicacao.',
      403,
    );
  }

  async authorizeCampaignLaunch(email: string, campaign: CampaignRecord): Promise<CampaignLaunchAuthorizationResult> {
    const record = await this.getOrCreateRecord(email);
    const definition = ACCOUNT_PLAN_DEFINITIONS[record.plan];

    for (const target of campaign.targets) {
      if (!definition.allowedPlatforms.includes(target.platform ?? 'youtube')) {
        throw new AccountPlanAccessError(
          'Seu plano atual nao cobre todos os destinos desta campanha. O plano PRO libera Instagram e TikTok.',
          403,
        );
      }
    }

    const chargedTokens = campaign.targets.length * definition.campaignPublishCostTokens;
    if (record.tokens < chargedTokens) {
      throw new AccountPlanTokenError(
        `Tokens insuficientes para lancar esta campanha. Saldo atual: ${record.tokens}. Necessario: ${chargedTokens}.`,
        402,
      );
    }

    const updated = await this.store.save({
      ...record,
      tokens: record.tokens - chargedTokens,
      updatedAt: this.now().toISOString(),
    });

    return {
      ok: true,
      chargedTokens,
      account: this.toSummary(updated),
    };
  }

  private async getOrCreateRecord(email: string): Promise<AccountPlanRecord> {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await this.store.findByEmail(normalizedEmail);
    if (!existing) {
      const nowIso = this.now().toISOString();
      const created: AccountPlanRecord = {
        email: normalizedEmail,
        plan: 'FREE',
        tokens: 0,
        lastDailyVisitAt: null,
        billingStartedAt: null,
        billingExpiresAt: null,
        selectedAt: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      return this.store.save(created);
    }

    if (this.isExpired(existing)) {
      const free = ACCOUNT_PLAN_DEFINITIONS.FREE;
      return this.store.save({
        ...existing,
        plan: 'FREE',
        tokens: Math.min(existing.tokens, free.maxTokens),
        billingStartedAt: null,
        billingExpiresAt: null,
        updatedAt: this.now().toISOString(),
      });
    }

    return existing;
  }

  private isExpired(record: AccountPlanRecord): boolean {
    if ((record.plan === 'BASIC' || record.plan === 'PRO') && record.billingExpiresAt) {
      return new Date(record.billingExpiresAt).getTime() <= this.now().getTime();
    }

    return false;
  }

  private toSummary(record: AccountPlanRecord): AccountPlanSummary {
    const definition = ACCOUNT_PLAN_DEFINITIONS[record.plan];
    const expiryMs = record.billingExpiresAt ? new Date(record.billingExpiresAt).getTime() : null;

    return {
      email: record.email,
      plan: record.plan,
      planLabel: definition.label,
      tokens: record.tokens,
      maxTokens: definition.maxTokens,
      dailyVisitTokens: definition.dailyVisitTokens,
      campaignPublishCostTokens: definition.campaignPublishCostTokens,
      priceBrl: definition.priceBrl,
      durationDays: definition.durationDays,
      billingStartedAt: record.billingStartedAt,
      billingExpiresAt: record.billingExpiresAt,
      expiresSoon: expiryMs !== null && expiryMs - this.now().getTime() <= 3 * 24 * 60 * 60 * 1000,
      dailyVisitClaimedToday: this.toBusinessDate(record.lastDailyVisitAt) === this.getBusinessDate(),
      allowedPlatforms: [...definition.allowedPlatforms],
      depthProfile: definition.depthProfile,
    };
  }

  private getBusinessDate(): string {
    const now = this.now();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private toBusinessDate(value: string | null): string | null {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

class InMemoryAccountPlanStore implements AccountPlanStore {
  private readonly records = new Map<string, AccountPlanRecord>();

  async findByEmail(email: string): Promise<AccountPlanRecord | null> {
    return this.records.get(email.trim().toLowerCase()) ?? null;
  }

  async save(record: AccountPlanRecord): Promise<AccountPlanRecord> {
    this.records.set(record.email.trim().toLowerCase(), record);
    return record;
  }
}
