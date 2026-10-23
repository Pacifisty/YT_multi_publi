import { describe, expect, it } from 'vitest';

import { createR2StorageFromEnv } from '../src/media/storage/r2-storage.service';

describe('Cloudflare R2 storage configuration', () => {
  it('keeps local storage when no R2 variables are present', () => {
    expect(createR2StorageFromEnv({})).toBeUndefined();
  });

  it('creates the R2 provider when every required variable is present', () => {
    const storage = createR2StorageFromEnv({
      R2_ACCOUNT_ID: 'account-id',
      R2_ACCESS_KEY_ID: 'access-key',
      R2_SECRET_ACCESS_KEY: 'secret-key',
      R2_BUCKET_NAME: 'media',
    });

    expect(storage?.providerName).toBe('r2');
  });

  it('fails fast when the R2 configuration is incomplete', () => {
    expect(() => createR2StorageFromEnv({
      R2_ACCOUNT_ID: 'account-id',
      R2_BUCKET_NAME: 'media',
    })).toThrow(/R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY/);
  });
});
