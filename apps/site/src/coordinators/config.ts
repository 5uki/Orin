/**
 * Site Configuration Coordinator (L2)
 *
 * Orchestrates configuration fetching and provides site-wide settings
 * with sensible defaults when API is unavailable.
 *
 * @module coordinators/config
 */

/**
 * Site configuration data structure
 */
export interface SiteConfigData {
  siteName: string;
  description: string;
  logoUrl: string;
  ownerName: string;
  ownerAvatar: string;
  ownerGithubId?: string;
}

/**
 * API response structure for site config
 */
interface ApiConfigResponse {
  data?: {
    siteName?: string;
    description?: string;
    logoUrl?: string;
    ownerName?: string;
    ownerAvatar?: string;
    ownerGithubId?: string;
  };
}

/**
 * Default site configuration values
 */
const DEFAULT_CONFIG: SiteConfigData = {
  siteName: 'Orin Blog',
  description: 'Share tech, development, and life.',
  logoUrl: '/favicon.svg',
  ownerName: 'Orin Blog',
  ownerAvatar: '/favicon.svg',
};

/**
 * Get site configuration
 *
 * Fetches configuration from API if available, falls back to defaults.
 * Environment variables can override defaults.
 *
 * @param options - Configuration options
 * @returns Site configuration data
 */
export async function getSiteConfig(options?: {
  apiBase?: string;
  envDescription?: string;
}): Promise<SiteConfigData> {
  const { apiBase = '', envDescription } = options || {};

  // Start with defaults
  let config: SiteConfigData = { ...DEFAULT_CONFIG };

  // Override description from environment if provided
  if (envDescription) {
    config.description = envDescription;
  }

  // Try to fetch from API
  if (apiBase) {
    try {
      const response = await fetch(`${apiBase}/api/config`);
      if (response.ok) {
        const payload = (await response.json()) as ApiConfigResponse;
        if (payload?.data) {
          config = {
            siteName: payload.data.siteName || config.siteName,
            description: payload.data.description || config.description,
            logoUrl: payload.data.logoUrl || config.logoUrl,
            ownerName: payload.data.ownerName || config.ownerName,
            ownerAvatar: payload.data.ownerAvatar || config.ownerAvatar,
            ownerGithubId: payload.data.ownerGithubId,
          };
        }
      }
    } catch {
      // API unavailable, use defaults
    }
  }

  return config;
}

/**
 * Get Turnstile site key from environment
 *
 * @param envKey - Environment variable value
 * @returns Turnstile site key or empty string
 */
export function getTurnstileSiteKey(envKey?: string): string {
  return envKey || '';
}

/**
 * Get API base URL from environment
 *
 * @param envUrl - Environment variable value
 * @returns API base URL or empty string
 */
export function getApiBaseUrl(envUrl?: string): string {
  return envUrl || '';
}
