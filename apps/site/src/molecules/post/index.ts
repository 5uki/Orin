/**
 * Post Molecules - Public Interface
 *
 * Components for rendering blog posts including cards, navigation, and structured data.
 * Re-exports atomic capabilities needed for post-related operations.
 *
 * @module molecules/post
 */

// Re-export date formatting atoms for post rendering
export { formatChineseDate, isSameDay, calculateReadingTime } from '../../atoms/date';

// Re-export slug utilities for post URLs
export { tagToSlug, slugToTag } from '../../atoms/slug';

// Note: Astro components (PostCard, PostNavigation, ArticleJsonLd) are imported
// directly in .astro files as they cannot be re-exported from TypeScript modules
