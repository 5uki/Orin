/**
 * Taxonomy (Tags/Groups) Data Coordinator (L2)
 *
 * Orchestrates molecular layer capabilities to provide all data needed
 * for tag and group pages: posts filtered by tag/group, static paths.
 *
 * @module coordinators/taxonomy
 */

import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';
import {
  tagToSlug,
  slugToTag,
  groupToSlug,
  slugToGroup,
  getGroupDisplayName,
} from '../molecules/taxonomy';

/**
 * Post data for taxonomy pages
 */
export interface TaxonomyPostData {
  id: string;
  slug: string;
  title: string;
  date: Date;
  updatedDate?: Date;
  summary?: string;
  tags: string[];
  group?: string;
}

/**
 * Tag page data structure
 */
export interface TagPageData {
  tag: string;
  tagSlug: string;
  posts: TaxonomyPostData[];
  totalPosts: number;
}

/**
 * Group page data structure
 */
export interface GroupPageData {
  group: string;
  groupSlug: string;
  displayName: string;
  posts: TaxonomyPostData[];
  totalPosts: number;
}

/**
 * Static path entry for tag pages
 */
export interface TagStaticPath {
  params: { tag: string };
  props: {
    tag: string;
    posts: CollectionEntry<'posts'>[];
  };
}

/**
 * Static path entry for group pages
 */
export interface GroupStaticPath {
  params: { group: string };
  props: {
    group: string;
    posts: CollectionEntry<'posts'>[];
  };
}

/**
 * Convert collection entry to taxonomy post data
 */
function toTaxonomyPostData(entry: CollectionEntry<'posts'>): TaxonomyPostData {
  return {
    id: entry.id,
    slug: entry.id,
    title: entry.data.title,
    date: entry.data.date,
    updatedDate: entry.data.updatedDate,
    summary: entry.data.summary,
    tags: entry.data.tags,
    group: entry.data.group,
  };
}

/**
 * Get static paths for all tags
 *
 * Used by Astro's getStaticPaths() for SSG.
 *
 * @returns Array of static path entries for tags
 */
export async function getTagStaticPaths(): Promise<TagStaticPath[]> {
  const allPosts = await getCollection('posts', ({ data }) => !data.draft);

  // Collect all unique tags
  const tags = new Set<string>();
  for (const post of allPosts) {
    for (const tag of post.data.tags) {
      tags.add(tag);
    }
  }

  return [...tags].map((tag) => ({
    params: { tag: tagToSlug(tag) },
    props: {
      tag,
      posts: allPosts
        .filter((post) => post.data.tags.includes(tag))
        .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf()),
    },
  }));
}

/**
 * Get static paths for all groups
 *
 * Used by Astro's getStaticPaths() for SSG.
 *
 * @returns Array of static path entries for groups
 */
export async function getGroupStaticPaths(): Promise<GroupStaticPath[]> {
  const allPosts = await getCollection('posts', ({ data }) => !data.draft);

  // Collect all unique groups
  const groups = new Set<string>();
  for (const post of allPosts) {
    if (post.data.group) {
      groups.add(post.data.group);
    }
  }

  return [...groups].map((group) => ({
    params: { group: groupToSlug(group) },
    props: {
      group,
      posts: allPosts
        .filter((post) => post.data.group === group)
        .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf()),
    },
  }));
}

/**
 * Get tag page data
 *
 * @param tag - The tag name (decoded)
 * @param posts - Posts with this tag
 * @returns Tag page data
 */
export function getTagPageData(tag: string, posts: CollectionEntry<'posts'>[]): TagPageData {
  return {
    tag,
    tagSlug: tagToSlug(tag),
    posts: posts.map(toTaxonomyPostData),
    totalPosts: posts.length,
  };
}

/**
 * Get group page data
 *
 * @param group - The group name (decoded)
 * @param posts - Posts in this group
 * @returns Group page data
 */
export function getGroupPageData(group: string, posts: CollectionEntry<'posts'>[]): GroupPageData {
  return {
    group,
    groupSlug: groupToSlug(group),
    displayName: getGroupDisplayName(group),
    posts: posts.map(toTaxonomyPostData),
    totalPosts: posts.length,
  };
}

/**
 * Get all tags with their post counts
 *
 * @returns Array of [tag, count] sorted by count (descending)
 */
export async function getAllTagsWithCounts(): Promise<Array<[string, number]>> {
  const allPosts = await getCollection('posts', ({ data }) => !data.draft);

  const tagCounts = new Map<string, number>();
  for (const post of allPosts) {
    for (const tag of post.data.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }

  return [...tagCounts.entries()].sort((a, b) => b[1] - a[1]);
}

/**
 * Get all groups with their post counts
 *
 * @returns Array of [group, count] sorted by count (descending)
 */
export async function getAllGroupsWithCounts(): Promise<Array<[string, number]>> {
  const allPosts = await getCollection('posts', ({ data }) => !data.draft);

  const groupCounts = new Map<string, number>();
  for (const post of allPosts) {
    if (post.data.group) {
      groupCounts.set(post.data.group, (groupCounts.get(post.data.group) || 0) + 1);
    }
  }

  return [...groupCounts.entries()].sort((a, b) => b[1] - a[1]);
}

// Re-export slug utilities for convenience
export { tagToSlug, slugToTag, groupToSlug, slugToGroup, getGroupDisplayName };
