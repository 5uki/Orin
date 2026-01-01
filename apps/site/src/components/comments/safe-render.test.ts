/**
 * Property-based tests for Safe Rendering Utilities
 *
 * **Property 16: Comment XSS Prevention**
 * **Property 17: Markdown Safety**
 * **Validates: Requirements 15.3, 15.4**
 *
 * Feature: cloudflare-blog, Property 16: Comment XSS Prevention
 * Feature: cloudflare-blog, Property 17: Markdown Safety
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  escapeHtml,
  renderSafeMarkdown,
  containsHtml,
  stripHtml,
  validateSafeOutput,
} from './safe-render';

/**
 * Common XSS attack vectors for testing
 */
const XSS_VECTORS = [
  '<script>alert("xss")</script>',
  '<img src=x onerror=alert("xss")>',
  '<svg onload=alert("xss")>',
  '<body onload=alert("xss")>',
  '<iframe src="javascript:alert(\'xss\')">',
  '<a href="javascript:alert(\'xss\')">click</a>',
  '<div onclick="alert(\'xss\')">click</div>',
  '<input onfocus="alert(\'xss\')" autofocus>',
  '<marquee onstart="alert(\'xss\')">',
  '<video><source onerror="alert(\'xss\')">',
  '"><script>alert("xss")</script>',
  '\'"--><script>alert("xss")</script>',
  '<ScRiPt>alert("xss")</ScRiPt>',
  '<SCRIPT>alert("xss")</SCRIPT>',
  '<script/src="data:text/javascript,alert(\'xss\')">',
  '<img src="x" onerror="alert(\'xss\')">',
  '<svg/onload=alert("xss")>',
  '<math><mtext><table><mglyph><style><img src=x onerror=alert("xss")>',
];

/**
 * Arbitrary generator for random strings with HTML special characters
 */
const htmlSpecialCharsArb = fc.stringOf(
  fc.constantFrom('&', '<', '>', '"', "'", '/', '`', '=', 'a', 'b', ' ', '\n'),
  { minLength: 0, maxLength: 100 }
);

/**
 * Arbitrary generator for XSS attack vectors
 */
const xssVectorArb = fc.constantFrom(...XSS_VECTORS);

/**
 * Arbitrary generator for safe text (no HTML)
 */
const safeTextArb = fc.stringOf(
  fc.constantFrom(
    ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 \n\t.,!?-_'.split('')
  ),
  { minLength: 0, maxLength: 200 }
);

/**
 * Arbitrary generator for Markdown content
 */
const markdownContentArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789 \n*_`~[]()'.split('')),
  { minLength: 0, maxLength: 100 }
);

describe('Safe Rendering Properties', () => {
  /**
   * Property 16: Comment XSS Prevention
   *
   * For any comment content rendered in the frontend, HTML special characters
   * SHALL be escaped to prevent XSS attacks.
   */
  describe('Property 16: Comment XSS Prevention', () => {
    /**
     * All HTML special characters must be escaped
     */
    it('should escape all HTML special characters in any input', () => {
      fc.assert(
        fc.property(htmlSpecialCharsArb, (input) => {
          const escaped = escapeHtml(input);

          // The escaped output should not contain raw < or > characters
          // (they should be converted to &lt; and &gt;)
          const hasRawAngleBrackets =
            /<|>/.test(escaped) && !escaped.includes('&lt;') && !escaped.includes('&gt;');
          expect(hasRawAngleBrackets).toBe(false);

          // Check that all special chars are escaped
          if (input.includes('<')) {
            expect(escaped).toContain('&lt;');
          }
          if (input.includes('>')) {
            expect(escaped).toContain('&gt;');
          }
          if (input.includes('&') && !input.includes('&amp;')) {
            expect(escaped).toContain('&amp;');
          }
          if (input.includes('"')) {
            expect(escaped).toContain('&quot;');
          }
          if (input.includes("'")) {
            expect(escaped).toContain('&#x27;');
          }
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Known XSS vectors must be neutralized
     */
    it('should neutralize all known XSS attack vectors', () => {
      fc.assert(
        fc.property(xssVectorArb, (xssVector) => {
          const escaped = escapeHtml(xssVector);

          // The escaped output should not contain executable script tags
          // (angle brackets are escaped, so <script> becomes &lt;script&gt;)
          expect(escaped).not.toMatch(/<script/i);
          expect(escaped).not.toMatch(/<\/script/i);

          // Should not contain raw event handlers (angle brackets escaped)
          expect(escaped).not.toMatch(/<[^>]*on\w+\s*=/i);

          // The output should be safe (no raw HTML tags)
          expect(escaped).not.toMatch(/<[a-z]/i);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Escaped output should not be executable as HTML
     */
    it('should produce output that cannot execute as HTML', () => {
      fc.assert(
        fc.property(fc.oneof(xssVectorArb, htmlSpecialCharsArb, fc.string()), (input) => {
          const escaped = escapeHtml(input);

          // The escaped string should not contain any raw HTML tags
          // (angle brackets should be escaped)
          const hasRawHtmlTag = /<[a-z!/?]/i.test(escaped);
          expect(hasRawHtmlTag).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Safe text should remain readable after escaping
     */
    it('should preserve safe text content', () => {
      fc.assert(
        fc.property(safeTextArb, (safeText) => {
          const escaped = escapeHtml(safeText);

          // Safe text without special chars should be unchanged
          if (!/[&<>"'`=/]/.test(safeText)) {
            expect(escaped).toBe(safeText);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 17: Markdown Safety
   *
   * For any Markdown content rendered, raw HTML tags SHALL be stripped or escaped.
   */
  describe('Property 17: Markdown Safety', () => {
    /**
     * Raw HTML in Markdown input must be escaped
     */
    it('should escape raw HTML tags in Markdown input', () => {
      fc.assert(
        fc.property(xssVectorArb, (xssVector) => {
          const rendered = renderSafeMarkdown(xssVector);

          // Should not contain raw script tags
          expect(rendered).not.toMatch(/<script/i);
          expect(rendered).not.toMatch(/<\/script/i);

          // Should not contain event handlers
          expect(rendered).not.toMatch(/\son\w+\s*=/i);

          // Should not contain javascript: URLs (except in our safe auto-linked URLs)
          // Our auto-linker only links http/https URLs
          expect(rendered).not.toMatch(/href\s*=\s*["']javascript:/i);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Markdown with embedded HTML should have HTML escaped
     */
    it('should escape HTML embedded in Markdown', () => {
      fc.assert(
        fc.property(fc.tuple(markdownContentArb, xssVectorArb), ([markdown, xss]) => {
          const input = `${markdown} ${xss} ${markdown}`;
          const rendered = renderSafeMarkdown(input);

          // The XSS vector should be escaped
          expect(rendered).not.toMatch(/<script/i);
          expect(rendered).not.toMatch(/<img[^>]*onerror/i);
          expect(rendered).not.toMatch(/<svg[^>]*onload/i);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Safe Markdown syntax should be rendered correctly
     */
    it('should render safe Markdown syntax', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            '**bold**',
            '*italic*',
            '`code`',
            '~~strikethrough~~',
            '__bold__',
            '_italic_'
          ),
          (markdown) => {
            const rendered = renderSafeMarkdown(markdown);

            // Should contain the expected safe HTML tags
            if (markdown.includes('**') || markdown.includes('__')) {
              expect(rendered).toContain('<strong>');
              expect(rendered).toContain('</strong>');
            }
            if (
              (markdown.includes('*') && !markdown.includes('**')) ||
              (markdown.includes('_') && !markdown.includes('__'))
            ) {
              expect(rendered).toContain('<em>');
              expect(rendered).toContain('</em>');
            }
            if (markdown.includes('`')) {
              expect(rendered).toContain('<code>');
              expect(rendered).toContain('</code>');
            }
            if (markdown.includes('~~')) {
              expect(rendered).toContain('<del>');
              expect(rendered).toContain('</del>');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Output should only contain safe tags
     */
    it('should only produce safe HTML tags in output', () => {
      fc.assert(
        fc.property(fc.oneof(markdownContentArb, xssVectorArb, fc.string()), (input) => {
          const rendered = renderSafeMarkdown(input);

          // Validate that output only contains safe tags
          const isValid = validateSafeOutput(rendered);
          expect(isValid).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * URLs should be auto-linked safely
     */
    it('should auto-link URLs with safe attributes', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'https://example.com',
            'http://test.org/path',
            'https://github.com/user/repo'
          ),
          (url) => {
            const rendered = renderSafeMarkdown(`Check out ${url} for more info`);

            // Should contain a link
            expect(rendered).toContain('<a href=');
            expect(rendered).toContain('target="_blank"');
            expect(rendered).toContain('rel="noopener noreferrer"');

            // Should not allow javascript: URLs
            expect(rendered).not.toContain('javascript:');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional helper function tests
   */
  describe('Helper Functions', () => {
    it('containsHtml should detect HTML patterns', () => {
      fc.assert(
        fc.property(xssVectorArb, (xss) => {
          expect(containsHtml(xss)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('stripHtml should remove all HTML tags', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            '<p>text</p>',
            '<div class="test">content</div>',
            '<script>alert("xss")</script>'
          ),
          (html) => {
            const stripped = stripHtml(html);
            expect(stripped).not.toMatch(/<[^>]*>/);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
