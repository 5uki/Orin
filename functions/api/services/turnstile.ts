/**
 * Turnstile Verification Service
 *
 * Implements Cloudflare Turnstile token verification for bot protection.
 */

/**
 * Turnstile verification API endpoint
 */
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Turnstile verification response from Cloudflare API
 */
export interface TurnstileVerifyResponse {
  /** Whether the token is valid */
  success: boolean;
  /** ISO timestamp of the challenge */
  challenge_ts?: string;
  /** Hostname of the site where the challenge was solved */
  hostname?: string;
  /** List of error codes if verification failed */
  'error-codes'?: string[];
  /** Action name if configured */
  action?: string;
  /** Custom data if configured */
  cdata?: string;
}

/**
 * Turnstile verification result
 */
export interface TurnstileResult {
  /** Whether verification was successful */
  success: boolean;
  /** Error message if verification failed */
  errorMessage?: string;
  /** Error codes from Turnstile API */
  errorCodes?: string[];
}

/**
 * Error code descriptions for better error messages
 */
const ERROR_CODE_MESSAGES: Record<string, string> = {
  'missing-input-secret': 'The secret parameter was not passed.',
  'invalid-input-secret': 'The secret parameter was invalid or did not exist.',
  'missing-input-response': 'The response parameter was not passed.',
  'invalid-input-response': 'The response parameter is invalid or has expired.',
  'bad-request': 'The request was rejected because it was malformed.',
  'timeout-or-duplicate': 'The response parameter has already been validated before.',
  'internal-error': 'An internal error happened while validating the response.',
};

/**
 * Get human-readable error message from error code
 */
function getErrorMessage(errorCodes: string[]): string {
  if (errorCodes.length === 0) {
    return 'Turnstile verification failed';
  }

  const messages = errorCodes
    .map((code) => ERROR_CODE_MESSAGES[code] || `Unknown error: ${code}`)
    .join('; ');

  return messages;
}

/**
 * Verify a Turnstile token with Cloudflare's API.
 *
 * @param token - The Turnstile response token from the client
 * @param secretKey - The Turnstile secret key
 * @param remoteIp - Optional client IP address for additional validation
 * @returns Verification result
 */
export async function verifyTurnstileToken(
  token: string,
  secretKey: string,
  remoteIp?: string
): Promise<TurnstileResult> {
  // Validate inputs
  if (!token || token.trim() === '') {
    return {
      success: false,
      errorMessage: 'Turnstile token is required',
      errorCodes: ['missing-input-response'],
    };
  }

  if (!secretKey || secretKey.trim() === '') {
    return {
      success: false,
      errorMessage: 'Turnstile secret key is not configured',
      errorCodes: ['missing-input-secret'],
    };
  }

  try {
    // Build form data for verification request
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token);

    if (remoteIp) {
      formData.append('remoteip', remoteIp);
    }

    // Call Turnstile verification API
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      return {
        success: false,
        errorMessage: `Turnstile API returned status ${response.status}`,
        errorCodes: ['internal-error'],
      };
    }

    const data = (await response.json()) as TurnstileVerifyResponse;

    if (data.success) {
      return {
        success: true,
      };
    }

    // Verification failed
    const errorCodes = data['error-codes'] || [];
    return {
      success: false,
      errorMessage: getErrorMessage(errorCodes),
      errorCodes,
    };
  } catch (error) {
    // Network or parsing error
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      errorMessage: `Turnstile verification failed: ${message}`,
      errorCodes: ['internal-error'],
    };
  }
}

/**
 * Check if Turnstile verification is required.
 * Can be used to skip verification in development or for trusted users.
 *
 * @param environment - Current environment (production, development, etc.)
 * @param trustLevel - User's trust level (0-3)
 * @returns true if Turnstile verification should be performed
 */
export function isTurnstileRequired(environment: string, trustLevel: number): boolean {
  // Always require in production for untrusted users
  if (environment === 'production') {
    // Trust level 2+ users may skip Turnstile
    return trustLevel < 2;
  }

  // In development, Turnstile can be skipped
  return false;
}

/**
 * Validate Turnstile token format (basic client-side validation).
 * This is a quick check before making the API call.
 *
 * @param token - The token to validate
 * @returns true if token format appears valid
 */
export function isValidTokenFormat(token: string): boolean {
  // Turnstile tokens are base64-encoded strings
  // They should be non-empty and contain only valid base64 characters
  if (!token || token.trim() === '') {
    return false;
  }

  // Basic length check (tokens are typically 200-500 characters)
  if (token.length < 50 || token.length > 2000) {
    return false;
  }

  return true;
}
