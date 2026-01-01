/**
 * GitHub OAuth Service
 *
 * Handles GitHub OAuth flow including:
 * - State and code_verifier generation for PKCE
 * - Authorization URL construction
 * - Token exchange
 * - User info retrieval
 */

/**
 * GitHub OAuth configuration
 */
export interface GitHubOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * GitHub user info from API
 */
export interface GitHubUser {
  id: number;
  login: string;
  avatar_url: string;
  email: string | null;
}

/**
 * OAuth state data stored in cookie
 */
export interface OAuthStateData {
  state: string;
  codeVerifier: string;
  redirectTo?: string;
}

/**
 * Token response from GitHub
 */
interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

/**
 * Generate a cryptographically secure random string
 */
export function generateRandomString(length: number): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate SHA-256 hash and encode as base64url
 */
async function sha256Base64Url(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
  // Convert to base64url
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Generate OAuth state and code verifier for PKCE flow
 */
export function generateOAuthState(redirectTo?: string): OAuthStateData {
  return {
    state: generateRandomString(32),
    codeVerifier: generateRandomString(64),
    redirectTo,
  };
}

/**
 * Build GitHub authorization URL
 */
export async function buildAuthorizationUrl(
  config: GitHubOAuthConfig,
  stateData: OAuthStateData
): Promise<string> {
  const codeChallenge = await sha256Base64Url(stateData.codeVerifier);

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: 'read:user user:email',
    state: stateData.state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(
  config: GitHubOAuthConfig,
  code: string,
  codeVerifier: string
): Promise<string> {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub token exchange failed: ${response.status}`);
  }

  const data = (await response.json()) as GitHubTokenResponse & { error?: string };

  if (data.error) {
    throw new Error(`GitHub OAuth error: ${data.error}`);
  }

  return data.access_token;
}

/**
 * Fetch GitHub user info using access token
 */
export async function fetchGitHubUser(accessToken: string): Promise<GitHubUser> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Orin-Blog',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub user fetch failed: ${response.status}`);
  }

  const user = (await response.json()) as GitHubUser;

  // If email is not public, try to fetch from emails endpoint
  if (!user.email) {
    const emailResponse = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Orin-Blog',
      },
    });

    if (emailResponse.ok) {
      const emails = (await emailResponse.json()) as Array<{
        email: string;
        primary: boolean;
        verified: boolean;
      }>;
      const primaryEmail = emails.find((e) => e.primary && e.verified);
      if (primaryEmail) {
        user.email = primaryEmail.email;
      }
    }
  }

  return user;
}

/**
 * Serialize OAuth state data to cookie value
 */
export function serializeOAuthState(stateData: OAuthStateData): string {
  return btoa(JSON.stringify(stateData));
}

/**
 * Deserialize OAuth state data from cookie value
 */
export function deserializeOAuthState(cookieValue: string): OAuthStateData | null {
  try {
    return JSON.parse(atob(cookieValue)) as OAuthStateData;
  } catch {
    return null;
  }
}

/**
 * Validate that the returned state matches the stored state
 */
export function validateState(returnedState: string, storedState: OAuthStateData | null): boolean {
  if (!storedState) {
    return false;
  }
  return returnedState === storedState.state;
}
