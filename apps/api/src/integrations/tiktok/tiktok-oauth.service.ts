import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

export const TIKTOK_BASIC_SCOPES = ['user.info.basic', 'video.publish', 'video.upload'] as const;
export const TIKTOK_SANDBOX_SCOPES = ['user.info.basic'] as const;

export interface TikTokOauthSession {
  oauthStateNonce?: string;
  tiktokCodeVerifier?: string;
}

export interface TikTokTokenResult {
  accessToken: string;
  refreshToken?: string;
  scopes: string[];
  tokenExpiresAt: string | null;
  profile: {
    providerSubject?: string;
    email?: string;
    displayName?: string;
  };
}

export interface TikTokOauthServiceOptions {
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
}

export class TikTokOauthService {
  private readonly env: Record<string, string | undefined>;
  private readonly fetchImpl: typeof fetch;

  constructor(options: TikTokOauthServiceOptions = {}) {
    this.env = options.env ?? process.env;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async createAuthorizationRedirect(session?: TikTokOauthSession | null): Promise<string> {
    const clientKey = this.env.TIKTOK_CLIENT_KEY;
    const redirectUri = this.env.TIKTOK_REDIRECT_URI;

    if (!clientKey || !redirectUri) {
      throw new Error(
        'TikTok OAuth env is incomplete. Expected TIKTOK_CLIENT_KEY and TIKTOK_REDIRECT_URI.',
      );
    }

    const state = randomUUID();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    if (session) {
      session.oauthStateNonce = state;
      session.tiktokCodeVerifier = codeVerifier;
    }

    const url = new URL('https://www.tiktok.com/v2/auth/authorize/');
    url.searchParams.set('client_key', clientKey);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    const scopes = this.env.TIKTOK_SANDBOX === 'true' ? TIKTOK_SANDBOX_SCOPES : TIKTOK_BASIC_SCOPES;
    url.searchParams.set('scope', scopes.join(','));
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('disable_auto_auth', '1');

    return url.toString();
  }

  validateCallbackState(session: TikTokOauthSession | null | undefined, callbackState: string): boolean {
    const expectedState = session?.oauthStateNonce;
    if (!expectedState || !callbackState) {
      return false;
    }

    const expectedBuffer = Buffer.from(expectedState);
    const callbackBuffer = Buffer.from(callbackState);
    if (expectedBuffer.length !== callbackBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, callbackBuffer);
  }

  async exchangeCodeForTokens(code: string, codeVerifier?: string): Promise<TikTokTokenResult> {
    const clientKey = this.env.TIKTOK_CLIENT_KEY;
    const clientSecret = this.env.TIKTOK_CLIENT_SECRET;
    const redirectUri = this.env.TIKTOK_REDIRECT_URI;

    if (!clientKey || !clientSecret || !redirectUri) {
      throw new Error(
        'TikTok OAuth env is incomplete. Expected TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_REDIRECT_URI.',
      );
    }

    const tokenBody = new URLSearchParams();
    tokenBody.set('client_key', clientKey);
    tokenBody.set('client_secret', clientSecret);
    tokenBody.set('code', code);
    tokenBody.set('grant_type', 'authorization_code');
    tokenBody.set('redirect_uri', redirectUri);
    if (codeVerifier) {
      tokenBody.set('code_verifier', codeVerifier);
    }

    const tokenResponse = await this.fetchImpl('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenBody.toString(),
    });

    const tokenPayload = await readJsonResponse(tokenResponse, 'TikTok OAuth token exchange failed.');
    const accessToken = readStringField(tokenPayload, 'access_token');
    if (!accessToken) {
      throw new Error('TikTok OAuth callback did not return an access token.');
    }

    const openId = readStringField(tokenPayload, 'open_id');
    const expiresIn = readNumberField(tokenPayload, 'expires_in');
    const scopes = readStringField(tokenPayload, 'scope')
      ?.split(',')
      .map((entry) => entry.trim())
      .filter(Boolean) ?? [...TIKTOK_BASIC_SCOPES];

    const userResponse = await this.fetchImpl('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const userPayload = await readJsonResponse(userResponse, 'TikTok profile lookup failed.');
    const data = readObjectField(userPayload, 'data');
    const user = readObjectField(data, 'user');

    return {
      accessToken,
      refreshToken: readStringField(tokenPayload, 'refresh_token') ?? undefined,
      scopes,
      tokenExpiresAt: typeof expiresIn === 'number' ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
      profile: {
        providerSubject:
          readStringField(user, 'open_id') ??
          openId ??
          createHash('sha256').update(accessToken).digest('hex'),
        displayName: readStringField(user, 'display_name') ?? undefined,
        email: undefined,
      },
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<TikTokTokenResult> {
    const clientKey = this.env.TIKTOK_CLIENT_KEY;
    const clientSecret = this.env.TIKTOK_CLIENT_SECRET;

    if (!clientKey || !clientSecret) {
      throw new Error(
        'TikTok OAuth env is incomplete. Expected TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET.',
      );
    }

    const tokenBody = new URLSearchParams();
    tokenBody.set('client_key', clientKey);
    tokenBody.set('client_secret', clientSecret);
    tokenBody.set('grant_type', 'refresh_token');
    tokenBody.set('refresh_token', refreshToken);

    const tokenResponse = await this.fetchImpl('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenBody.toString(),
    });

    const tokenPayload = await readJsonResponse(tokenResponse, 'TikTok OAuth token refresh failed.');
    const accessToken = readStringField(tokenPayload, 'access_token');
    if (!accessToken) {
      throw new Error('TikTok token refresh did not return an access token.');
    }

    const openId = readStringField(tokenPayload, 'open_id');
    const expiresIn = readNumberField(tokenPayload, 'expires_in');
    const scopes = readStringField(tokenPayload, 'scope')
      ?.split(',')
      .map((entry) => entry.trim())
      .filter(Boolean) ?? [...TIKTOK_BASIC_SCOPES];

    return {
      accessToken,
      refreshToken: readStringField(tokenPayload, 'refresh_token') ?? refreshToken,
      scopes,
      tokenExpiresAt: typeof expiresIn === 'number' ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
      profile: {
        providerSubject: openId ?? undefined,
      },
    };
  }
}

async function readJsonResponse(response: Response, fallbackMessage: string): Promise<Record<string, unknown>> {
  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  const error = payload ? readObjectField(payload, 'error') : null;
  const code = readStringField(error, 'code') ?? readStringField(payload, 'error');

  if (response.ok && (!code || code === 'ok')) {
    return payload ?? {};
  }

  const message =
    readStringField(error, 'message') ??
    readStringField(payload, 'error_description') ??
    readStringField(payload, 'description') ??
    fallbackMessage;
  throw new Error(message);
}

function readObjectField(value: Record<string, unknown> | null, key: string): Record<string, unknown> | null {
  const raw = value?.[key];
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
}

function readStringField(value: Record<string, unknown> | null, key: string): string | null {
  const raw = value?.[key];
  return typeof raw === 'string' && raw.trim() ? raw : null;
}

function readNumberField(value: Record<string, unknown> | null, key: string): number | null {
  const raw = value?.[key];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}

function generateCodeVerifier(): string {
  return randomBytes(48).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}
