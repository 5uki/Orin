/**
 * Safe Rendering Atom (L4)
 *
 * Provides safe Markdown subset rendering for user-generated content.
 * Implements HTML escaping internally to prevent XSS attacks.
 *
 * @module atoms/render
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
 * Escape HTML special characters
 */
function escapeHtmlInternal(text: string): string {
  return text.replace(/[&<>"'=]/g, (char) => HTML_ESCAPE_MAP[char] || char);
}

/**
 * Safe Markdown patterns for rendering
 * Only allows a limited subset of Markdown syntax
 */
const SAFE_MARKDOWN_PATTERNS = [
  // Bold: **text** or __text__
  { pattern: /\*\*([^*]+)\*\*/g, replacement: '<strong>$1</strong>' },
  { pattern: /__([^_]+)__/g, replacement: '<strong>$1</strong>' },
  // Italic: *text* or _text_
  { pattern: /\*([^*]+)\*/g, replacement: '<em>$1</em>' },
  { pattern: /_([^_]+)_/g, replacement: '<em>$1</em>' },
  // Inline code: `code`
  { pattern: /`([^`]+)`/g, replacement: '<code>$1</code>' },
  // Strikethrough: ~~text~~
  { pattern: /~~([^~]+)~~/g, replacement: '<del>$1</del>' },
];

/**
 * URL pattern for auto-linking
 */
const URL_PATTERN = /https?:\/\/[^\s<>"']+/g;

/**
 * Safe tags that we generate
 */
const SAFE_TAGS = ['strong', 'em', 'code', 'del', 'a', 'br'];

/**
 * Render safe Markdown subset.
 * First escapes HTML, then applies safe Markdown transformations.
 *
 * @param text - Raw text with potential Markdown
 * @returns HTML string with safe Markdown rendered
 *
 * @example
 * renderSafeMarkdown('**bold** and *italic*')
 * // '<strong>bold</strong> and <em>italic</em>'
 */
export function renderSafeMarkdown(text: string): string {
  if (typeof text !== 'string') {
    return '';
  }

  // First, escape all HTML to prevent XSS
  let result = escapeHtmlInternal(text);

  // Apply safe Markdown patterns
  for (const { pattern, replacement } of SAFE_MARKDOWN_PATTERNS) {
    result = result.replace(pattern, replacement);
  }

  // Auto-link URLs (after escaping, so URLs are safe)
  result = result.replace(URL_PATTERN, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });

  // Convert newlines to <br> for display
  result = result.replace(/\n/g, '<br>');

  return result;
}

/**
 * Validate that rendered output contains no raw HTML tags
 * (only our safe generated tags)
 *
 * @param html - HTML string to validate
 * @returns true if output only contains safe tags
 *
 * @example
 * validateSafeOutput('<strong>safe</strong>') // true
 * validateSafeOutput('<script>bad</script>') // false
 */
export function validateSafeOutput(html: string): boolean {
  let stripped = html;

  for (const tag of SAFE_TAGS) {
    // Remove opening tags (with attributes for <a>)
    stripped = stripped.replace(new RegExp(`<${tag}[^>]*>`, 'gi'), '');
    // Remove closing tags
    stripped = stripped.replace(new RegExp(`</${tag}>`, 'gi'), '');
  }

  // Check if any HTML-like patterns remain
  return !/<[a-z/!?]/i.test(stripped);
}

/**
 * Format a date string for display
 *
 * @param dateString - ISO date string
 * @returns Formatted date string
 *
 * @example
 * formatDisplayDate('2026-01-01T12:00:00Z')
 * // 'Jan 1, 2026, 12:00 PM'
 */
export function formatDisplayDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}
