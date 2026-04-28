import { describe, it, expect, vi, afterEach } from 'vitest';
import { validatePaymentConfig } from '../src/startup/payment-startup-validator';
import { createApp, type AppConfig } from '../src/app';

// Test helper: ensures startup validation passes in test environment
function createTestApp(overrides?: Partial<AppConfig>): ReturnType<typeof createApp> {
  const mockConfig: AppConfig = {
    env: {
      MERCADOPAGO_ACCESS_TOKEN: 'test-token',
      NODE_ENV: 'test',
    },
    ...overrides,
  };
  return createApp(mockConfig);
}

describe('Startup Validation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Test 1: Production without MERCADOPAGO_ACCESS_TOKEN throws error', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => {
      validatePaymentConfig({}, 'production');
    }).toThrow(/MERCADOPAGO_ACCESS_TOKEN.*production/);
    consoleErrorSpy.mockRestore();
  });

  it('Test 2: Production with MERCADOPAGO_ACCESS_TOKEN passes validation', () => {
    const result = validatePaymentConfig({ MERCADOPAGO_ACCESS_TOKEN: 'test-token' }, 'production');
    expect(result.isValid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('Test 3: Development without token logs warning but continues', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = validatePaymentConfig({}, 'development');
    expect(result.isValid).toBe(true);
    expect(consoleWarnSpy).toHaveBeenCalled();
    const warningMessages = consoleWarnSpy.mock.calls.map((call) => call[0]);
    expect(warningMessages.some((msg) => msg.includes('mock adapter'))).toBe(true);
    consoleWarnSpy.mockRestore();
  });

  it('Test 4: Test environment without token logs warning but continues', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = validatePaymentConfig({}, 'test');
    expect(result.isValid).toBe(true);
    expect(consoleWarnSpy).toHaveBeenCalled();
    consoleWarnSpy.mockRestore();
  });

  it('Test 5: Production without webhook secret logs warning', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = validatePaymentConfig({ MERCADOPAGO_ACCESS_TOKEN: 'token' }, 'production');
    expect(result.isValid).toBe(true);
    expect(consoleWarnSpy).toHaveBeenCalled();
    const warningMessages = consoleWarnSpy.mock.calls.map((call) => call[0]);
    expect(warningMessages.some((msg) => msg.includes('WEBHOOK_SECRET'))).toBe(true);
    consoleWarnSpy.mockRestore();
  });

  it('Test 6: createApp with production config and missing token throws error', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => {
      createApp({ env: { NODE_ENV: 'production' } });
    }).toThrow(/MERCADOPAGO_ACCESS_TOKEN/);
    consoleErrorSpy.mockRestore();
  });

  it('Test 7: createApp with test config and mock token succeeds', () => {
    const mockConfig = {
      env: {
        MERCADOPAGO_ACCESS_TOKEN: 'test-token',
        NODE_ENV: 'test',
      },
    };
    expect(() => {
      createApp(mockConfig);
    }).not.toThrow();
  });

  it('Test 8: Validation result structure', () => {
    const result = validatePaymentConfig({ MERCADOPAGO_ACCESS_TOKEN: 'token' }, 'production');
    expect(result).toHaveProperty('isValid');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('warnings');
    expect(Array.isArray(result.errors)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it('Test 9: Test helper createTestApp ensures startup validation passes', () => {
    // In test environment, provide MERCADOPAGO_ACCESS_TOKEN even if mock; ensures startup validation passes
    expect(() => {
      createTestApp();
    }).not.toThrow();
  });

  it('Test 10: Test helper can be overridden with custom config', () => {
    expect(() => {
      createTestApp({
        env: {
          MERCADOPAGO_ACCESS_TOKEN: 'custom-token',
          NODE_ENV: 'test',
        },
      });
    }).not.toThrow();
  });
});
