/**
 * Trust Level Calculator Service
 *
 * Calculates user trust levels based on their comment history.
 * Trust levels determine automatic approval thresholds.
 */

import type { TrustLevel } from '@orin/shared/types';

/**
 * User comment statistics for trust calculation
 */
export interface UserCommentStats {
  /** Number of approved comments */
  approvedCount: number;
  /** Whether user has rejections in last 30 days */
  hasRecentRejections: boolean;
  /** Whether user is manually marked as trusted by admin */
  isManuallyTrusted: boolean;
}

/**
 * Calculate trust level based on user's comment history
 *
 * Trust Level Rules:
 * - Level 0: New user (no approved comments)
 * - Level 1: Has 1 approved comment
 * - Level 2: Has ≥2 approved comments AND no rejections in last 30 days
 * - Level 3: Manually marked as trusted by admin
 *
 * @param stats - User's comment statistics
 * @returns Calculated trust level (0-3)
 */
export function calculateTrustLevel(stats: UserCommentStats): TrustLevel {
  // Level 3: Admin manually marked as trusted
  if (stats.isManuallyTrusted) {
    return 3;
  }

  // Level 0: No approved comments
  if (stats.approvedCount === 0) {
    return 0;
  }

  // Level 1: Exactly 1 approved comment
  if (stats.approvedCount === 1) {
    return 1;
  }

  // Level 2: ≥2 approved comments AND no recent rejections
  if (stats.approvedCount >= 2 && !stats.hasRecentRejections) {
    return 2;
  }

  // Default to Level 1 if has rejections
  return 1;
}

/**
 * Check if a trust level qualifies for auto-approval
 *
 * @param trustLevel - User's trust level
 * @returns true if user can have comments auto-approved
 */
export function canAutoApprove(trustLevel: TrustLevel): boolean {
  return trustLevel >= 2;
}

/**
 * Get trust level description for display
 *
 * @param trustLevel - Trust level to describe
 * @returns Human-readable description
 */
export function getTrustLevelDescription(trustLevel: TrustLevel): string {
  switch (trustLevel) {
    case 0:
      return 'New User';
    case 1:
      return 'Basic User';
    case 2:
      return 'Trusted User';
    case 3:
      return 'Verified User';
    default:
      return 'Unknown';
  }
}

/**
 * Calculate trust level from database query results
 *
 * This is a convenience function that takes raw database values
 * and converts them to the UserCommentStats format.
 *
 * @param approvedCount - Number of approved comments
 * @param hasRecentRejections - Whether user has rejections in last 30 days
 * @param currentTrustLevel - Current trust level from database
 * @returns Calculated trust level
 */
export function calculateTrustLevelFromDb(
  approvedCount: number,
  hasRecentRejections: boolean,
  currentTrustLevel: TrustLevel
): TrustLevel {
  // If already level 3 (manually set), preserve it
  const isManuallyTrusted = currentTrustLevel === 3;

  return calculateTrustLevel({
    approvedCount,
    hasRecentRejections,
    isManuallyTrusted,
  });
}
