import { randomUUID, timingSafeEqual } from 'node:crypto';

export const INSTAGRAM_BASIC_SCOPES = [
  'instagram_business_basic',
  'instagram_business_content_publish',
] as const;

export interface InstagramOauthSession {
  oauthStateNonce?: string;
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
}

export class InstagramOauthService {
  private readonly env: Record<string, string | undefined>;
  private readonly fetchImpl: typeof fetch;

  constructor(options: InstagramOauthServiceOptions = {}) {
    this.env = options.env ?? process.env;
    this.fetchImpl = options.fetchImpl ?? fetch;
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
    url.searchParams.set('enable_fb_login', '0');
    url.searchParams.set('force_authentication', '1');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', INSTAGRAM_BASIC_SCOPES.join(','));
    url.searchParams.set('state', state);

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

  async exchangeCodeForTokens(code: string): Promise<InstagramTokenResult> {
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
    tokenBody.set('redirect_uri', redirectUri);
    tokenBody.set('code', code);

    const tokenResponse = await this.fetchImpl('https://api.instagram.com/oauth/access_token', {
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

    const profileUrl = new URL('https://graph.instagram.com/me');
    profileUrl.searchParams.set('fields', 'user_id,username');
    profileUrl.searchParams.set('access_token', accessToken);

    const profileResponse = await this.fetchImpl(profileUrl, { method: 'GET' });
    const profilePayload = await readJsonResponse(profileResponse, 'Instagram profile lookup failed.');

    return {
      accessToken,
      refreshToken: undefined,
      scopes: [...INSTAGRAM_BASIC_SCOPES],
      tokenExpiresAt: null,
      profile: {
        providerSubject: readStringField(profilePayload, 'user_id') ?? readStringField(profilePayload, 'id') ?? undefined,
        displayName: readStringField(profilePayload, 'username') ?? undefined,
        email: undefined,
      },
    };
  }
}

async function readJsonResponse(response: Response, fallbackMessage: string): Promise<Record<string, unknown>> {
  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (response.ok && payload) {
    return payload;
  }

  const message =
    readStringField(payload, 'error_message') ??
    readNestedErrorMessage(payload) ??
    fallbackMessage;
  throw new Error(message);
}

function readNestedErrorMessage(value: Record<string, unknown> | null): string | null {
  if (!value) return null;
  const error = value.error;
  if (!error || typeof error !== 'object') return null;
  return readStringField(error as Record<string, unknown>, 'message');
}

function readStringField(value: Record<string, unknown> | null, key: string): string | null {
  const raw = value?.[key];
  return typeof raw === 'string' && raw.trim() ? raw : null;
}
