/**
 * Tag utilities for URL-safe tag slugs
 */

/**
 * Generate a URL-safe slug from tag name
 * Uses base64 encoding for non-ASCII characters
 */
export function tagToSlug(tag: string): string {
  if (/^[a-zA-Z0-9_-]+$/.test(tag)) {
    return tag
  }
  const encoded = btoa(encodeURIComponent(tag))
  return `_${encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`
}

/**
 * Decode slug back to tag name
 */
export function slugToTag(slug: string): string {
  if (!slug.startsWith('_')) {
    return slug
  }
  const base64 = slug.slice(1).replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  return decodeURIComponent(atob(padded))
}
