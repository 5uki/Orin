/**
 * Property-based tests for Admin Permission Middleware
 *
 * Test Property: Admin Permission Enforcement
 * For any admin API request, if the user's github_id is not in ADMIN_GITHUB_IDS,
 * the request SHALL be rejected with FORBIDDEN error.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { parseAdminGithubIds, isAdminGithubId } from './admin';

describe('Admin Permission Properties', () => {
  /**
   * Property: Admin Permission Enforcement
   * For any admin API request, if the user's github_id is not in ADMIN_GITHUB_IDS,
   * the request SHALL be rejected with FORBIDDEN error.
   */
  describe('Property: Admin Permission Enforcement', () => {
    // Arbitrary for GitHub ID (numeric string)
    const githubIdArb = fc
      .array(fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'), {
        minLength: 1,
        maxLength: 20,
      })
      .map((arr) => arr.join(''));

    // Arbitrary for admin whitelist (comma-separated GitHub IDs)
    const adminListArb = fc.array(githubIdArb, { minLength: 0, maxLength: 10 });

    it('should grant access when github_id is in whitelist', () => {
      fc.assert(
        fc.property(
          adminListArb.filter((list) => list.length > 0),
          fc.nat({ max: 100 }),
          (adminList, indexSeed) => {
            // Pick a random admin from the list
            const index = indexSeed % adminList.length;
            const adminGithubId = adminList[index];

            const result = isAdminGithubId(adminGithubId, adminList);
            expect(result).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should deny access when github_id is NOT in whitelist', () => {
      fc.assert(
        fc.property(adminListArb, githubIdArb, (adminList, testGithubId) => {
          // Only test when the ID is not in the list
          fc.pre(!adminList.includes(testGithubId));

          const result = isAdminGithubId(testGithubId, adminList);
          expect(result).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should deny access when whitelist is empty', () => {
      fc.assert(
        fc.property(githubIdArb, (testGithubId) => {
          const result = isAdminGithubId(testGithubId, []);
          expect(result).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should parse comma-separated admin IDs correctly', () => {
      fc.assert(
        fc.property(adminListArb, (adminList) => {
          const envString = adminList.join(',');
          const parsed = parseAdminGithubIds(envString);

          // Should contain all non-empty IDs
          const expected = adminList.filter((id) => id.length > 0);
          expect(parsed).toEqual(expected);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle whitespace in admin IDs', () => {
      fc.assert(
        fc.property(adminListArb, (adminList) => {
          // Add random whitespace around IDs
          const envString = adminList.map((id) => `  ${id}  `).join(',');
          const parsed = parseAdminGithubIds(envString);

          // Should trim whitespace
          const expected = adminList.filter((id) => id.length > 0);
          expect(parsed).toEqual(expected);
        }),
        { numRuns: 100 }
      );
    });

    it('should return empty array for undefined/empty env', () => {
      fc.assert(
        fc.property(fc.constantFrom(undefined, '', '   '), (envValue) => {
          const parsed = parseAdminGithubIds(envValue);
          expect(parsed).toEqual([]);
        }),
        { numRuns: 100 }
      );
    });

    it('should be case-sensitive for github IDs', () => {
      fc.assert(
        fc.property(
          fc
            .array(fc.constantFrom('a', 'b', 'c', 'A', 'B', 'C', '1', '2', '3'), {
              minLength: 1,
              maxLength: 10,
            })
            .map((arr) => arr.join('')),
          (baseId) => {
            const lowerId = baseId.toLowerCase();
            const upperId = baseId.toUpperCase();

            // If they're different, one should not match the other
            if (lowerId !== upperId) {
              const adminList = [lowerId];
              expect(isAdminGithubId(upperId, adminList)).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
