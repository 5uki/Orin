/**
 * Property-based tests for Rate Limiting Middleware
 *
 * Tests Property: Rate Limiting Enforcement
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { COMMENT_RATE_LIMIT, isRateLimitExceeded, calculateRemainingRequests } from './rate-limit';

describe('Rate Limiting Properties', () => {
  /**
   * Property: Rate Limiting Enforcement
   * For any user, if they submit more than 3 comments within 60 seconds,
   * subsequent submissions SHALL be rejected with RATE_LIMITED error.
   */
  describe('Property: Rate Limiting Enforcement', () => {
    it('should have correct default configuration', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          // Default config should be 3 requests per 60 seconds
          expect(COMMENT_RATE_LIMIT.maxRequests).toBe(3);
          expect(COMMENT_RATE_LIMIT.windowSeconds).toBe(60);
        }),
        { numRuns: 100 }
      );
    });

    it('should allow requests when count is below limit', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }), // maxRequests
          fc.nat(), // currentCount (will be constrained)
          (maxRequests, rawCount) => {
            // Ensure currentCount is less than maxRequests
            const currentCount = rawCount % maxRequests;

            const exceeded = isRateLimitExceeded(currentCount, maxRequests);
            expect(exceeded).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject requests when count equals or exceeds limit', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }), // maxRequests
          fc.integer({ min: 0, max: 100 }), // additional requests beyond limit
          (maxRequests, additional) => {
            // currentCount >= maxRequests
            const currentCount = maxRequests + additional;

            const exceeded = isRateLimitExceeded(currentCount, maxRequests);
            expect(exceeded).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly calculate remaining requests', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }), // maxRequests
          fc.integer({ min: 0, max: 200 }), // currentCount
          (maxRequests, currentCount) => {
            const remaining = calculateRemainingRequests(currentCount, maxRequests);

            // Remaining should never be negative
            expect(remaining).toBeGreaterThanOrEqual(0);

            // Remaining should be maxRequests - currentCount when positive
            if (currentCount < maxRequests) {
              expect(remaining).toBe(maxRequests - currentCount);
            } else {
              expect(remaining).toBe(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should enforce exactly 3 requests per 60 seconds with default config', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 10 }), (currentCount) => {
          const exceeded = isRateLimitExceeded(currentCount, COMMENT_RATE_LIMIT.maxRequests);

          // Should allow 0, 1, 2 requests (count < 3)
          // Should reject 3, 4, 5, ... requests (count >= 3)
          if (currentCount < 3) {
            expect(exceeded).toBe(false);
          } else {
            expect(exceeded).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should be consistent: exceeded implies zero remaining', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }), // maxRequests
          fc.integer({ min: 0, max: 200 }), // currentCount
          (maxRequests, currentCount) => {
            const exceeded = isRateLimitExceeded(currentCount, maxRequests);
            const remaining = calculateRemainingRequests(currentCount, maxRequests);

            // If exceeded, remaining must be 0
            if (exceeded) {
              expect(remaining).toBe(0);
            }

            // If remaining > 0, must not be exceeded
            if (remaining > 0) {
              expect(exceeded).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle edge case: exactly at limit', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), (maxRequests) => {
          // When currentCount equals maxRequests, should be exceeded
          const exceeded = isRateLimitExceeded(maxRequests, maxRequests);
          expect(exceeded).toBe(true);

          // Remaining should be 0
          const remaining = calculateRemainingRequests(maxRequests, maxRequests);
          expect(remaining).toBe(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle edge case: one below limit', () => {
      fc.assert(
        fc.property(fc.integer({ min: 2, max: 100 }), (maxRequests) => {
          const currentCount = maxRequests - 1;

          // Should not be exceeded
          const exceeded = isRateLimitExceeded(currentCount, maxRequests);
          expect(exceeded).toBe(false);

          // Should have exactly 1 remaining
          const remaining = calculateRemainingRequests(currentCount, maxRequests);
          expect(remaining).toBe(1);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle zero current count', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), (maxRequests) => {
          const exceeded = isRateLimitExceeded(0, maxRequests);
          expect(exceeded).toBe(false);

          const remaining = calculateRemainingRequests(0, maxRequests);
          expect(remaining).toBe(maxRequests);
        }),
        { numRuns: 100 }
      );
    });
  });
});
