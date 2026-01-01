/**
 * Property-based tests for Trust Level Calculator
 *
 * Test Property: Trust Level Calculation**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { TrustLevel } from '@orin/shared/types';
import {
  calculateTrustLevel,
  calculateTrustLevelFromDb,
  canAutoApprove,
  type UserCommentStats,
} from './trust-level';

/**
 * Arbitrary generator for UserCommentStats
 */
const userCommentStatsArb: fc.Arbitrary<UserCommentStats> = fc.record({
  approvedCount: fc.integer({ min: 0, max: 1000 }),
  hasRecentRejections: fc.boolean(),
  isManuallyTrusted: fc.boolean(),
});

describe('Trust Level Calculator Properties', () => {
  /**
   * Property: Trust Level Calculation
   *
   * For any user:
   * - IF approved_count = 0 THEN trust_level = 0
   * - ELSE IF approved_count = 1 THEN trust_level = 1
   * - ELSE IF approved_count >= 2 AND no_rejections_in_30_days THEN trust_level = 2
   * - ELSE trust_level = 1
   *
   * Exception: IF manually trusted THEN trust_level = 3
   */
  describe('Property: Trust Level Calculation', () => {
    it('should return level 3 for manually trusted users regardless of other stats', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1000 }),
          fc.boolean(),
          (approvedCount, hasRecentRejections) => {
            const stats: UserCommentStats = {
              approvedCount,
              hasRecentRejections,
              isManuallyTrusted: true,
            };

            const level = calculateTrustLevel(stats);
            expect(level).toBe(3);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Users with no approved comments get level 0
     */
    it('should return level 0 for users with no approved comments', () => {
      fc.assert(
        fc.property(fc.boolean(), (hasRecentRejections) => {
          const stats: UserCommentStats = {
            approvedCount: 0,
            hasRecentRejections,
            isManuallyTrusted: false,
          };

          const level = calculateTrustLevel(stats);
          expect(level).toBe(0);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Users with exactly 1 approved comment get level 1
     */
    it('should return level 1 for users with exactly 1 approved comment', () => {
      fc.assert(
        fc.property(fc.boolean(), (hasRecentRejections) => {
          const stats: UserCommentStats = {
            approvedCount: 1,
            hasRecentRejections,
            isManuallyTrusted: false,
          };

          const level = calculateTrustLevel(stats);
          expect(level).toBe(1);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Users with ≥2 approved comments and no recent rejections get level 2
     */
    it('should return level 2 for users with ≥2 approved comments and no recent rejections', () => {
      fc.assert(
        fc.property(fc.integer({ min: 2, max: 1000 }), (approvedCount) => {
          const stats: UserCommentStats = {
            approvedCount,
            hasRecentRejections: false,
            isManuallyTrusted: false,
          };

          const level = calculateTrustLevel(stats);
          expect(level).toBe(2);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Users with ≥2 approved comments but recent rejections get level 1
     */
    it('should return level 1 for users with ≥2 approved comments but recent rejections', () => {
      fc.assert(
        fc.property(fc.integer({ min: 2, max: 1000 }), (approvedCount) => {
          const stats: UserCommentStats = {
            approvedCount,
            hasRecentRejections: true,
            isManuallyTrusted: false,
          };

          const level = calculateTrustLevel(stats);
          expect(level).toBe(1);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Trust level should always be in valid range (0-3)
     */
    it('should always return a valid trust level (0-3)', () => {
      fc.assert(
        fc.property(userCommentStatsArb, (stats) => {
          const level = calculateTrustLevel(stats);
          expect(level).toBeGreaterThanOrEqual(0);
          expect(level).toBeLessThanOrEqual(3);
          expect([0, 1, 2, 3]).toContain(level);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * calculateTrustLevelFromDb should preserve level 3 for manually trusted users
     */
    it('should preserve level 3 when current level is 3 (manually trusted)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1000 }),
          fc.boolean(),
          (approvedCount, hasRecentRejections) => {
            const level = calculateTrustLevelFromDb(
              approvedCount,
              hasRecentRejections,
              3 as TrustLevel
            );
            expect(level).toBe(3);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * canAutoApprove should return true only for level 2+
     */
    it('should allow auto-approve only for trust level 2 or higher', () => {
      fc.assert(
        fc.property(fc.constantFrom<TrustLevel>(0, 1, 2, 3), (trustLevel) => {
          const canApprove = canAutoApprove(trustLevel);
          if (trustLevel >= 2) {
            expect(canApprove).toBe(true);
          } else {
            expect(canApprove).toBe(false);
          }
        }),
        { numRuns: 100 }
      );
    });
  });
});
