/**
 * URL Slug Encoding Atom (L4)
 *
 * Provides URL-safe encoding/decoding for tags and groups.
 * Uses base64url encoding for non-ASCII characters.
 *
 * @module atoms/slug
 */

/** Pattern for ASCII-safe strings that don't need encoding */
const ASCII_SAFE_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Encode a string to base64url format
 */
function toBase64Url(str: string): string {
  const encoded = btoa(encodeURIComponent(str));
  return `_${encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
}

/**
 * Decode a base64url string
 */
function fromBase64Url(slug: string): string {
  const base64 = slug.slice(1).replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return decodeURIComponent(atob(padded));
}

/**
 * Generate a URL-safe slug from tag name
 * Uses base64url encoding for non-ASCII characters
 *
 * @param tag - Tag name to encode
 * @returns URL-safe slug
 *
 * @example
 * tagToSlug('javascript') // 'javascript'
 * tagToSlug('前端') // '_JUU1JTg5JUFFJUU3JUFCJUFG'
 */
export function tagToSlug(tag: string): string {
  if (ASCII_SAFE_PATTERN.test(tag)) {
    return tag;
  }
  return toBase64Url(tag);
}

/**
 * Decode slug back to tag name
 *
 * @param slug - URL slug to decode
 * @returns Original tag name
 *
 * @example
 * slugToTag('javascript') // 'javascript'
 * slugToTag('_JUU1JTg5JUFFJUU3JUFCJUFG') // '前端'
 */
export function slugToTag(slug: string): string {
  if (!slug.startsWith('_')) {
    return slug;
  }
  return fromBase64Url(slug);
}

/**
 * Generate a URL-safe slug from group name
 * Uses base64url encoding for non-ASCII characters
 *
 * @param group - Group name to encode
 * @returns URL-safe slug
 *
 * @example
 * groupToSlug('tech') // 'tech'
 * groupToSlug('技术') // '_JUU2JThBJTgwJUU2JTlDJUFG'
 */
export function groupToSlug(group: string): string {
  if (ASCII_SAFE_PATTERN.test(group)) {
    return group;
  }
  return toBase64Url(group);
}

/**
 * Decode slug back to group name
 *
 * @param slug - URL slug to decode
 * @returns Original group name
 *
 * @example
 * slugToGroup('tech') // 'tech'
 * slugToGroup('_JUU2JThBJTgwJUU2JTlDJUFG') // '技术'
 */
export function slugToGroup(slug: string): string {
  if (!slug.startsWith('_')) {
    return slug;
  }
  return fromBase64Url(slug);
}

/**
 * Get display name for a group (capitalize first letter)
 *
 * @param group - Group name
 * @returns Display name with first letter capitalized
 *
 * @example
 * getGroupDisplayName('tech') // 'Tech'
 * getGroupDisplayName('前端') // '前端'
 */
export function getGroupDisplayName(group: string): string {
  return group.charAt(0).toUpperCase() + group.slice(1);
}
