/**
 * Coordinators Layer (L2) - Public Interface
 *
 * Orchestrates molecular layer capabilities, manages data flow, and provides
 * typed interfaces for all data fetching operations.
 *
 * Dependency Rule: L2 → L3 only (no direct L4 imports)
 *
 * @module coordinators
 */

// Home page data coordination
export { getHomePageData, type HomePageData, type SidebarConfig } from './home';

// Post page data coordination
export {
  getPostPageData,
  getPostStaticPaths,
  getAllPosts,
  type PostPageData,
  type PostNavItem,
} from './post';

// Archive page data coordination
export { getArchivePageData, type ArchivePageData, type PostsByYearMonth } from './archive';

// Taxonomy (tags/groups) data coordination
export {
  getTagPageData,
  getGroupPageData,
  getTagStaticPaths,
  getGroupStaticPaths,
  getAllTagsWithCounts,
  getAllGroupsWithCounts,
  tagToSlug,
  slugToTag,
  groupToSlug,
  slugToGroup,
  getGroupDisplayName,
  type TagPageData,
  type GroupPageData,
} from './taxonomy';

// Site configuration coordination
export { getSiteConfig, type SiteConfigData } from './config';
