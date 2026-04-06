import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export interface TokenCryptoEnv {
  OAUTH_TOKEN_KEY?: string;
}

const AES_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12;

export class TokenCryptoService {
  private readonly key: Buffer;

  constructor(env: TokenCryptoEnv = process.env) {
    this.key = resolveTokenKey(env.OAUTH_TOKEN_KEY);
  }

  encrypt(value: string): string {
    if (!value) {
      throw new Error('Cannot encrypt an empty token value.');
    }

    const iv = randomBytes(IV_LENGTH_BYTES);
    const cipher = createCipheriv(AES_ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(':');
  }

  decrypt(payload: string): string {
    const [ivSegment, tagSegment, ciphertextSegment, ...extra] = payload.split(':');

    if (!ivSegment || !tagSegment || !ciphertextSegment || extra.length > 0) {
      throw new Error('Invalid encrypted payload format. Expected iv:tag:ciphertext.');
    }

    try {
      const iv = Buffer.from(ivSegment, 'base64');
      const authTag = Buffer.from(tagSegment, 'base64');
      const ciphertext = Buffer.from(ciphertextSegment, 'base64');
      const decipher = createDecipheriv(AES_ALGORITHM, this.key, iv);
      decipher.setAuthTag(authTag);

      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    } catch {
      throw new Error('Invalid encrypted payload.');
    }
  }
}

export function isValidTokenKey(rawKey?: string): boolean {
  try {
    resolveTokenKey(rawKey);
    return true;
  } catch {
    return false;
  }
}

function resolveTokenKey(rawKey?: string): Buffer {
  if (!rawKey) {
    throw new Error('OAUTH_TOKEN_KEY must be configured with a 32-byte value.');
  }

  const utf8Key = Buffer.from(rawKey, 'utf8');
  if (utf8Key.length === 32) {
    return utf8Key;
  }

  if (rawKey.length === 64 && /^[0-9a-fA-F]+$/.test(rawKey)) {
    return Buffer.from(rawKey, 'hex');
  }

  const decoded = Buffer.from(rawKey, 'base64');

  if (decoded.length === 32) {
    return decoded;
  }

  throw new Error('OAUTH_TOKEN_KEY must resolve to exactly 32 bytes for AES-256-GCM.');
}
