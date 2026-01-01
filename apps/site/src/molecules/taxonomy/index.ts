/**
 * Taxonomy Molecules - Public Interface
 *
 * Components for tag and group display including tag cloud and callouts.
 * Re-exports atomic capabilities needed for taxonomy operations.
 *
 * @module molecules/taxonomy
 */

// Re-export slug utilities for tag/group URLs
export {
  tagToSlug,
  slugToTag,
  groupToSlug,
  slugToGroup,
  getGroupDisplayName,
} from '../../atoms/slug';

// Note: Astro components (TagCloud, Callout) are imported
// directly in .astro files as they cannot be re-exported from TypeScript modules
