/**
 * Property-based tests for Comment Content Validation
 *
 * Tests Property: Comment Content Validation
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { CommentContentSchema } from '@orin/shared/validators';

describe('Comment Content Validation Properties', () => {
  /**
   * Property: Comment Content Validation
   * For any comment submission, if content length is outside 1-2000 characters,
   * the request SHALL be rejected with INVALID_INPUT error.
   */
  describe('Property: Comment Content Validation', () => {
    it('should accept content with length between 1 and 2000 characters', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 2000 }), (content) => {
          const result = CommentContentSchema.safeParse(content);
          expect(result.success).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject empty content', () => {
      fc.assert(
        fc.property(fc.constant(''), (content) => {
          const result = CommentContentSchema.safeParse(content);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues[0].message).toBe('Comment content is required');
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should reject content exceeding 2000 characters', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 2001, maxLength: 5000 }), (content) => {
          const result = CommentContentSchema.safeParse(content);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues[0].message).toBe(
              'Comment content must not exceed 2000 characters'
            );
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should accept exactly 1 character content', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 1 }), (content) => {
          const result = CommentContentSchema.safeParse(content);
          expect(result.success).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should accept exactly 2000 character content', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 2000, maxLength: 2000 }), (content) => {
          const result = CommentContentSchema.safeParse(content);
          expect(result.success).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject exactly 2001 character content', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 2001, maxLength: 2001 }), (content) => {
          const result = CommentContentSchema.safeParse(content);
          expect(result.success).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle unicode characters correctly', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 2000, unit: 'grapheme' }), (content) => {
          const result = CommentContentSchema.safeParse(content);
          // Unicode strings should be validated by character count
          if (content.length >= 1 && content.length <= 2000) {
            expect(result.success).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should reject non-string inputs', () => {
      fc.assert(
        fc.property(
          fc.oneof(fc.integer(), fc.boolean(), fc.constant(null), fc.constant(undefined)),
          (input) => {
            const result = CommentContentSchema.safeParse(input);
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
