/**
 * Group utilities for URL-safe group slugs
 */

/**
 * Generate a URL-safe slug from group name
 * Uses base64 encoding for non-ASCII characters
 */
export function groupToSlug(group: string): string {
  // If already ASCII-safe, use as-is
  if (/^[a-zA-Z0-9_-]+$/.test(group)) {
    return group;
  }
  // Encode non-ASCII to base64url
  const encoded = btoa(encodeURIComponent(group));
  return `_${encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
}

/**
 * Decode slug back to group name
 */
export function slugToGroup(slug: string): string {
  // If not encoded (no underscore prefix), return as-is
  if (!slug.startsWith('_')) {
    return slug;
  }
  // Decode base64url
  const base64 = slug.slice(1).replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return decodeURIComponent(atob(padded));
}

/**
 * Get display name for a group (capitalize first letter)
 */
export function getGroupDisplayName(group: string): string {
  return group.charAt(0).toUpperCase() + group.slice(1);
}
