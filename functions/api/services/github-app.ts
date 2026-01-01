/**
 * GitHub App Service
 *
 * Handles GitHub App authentication and repository operations:
 * - JWT generation for GitHub App authentication
 * - Installation token retrieval
 * - File read/write operations via GitHub Contents API
 */

/**
 * GitHub App configuration
 */
export interface GitHubAppConfig {
  appId: string;
  privateKey: string;
  installationId?: string;
}

/**
 * GitHub file content response
 */
export interface GitHubFileContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  content: string;
  encoding: string;
}

/**
 * GitHub commit response
 */
export interface GitHubCommitResponse {
  content: {
    name: string;
    path: string;
    sha: string;
  };
  commit: {
    sha: string;
    message: string;
  };
}

/**
 * Base64 URL encode (for JWT)
 */
function base64UrlEncode(data: string): string {
  const base64 = btoa(data);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Convert ArrayBuffer to base64url string
 */
function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return base64UrlEncode(binary);
}

/**
 * Parse PEM private key to CryptoKey
 */
async function importPrivateKey(pemKey: string): Promise<CryptoKey> {
  if (!pemKey || !pemKey.trim()) {
    throw new Error('GitHub App private key is missing');
  }
  if (pemKey.includes('BEGIN RSA PRIVATE KEY')) {
    throw new Error('GitHub App private key must be PKCS#8 (BEGIN PRIVATE KEY)');
  }

  // Remove PEM headers and whitespace
  const pemContents = pemKey
    .replace(/-----BEGIN RSA PRIVATE KEY-----/, '')
    .replace(/-----END RSA PRIVATE KEY-----/, '')
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');

  // Decode base64 to binary
  const binaryString = atob(pemContents);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Import as PKCS8 key
  return crypto.subtle.importKey(
    'pkcs8',
    bytes.buffer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );
}

/**
 * Generate JWT for GitHub App authentication
 */
export async function generateAppJwt(config: GitHubAppConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  // JWT header
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  // JWT payload
  const payload = {
    iat: now - 60, // Issued 60 seconds ago to account for clock drift
    exp: now + 10 * 60, // Expires in 10 minutes
    iss: config.appId,
  };

  // Encode header and payload
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  // Sign with private key
  const privateKey = await importPrivateKey(config.privateKey);
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    encoder.encode(signingInput)
  );

  const encodedSignature = arrayBufferToBase64Url(signature);

  return `${signingInput}.${encodedSignature}`;
}

/**
 * Get installation access token
 */
export async function getInstallationToken(jwt: string, installationId: string): Promise<string> {
  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Orin-Blog',
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get installation token: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as { token: string };
  return data.token;
}

/**
 * GitHub App client for repository operations
 */
export class GitHubAppClient {
  private config: GitHubAppConfig;
  private owner: string;
  private repo: string;
  private installationToken: string | null = null;

  constructor(config: GitHubAppConfig, owner: string, repo: string) {
    this.config = config;
    this.owner = owner;
    this.repo = repo;
  }

  /**
   * Get or refresh installation token
   */
  private async getToken(): Promise<string> {
    if (!this.installationToken) {
      const jwt = await generateAppJwt(this.config);

      // If no installation ID provided, get it from the app
      let installationId = this.config.installationId;
      if (!installationId) {
        installationId = await this.getInstallationId(jwt);
      }

      this.installationToken = await getInstallationToken(jwt, installationId);
    }
    return this.installationToken;
  }

  /**
   * Get installation ID for the repository
   */
  private async getInstallationId(jwt: string): Promise<string> {
    const response = await fetch(
      `https://api.github.com/repos/${this.owner}/${this.repo}/installation`,
      {
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'Orin-Blog',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get installation: ${response.status}`);
    }

    const data = (await response.json()) as { id: number };
    return String(data.id);
  }

  /**
   * Read file content from repository
   */
  async readFile(path: string, ref?: string): Promise<GitHubFileContent | null> {
    const token = await this.getToken();
    const url = new URL(`https://api.github.com/repos/${this.owner}/${this.repo}/contents/${path}`);
    if (ref) {
      url.searchParams.set('ref', ref);
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Orin-Blog',
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to read file: ${response.status}`);
    }

    return (await response.json()) as GitHubFileContent;
  }

  /**
   * Create or update file in repository
   */
  async writeFile(
    path: string,
    content: string,
    message: string,
    sha?: string
  ): Promise<GitHubCommitResponse> {
    const token = await this.getToken();

    // Encode content to base64
    const encodedContent = btoa(unescape(encodeURIComponent(content)));

    const body: Record<string, string> = {
      message,
      content: encodedContent,
    };

    // Include SHA if updating existing file
    if (sha) {
      body.sha = sha;
    }

    const response = await fetch(
      `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${path}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'Orin-Blog',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to write file: ${response.status} - ${error}`);
    }

    return (await response.json()) as GitHubCommitResponse;
  }

  /**
   * Delete file from repository
   */
  async deleteFile(path: string, message: string, sha: string): Promise<GitHubCommitResponse> {
    const token = await this.getToken();

    const response = await fetch(
      `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${path}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'Orin-Blog',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          sha,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to delete file: ${response.status} - ${error}`);
    }

    return (await response.json()) as GitHubCommitResponse;
  }
}

/**
 * Decode base64 file content from GitHub
 */
export function decodeFileContent(content: string): string {
  return decodeURIComponent(escape(atob(content.replace(/\n/g, ''))));
}
