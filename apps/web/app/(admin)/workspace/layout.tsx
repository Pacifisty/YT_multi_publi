import { getAuthenticatedAdmin, UnauthorizedError, type AuthFetch } from '../../../lib/auth-client';

export interface WorkspaceTab {
  id: 'accounts' | 'media' | 'campanhas' | 'dashboard' | 'growth';
  label: 'Contas' | 'Media' | 'Campanhas' | 'Dashboard' | 'Growth';
  selected: boolean;
}

export interface EmptyStateContent {
  heading: string;
  body: string;
  cta: string;
}

export interface WorkspaceLayoutView {
  redirectTo?: '/login';
  admin?: { email: string };
  tabs?: WorkspaceTab[];
  emptyStates?: {
    accounts: EmptyStateContent;
    media: EmptyStateContent;
  };
}

export async function buildWorkspaceLayout(options: { fetcher?: AuthFetch } = {}): Promise<WorkspaceLayoutView> {
  try {
    const admin = await getAuthenticatedAdmin(options.fetcher);

    return {
      admin,
      tabs: [
        {
          id: 'accounts',
          label: 'Contas',
          selected: true,
        },
        {
          id: 'media',
          label: 'Media',
          selected: false,
        },
        {
          id: 'campanhas',
          label: 'Campanhas',
          selected: false,
        },
        {
          id: 'dashboard',
          label: 'Dashboard',
          selected: false,
        },
        {
          id: 'growth',
          label: 'Growth',
          selected: false,
        },
      ],
      emptyStates: {
        accounts: {
          heading: 'No accounts connected',
          body: 'Connect a Google account to load available YouTube channels and choose which ones stay active.',
          cta: 'Connect Google Account',
        },
        media: {
          heading: 'No media assets uploaded.',
          body: 'Upload one video (and optional thumbnail) to reuse in future campaigns.',
          cta: 'Upload video',
        },
      },
    };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return {
        redirectTo: '/login',
      };
    }

    throw error;
  }
}
