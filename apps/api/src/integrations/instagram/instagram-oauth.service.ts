import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';

export const INSTAGRAM_BASIC_SCOPES = [
  'instagram_business_basic',
  'instagram_business_content_publish',
] as const;

export interface InstagramOauthSession {
  oauthStateNonce?: string;
  instagramCodeVerifier?: string;
}

export interface InstagramTokenResult {
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

export interface InstagramOauthServiceOptions {
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  graphApiVersion?: string;
}

export class InstagramOauthService {
  private readonly env: Record<string, string | undefined>;
  private readonly fetchImpl: typeof fetch;
  private readonly graphApiVersion: string;

  constructor(options: InstagramOauthServiceOptions = {}) {
    this.env = options.env ?? process.env;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.graphApiVersion = options.graphApiVersion ?? 'v25.0';
  }

  async createAuthorizationRedirect(session?: InstagramOauthSession | null): Promise<string> {
    const clientId = this.env.INSTAGRAM_CLIENT_ID;
    const redirectUri = this.env.INSTAGRAM_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      throw new Error(
        'Instagram OAuth env is incomplete. Expected INSTAGRAM_CLIENT_ID and INSTAGRAM_REDIRECT_URI.',
      );
    }

    const state = randomUUID();

    if (session) {
      session.oauthStateNonce = state;
    }

    const url = new URL('https://www.instagram.com/oauth/authorize');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', INSTAGRAM_BASIC_SCOPES.join(','));
    url.searchParams.set('state', state);
    url.searchParams.set('enable_fb_login', '0');
    url.searchParams.set('force_authentication', '1');

    return url.toString();
  }

  validateCallbackState(session: InstagramOauthSession | null | undefined, callbackState: string): boolean {
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

  async exchangeCodeForTokens(code: string, _codeVerifier?: string): Promise<InstagramTokenResult> {
    const clientId = this.env.INSTAGRAM_CLIENT_ID;
    const clientSecret = this.env.INSTAGRAM_CLIENT_SECRET;
    const redirectUri = this.env.INSTAGRAM_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error(
        'Instagram OAuth env is incomplete. Expected INSTAGRAM_CLIENT_ID, INSTAGRAM_CLIENT_SECRET, INSTAGRAM_REDIRECT_URI.',
      );
    }

    const tokenBody = new URLSearchParams();
    tokenBody.set('client_id', clientId);
    tokenBody.set('client_secret', clientSecret);
    tokenBody.set('grant_type', 'authorization_code');
    tokenBody.set('code', code);
    tokenBody.set('redirect_uri', redirectUri);

    const tokenResponse = await this.fetchImpl('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenBody.toString(),
    });

    const tokenPayload = await readJsonResponse(tokenResponse, 'Instagram OAuth token exchange failed.');
    const shortLivedAccessToken = readStringField(tokenPayload, 'access_token');
    if (!shortLivedAccessToken) {
      throw new Error('Instagram OAuth callback did not return an access token.');
    }

    const exchangeUrl = new URL('https://graph.instagram.com/access_token');
    exchangeUrl.searchParams.set('grant_type', 'ig_exchange_token');
    exchangeUrl.searchParams.set('client_secret', clientSecret);
    exchangeUrl.searchParams.set('access_token', shortLivedAccessToken);
    const exchangeResponse = await this.fetchImpl(exchangeUrl.toString(), { method: 'GET' });
    const exchangePayload = await readJsonResponse(
      exchangeResponse,
      'Instagram long-lived token exchange failed.',
    );
    const accessToken = readStringField(exchangePayload, 'access_token');
    if (!accessToken) {
      throw new Error('Instagram long-lived token exchange did not return an access token.');
    }

    const expiresIn = readNumberField(exchangePayload, 'expires_in');
    const scopes = readStringField(tokenPayload, 'scope')
      ?.split(',')
      .map((entry) => entry.trim())
      .filter(Boolean) ?? [...INSTAGRAM_BASIC_SCOPES];

    const profileResponse = await this.fetchImpl(
      `${this.graphBaseUrl()}/me?fields=id,name&access_token=${encodeURIComponent(accessToken)}`,
      { method: 'GET' },
    );
    const profilePayload = await readJsonResponse(profileResponse, 'Instagram profile lookup failed.');

    return {
      accessToken,
      refreshToken: readStringField(tokenPayload, 'refresh_token') ?? accessToken,
      scopes,
      tokenExpiresAt: typeof expiresIn === 'number' ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
      profile: {
        providerSubject:
          readStringField(profilePayload, 'id') ??
          createHash('sha256').update(accessToken).digest('hex'),
        displayName: readStringField(profilePayload, 'name') ?? undefined,
        email: undefined,
      },
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<InstagramTokenResult> {
    if (!refreshToken) {
      throw new Error('Instagram refresh requires a long-lived access token.');
    }

    const url = new URL('https://graph.instagram.com/refresh_access_token');
    url.searchParams.set('grant_type', 'ig_refresh_token');
    url.searchParams.set('access_token', refreshToken);

    const tokenResponse = await this.fetchImpl(url.toString(), { method: 'GET' });
    const tokenPayload = await readJsonResponse(tokenResponse, 'Instagram token refresh failed.');
    const accessToken = readStringField(tokenPayload, 'access_token');
    if (!accessToken) {
      throw new Error('Instagram token refresh did not return an access token.');
    }

    const expiresIn = readNumberField(tokenPayload, 'expires_in');

    return {
      accessToken,
      refreshToken: readStringField(tokenPayload, 'refresh_token') ?? accessToken,
      scopes: [...INSTAGRAM_BASIC_SCOPES],
      tokenExpiresAt: typeof expiresIn === 'number' ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
      profile: {},
    };
  }

  private graphBaseUrl(): string {
    return `https://graph.facebook.com/${this.graphApiVersion}`;
  }
}

async function readJsonResponse(response: Response, fallbackMessage: string): Promise<Record<string, unknown>> {
  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  const error = payload ? readObjectField(payload, 'error') : null;

  if (response.ok && !error) {
    return payload ?? {};
  }

  const message =
    readStringField(error, 'message') ??
    readStringField(payload, 'error_description') ??
    readStringField(payload, 'message') ??
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

