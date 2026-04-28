export interface PaymentLogEntry {
  timestamp: string;
  intentId?: string;
  email?: string;
  scope: string;
  message: string;
  status?: string;
  provider?: string;
  oldStatus?: string;
  newStatus?: string;
  errorMessage?: string;
  context?: Record<string, any>;
}

class PaymentLogger {
  private redactSecrets(obj: any): any {
    if (!obj) return obj;
    const redacted = JSON.parse(JSON.stringify(obj));
    const secretKeys = ['accessToken', 'token', 'secret', 'webhookSecret', 'MERCADOPAGO_ACCESS_TOKEN', 'MERCADOPAGO_WEBHOOK_SECRET'];

    const redactValue = (val: any) => {
      if (typeof val === 'object' && val !== null) {
        for (const key of secretKeys) {
          if (key in val) {
            val[key] = '[REDACTED]';
          }
        }
        Object.values(val).forEach(redactValue);
      }
    };

    redactValue(redacted);
    return redacted;
  }

  private formatLog(entry: PaymentLogEntry): string {
    const logObj = {
      timestamp: entry.timestamp,
      scope: entry.scope,
      message: entry.message,
      ...(entry.intentId && { intentId: entry.intentId }),
      ...(entry.email && { email: entry.email }),
      ...(entry.status && { status: entry.status }),
      ...(entry.provider && { provider: entry.provider }),
      ...(entry.oldStatus && { oldStatus: entry.oldStatus }),
      ...(entry.newStatus && { newStatus: entry.newStatus }),
      ...(entry.errorMessage && { errorMessage: entry.errorMessage }),
      ...(entry.context && { context: this.redactSecrets(entry.context) }),
    };
    return JSON.stringify(logObj);
  }

  logCheckoutCreated(intentId: string, email: string, planOrPackId: string, amountBrl: number): void {
    const entry: PaymentLogEntry = {
      timestamp: new Date().toISOString(),
      intentId,
      email,
      scope: 'checkout',
      message: 'Checkout created',
      status: 'pending',
      context: { planOrPackId, amountBrl },
    };
    console.log(this.formatLog(entry));
  }

  logWebhookReceived(intentId: string, provider: string, rawBodySize: number): void {
    const entry: PaymentLogEntry = {
      timestamp: new Date().toISOString(),
      intentId,
      scope: 'webhook_received',
      message: 'Webhook received',
      provider,
      context: { rawBodySize },
    };
    console.log(this.formatLog(entry));
  }

  logStatusUpdated(intentId: string, oldStatus: string, newStatus: string, provider: string): void {
    const entry: PaymentLogEntry = {
      timestamp: new Date().toISOString(),
      intentId,
      scope: 'status_updated',
      message: `Status changed from ${oldStatus} to ${newStatus}`,
      oldStatus,
      newStatus,
      provider,
    };
    console.log(this.formatLog(entry));
  }

  logTokensCredited(email: string, tokens: number, intentId: string): void {
    const entry: PaymentLogEntry = {
      timestamp: new Date().toISOString(),
      email,
      intentId,
      scope: 'tokens_credited',
      message: `Tokens credited: ${tokens}`,
      context: { tokensAmount: tokens },
    };
    console.log(this.formatLog(entry));
  }

  logError(intentId: string, scope: string, error: Error | string, context?: Record<string, any>): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const entry: PaymentLogEntry = {
      timestamp: new Date().toISOString(),
      intentId,
      scope: `error:${scope}`,
      message: errorMessage,
      errorMessage,
      context,
    };
    console.log(this.formatLog(entry));
  }
}

export const paymentLogger = new PaymentLogger();
