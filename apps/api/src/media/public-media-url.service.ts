import { createHmac, timingSafeEqual } from 'node:crypto';

export interface PublicMediaUrlServiceOptions {
  baseUrl: string;
  secret: string;
  ttlSeconds?: number;
}

export class PublicMediaUrlService {
  private readonly baseUrl: string;
  private readonly secret: string;
  private readonly ttlSeconds: number;

  constructor(options: PublicMediaUrlServiceOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.secret = options.secret;
    this.ttlSeconds = options.ttlSeconds ?? 24 * 60 * 60;
  }

  createUrl(assetId: string): string {
    const expires = Math.floor(Date.now() / 1000) + this.ttlSeconds;
    const signature = this.sign(assetId, expires);
    const url = new URL(`${this.baseUrl}/public-media/${encodeURIComponent(assetId)}`);
    url.searchParams.set('expires', String(expires));
    url.searchParams.set('signature', signature);
    return url.toString();
  }

  verify(assetId: string, expiresRaw: string | undefined, signature: string | undefined): boolean {
    const expires = Number(expiresRaw);
    if (!Number.isInteger(expires) || expires <= 0) {
      return false;
    }

    if (!signature || Date.now() / 1000 > expires) {
      return false;
    }

    const expected = this.sign(assetId, expires);
    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(signature);
    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, receivedBuffer);
  }

  private sign(assetId: string, expires: number): string {
    return createHmac('sha256', this.secret)
      .update(`${assetId}:${expires}`)
      .digest('hex');
  }
}
