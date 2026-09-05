import type { PrismaClient } from '@prisma/client';

export interface WebhookDeduplicator {
  recordWebhookEvent(provider: string, providerEventId: string, externalReference: string, eventType: string, rawPayload?: string): Promise<void>;
  hasProcessedEvent(provider: string, providerEventId: string): Promise<boolean>;
  claimWebhookEvent?(provider: string, providerEventId: string, externalReference: string, eventType: string, rawPayload?: string): Promise<boolean>;
  completeWebhookEventsForReference?(externalReference: string): Promise<void>;
  failWebhookEventsForReference?(externalReference: string, errorMessage: string): Promise<void>;
}

export class PrismaWebhookDeduplicator implements WebhookDeduplicator {
  constructor(private readonly prisma: PrismaClient) {}

  async claimWebhookEvent(provider: string, providerEventId: string, externalReference: string, eventType: string, rawPayload?: string): Promise<boolean> {
    try {
      await this.prisma.webhookEvent.create({
        data: {
          provider,
          providerEventId,
          externalReference,
          eventType,
          status: 'processing',
          rawPayload,
        },
      });
      return true;
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        const staleBefore = new Date(Date.now() - 5 * 60_000);
        const retried = await this.prisma.webhookEvent.updateMany({
          where: {
            provider,
            providerEventId,
            OR: [
              { status: 'failed' },
              { status: 'processing', createdAt: { lt: staleBefore } },
            ],
          },
          data: {
            status: 'processing',
            errorMessage: null,
            processedAt: null,
            externalReference,
            rawPayload,
          },
        });
        return retried.count === 1;
      }
      throw error;
    }
  }

  async completeWebhookEventsForReference(externalReference: string): Promise<void> {
    await this.prisma.webhookEvent.updateMany({
      where: { externalReference, status: 'processing' },
      data: { status: 'completed', processedAt: new Date(), errorMessage: null },
    });
  }

  async failWebhookEventsForReference(externalReference: string, errorMessage: string): Promise<void> {
    await this.prisma.webhookEvent.updateMany({
      where: { externalReference, status: 'processing' },
      data: { status: 'failed', errorMessage },
    });
  }

  async recordWebhookEvent(provider: string, providerEventId: string, externalReference: string, eventType: string, rawPayload?: string): Promise<void> {
    try {
      await this.prisma.webhookEvent.upsert({
        where: {
          provider_providerEventId: {
            provider,
            providerEventId,
          },
        },
        update: {
          status: 'completed',
          processedAt: new Date(),
          externalReference,
          rawPayload,
        },
        create: {
          provider,
          providerEventId,
          externalReference,
          eventType,
          status: 'processing',
          rawPayload,
        },
      });
    } catch (error) {
      if ((error as any).code === 'P2002') {
        // Unique constraint violation: event already being processed, this is fine
        return;
      }
      throw error;
    }
  }

  async hasProcessedEvent(provider: string, providerEventId: string): Promise<boolean> {
    const event = await this.prisma.webhookEvent.findUnique({
      where: {
        provider_providerEventId: {
          provider,
          providerEventId,
        },
      },
    });
    return !!event;
  }
}

// Production queries for debugging webhook idempotency:
// Find all processed webhooks:
//   SELECT * FROM webhook_events WHERE status = 'completed' ORDER BY created_at DESC LIMIT 100;
//
// Find webhooks for a specific payment:
//   SELECT * FROM webhook_events WHERE external_reference = 'pay_xxxxx';
//
// Find duplicate webhook attempts:
//   SELECT provider, provider_event_id, COUNT(*) FROM webhook_events
//   GROUP BY provider, provider_event_id HAVING COUNT(*) > 1;
//
// Verify idempotency for specific payment:
//   SELECT COUNT(DISTINCT provider_event_id) FROM webhook_events
//   WHERE external_reference = 'pay_xxxxx' (should be 1);
