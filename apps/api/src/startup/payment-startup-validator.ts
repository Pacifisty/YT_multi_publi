/** Fail-closed validation for the production payment boundary. */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

function isPlaceholder(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase() ?? '';
  return !normalized || [
    'replace-me',
    'changeme',
    'change-me',
    'your-token',
    'token',
    'test-token',
  ].includes(normalized) || normalized.includes('xxxx');
}

function validateProductionHttpsUrl(
  env: Record<string, string | undefined>,
  field: string,
  errors: string[],
): void {
  const raw = env[field]?.trim();
  if (!raw) {
    errors.push(`[startup] ${field} is required in production.`);
    return;
  }

  try {
    const url = new URL(raw);
    const localHosts = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);
    if (url.protocol !== 'https:' || localHosts.has(url.hostname.toLowerCase())) {
      errors.push(`[startup] ${field} must be a public HTTPS URL in production.`);
    }
  } catch {
    errors.push(`[startup] ${field} must be a valid public HTTPS URL in production.`);
  }
}

export function validatePaymentConfig(env: Record<string, string | undefined>, nodeEnv: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (nodeEnv === 'production') {
    const token = env.MERCADOPAGO_ACCESS_TOKEN?.trim();
    if (isPlaceholder(token)) {
      errors.push('[startup] MERCADOPAGO_ACCESS_TOKEN is required in production and cannot be a placeholder.');
    } else if (!token!.startsWith('APP_USR-')) {
      errors.push('[startup] MERCADOPAGO_ACCESS_TOKEN must be a production credential (APP_USR-...).');
    }

    if (isPlaceholder(env.MERCADOPAGO_WEBHOOK_SECRET)) {
      errors.push('[startup] MERCADOPAGO_WEBHOOK_SECRET is required in production for signed webhooks.');
    }

    validateProductionHttpsUrl(env, 'PAYMENT_SUCCESS_URL', errors);
    validateProductionHttpsUrl(env, 'PAYMENT_CANCEL_URL', errors);
    validateProductionHttpsUrl(env, 'PAYMENT_WEBHOOK_URL', errors);
  } else if (nodeEnv === 'development' || nodeEnv === 'test') {
    const token = env.MERCADOPAGO_ACCESS_TOKEN?.trim();
    if (!token) {
      warnings.push('[startup] MERCADOPAGO_ACCESS_TOKEN not set; using mock adapter');
    }
  }

  if (errors.length > 0) {
    errors.forEach((error) => console.error(error));
    throw new Error(errors.join('\n'));
  }

  warnings.forEach((warning) => console.warn(warning));
  return { isValid: true, errors, warnings };
}
