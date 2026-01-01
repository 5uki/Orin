/**
 * Property-based tests for Audit Log Service
 *
 * Property 14: Audit Log Completeness
 * For any admin action (publish, update, unpublish, approve, reject, ban),
 * an audit log entry SHALL be created with actor, action, target, and timestamp.
 *
 * **Validates: Requirements 10.3, 11.2, 11.3**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { isValidAuditLogInput, type AuditLogInput } from './audit';

describe('Audit Log Properties', () => {
  /**
   * Property 14: Audit Log Completeness
   * For any admin action (publish, update, unpublish, approve, reject, ban),
   * an audit log entry SHALL be created with actor, action, target, and timestamp.
   *
   * **Validates: Requirements 10.3, 11.2, 11.3**
   */
  describe('Property 14: Audit Log Completeness', () => {
    // Arbitrary for valid audit actions
    const auditActionArb = fc.constantFrom(
      'POST_PUBLISH',
      'POST_UPDATE',
      'POST_UNPUBLISH',
      'COMMENT_APPROVE',
      'COMMENT_REJECT',
      'USER_BAN',
      'USER_UNBAN',
      'USER_TRUST_UPDATE'
    );

    // Arbitrary for valid target types
    const targetTypeArb = fc.constantFrom('post', 'comment', 'user');

    // Arbitrary for valid audit log input
    const validAuditLogInputArb = fc.record({
      actorUserId: fc.integer({ min: 1, max: 1000000 }),
      action: auditActionArb,
      targetType: targetTypeArb,
      targetId: fc.string({ minLength: 1, maxLength: 100 }),
      detail: fc.dictionary(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.oneof(fc.string(), fc.integer(), fc.boolean())
      ),
    }) as fc.Arbitrary<AuditLogInput>;

    it('should validate complete audit log inputs', () => {
      fc.assert(
        fc.property(validAuditLogInputArb, (input) => {
          expect(isValidAuditLogInput(input)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should require actorUserId to be a number', () => {
      fc.assert(
        fc.property(
          fc.oneof(fc.string(), fc.boolean(), fc.constant(null), fc.constant(undefined)),
          auditActionArb,
          targetTypeArb,
          fc.string({ minLength: 1, maxLength: 50 }),
          (actorUserId, action, targetType, targetId) => {
            const input = {
              actorUserId,
              action,
              targetType,
              targetId,
              detail: {},
            };
            expect(isValidAuditLogInput(input)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should require action to be a string', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }),
          fc.oneof(fc.integer(), fc.boolean(), fc.constant(null), fc.constant(undefined)),
          targetTypeArb,
          fc.string({ minLength: 1, maxLength: 50 }),
          (actorUserId, action, targetType, targetId) => {
            const input = {
              actorUserId,
              action,
              targetType,
              targetId,
              detail: {},
            };
            expect(isValidAuditLogInput(input)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should require targetType to be a string', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }),
          auditActionArb,
          fc.oneof(fc.integer(), fc.boolean(), fc.constant(null), fc.constant(undefined)),
          fc.string({ minLength: 1, maxLength: 50 }),
          (actorUserId, action, targetType, targetId) => {
            const input = {
              actorUserId,
              action,
              targetType,
              targetId,
              detail: {},
            };
            expect(isValidAuditLogInput(input)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should require targetId to be a string', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }),
          auditActionArb,
          targetTypeArb,
          fc.oneof(fc.integer(), fc.boolean(), fc.constant(null), fc.constant(undefined)),
          (actorUserId, action, targetType, targetId) => {
            const input = {
              actorUserId,
              action,
              targetType,
              targetId,
              detail: {},
            };
            expect(isValidAuditLogInput(input)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should require detail to be an object', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }),
          auditActionArb,
          targetTypeArb,
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null)),
          (actorUserId, action, targetType, targetId, detail) => {
            const input = {
              actorUserId,
              action,
              targetType,
              targetId,
              detail,
            };
            expect(isValidAuditLogInput(input)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject null input', () => {
      expect(isValidAuditLogInput(null)).toBe(false);
    });

    it('should reject undefined input', () => {
      expect(isValidAuditLogInput(undefined)).toBe(false);
    });

    it('should reject non-object input', () => {
      fc.assert(
        fc.property(fc.oneof(fc.string(), fc.integer(), fc.boolean()), (input) => {
          expect(isValidAuditLogInput(input)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should accept all valid audit actions', () => {
      const validActions = [
        'POST_PUBLISH',
        'POST_UPDATE',
        'POST_UNPUBLISH',
        'COMMENT_APPROVE',
        'COMMENT_REJECT',
        'USER_BAN',
        'USER_UNBAN',
        'USER_TRUST_UPDATE',
      ];

      for (const action of validActions) {
        const input: AuditLogInput = {
          actorUserId: 1,
          action: action as AuditLogInput['action'],
          targetType: 'post',
          targetId: 'test-id',
          detail: { test: 'value' },
        };
        expect(isValidAuditLogInput(input)).toBe(true);
      }
    });

    it('should accept all valid target types', () => {
      const validTargetTypes = ['post', 'comment', 'user'];

      for (const targetType of validTargetTypes) {
        const input: AuditLogInput = {
          actorUserId: 1,
          action: 'POST_PUBLISH',
          targetType: targetType as AuditLogInput['targetType'],
          targetId: 'test-id',
          detail: { test: 'value' },
        };
        expect(isValidAuditLogInput(input)).toBe(true);
      }
    });
  });
});
