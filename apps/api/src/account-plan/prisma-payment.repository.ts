import type {
  PaymentIntent,
  PaymentProvider,
  PaymentRepository,
  PaymentStatus,
  Purchase,
} from './payment.service';

interface PrismaPaymentIntentDelegate {
  create(args: { data: Record<string, unknown> }): Promise<any>;
  findUnique(args: { where: Record<string, unknown> }): Promise<any>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<any>;
  updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>;
  findMany(args: { where: { email: string }; orderBy: { createdAt: 'desc' } }): Promise<any[]>;
}

interface PrismaClientLike {
  paymentIntentRecord: PrismaPaymentIntentDelegate;
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  return new Date(value as string | number | Date).toISOString();
}

function toIntent(row: any): PaymentIntent {
  return {
    id: row.id,
    provider: row.provider as PaymentProvider,
    providerIntentId: row.providerIntentId ?? null,
    email: row.email,
    purchase: row.purchase as Purchase,
    amountBrl: Number(row.amountBrl),
    currency: 'BRL',
    status: row.status as PaymentStatus,
    checkoutUrl: row.checkoutUrl ?? null,
    externalReference: row.externalReference ?? null,
    errorMessage: row.errorMessage ?? null,
    createdAt: toIso(row.createdAt)!,
    updatedAt: toIso(row.updatedAt)!,
    paidAt: toIso(row.paidAt),
    fulfillmentStatus: row.fulfillmentStatus ?? 'pending',
    fulfillmentError: row.fulfillmentError ?? null,
    fulfillmentStartedAt: toIso(row.fulfillmentStartedAt),
    fulfilledAt: toIso(row.fulfilledAt),
  };
}

function toData(intent: PaymentIntent | Partial<PaymentIntent>): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  const scalarFields: Array<keyof PaymentIntent> = [
    'provider',
    'providerIntentId',
    'email',
    'purchase',
    'amountBrl',
    'currency',
    'status',
    'checkoutUrl',
    'externalReference',
    'errorMessage',
    'fulfillmentStatus',
    'fulfillmentError',
  ];

  for (const field of scalarFields) {
    if (field in intent) data[field] = intent[field];
  }

  for (const field of ['createdAt', 'updatedAt', 'paidAt', 'fulfillmentStartedAt', 'fulfilledAt'] as const) {
    if (field in intent) {
      const value = intent[field];
      data[field] = value ? new Date(value) : null;
    }
  }

  return data;
}

export class PrismaPaymentRepository implements PaymentRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async create(intent: PaymentIntent): Promise<PaymentIntent> {
    const row = await this.prisma.paymentIntentRecord.create({ data: { id: intent.id, ...toData(intent) } });
    return toIntent(row);
  }

  async findById(id: string): Promise<PaymentIntent | null> {
    const row = await this.prisma.paymentIntentRecord.findUnique({ where: { id } });
    return row ? toIntent(row) : null;
  }

  async findByProviderIntentId(provider: PaymentProvider, providerIntentId: string): Promise<PaymentIntent | null> {
    const row = await this.prisma.paymentIntentRecord.findUnique({ where: { providerIntentId } });
    if (!row || row.provider !== provider) return null;
    return toIntent(row);
  }

  async update(id: string, patch: Partial<PaymentIntent>): Promise<PaymentIntent | null> {
    try {
      const row = await this.prisma.paymentIntentRecord.update({ where: { id }, data: toData(patch) });
      return toIntent(row);
    } catch (error) {
      if ((error as { code?: string }).code === 'P2025') return null;
      throw error;
    }
  }

  async listByEmail(email: string): Promise<PaymentIntent[]> {
    const rows = await this.prisma.paymentIntentRecord.findMany({
      where: { email: email.trim().toLowerCase() },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toIntent);
  }

  async claimFulfillment(id: string, startedAt: string): Promise<PaymentIntent | null> {
    const result = await this.prisma.paymentIntentRecord.updateMany({
      where: {
        id,
        status: 'paid',
        fulfillmentStatus: { in: ['pending', 'failed'] },
      },
      data: {
        fulfillmentStatus: 'processing',
        fulfillmentError: null,
        fulfillmentStartedAt: new Date(startedAt),
        updatedAt: new Date(startedAt),
      },
    });
    return result.count === 1 ? this.findById(id) : null;
  }
}
