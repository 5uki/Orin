/**
 * Safe Rendering Utilities
 *
 * Functions for safely rendering user-generated content to prevent XSS attacks.
 * Implements HTML escaping and safe Markdown rendering.
 *
 * Requirements: 15.3, 15.4
 */

/**
 * HTML entities to escape for basic text
 * Note: We don't escape / and ` here to allow Markdown processing
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
 * Regex pattern for HTML special characters (excluding / and ` for Markdown)
 */
const HTML_ESCAPE_REGEX = /[&<>"'=]/g;

/**
 * Escape HTML special characters to prevent XSS attacks.
 *
 * @param text - Raw text to escape
 * @returns Escaped text safe for HTML rendering
 */
export function escapeHtml(text: string): string {
  if (typeof text !== 'string') {
    return '';
  }
  return text.replace(HTML_ESCAPE_REGEX, (char) => HTML_ESCAPE_MAP[char] || char);
}

/**
 * Check if a string contains potentially dangerous HTML
 */
export function containsHtml(text: string): boolean {
  return /<[a-z/!?]|&#?\w+;/i.test(text);
}

/**
 * Strip all HTML tags from text
 */
export function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, '');
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
 * Render safe Markdown subset.
 * First escapes HTML, then applies safe Markdown transformations.
 *
 * @param text - Raw text with potential Markdown
 * @returns HTML string with safe Markdown rendered
 */
export function renderSafeMarkdown(text: string): string {
  if (typeof text !== 'string') {
    return '';
  }

  // First, escape all HTML to prevent XSS
  let result = escapeHtml(text);

  // Apply safe Markdown patterns
  for (const { pattern, replacement } of SAFE_MARKDOWN_PATTERNS) {
    result = result.replace(pattern, replacement);
  }

  // Auto-link URLs (after escaping, so URLs are safe)
  result = result.replace(URL_PATTERN, (url) => {
    // URL is already escaped, create safe link
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });

  // Convert newlines to <br> for display
  result = result.replace(/\n/g, '<br>');

  return result;
}

/**
 * Validate that rendered output contains no raw HTML tags
 * (only our safe generated tags)
 */
export function validateSafeOutput(html: string): boolean {
  // Remove our known safe tags
  const safeTags = ['strong', 'em', 'code', 'del', 'a', 'br'];
  let stripped = html;

  for (const tag of safeTags) {
    // Remove opening tags (with attributes for <a>)
    stripped = stripped.replace(new RegExp(`<${tag}[^>]*>`, 'gi'), '');
    // Remove closing tags
    stripped = stripped.replace(new RegExp(`</${tag}>`, 'gi'), '');
  }

  // Check if any HTML-like patterns remain
  return !/<[a-z/!?]/i.test(stripped);
}

/**
 * Format a date for display
 */
export function formatDate(dateString: string): string {
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
