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
  thumbnailCostTokens: number;
  allowedPlatforms: string[];
  depthProfile: AccountDepthProfile;
}

export interface AccountPlanRecord {
  email: string;
  plan: AccountPlanType;
  tokens: number;
  lastDailyVisitAt: string | null;
  lastMonthlyGrantAt: string | null;
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
  thumbnailCostTokens: number;
  priceBrl: number | null;
  durationDays: number | null;
  billingStartedAt: string | null;
  billingExpiresAt: string | null;
  expiresSoon: boolean;
  dailyVisitClaimedToday: boolean;
  monthlyGrantClaimedThisMonth: boolean;
  allowedPlatforms: string[];
  depthProfile: AccountDepthProfile;
}

export interface MonthlyGrantResult {
  claimed: boolean;
  grantedTokens: number;
  account: AccountPlanSummary;
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
    maxTokens: 150,
    dailyVisitTokens: 15,
    campaignPublishCostTokens: 2,
    thumbnailCostTokens: 1,
    allowedPlatforms: ['youtube'],
    depthProfile: 'light',
  },
  BASIC: {
    code: 'BASIC',
    label: 'Basic',
    priceBrl: 9.99,
    durationDays: 30,
    maxTokens: 400,
    dailyVisitTokens: 40,
    campaignPublishCostTokens: 2,
    thumbnailCostTokens: 0,
    allowedPlatforms: ['youtube'],
    depthProfile: 'balanced',
  },
  PRO: {
    code: 'PRO',
    label: 'Pro',
    priceBrl: 19.99,
    durationDays: 30,
    maxTokens: 800,
    dailyVisitTokens: 80,
    campaignPublishCostTokens: 2,
    thumbnailCostTokens: 0,
    allowedPlatforms: ['youtube', 'tiktok'],
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

    const grantedTokens = definition.dailyVisitTokens;
    const updated = await this.store.save({
      ...record,
      tokens: record.tokens + grantedTokens,
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

    const planChanged = current.plan !== plan;
    const shouldGrantMonthly = planChanged || !current.lastMonthlyGrantAt;

    const baseTokens = shouldGrantMonthly
      ? current.tokens + definition.maxTokens
      : current.tokens;

    const updated = await this.store.save({
      ...current,
      plan,
      tokens: baseTokens,
      lastMonthlyGrantAt: shouldGrantMonthly ? nowIso : current.lastMonthlyGrantAt,
      billingStartedAt: definition.durationDays ? nowIso : null,
      billingExpiresAt: definition.durationDays ? new Date(this.now().getTime() + definition.durationDays * 24 * 60 * 60 * 1000).toISOString() : null,
      selectedAt: nowIso,
      updatedAt: nowIso,
    });

    return { account: this.toSummary(updated) };
  }

  async claimMonthlyGrant(email: string): Promise<MonthlyGrantResult> {
    const record = await this.getOrCreateRecord(email);
    const definition = ACCOUNT_PLAN_DEFINITIONS[record.plan];
    const thisMonth = this.getBusinessMonth();
    const alreadyClaimed = this.toBusinessMonth(record.lastMonthlyGrantAt) === thisMonth;

    if (alreadyClaimed) {
      return { claimed: false, grantedTokens: 0, account: this.toSummary(record) };
    }

    const grantedTokens = definition.maxTokens;
    const updated = await this.store.save({
      ...record,
      tokens: record.tokens + grantedTokens,
      lastMonthlyGrantAt: this.now().toISOString(),
      updatedAt: this.now().toISOString(),
    });

    return { claimed: true, grantedTokens, account: this.toSummary(updated) };
  }

  async assertPlatformAccess(email: string, platform: string): Promise<void> {
    const account = await this.getAccount(email);
    if (account.allowedPlatforms.includes(platform)) {
      return;
    }

    throw new AccountPlanAccessError(
      platform === 'tiktok'
        ? 'Seu plano atual nao permite publicar no TikTok. Faca upgrade para o plano PRO.'
        : 'Seu plano atual nao permite usar este destino de publicacao.',
      403,
    );
  }

  async chargeThumbnailUpload(email: string): Promise<CampaignLaunchAuthorizationResult> {
    const record = await this.getOrCreateRecord(email);
    const definition = ACCOUNT_PLAN_DEFINITIONS[record.plan];
    const chargedTokens = definition.thumbnailCostTokens;

    if (chargedTokens <= 0) {
      return { ok: true, chargedTokens: 0, account: this.toSummary(record) };
    }

    if (record.tokens < chargedTokens) {
      throw new AccountPlanTokenError(
        `Tokens insuficientes para enviar thumbnail. Saldo atual: ${record.tokens}. Necessario: ${chargedTokens}.`,
        402,
      );
    }

    const updated = await this.store.save({
      ...record,
      tokens: record.tokens - chargedTokens,
      updatedAt: this.now().toISOString(),
    });

    return { ok: true, chargedTokens, account: this.toSummary(updated) };
  }

  async authorizeCampaignLaunch(email: string, campaign: CampaignRecord): Promise<CampaignLaunchAuthorizationResult> {
    const record = await this.getOrCreateRecord(email);
    const definition = ACCOUNT_PLAN_DEFINITIONS[record.plan];

    for (const target of campaign.targets) {
      if (!definition.allowedPlatforms.includes(target.platform ?? 'youtube')) {
        throw new AccountPlanAccessError(
          'Seu plano atual nao cobre todos os destinos desta campanha. O plano PRO libera TikTok.',
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
      const freeDefinition = ACCOUNT_PLAN_DEFINITIONS.FREE;
      const created: AccountPlanRecord = {
        email: normalizedEmail,
        plan: 'FREE',
        tokens: freeDefinition.maxTokens,
        lastDailyVisitAt: null,
        lastMonthlyGrantAt: nowIso,
        billingStartedAt: null,
        billingExpiresAt: null,
        selectedAt: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      return this.store.save(created);
    }

    if (this.isExpired(existing)) {
      return this.store.save({
        ...existing,
        plan: 'FREE',
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
      thumbnailCostTokens: definition.thumbnailCostTokens,
      priceBrl: definition.priceBrl,
      durationDays: definition.durationDays,
      billingStartedAt: record.billingStartedAt,
      billingExpiresAt: record.billingExpiresAt,
      expiresSoon: expiryMs !== null && expiryMs - this.now().getTime() <= 3 * 24 * 60 * 60 * 1000,
      dailyVisitClaimedToday: this.toBusinessDate(record.lastDailyVisitAt) === this.getBusinessDate(),
      monthlyGrantClaimedThisMonth: this.toBusinessMonth(record.lastMonthlyGrantAt) === this.getBusinessMonth(),
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
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getBusinessMonth(): string {
    const now = this.now();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private toBusinessMonth(value: string | null): string | null {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
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
