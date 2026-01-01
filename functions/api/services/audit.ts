/**
 * Audit Log Service
 *
 * Handles audit log creation for admin actions.
 *
 * Requirements: 10.3, 11.2, 11.3
 */

import type { DatabaseQueries } from '../../db/queries';
import type { AuditAction, AuditTargetType } from '@orin/shared/types';

/**
 * Audit log entry input
 */
export interface AuditLogInput {
  actorUserId: number;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string;
  detail: Record<string, unknown>;
}

/**
 * Create an audit log entry
 *
 * Requirements: 10.3, 11.2, 11.3
 */
export async function createAuditLog(db: DatabaseQueries, input: AuditLogInput): Promise<void> {
  await db.auditLogs.create({
    actorUserId: input.actorUserId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    detailJson: JSON.stringify(input.detail),
  });
}

/**
 * Validate that an audit log entry has all required fields
 */
export function isValidAuditLogInput(input: unknown): input is AuditLogInput {
  if (typeof input !== 'object' || input === null) {
    return false;
  }

  const obj = input as Record<string, unknown>;

  return (
    typeof obj.actorUserId === 'number' &&
    typeof obj.action === 'string' &&
    typeof obj.targetType === 'string' &&
    typeof obj.targetId === 'string' &&
    typeof obj.detail === 'object' &&
    obj.detail !== null
  );
}
