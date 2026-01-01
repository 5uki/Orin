/**
 * Property-based tests for Admin Routes
 *
 * Test Property 1: Article Path Security
 * For any publish/update request, the file path SHALL be exactly
 * `content/posts/{slug}.mdx` with no directory traversal possible.
 *
 * Test Property 2: Unpublish Draft Flag
 * For any unpublish request, the resulting file SHALL have `draft: true`
 * in its frontmatter.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { isPathSafe, buildPostPath, setDraftFlag } from './admin';

describe('Admin Routes Properties', () => {
  /**
   * Property: Article Path Security
   * For any publish/update request, the file path SHALL be exactly
   * `content/posts/{slug}.mdx` with no directory traversal possible.
   */
  describe('Property: Article Path Security', () => {
    // Arbitrary for valid slug (no path traversal characters)
    const validSlugArb = fc
      .tuple(
        fc.integer({ min: 2000, max: 2099 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 }),
        fc
          .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')), {
            minLength: 3,
            maxLength: 40,
          })
          .map((arr) => arr.join(''))
      )
      .map(([year, month, day, text]) => {
        const mm = String(month).padStart(2, '0');
        const dd = String(day).padStart(2, '0');
        return `${year}-${mm}-${dd}-${text}`;
      });

    it('should accept valid slugs without path traversal', () => {
      fc.assert(
        fc.property(validSlugArb, (slug) => {
          expect(isPathSafe(slug)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject slugs with directory traversal (..)', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            '../etc/passwd',
            '..\\windows\\system32',
            '2024-01-01-test/../../../etc/passwd',
            '2024-01-01-..test',
            '2024-01-01-test..'
          ),
          (slug) => {
            expect(isPathSafe(slug)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject slugs with forward slashes', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            '2024-01-01-test/subdir',
            'path/to/file',
            '/absolute/path',
            '2024-01-01-test/../../etc'
          ),
          (slug) => {
            expect(isPathSafe(slug)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject slugs with backslashes', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            '2024-01-01-test\\subdir',
            'path\\to\\file',
            '\\absolute\\path',
            '2024-01-01-test\\..\\..\\etc'
          ),
          (slug) => {
            expect(isPathSafe(slug)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject slugs with null bytes', () => {
      fc.assert(
        fc.property(fc.constantFrom('2024-01-01-test\0.mdx', 'test\0', '\0test'), (slug) => {
          expect(isPathSafe(slug)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should build correct file path for valid slugs', () => {
      fc.assert(
        fc.property(validSlugArb, (slug) => {
          const path = buildPostPath(slug);
          expect(path).toBe(`content/posts/${slug}.mdx`);
          // Path should not contain any traversal
          expect(path).not.toContain('..');
          // Path should start with expected prefix
          expect(path.startsWith('content/posts/')).toBe(true);
          // Path should end with .mdx
          expect(path.endsWith('.mdx')).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 2: Unpublish Draft Flag
   * For any unpublish request, the resulting file SHALL have `draft: true`
   * in its frontmatter.
   */
  describe('Property 13: Unpublish Draft Flag', () => {
    // Arbitrary for MDX content with frontmatter
    // Use integer-based date generation to avoid Invalid Date issues
    const contentWithFrontmatterArb = fc
      .tuple(
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 100 }),
          year: fc.integer({ min: 2000, max: 2099 }),
          month: fc.integer({ min: 1, max: 12 }),
          day: fc.integer({ min: 1, max: 28 }),
        }),
        fc.string({ minLength: 10, maxLength: 500 })
      )
      .map(([meta, body]) => {
        const mm = String(meta.month).padStart(2, '0');
        const dd = String(meta.day).padStart(2, '0');
        const dateStr = `${meta.year}-${mm}-${dd}`;
        return `---\ntitle: "${meta.title}"\ndate: ${dateStr}\n---\n\n${body}`;
      });

    // Arbitrary for MDX content without frontmatter
    const contentWithoutFrontmatterArb = fc.string({ minLength: 10, maxLength: 500 });

    it('should add draft: true to content without frontmatter', () => {
      fc.assert(
        fc.property(contentWithoutFrontmatterArb, (content) => {
          // Skip if content accidentally looks like frontmatter
          fc.pre(!content.startsWith('---'));

          const result = setDraftFlag(content, true);
          expect(result).toContain('draft: true');
          expect(result.startsWith('---\n')).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should add draft: true to content with frontmatter but no draft field', () => {
      fc.assert(
        fc.property(contentWithFrontmatterArb, (content) => {
          const result = setDraftFlag(content, true);
          expect(result).toContain('draft: true');
        }),
        { numRuns: 100 }
      );
    });

    it('should update existing draft: false to draft: true', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 10, maxLength: 200 }),
          (title, body) => {
            const content = `---\ntitle: "${title}"\ndraft: false\n---\n\n${body}`;
            const result = setDraftFlag(content, true);
            expect(result).toContain('draft: true');
            expect(result).not.toContain('draft: false');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve existing draft: true', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 10, maxLength: 200 }),
          (title, body) => {
            const content = `---\ntitle: "${title}"\ndraft: true\n---\n\n${body}`;
            const result = setDraftFlag(content, true);
            expect(result).toContain('draft: true');
            // Should only have one draft field
            const matches = result.match(/draft:/g);
            expect(matches?.length).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be able to set draft: false', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 10, maxLength: 200 }),
          (title, body) => {
            const content = `---\ntitle: "${title}"\ndraft: true\n---\n\n${body}`;
            const result = setDraftFlag(content, false);
            expect(result).toContain('draft: false');
            expect(result).not.toContain('draft: true');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve other frontmatter fields', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 10, maxLength: 100 }),
          (title, author, body) => {
            const content = `---\ntitle: "${title}"\nauthor: "${author}"\n---\n\n${body}`;
            const result = setDraftFlag(content, true);
            expect(result).toContain(`title: "${title}"`);
            expect(result).toContain(`author: "${author}"`);
            expect(result).toContain('draft: true');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
