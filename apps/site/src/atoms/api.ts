/**
 * API Request Atom (L4)
 *
 * Provides basic API request utilities including CSRF token handling.
 * Pure functions for HTTP communication.
 *
 * @module atoms/api
 */

/** API response wrapper type */
export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

/**
 * Get CSRF token from cookie
 *
 * @returns CSRF token string or null if not found
 *
 * @example
 * const token = getCsrfToken()
 * if (token) { // use token in request header }
 */
export function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|; )csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Build full API URL from path
 *
 * @param path - API path (e.g., '/auth/me')
 * @returns Full API URL
 *
 * @example
 * buildApiUrl('/auth/me') // '/api/auth/me'
 */
export function buildApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `/api${cleanPath}`;
}

/**
 * Perform a GET request to the API
 *
 * @param url - API endpoint URL
 * @returns Promise resolving to API response
 *
 * @example
 * const result = await apiGet<User>('/api/auth/me')
 * if (result.ok) { console.log(result.data) }
 */
export async function apiGet<T>(url: string): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(url, {
      credentials: 'include',
    });

    if (!response.ok) {
      return {
        ok: false,
        error: {
          code: 'HTTP_ERROR',
          message: `Request failed with status ${response.status}`,
        },
      };
    }

    const data = (await response.json()) as ApiResponse<T>;
    return data;
  } catch (error) {
    return {
      ok: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network request failed',
      },
    };
  }
}

/**
 * Perform a POST request to the API
 *
 * @param url - API endpoint URL
 * @param data - Request body data
 * @returns Promise resolving to API response
 *
 * @example
 * const result = await apiPost<Comment>('/api/comments', { content: 'Hello' })
 * if (result.ok) { console.log(result.data) }
 */
export async function apiPost<T>(url: string, data: unknown): Promise<ApiResponse<T>> {
  const csrfToken = getCsrfToken();

  if (!csrfToken) {
    return {
      ok: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'CSRF token not found',
      },
    };
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      body: JSON.stringify(data),
    });

    const result = (await response.json()) as ApiResponse<T>;
    return result;
  } catch (error) {
    return {
      ok: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network request failed',
      },
    };
  }
}
