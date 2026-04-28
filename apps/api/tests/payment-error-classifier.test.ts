import { describe, it, expect } from 'vitest';
import { classifyPaymentError } from '../src/account-plan/payment-error-classifier';

describe('Payment Error Classification', () => {
  it('Test 1: Permanent errors', () => {
    expect(classifyPaymentError(new Error('Invalid token'))).toBe('permanent');
    expect(classifyPaymentError(new Error('Unauthorized'))).toBe('permanent');
    expect(classifyPaymentError(new Error('not found'))).toBe('permanent');
    expect(classifyPaymentError(new Error('Invalid credentials'))).toBe('permanent');
    expect(classifyPaymentError(new Error('Forbidden'))).toBe('permanent');
  });

  it('Test 2: Transient errors', () => {
    expect(classifyPaymentError(new Error('Request timeout'))).toBe('transient');
    expect(classifyPaymentError(new Error('ECONNRESET'))).toBe('transient');
    expect(classifyPaymentError(new Error('temporarily unavailable'))).toBe('transient');
    expect(classifyPaymentError(new Error('Connection refused'))).toBe('transient');
    expect(classifyPaymentError(new Error('503 Service Unavailable'))).toBe('transient');
  });

  it('Test 3: Unknown errors default to transient', () => {
    expect(classifyPaymentError(new Error('something weird happened'))).toBe('transient');
    expect(classifyPaymentError(new Error('random error'))).toBe('transient');
  });

  it('Test 4: Null/undefined errors classify as transient', () => {
    expect(classifyPaymentError(null)).toBe('transient');
    expect(classifyPaymentError(undefined)).toBe('transient');
    expect(classifyPaymentError('')).toBe('transient');
  });

  it('Test 5: Case insensitive matching', () => {
    expect(classifyPaymentError(new Error('TIMEOUT'))).toBe('transient');
    expect(classifyPaymentError(new Error('InVaLiD tOkEn'))).toBe('permanent');
  });
});
