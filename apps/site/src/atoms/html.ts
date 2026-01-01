/**
 * HTML Escaping Atom (L4)
 *
 * Provides XSS prevention through HTML character escaping.
 * Pure functions for safe HTML handling.
 *
 * @module atoms/html
 */

/**
 * HTML entities to escape for XSS prevention
 */
const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '=': '&#x3D;',
};

/**
 * Regex pattern for HTML special characters
 */
const HTML_ESCAPE_REGEX = /[&<>"'=]/g;

/**
 * Regex pattern to detect HTML tags or entities
 */
const HTML_DETECT_REGEX = /<[a-z/!?]|&#?\w+;/i;

/**
 * Regex pattern to match HTML tags
 */
const HTML_TAG_REGEX = /<[^>]*>/g;

/**
 * Escape HTML special characters to prevent XSS attacks
 *
 * @param text - Raw text to escape
 * @returns Escaped text safe for HTML rendering
 *
 * @example
 * escapeHtml('<script>alert("xss")</script>')
 * // '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
 */
export function escapeHtml(text: string): string {
  if (typeof text !== 'string') {
    return '';
  }
  return text.replace(HTML_ESCAPE_REGEX, (char) => HTML_ESCAPE_MAP[char] || char);
}

/**
 * Check if a string contains potentially dangerous HTML
 *
 * @param text - Text to check
 * @returns true if text contains HTML tags or entities
 *
 * @example
 * containsHtml('<div>test</div>') // true
 * containsHtml('plain text') // false
 */
export function containsHtml(text: string): boolean {
  return HTML_DETECT_REGEX.test(text);
}

/**
 * Strip all HTML tags from text
 *
 * @param text - Text containing HTML
 * @returns Text with all HTML tags removed
 *
 * @example
 * stripHtml('<p>Hello <strong>world</strong></p>') // 'Hello world'
 */
export function stripHtml(text: string): string {
  return text.replace(HTML_TAG_REGEX, '');
}
