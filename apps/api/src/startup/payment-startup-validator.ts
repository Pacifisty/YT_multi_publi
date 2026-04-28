/**
 * Validates payment configuration at startup.
 *
 * In production: Requires MERCADOPAGO_ACCESS_TOKEN.
 *
 * Expected error message on missing token:
 *   "[startup] MERCADOPAGO_ACCESS_TOKEN is required in production. Aborting."
 *
 * Example fix:
 *   export MERCADOPAGO_ACCESS_TOKEN=APP_USR_xxxx
 *   npm run server
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validatePaymentConfig(env: Record<string, string | undefined>, nodeEnv: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (nodeEnv === 'production') {
    const token = env.MERCADOPAGO_ACCESS_TOKEN?.trim();
    if (!token) {
      errors.push('[startup] MERCADOPAGO_ACCESS_TOKEN is required in production. Aborting.');
    }

    const webhookSecret = env.MERCADOPAGO_WEBHOOK_SECRET?.trim();
    if (!webhookSecret) {
      warnings.push('[startup] MERCADOPAGO_WEBHOOK_SECRET not set; webhooks cannot be verified. Recommend setting it.');
    }

    const successUrl = env.PAYMENT_SUCCESS_URL?.trim();
    if (!successUrl) {
      warnings.push('[startup] PAYMENT_SUCCESS_URL not set; using default localhost URL. Recommend setting it for production.');
    }

    const cancelUrl = env.PAYMENT_CANCEL_URL?.trim();
    if (!cancelUrl) {
      warnings.push('[startup] PAYMENT_CANCEL_URL not set; using default localhost URL. Recommend setting it for production.');
    }
  } else if (nodeEnv === 'development' || nodeEnv === 'test') {
    const token = env.MERCADOPAGO_ACCESS_TOKEN?.trim();
    if (!token) {
      warnings.push('[startup] MERCADOPAGO_ACCESS_TOKEN not set; using mock adapter');
    }
  }

  if (errors.length > 0) {
    errors.forEach((err) => console.error(err));
    throw new Error(errors[0]);
  }

  warnings.forEach((warn) => console.warn(warn));

  return {
    isValid: true,
    errors,
    warnings,
  };
}
