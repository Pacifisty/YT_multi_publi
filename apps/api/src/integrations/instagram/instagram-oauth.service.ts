import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

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
    this.graphApiVersion = options.graphApiVersion ?? 'v19.0';
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
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    if (session) {
      session.oauthStateNonce = state;
      session.instagramCodeVerifier = codeVerifier;
    }

    const url = new URL(`https://www.facebook.com/${this.graphApiVersion}/dialog/oauth`);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', INSTAGRAM_BASIC_SCOPES.join(','));
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');

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

  async exchangeCodeForTokens(code: string, codeVerifier?: string): Promise<InstagramTokenResult> {
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
    tokenBody.set('code', code);
    tokenBody.set('redirect_uri', redirectUri);
    if (codeVerifier) {
      tokenBody.set('code_verifier', codeVerifier);
    }

    const tokenResponse = await this.fetchImpl(`${this.graphBaseUrl()}/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenBody.toString(),
    });

    const tokenPayload = await readJsonResponse(tokenResponse, 'Instagram OAuth token exchange failed.');
    const accessToken = readStringField(tokenPayload, 'access_token');
    if (!accessToken) {
      throw new Error('Instagram OAuth callback did not return an access token.');
    }

    const expiresIn = readNumberField(tokenPayload, 'expires_in');
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
    const clientId = this.env.INSTAGRAM_CLIENT_ID;
    const clientSecret = this.env.INSTAGRAM_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error(
        'Instagram OAuth env is incomplete. Expected INSTAGRAM_CLIENT_ID and INSTAGRAM_CLIENT_SECRET.',
      );
    }

    const url = new URL(`${this.graphBaseUrl()}/oauth/access_token`);
    url.searchParams.set('grant_type', 'fb_exchange_token');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('client_secret', clientSecret);
    url.searchParams.set('fb_exchange_token', refreshToken);

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

function generateCodeVerifier(): string {
  return randomBytes(48).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}
