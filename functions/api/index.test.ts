/**
 * Property-based tests for Hono API error handling
 *
 * Tests Property: Error Response Format
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { createErrorResponse } from './index';
import type { ErrorCode } from '@orin/shared/types';
import { ApiErrorResponseSchema, ErrorCodeSchema } from '@orin/shared/validators';

describe('API Error Response Format', () => {
  /**
   * Property: Error Response Format
   * For any API error response, the body SHALL match the format
   * {ok: false, error: {code, message, requestId}} where code is one of the defined error codes.
   */
  it('should always return properly formatted error responses', () => {
    fc.assert(
      fc.property(
        // Generate valid error codes
        fc.constantFrom(
          'UNAUTHORIZED',
          'FORBIDDEN',
          'INVALID_INPUT',
          'RATE_LIMITED',
          'NOT_FOUND',
          'INTERNAL_ERROR'
        ) as fc.Arbitrary<ErrorCode>,
        // Generate error messages (non-empty strings)
        fc.string({ minLength: 1, maxLength: 200 }),
        // Generate optional request IDs
        fc.option(fc.string({ minLength: 1, maxLength: 50 })),
        (errorCode, message, requestId) => {
          // Create error response using our function
          const response = createErrorResponse(errorCode, message, requestId || undefined);

          // Verify the response structure matches our schema
          const validation = ApiErrorResponseSchema.safeParse(response);
          expect(validation.success).toBe(true);

          if (validation.success) {
            // Verify required fields
            expect(response.ok).toBe(false);
            expect(response.error).toBeDefined();
            expect(response.error.code).toBe(errorCode);
            expect(response.error.message).toBe(message);

            // Verify error code is valid
            const codeValidation = ErrorCodeSchema.safeParse(response.error.code);
            expect(codeValidation.success).toBe(true);

            // Verify requestId is present (either provided or generated)
            expect(response.error.requestId).toBeDefined();
            expect(typeof response.error.requestId).toBe('string');
            expect(response.error.requestId!.length).toBeGreaterThan(0);

            // If requestId was provided, it should match
            if (requestId) {
              expect(response.error.requestId).toBe(requestId);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Test that error codes are properly constrained to the defined enum
   */
  it('should only accept valid error codes', () => {
    fc.assert(
      fc.property(
        fc
          .string({ minLength: 1, maxLength: 50 })
          .filter(
            (s) =>
              ![
                'UNAUTHORIZED',
                'FORBIDDEN',
                'INVALID_INPUT',
                'RATE_LIMITED',
                'NOT_FOUND',
                'INTERNAL_ERROR',
              ].includes(s)
          ),
        fc.string({ minLength: 1, maxLength: 200 }),
        (invalidCode, message) => {
          // TypeScript should prevent this at compile time, but we test runtime behavior
          // This test ensures our validation catches invalid codes
          const response = {
            ok: false as const,
            error: {
              code: invalidCode as ErrorCode,
              message,
              requestId: 'test-id',
            },
          };

          const validation = ApiErrorResponseSchema.safeParse(response);
          expect(validation.success).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Test edge cases for error response format
   */
  it('should handle edge cases properly', () => {
    // Test with empty message (should still be valid if non-empty constraint is met)
    const response1 = createErrorResponse('INTERNAL_ERROR', 'Error', undefined);
    expect(ApiErrorResponseSchema.safeParse(response1).success).toBe(true);

    // Test that requestId is always generated when not provided
    const response2 = createErrorResponse('NOT_FOUND', 'Not found');
    expect(response2.error.requestId).toBeDefined();
    expect(response2.error.requestId!.length).toBeGreaterThan(0);

    // Test that all error codes work
    const errorCodes: ErrorCode[] = [
      'UNAUTHORIZED',
      'FORBIDDEN',
      'INVALID_INPUT',
      'RATE_LIMITED',
      'NOT_FOUND',
      'INTERNAL_ERROR',
    ];

    errorCodes.forEach((code) => {
      const response = createErrorResponse(code, `Test message for ${code}`);
      expect(ApiErrorResponseSchema.safeParse(response).success).toBe(true);
      expect(response.error.code).toBe(code);
    });
  });
});
