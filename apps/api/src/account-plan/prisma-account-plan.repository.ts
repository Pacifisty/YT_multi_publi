import type { AccountPlanRecord, AccountPlanStore } from './account-plan.service';

interface PrismaClient {
  accountPlan: {
    findUnique(args: { where: { email: string } }): Promise<any>;
    upsert(args: {
      where: { email: string };
      create: any;
      update: any;
    }): Promise<any>;
  };
}

function toRecord(row: any): AccountPlanRecord {
  return {
    email: row.email,
    plan: row.plan,
    tokens: Number(row.tokens ?? 0),
    lastDailyVisitAt: row.lastDailyVisitAt ? new Date(row.lastDailyVisitAt).toISOString() : null,
    lastMonthlyGrantAt: row.lastMonthlyGrantAt ? new Date(row.lastMonthlyGrantAt).toISOString() : null,
    billingStartedAt: row.billingStartedAt ? new Date(row.billingStartedAt).toISOString() : null,
    billingExpiresAt: row.billingExpiresAt ? new Date(row.billingExpiresAt).toISOString() : null,
    selectedAt: row.selectedAt ? new Date(row.selectedAt).toISOString() : null,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

export class PrismaAccountPlanRepository implements AccountPlanStore {
  constructor(private readonly prisma: PrismaClient) {}

  async findByEmail(email: string): Promise<AccountPlanRecord | null> {
    const row = await this.prisma.accountPlan.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    return row ? toRecord(row) : null;
  }

  async save(record: AccountPlanRecord): Promise<AccountPlanRecord> {
    const normalizedEmail = record.email.trim().toLowerCase();
    const row = await this.prisma.accountPlan.upsert({
      where: { email: normalizedEmail },
      create: {
        email: normalizedEmail,
        plan: record.plan,
        tokens: record.tokens,
        lastDailyVisitAt: record.lastDailyVisitAt ? new Date(record.lastDailyVisitAt) : null,
        lastMonthlyGrantAt: record.lastMonthlyGrantAt ? new Date(record.lastMonthlyGrantAt) : null,
        billingStartedAt: record.billingStartedAt ? new Date(record.billingStartedAt) : null,
        billingExpiresAt: record.billingExpiresAt ? new Date(record.billingExpiresAt) : null,
        selectedAt: record.selectedAt ? new Date(record.selectedAt) : null,
        createdAt: new Date(record.createdAt),
        updatedAt: new Date(record.updatedAt),
      },
      update: {
        plan: record.plan,
        tokens: record.tokens,
        lastDailyVisitAt: record.lastDailyVisitAt ? new Date(record.lastDailyVisitAt) : null,
        lastMonthlyGrantAt: record.lastMonthlyGrantAt ? new Date(record.lastMonthlyGrantAt) : null,
        billingStartedAt: record.billingStartedAt ? new Date(record.billingStartedAt) : null,
        billingExpiresAt: record.billingExpiresAt ? new Date(record.billingExpiresAt) : null,
        selectedAt: record.selectedAt ? new Date(record.selectedAt) : null,
        updatedAt: new Date(record.updatedAt),
      },
    });
    return toRecord(row);
  }
}
