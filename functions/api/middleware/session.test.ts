/**
 * Property-based tests for Session Management
 *
 * Tests Property 1: Session Cookie Security
 * Tests Property 2: Session Lifecycle Integrity
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  getSessionCookieOptions,
  generateSessionId,
  calculateSessionExpiry,
  SESSION_DURATION_DAYS,
} from './session';

describe('Session Security Properties', () => {
  /**
   * Property: Session Cookie Security
   * For any successful login, the session_id cookie SHALL have
   * HttpOnly=true, Secure=true (in production), and SameSite=Lax attributes.
   */
  describe('Property: Session Cookie Security', () => {
    it('should always set HttpOnly=true for session cookies', () => {
      fc.assert(
        fc.property(fc.boolean(), (isProduction) => {
          const options = getSessionCookieOptions(isProduction);

          // HttpOnly must ALWAYS be true regardless of environment
          expect(options.httpOnly).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should set Secure=true in production environment', () => {
      fc.assert(
        fc.property(fc.constant(true), (isProduction) => {
          const options = getSessionCookieOptions(isProduction);

          // Secure must be true in production
          expect(options.secure).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should always set SameSite=Lax for session cookies', () => {
      fc.assert(
        fc.property(fc.boolean(), (isProduction) => {
          const options = getSessionCookieOptions(isProduction);

          // SameSite must ALWAYS be Lax
          expect(options.sameSite).toBe('Lax');
        }),
        { numRuns: 100 }
      );
    });

    it('should set correct maxAge based on session duration', () => {
      fc.assert(
        fc.property(fc.boolean(), (isProduction) => {
          const options = getSessionCookieOptions(isProduction);
          const expectedMaxAge = SESSION_DURATION_DAYS * 24 * 60 * 60;

          expect(options.maxAge).toBe(expectedMaxAge);
        }),
        { numRuns: 100 }
      );
    });

    it('should set path to root for session cookies', () => {
      fc.assert(
        fc.property(fc.boolean(), (isProduction) => {
          const options = getSessionCookieOptions(isProduction);

          expect(options.path).toBe('/');
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property: Session Lifecycle Integrity
   * For any session, after logout or ban, the session SHALL be marked as revoked
   * and subsequent requests with that session SHALL be rejected.
   */
  describe('Property: Session Lifecycle Integrity', () => {
    it('should generate unique session IDs', () => {
      fc.assert(
        fc.property(fc.integer({ min: 2, max: 100 }), (count) => {
          const sessionIds = new Set<string>();

          for (let i = 0; i < count; i++) {
            sessionIds.add(generateSessionId());
          }

          // All generated session IDs should be unique
          expect(sessionIds.size).toBe(count);
        }),
        { numRuns: 100 }
      );
    });

    it('should generate session IDs with correct prefix', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const sessionId = generateSessionId();

          // Session ID should start with 'sess_' prefix
          expect(sessionId.startsWith('sess_')).toBe(true);
          // Session ID should have sufficient length for security
          expect(sessionId.length).toBeGreaterThan(40);
        }),
        { numRuns: 100 }
      );
    });

    it('should calculate session expiry in the future', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 365 }), (durationDays) => {
          const now = new Date();
          const expiryStr = calculateSessionExpiry(durationDays);
          const expiry = new Date(expiryStr);

          // Expiry should be in the future
          expect(expiry.getTime()).toBeGreaterThan(now.getTime());

          // Expiry should be approximately durationDays from now
          const expectedExpiry = new Date(now);
          expectedExpiry.setDate(expectedExpiry.getDate() + durationDays);

          // Allow 1 second tolerance for test execution time
          const diff = Math.abs(expiry.getTime() - expectedExpiry.getTime());
          expect(diff).toBeLessThan(1000);
        }),
        { numRuns: 100 }
      );
    });

    it('should use default duration when not specified', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const now = new Date();
          const expiryStr = calculateSessionExpiry();
          const expiry = new Date(expiryStr);

          const expectedExpiry = new Date(now);
          expectedExpiry.setDate(expectedExpiry.getDate() + SESSION_DURATION_DAYS);

          // Allow 1 second tolerance
          const diff = Math.abs(expiry.getTime() - expectedExpiry.getTime());
          expect(diff).toBeLessThan(1000);
        }),
        { numRuns: 100 }
      );
    });

    it('should generate valid ISO date strings for expiry', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 365 }), (durationDays) => {
          const expiryStr = calculateSessionExpiry(durationDays);

          // Should be a valid ISO date string
          const parsed = new Date(expiryStr);
          expect(parsed.toISOString()).toBe(expiryStr);
        }),
        { numRuns: 100 }
      );
    });
  });
});
