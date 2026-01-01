/**
 * Property-based tests for CSRF Protection
 *
 * Tests Property: CSRF Token Validation
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  getCsrfCookieOptions,
  generateCsrfToken,
  validateCsrfToken,
  requiresCsrfValidation,
  CSRF_TOKEN_LENGTH,
} from './csrf';

describe('CSRF Protection Properties', () => {
  /**
   * Property: CSRF Token Validation
   * For any write operation (POST/PUT/DELETE), if the X-CSRF-Token header
   * does not match the csrf_token cookie, the request SHALL be rejected with FORBIDDEN error.
   */
  describe('Property: CSRF Token Validation', () => {
    it('should accept matching valid tokens', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const token = generateCsrfToken();

          // Same token in header and cookie should be valid
          expect(validateCsrfToken(token, token)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject when header token is missing', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const cookieToken = generateCsrfToken();

          // Missing header token should be rejected
          expect(validateCsrfToken(undefined, cookieToken)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject when cookie token is missing', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const headerToken = generateCsrfToken();

          // Missing cookie token should be rejected
          expect(validateCsrfToken(headerToken, undefined)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject when both tokens are missing', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          // Both missing should be rejected
          expect(validateCsrfToken(undefined, undefined)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject mismatched tokens', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const headerToken = generateCsrfToken();
          const cookieToken = generateCsrfToken();

          // Different tokens should be rejected (extremely unlikely to match)
          expect(validateCsrfToken(headerToken, cookieToken)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject tokens that are too short', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: CSRF_TOKEN_LENGTH * 2 - 1 }),
          (shortToken) => {
            // Short tokens should be rejected even if they match
            expect(validateCsrfToken(shortToken, shortToken)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject empty string tokens', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          expect(validateCsrfToken('', '')).toBe(false);
          expect(validateCsrfToken('', generateCsrfToken())).toBe(false);
          expect(validateCsrfToken(generateCsrfToken(), '')).toBe(false);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('CSRF Token Generation', () => {
    it('should generate unique tokens', () => {
      fc.assert(
        fc.property(fc.integer({ min: 2, max: 100 }), (count) => {
          const tokens = new Set<string>();

          for (let i = 0; i < count; i++) {
            tokens.add(generateCsrfToken());
          }

          // All generated tokens should be unique
          expect(tokens.size).toBe(count);
        }),
        { numRuns: 100 }
      );
    });

    it('should generate tokens with correct length', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const token = generateCsrfToken();

          // Token should be hex string of CSRF_TOKEN_LENGTH bytes
          expect(token.length).toBe(CSRF_TOKEN_LENGTH * 2);
        }),
        { numRuns: 100 }
      );
    });

    it('should generate tokens containing only hex characters', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const token = generateCsrfToken();

          // Token should only contain hex characters
          expect(/^[0-9a-f]+$/.test(token)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('CSRF Cookie Options', () => {
    it('should NOT set HttpOnly for CSRF cookie (must be readable by JS)', () => {
      fc.assert(
        fc.property(fc.boolean(), (isProduction) => {
          const options = getCsrfCookieOptions(isProduction);

          // CSRF cookie must NOT be HttpOnly so JavaScript can read it
          expect(options.httpOnly).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should set Secure=true in production', () => {
      fc.assert(
        fc.property(fc.constant(true), (isProduction) => {
          const options = getCsrfCookieOptions(isProduction);

          expect(options.secure).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should set SameSite=Lax for CSRF cookie', () => {
      fc.assert(
        fc.property(fc.boolean(), (isProduction) => {
          const options = getCsrfCookieOptions(isProduction);

          expect(options.sameSite).toBe('Lax');
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Write Method Detection', () => {
    it('should require CSRF validation for write methods', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('POST', 'PUT', 'DELETE', 'PATCH', 'post', 'put', 'delete', 'patch'),
          (method) => {
            expect(requiresCsrfValidation(method)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should NOT require CSRF validation for read methods', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('GET', 'HEAD', 'OPTIONS', 'get', 'head', 'options'),
          (method) => {
            expect(requiresCsrfValidation(method)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
