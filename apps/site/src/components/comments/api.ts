/**
 * Comment API Client
 *
 * Functions for interacting with the comment API endpoints.
 */

import type { CurrentUser, CommentFormData, CommentSubmitResult, ApiResponse } from './types';
import type { CommentTree, SiteConfig } from '@orin/shared/types';

/**
 * Get CSRF token from cookie
 */
function getCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|; )csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Fetch current user info
 */
export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  try {
    const response = await fetch('/api/auth/me', {
      credentials: 'include',
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as ApiResponse<CurrentUser>;
    if (data.ok) {
      return data.data;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch site configuration
 */
export async function fetchSiteConfig(): Promise<SiteConfig | null> {
  try {
    const response = await fetch('/api/config', {
      credentials: 'include',
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as ApiResponse<SiteConfig>;
    if (data.ok) {
      return data.data;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch comments for a post
 */
export async function fetchComments(postSlug: string): Promise<CommentTree[]> {
  try {
    const response = await fetch(`/api/comments?post=${encodeURIComponent(postSlug)}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as ApiResponse<{ post: string; comments: CommentTree[] }>;
    if (data.ok) {
      return data.data.comments;
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Submit a new comment
 */
export async function submitComment(
  postSlug: string,
  data: CommentFormData
): Promise<ApiResponse<CommentSubmitResult>> {
  const csrfToken = getCsrfToken();

  if (!csrfToken) {
    return {
      ok: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Please log in to comment',
      },
    };
  }

  try {
    const response = await fetch('/api/comments', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      body: JSON.stringify({
        post: postSlug,
        parentId: data.parentId,
        content: data.content,
        turnstileToken: data.turnstileToken,
      }),
    });

    const result = (await response.json()) as ApiResponse<CommentSubmitResult>;
    return result;
  } catch {
    return {
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to submit comment',
      },
    };
  }
}

/**
 * Get GitHub OAuth login URL
 */
export function getLoginUrl(redirectTo?: string): string {
  const params = new URLSearchParams();
  if (redirectTo) {
    params.set('redirect', redirectTo);
  }
  const query = params.toString();
  return `/api/auth/github/start${query ? `?${query}` : ''}`;
}

/**
 * Logout current user
 */
export async function logout(): Promise<boolean> {
  const csrfToken = getCsrfToken();

  if (!csrfToken) {
    return false;
  }

  try {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'X-CSRF-Token': csrfToken,
      },
    });

    return response.ok;
  } catch {
    return false;
  }
}
