import { randomUUID, timingSafeEqual } from 'node:crypto';

export const GOOGLE_YOUTUBE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.force-ssl',
] as const;

export const GOOGLE_AUTH_SCOPES = [
  'openid',
  'email',
  'profile',
] as const;

export const YOUTUBE_PLAYLIST_WRITE_SCOPES = [
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/youtube.force-ssl',
  'https://www.googleapis.com/auth/youtubepartner',
  'youtube',
  'youtube.force-ssl',
  'youtubepartner',
] as const;

export function hasYouTubePlaylistWriteScope(scopes: readonly string[] | null | undefined): boolean {
  const grantedScopes = new Set((scopes ?? []).filter((scope) => typeof scope === 'string' && scope.trim()));
  return YOUTUBE_PLAYLIST_WRITE_SCOPES.some((scope) => grantedScopes.has(scope));
}

export interface GoogleOauthSession {
  oauthStateNonce?: string;
}

export interface GoogleTokenResult {
  accessToken: string;
  refreshToken?: string;
  scopes: string[];
  tokenExpiresAt: string | null;
  profile: {
    providerSubject?: string;
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

  async createAuthorizationRedirect(
    session?: GoogleOauthSession | null,
    scopes: readonly string[] = GOOGLE_YOUTUBE_SCOPES,
  ): Promise<string> {
    const client = await this.createClient();
    const state = randomUUID();

    if (session) {
      session.oauthStateNonce = state;
    }

    return client.generateAuthUrl({
      access_type: 'offline',
      include_granted_scopes: true,
      scope: scopes,
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
        providerSubject: userInfo.data.id,
        googleSubject: userInfo.data.id,
        email: userInfo.data.email,
        displayName: userInfo.data.name,
      },
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt: string;
  }> {
    const client = await this.createClient();
    const refreshClient = client as GoogleOauthClient & {
      refreshAccessToken?: () => Promise<{
        credentials?: {
          access_token?: string;
          refresh_token?: string;
          expiry_date?: number;
        };
      }>;
    };

    client.setCredentials({ refresh_token: refreshToken });
    if (typeof refreshClient.refreshAccessToken !== 'function') {
      throw new Error('Google OAuth client does not support refreshAccessToken().');
    }

    const refreshed = await refreshClient.refreshAccessToken();
    const credentials = refreshed.credentials ?? {};
    const accessToken = credentials.access_token;
    if (!accessToken) {
      throw new Error('Google refresh did not return an access token.');
    }

    return {
      accessToken,
      refreshToken: credentials.refresh_token,
      expiresAt: credentials.expiry_date
        ? new Date(credentials.expiry_date).toISOString()
        : new Date(Date.now() + 3600 * 1000).toISOString(),
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
