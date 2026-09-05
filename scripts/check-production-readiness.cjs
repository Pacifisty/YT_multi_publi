'use strict';

const path = require('node:path');

const errors = [];
const warnings = [];

function value(name) {
  return (process.env[name] || '').trim();
}

function isPlaceholder(input) {
  const normalized = input.toLowerCase();
  return !normalized
    || normalized.includes('<')
    || normalized === 'replace-me'
    || normalized === 'changeme'
    || normalized.includes('xxxx');
}

function requireSecret(name, predicate) {
  const current = value(name);
  if (isPlaceholder(current) || (predicate && !predicate(current))) {
    errors.push(name);
  }
}

function requireHttpsUrl(name) {
  const current = value(name);
  try {
    const url = new URL(current);
    if (url.protocol !== 'https:' || ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(url.hostname)) {
      throw new Error('not public');
    }
  } catch {
    errors.push(name);
  }
}

function tokenKeyIsValid(raw) {
  if (raw === '12345678901234567890123456789012') return false;
  if (Buffer.byteLength(raw, 'utf8') === 32) return true;
  if (/^[0-9a-f]{64}$/i.test(raw)) return true;
  try {
    return Buffer.from(raw, 'base64').length === 32;
  } catch {
    return false;
  }
}

requireSecret('DATABASE_URL', (input) => /^postgres(ql)?:\/\//i.test(input));
requireHttpsUrl('PUBLIC_APP_URL');
requireSecret('OAUTH_TOKEN_KEY', tokenKeyIsValid);
requireSecret('ADMIN_EMAIL', (input) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input) && !input.endsWith('@example.com'));
requireSecret('ADMIN_PASSWORD_HASH', (input) => input.startsWith('scrypt:') || input.startsWith('$argon2'));

for (const name of [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'TIKTOK_CLIENT_KEY',
  'TIKTOK_CLIENT_SECRET',
  'INSTAGRAM_CLIENT_ID',
  'INSTAGRAM_CLIENT_SECRET',
  'MERCADOPAGO_WEBHOOK_SECRET',
  'EMAIL_PROVIDER_API_KEY',
  'EMAIL_FROM_ADDRESS',
]) requireSecret(name);

for (const name of [
  'GOOGLE_REDIRECT_URI',
  'GOOGLE_AUTH_REDIRECT_URI',
  'TIKTOK_REDIRECT_URI',
  'INSTAGRAM_REDIRECT_URI',
  'PAYMENT_SUCCESS_URL',
  'PAYMENT_CANCEL_URL',
  'PAYMENT_WEBHOOK_URL',
]) requireHttpsUrl(name);

requireSecret('MERCADOPAGO_ACCESS_TOKEN', (input) => input.startsWith('APP_USR-'));
requireSecret('EMAIL_PROVIDER', (input) => ['resend', 'sendgrid', 'mailgun'].includes(input.toLowerCase()));
if (value('EMAIL_PROVIDER').toLowerCase() === 'mailgun') requireSecret('MAILGUN_DOMAIN');

const storageRoot = value('MEDIA_STORAGE_ROOT');
if (!storageRoot || !path.isAbsolute(storageRoot)) errors.push('MEDIA_STORAGE_ROOT');
if (!value('SENTRY_DSN')) warnings.push('SENTRY_DSN');

const uniqueErrors = [...new Set(errors)].sort();
if (uniqueErrors.length) {
  console.error('Produção não está pronta. Variáveis inválidas ou ausentes:');
  for (const name of uniqueErrors) console.error(`- ${name}`);
  console.error('Nenhum valor de credencial foi exibido. Consulte .env.production.example.');
  process.exitCode = 1;
} else {
  console.log('Configuração obrigatória de produção: OK');
}

if (warnings.length) {
  console.warn(`Recomendado, mas opcional: ${warnings.join(', ')}`);
}
