/**
 * Property-based tests for Slug Format Validation
 *
 * Test Property: Slug Format Validation
 * For any publish request, the slug SHALL match the regex
 * `^\d{4}-\d{2}-\d{2}-[a-z0-9-]{3,80}$`, otherwise the request
 * SHALL be rejected with INVALID_INPUT error.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { PostSlugSchema } from '@orin/shared/validators';

describe('Slug Format Validation Properties', () => {
  /**
   * Property: Slug Format Validation
   * For any publish request, the slug SHALL match the regex
   * `^\d{4}-\d{2}-\d{2}-[a-z0-9-]{3,80}$`, otherwise the request
   * SHALL be rejected with INVALID_INPUT error.
   */
  describe('Property: Slug Format Validation', () => {
    // Arbitrary for valid date part (YYYY-MM-DD)
    const validDateArb = fc
      .tuple(
        fc.integer({ min: 2000, max: 2099 }), // year
        fc.integer({ min: 1, max: 12 }), // month
        fc.integer({ min: 1, max: 28 }) // day (safe for all months)
      )
      .map(([year, month, day]) => {
        const mm = String(month).padStart(2, '0');
        const dd = String(day).padStart(2, '0');
        return `${year}-${mm}-${dd}`;
      });

    // Arbitrary for valid slug text part (3-80 lowercase alphanumeric + hyphens)
    const validSlugTextArb = fc
      .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')), {
        minLength: 3,
        maxLength: 80,
      })
      .map((arr) => arr.join(''));

    // Arbitrary for valid complete slug
    const validSlugArb = fc
      .tuple(validDateArb, validSlugTextArb)
      .map(([date, text]) => `${date}-${text}`);

    it('should accept valid slugs with correct format', () => {
      fc.assert(
        fc.property(validSlugArb, (slug) => {
          const result = PostSlugSchema.safeParse(slug);
          expect(result.success).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject slugs without date prefix', () => {
      fc.assert(
        fc.property(validSlugTextArb, (text) => {
          const result = PostSlugSchema.safeParse(text);
          expect(result.success).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject slugs with uppercase letters', () => {
      fc.assert(
        fc.property(
          validDateArb,
          fc
            .array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')), {
              minLength: 3,
              maxLength: 20,
            })
            .map((arr) => arr.join('')),
          (date, text) => {
            const slug = `${date}-${text}`;
            const result = PostSlugSchema.safeParse(slug);
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject slugs with special characters', () => {
      fc.assert(
        fc.property(
          validDateArb,
          fc.constantFrom('test_slug', 'test.slug', 'test@slug', 'test!slug', 'test slug'),
          (date, text) => {
            const slug = `${date}-${text}`;
            const result = PostSlugSchema.safeParse(slug);
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject slugs with text part shorter than 3 characters', () => {
      fc.assert(
        fc.property(
          validDateArb,
          fc
            .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), {
              minLength: 1,
              maxLength: 2,
            })
            .map((arr) => arr.join('')),
          (date, text) => {
            const slug = `${date}-${text}`;
            const result = PostSlugSchema.safeParse(slug);
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject slugs with text part longer than 80 characters', () => {
      fc.assert(
        fc.property(
          validDateArb,
          fc
            .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), {
              minLength: 81,
              maxLength: 100,
            })
            .map((arr) => arr.join('')),
          (date, text) => {
            const slug = `${date}-${text}`;
            const result = PostSlugSchema.safeParse(slug);
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject slugs with invalid date format', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            '24-01-15', // 2-digit year
            '2024-1-15', // 1-digit month
            '2024-01-5', // 1-digit day
            '2024/01/15', // wrong separator
            '01-15-2024' // wrong order
          ),
          validSlugTextArb,
          (date, text) => {
            const slug = `${date}-${text}`;
            const result = PostSlugSchema.safeParse(slug);
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept slugs with exactly 3 character text part', () => {
      fc.assert(
        fc.property(
          validDateArb,
          fc
            .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), {
              minLength: 3,
              maxLength: 3,
            })
            .map((arr) => arr.join('')),
          (date, text) => {
            const slug = `${date}-${text}`;
            const result = PostSlugSchema.safeParse(slug);
            expect(result.success).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept slugs with exactly 80 character text part', () => {
      fc.assert(
        fc.property(
          validDateArb,
          fc
            .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), {
              minLength: 80,
              maxLength: 80,
            })
            .map((arr) => arr.join('')),
          (date, text) => {
            const slug = `${date}-${text}`;
            const result = PostSlugSchema.safeParse(slug);
            expect(result.success).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject non-string inputs', () => {
      fc.assert(
        fc.property(
          fc.oneof(fc.integer(), fc.boolean(), fc.constant(null), fc.constant(undefined)),
          (input) => {
            const result = PostSlugSchema.safeParse(input);
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
