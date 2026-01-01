/**
 * Home Page Data Coordinator (L2)
 *
 * Orchestrates molecular layer capabilities to provide all data needed
 * for the home page: latest posts, tag counts, group counts, and sidebar config.
 *
 * @module coordinators/home
 */

import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';

/**
 * Sidebar configuration data
 */
export interface SidebarConfig {
  ownerAvatar: string;
  ownerName: string;
  description: string;
}

/**
 * Post data for display
 */
export interface PostData {
  id: string;
  slug: string;
  title: string;
  date: Date;
  updatedDate?: Date;
  summary?: string;
  tags: string[];
  draft: boolean;
  cover?: string;
  group?: string;
}

/**
 * Home page data structure
 */
export interface HomePageData {
  latestPosts: PostData[];
  tagCounts: Array<[string, number]>;
  groupCounts: Array<[string, number]>;
  sidebarConfig: SidebarConfig;
  totalPosts: number;
}

/**
 * Convert collection entry to PostData
 */
function toPostData(entry: CollectionEntry<'posts'>): PostData {
  return {
    id: entry.id,
    slug: entry.id,
    title: entry.data.title,
    date: entry.data.date,
    updatedDate: entry.data.updatedDate,
    summary: entry.data.summary,
    tags: entry.data.tags,
    draft: entry.data.draft,
    cover: entry.data.cover,
    group: entry.data.group,
  };
}

/**
 * Fetch site configuration from API
 */
async function fetchSiteConfig(apiBase: string): Promise<SidebarConfig | null> {
  if (!apiBase) return null;

  try {
    const response = await fetch(`${apiBase}/api/config`);
    if (!response.ok) return null;

    const payload = (await response.json()) as {
      data?: {
        ownerAvatar?: string;
        ownerName?: string;
        description?: string;
      };
    };

    if (!payload?.data) return null;

    return {
      ownerAvatar: payload.data.ownerAvatar || '/favicon.svg',
      ownerName: payload.data.ownerName || 'Orin Blog',
      description: payload.data.description || '',
    };
  } catch {
    return null;
  }
}

/**
 * Get home page data
 *
 * Orchestrates:
 * - Fetching all published posts
 * - Sorting by date (newest first)
 * - Collecting tag counts
 * - Collecting group counts
 * - Fetching sidebar configuration
 *
 * @param options - Configuration options
 * @returns Home page data with posts, tags, groups, and sidebar config
 */
export async function getHomePageData(options?: {
  apiBase?: string;
  siteDescription?: string;
  maxLatestPosts?: number;
  maxTags?: number;
}): Promise<HomePageData> {
  const {
    apiBase = '',
    siteDescription = 'Share tech, development, and life.',
    maxLatestPosts = 10,
    maxTags = 15,
  } = options || {};

  // Fetch all published posts
  const allPosts = await getCollection('posts', ({ data }) => !data.draft);

  // Sort by date (newest first)
  const sortedPosts = allPosts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  // Get latest posts
  const latestPosts = sortedPosts.slice(0, maxLatestPosts).map(toPostData);

  // Collect tag counts
  const tagCountMap = new Map<string, number>();
  for (const post of allPosts) {
    for (const tag of post.data.tags) {
      tagCountMap.set(tag, (tagCountMap.get(tag) || 0) + 1);
    }
  }
  const tagCounts = [...tagCountMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, maxTags);

  // Collect group counts
  const groupCountMap = new Map<string, number>();
  for (const post of allPosts) {
    if (post.data.group) {
      groupCountMap.set(post.data.group, (groupCountMap.get(post.data.group) || 0) + 1);
    }
  }
  const groupCounts = [...groupCountMap.entries()].sort((a, b) => b[1] - a[1]);

  // Fetch sidebar configuration
  const apiConfig = await fetchSiteConfig(apiBase);
  const sidebarConfig: SidebarConfig = {
    ownerAvatar: apiConfig?.ownerAvatar || '/favicon.svg',
    ownerName: apiConfig?.ownerName || 'Orin Blog',
    description: apiConfig?.description || siteDescription,
  };

  return {
    latestPosts,
    tagCounts,
    groupCounts,
    sidebarConfig,
    totalPosts: allPosts.length,
  };
}
