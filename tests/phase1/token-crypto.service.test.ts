import { describe, expect, test } from 'vitest';

import { AccountsService } from '../../apps/api/src/accounts/accounts.service';
import { TokenCryptoService } from '../../apps/api/src/common/crypto/token-crypto.service';

describe('OAuth token encryption service', () => {
  test('round-trips non-empty tokens with iv:tag:ciphertext payload format', () => {
    const tokenCryptoService = new TokenCryptoService({
      OAUTH_TOKEN_KEY: '12345678901234567890123456789012',
    });

    const encrypted = tokenCryptoService.encrypt('ya29.a0AfH6SMB_access_token');

    expect(encrypted.split(':')).toHaveLength(3);
    expect(tokenCryptoService.decrypt(encrypted)).toBe('ya29.a0AfH6SMB_access_token');
  });

  test('rejects malformed encrypted payloads', () => {
    const tokenCryptoService = new TokenCryptoService({
      OAUTH_TOKEN_KEY: '12345678901234567890123456789012',
    });

    expect(() => tokenCryptoService.decrypt('not-a-valid-payload')).toThrow(/invalid encrypted payload/i);
  });

  test('persists only encrypted token columns for connected accounts', () => {
    const tokenCryptoService = new TokenCryptoService({
      OAUTH_TOKEN_KEY: '12345678901234567890123456789012',
    });
    const accountsService = new AccountsService({ tokenCryptoService });

    const record = accountsService.createPersistenceRecord({
      provider: 'google',
      email: 'ops@example.com',
      accessToken: 'access-token-value',
      refreshToken: 'refresh-token-value',
      scopes: ['youtube.upload'],
    });

    expect(record.accessTokenEnc).not.toBe('access-token-value');
    expect(record.refreshTokenEnc).not.toBe('refresh-token-value');
    expect('accessToken' in record).toBe(false);
    expect('refreshToken' in record).toBe(false);
    expect(accountsService.readPersistedTokens(record)).toEqual({
      accessToken: 'access-token-value',
      refreshToken: 'refresh-token-value',
    });
  });
});
