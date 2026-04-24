export interface AuthFetchResponse {
  status: number;
  json: () => Promise<unknown>;
}

export type AuthFetch = (
  input: string,
  init?: {
    method?: string;
    credentials?: 'include';
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<AuthFetchResponse>;

export interface AuthenticatedUser {
  email: string;
  fullName?: string;
  needsPlanSelection: boolean;
}

export interface AuthenticatedAdmin {
  email: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized');
  }
}

interface AuthResponseBody {
  error?: string;
  redirectUrl?: string;
  user?: Partial<AuthenticatedUser>;
}

function buildQueryUrl(path: string, query?: Record<string, string>): string {
  if (!query) {
    return path;
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    params.set(key, value);
  }

  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

function parseAuthenticatedUser(value?: Partial<AuthenticatedUser>): AuthenticatedUser | undefined {
  if (!value?.email) {
    return undefined;
  }

  return {
    email: value.email,
    fullName: value.fullName,
    needsPlanSelection: Boolean(value.needsPlanSelection),
  };
}

export async function loginWithPassword(
  credentials: LoginCredentials,
  fetcher: AuthFetch = globalThis.fetch as AuthFetch,
): Promise<{ ok: true; user: AuthenticatedUser } | { ok: false; status: number; error: string }> {
  const response = await fetcher('/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(credentials),
  });
  const body = (await response.json()) as AuthResponseBody;
  const user = parseAuthenticatedUser(body.user);

  if (response.status !== 200 || !user) {
    return {
      ok: false,
      status: response.status,
      error: body.error ?? 'Unable to sign in.',
    };
  }

  return {
    ok: true,
    user,
  };
}

export async function logoutSession(fetcher: AuthFetch = globalThis.fetch as AuthFetch): Promise<void> {
  await fetcher('/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });
}

export async function getAuthenticatedUser(fetcher: AuthFetch = globalThis.fetch as AuthFetch): Promise<AuthenticatedUser> {
  const response = await fetcher('/auth/me', {
    method: 'GET',
    credentials: 'include',
  });

  if (response.status === 401) {
    throw new UnauthorizedError();
  }

  const body = (await response.json()) as AuthResponseBody;
  const user = parseAuthenticatedUser(body.user);

  if (response.status !== 200 || !user) {
    throw new Error(body.error ?? 'Unable to load the current admin session.');
  }

  return user;
}

export async function getAuthenticatedAdmin(fetcher: AuthFetch = globalThis.fetch as AuthFetch): Promise<AuthenticatedAdmin> {
  const user = await getAuthenticatedUser(fetcher);
  return { email: user.email };
}

export async function startGoogleLogin(
  fetcher: AuthFetch = globalThis.fetch as AuthFetch,
): Promise<{ ok: true; redirectUrl: string } | { ok: false; status: number; error: string }> {
  const response = await fetcher('/auth/google/start', {
    method: 'GET',
    credentials: 'include',
  });
  const body = (await response.json()) as AuthResponseBody;

  if (response.status !== 200 || !body.redirectUrl) {
    return {
      ok: false,
      status: response.status,
      error: body.error ?? 'Unable to start Google sign-in.',
    };
  }

  return {
    ok: true,
    redirectUrl: body.redirectUrl,
  };
}

export async function completeGoogleLoginCallback(
  params: { code: string; state: string },
  fetcher: AuthFetch = globalThis.fetch as AuthFetch,
): Promise<{ ok: true; user: AuthenticatedUser } | { ok: false; status: number; error: string }> {
  const response = await fetcher(
    buildQueryUrl('/auth/google/callback', params),
    {
      method: 'GET',
      credentials: 'include',
    },
  );
  const body = (await response.json()) as AuthResponseBody;
  const user = parseAuthenticatedUser(body.user);

  if (response.status !== 200 || !user) {
    return {
      ok: false,
      status: response.status,
      error: body.error ?? 'Unable to complete Google sign-in.',
    };
  }

  return {
    ok: true,
    user,
  };
}
