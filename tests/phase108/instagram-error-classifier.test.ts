import { describe, expect, test } from 'vitest';

import {
  classifyInstagramError,
  classifyPublishErrorMessage,
  isInstagramAuthError,
} from '../../apps/api/src/campaigns/error-classifier';

describe('Phase 108 - Instagram error classification', () => {
  test('classifies auth and validation errors as permanent', () => {
    expect(classifyInstagramError({ statusCode: 401, errorCode: 'OAuthException', message: 'Invalid access token' }))
      .toBe('permanent');
    expect(classifyInstagramError({ statusCode: 400, errorCode: 'invalid_media_url', message: 'Invalid media URL' }))
      .toBe('permanent');
    expect(classifyInstagramError({ errorCode: 'missing_caption', message: 'Caption is required' }))
      .toBe('permanent');
    expect(classifyInstagramError(new Error('Unsupported video codec for Instagram Reels')))
      .toBe('permanent');
    expect(isInstagramAuthError({ errorCode: 'OAuthException', message: 'Invalid OAuth access token.' }))
      .toBe(true);
  });

  test('classifies rate limits, server errors, and polling exhaustion as transient', () => {
    expect(classifyInstagramError({ statusCode: 429, message: 'Too many calls' })).toBe('transient');
    expect(classifyInstagramError({ statusCode: 400, errorCode: 613, message: 'Calls to this API have exceeded the rate limit' }))
      .toBe('transient');
    expect(classifyInstagramError({ errorCode: 'rate_limit_exceeded', message: 'Application limit reached' }))
      .toBe('transient');
    expect(classifyInstagramError({ statusCode: 503, message: 'Graph API temporarily unavailable' }))
      .toBe('transient');
    expect(classifyPublishErrorMessage('Instagram container processing did not finish before the polling limit.'))
      .toBe('transient');
  });
});
