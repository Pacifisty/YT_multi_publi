import { randomUUID, timingSafeEqual } from 'node:crypto';

export const GOOGLE_YOUTUBE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.upload',
] as const;

export interface GoogleOauthSession {
  oauthStateNonce?: string;
}

export interface GoogleTokenResult {
  accessToken: string;
  refreshToken?: string;
  scopes: string[];
  tokenExpiresAt: string | null;
  profile: {
    googleSubject?: string;
    email?: string;
    displayName?: string;
  };
}

interface GoogleOauthClient {
  generateAuthUrl: (options: {
    access_type: 'offline';
    include_granted_scopes: true;
    scope: readonly string[];
    state: string;
    prompt: 'consent';
  }) => string;
  getToken: (code: string) => Promise<{
    tokens: {
      access_token?: string;
      refresh_token?: string;
      scope?: string;
      expiry_date?: number;
      id_token?: string;
    };
  }>;
  setCredentials: (tokens: { access_token?: string; refresh_token?: string }) => void;
}

interface GoogleUserInfoClient {
  userinfo: {
    get: () => Promise<{
      data: {
        id?: string;
        email?: string;
        name?: string;
      };
    }>;
  };
}

export interface GoogleOauthServiceOptions {
  env?: Record<string, string | undefined>;
  createClient?: () => Promise<GoogleOauthClient>;
  createUserInfoClient?: (client: GoogleOauthClient) => Promise<GoogleUserInfoClient>;
}

export class GoogleOauthService {
  private readonly env: Record<string, string | undefined>;
  private readonly createClient: () => Promise<GoogleOauthClient>;
  private readonly createUserInfoClient: (client: GoogleOauthClient) => Promise<GoogleUserInfoClient>;

  constructor(options: GoogleOauthServiceOptions = {}) {
    this.env = options.env ?? process.env;
    this.createClient = options.createClient ?? createOfficialOauthClient(this.env);
    this.createUserInfoClient = options.createUserInfoClient ?? createOfficialUserInfoClient;
  }

  async createAuthorizationRedirect(session?: GoogleOauthSession | null): Promise<string> {
    const client = await this.createClient();
    const state = randomUUID();

    if (session) {
      session.oauthStateNonce = state;
    }

    return client.generateAuthUrl({
      access_type: 'offline',
      include_granted_scopes: true,
      scope: GOOGLE_YOUTUBE_SCOPES,
      state,
      prompt: 'consent',
    });
  }

  validateCallbackState(session: GoogleOauthSession | null | undefined, callbackState: string): boolean {
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

  async exchangeCodeForTokens(code: string): Promise<GoogleTokenResult> {
    const client = await this.createClient();
    const tokenResponse = await client.getToken(code);
    const accessToken = tokenResponse.tokens.access_token;

    if (!accessToken) {
      throw new Error('Google OAuth callback did not return an access token.');
    }

    client.setCredentials({
      access_token: accessToken,
      refresh_token: tokenResponse.tokens.refresh_token,
    });

    const userInfoClient = await this.createUserInfoClient(client);
    const userInfo = await userInfoClient.userinfo.get();

    return {
      accessToken,
      refreshToken: tokenResponse.tokens.refresh_token,
      scopes: tokenResponse.tokens.scope ? tokenResponse.tokens.scope.split(' ') : [],
      tokenExpiresAt: tokenResponse.tokens.expiry_date ? new Date(tokenResponse.tokens.expiry_date).toISOString() : null,
      profile: {
        googleSubject: userInfo.data.id,
        email: userInfo.data.email,
        displayName: userInfo.data.name,
      },
    };
  }
}

function createOfficialOauthClient(env: Record<string, string | undefined>): () => Promise<GoogleOauthClient> {
  return async () => {
    const { google } = await importGoogleApisModule();
    const clientId = env.GOOGLE_CLIENT_ID;
    const clientSecret = env.GOOGLE_CLIENT_SECRET;
    const redirectUri = env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Google OAuth env is incomplete. Expected GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI.');
    }

    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  };
}

async function createOfficialUserInfoClient(client: GoogleOauthClient): Promise<GoogleUserInfoClient> {
  const { google } = await importGoogleApisModule();
  return google.oauth2({
    version: 'v2',
    auth: client,
  });
}

async function importGoogleApisModule(): Promise<{ google: any }> {
  try {
    const dynamicImport = new Function('modulePath', 'return import(modulePath);') as (
      modulePath: string,
    ) => Promise<{ google: any }>;
    return await dynamicImport('googleapis');
  } catch {
    throw new Error('googleapis must be installed to use official Google OAuth endpoints.');
  }
}
