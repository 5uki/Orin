import type {
  CurrentUserResponse,
  PendingCommentsResponse,
  PublishPostResponse,
  UpdatePostResponse,
  User,
  ApiErrorResponse,
  PostMetadata,
  Comment,
  SiteConfig,
} from '@orin/shared/types';

const API_BASE = '/api';

/**
 * Get CSRF token from cookie
 */
function getCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|; )csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Make an API request with proper headers
 */
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ ok: true; data: T } | ApiErrorResponse> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Add CSRF token for write operations
  if (options.method && ['POST', 'PUT', 'DELETE'].includes(options.method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      (headers as Record<string, string>)['X-CSRF-Token'] = csrfToken;
    }
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  const data = await response.json();
  return data;
}

// Auth API
export const authApi = {
  async getMe(): Promise<CurrentUserResponse | null> {
    const result = await request<CurrentUserResponse>('/auth/me');
    if (result.ok) {
      return result.data;
    }
    return null;
  },

  async logout(): Promise<boolean> {
    const result = await request('/auth/logout', { method: 'POST' });
    return result.ok;
  },

  getLoginUrl(redirect?: string): string {
    const params = redirect ? `?redirect=${encodeURIComponent(redirect)}` : '';
    return `${API_BASE}/auth/github/start${params}`;
  },

  async devLogin(username: string, isAdmin: boolean = false): Promise<CurrentUserResponse | null> {
    const result = await request<CurrentUserResponse>('/auth/dev-login', {
      method: 'POST',
      body: JSON.stringify({ username, isAdmin }),
    });
    if (result.ok) {
      return result.data;
    }
    return null;
  },

  // Check if we're in development mode
  isDevelopment(): boolean {
    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  },
};

// Config API
export const configApi = {
  /**
   * Get site configuration (public endpoint)
   */
  async getConfig(): Promise<SiteConfig | ApiErrorResponse> {
    const result = await request<SiteConfig>('/config');
    if (result.ok) {
      return result.data;
    }
    return result;
  },

  /**
   * Update site configuration (admin only)
   */
  async updateConfig(config: Partial<SiteConfig>): Promise<SiteConfig | ApiErrorResponse> {
    const result = await request<SiteConfig>('/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
    if (result.ok) {
      return result.data;
    }
    return result;
  },
};

// Admin API
export const adminApi = {
  // Comments
  async getPendingComments(
    limit = 20,
    cursor?: string
  ): Promise<PendingCommentsResponse | ApiErrorResponse> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);
    const result = await request<PendingCommentsResponse>(
      `/admin/comments/pending?${params.toString()}`
    );
    if (result.ok) {
      return result.data;
    }
    return result;
  },

  async approveComment(id: number): Promise<boolean> {
    const result = await request(`/admin/comments/${id}/approve`, { method: 'POST' });
    return result.ok;
  },

  async rejectComment(id: number): Promise<boolean> {
    const result = await request(`/admin/comments/${id}/reject`, { method: 'POST' });
    return result.ok;
  },

  // Posts
  async publishPost(
    slug: string,
    content: string,
    commitMessage: string
  ): Promise<PublishPostResponse | ApiErrorResponse> {
    const result = await request<PublishPostResponse>('/admin/posts/publish', {
      method: 'POST',
      body: JSON.stringify({ slug, content, commitMessage }),
    });
    if (result.ok) {
      return result.data;
    }
    return result;
  },

  async updatePost(
    slug: string,
    content: string,
    commitMessage: string
  ): Promise<UpdatePostResponse | ApiErrorResponse> {
    const result = await request<UpdatePostResponse>(`/admin/posts/${slug}`, {
      method: 'PUT',
      body: JSON.stringify({ content, commitMessage }),
    });
    if (result.ok) {
      return result.data;
    }
    return result;
  },

  async unpublishPost(slug: string): Promise<UpdatePostResponse | ApiErrorResponse> {
    const result = await request<UpdatePostResponse>(`/admin/posts/${slug}/unpublish`, {
      method: 'POST',
    });
    if (result.ok) {
      return result.data;
    }
    return result;
  },

  // Post pinning
  async getPinnedPosts(): Promise<PostMetadata[] | ApiErrorResponse> {
    const result = await request<PostMetadata[]>('/admin/posts/pinned');
    if (result.ok) {
      return result.data;
    }
    return result;
  },

  async pinPost(slug: string): Promise<PostMetadata | ApiErrorResponse> {
    const result = await request<PostMetadata>(`/admin/posts/${slug}/pin`, {
      method: 'POST',
    });
    if (result.ok) {
      return result.data;
    }
    return result;
  },

  async unpinPost(slug: string): Promise<{ slug: string; isPinned: boolean } | ApiErrorResponse> {
    const result = await request<{ slug: string; isPinned: boolean }>(`/admin/posts/${slug}/pin`, {
      method: 'DELETE',
    });
    if (result.ok) {
      return result.data;
    }
    return result;
  },

  // Comment pinning
  async pinComment(id: number): Promise<Comment | ApiErrorResponse> {
    const result = await request<Comment>(`/admin/comments/${id}/pin`, {
      method: 'POST',
    });
    if (result.ok) {
      return result.data;
    }
    return result;
  },

  async unpinComment(id: number): Promise<{ id: number; isPinned: boolean } | ApiErrorResponse> {
    const result = await request<{ id: number; isPinned: boolean }>(`/admin/comments/${id}/pin`, {
      method: 'DELETE',
    });
    if (result.ok) {
      return result.data;
    }
    return result;
  },

  // Users
  async banUser(id: number, reason: string): Promise<boolean> {
    const result = await request(`/admin/users/${id}/ban`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    return result.ok;
  },
};

// Extended types for admin panel
export interface UserWithStats extends User {
  commentCount?: number;
  approvedCount?: number;
  rejectedCount?: number;
}
