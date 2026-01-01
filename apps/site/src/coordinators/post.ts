/**
 * Post Page Data Coordinator (L2)
 *
 * Orchestrates molecular layer capabilities to provide all data needed
 * for post detail pages: content, navigation, metadata, and reading time.
 *
 * @module coordinators/post
 */

import { getCollection, render } from 'astro:content';
import type { CollectionEntry } from 'astro:content';
import { formatChineseDate, isSameDay, calculateReadingTime } from '../molecules/post';

/**
 * Post navigation item
 */
export interface PostNavItem {
  slug: string;
  title: string;
}

/**
 * Heading item from rendered content
 */
export interface Heading {
  depth: number;
  slug: string;
  text: string;
}

/**
 * Post page data structure
 */
export interface PostPageData {
  post: CollectionEntry<'posts'>;
  headings: Heading[];
  prev: PostNavItem | null;
  next: PostNavItem | null;
  formattedDate: string;
  formattedUpdatedDate: string | null;
  hasBeenUpdated: boolean;
  readingTime: number;
  canonicalUrl: string;
}

/**
 * Static path entry for Astro
 */
export interface PostStaticPath {
  params: { slug: string };
  props: {
    post: CollectionEntry<'posts'>;
    prev: CollectionEntry<'posts'> | null;
    next: CollectionEntry<'posts'> | null;
  };
}

/**
 * Get all posts sorted by date (newest first)
 */
async function getSortedPosts(): Promise<CollectionEntry<'posts'>[]> {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

/**
 * Get static paths for all posts
 *
 * Used by Astro's getStaticPaths() for SSG.
 * Returns posts with prev/next navigation.
 *
 * @returns Array of static path entries
 */
export async function getPostStaticPaths(): Promise<PostStaticPath[]> {
  const sortedPosts = await getSortedPosts();

  return sortedPosts.map((post, index) => ({
    params: { slug: post.id },
    props: {
      post,
      prev: sortedPosts[index + 1] || null,
      next: sortedPosts[index - 1] || null,
    },
  }));
}

/**
 * Get post page data
 *
 * Orchestrates:
 * - Rendering post content
 * - Extracting headings for TOC
 * - Formatting dates in Chinese
 * - Calculating reading time
 * - Building canonical URL
 *
 * @param post - The post collection entry
 * @param prev - Previous post (older)
 * @param next - Next post (newer)
 * @param siteUrl - Site base URL for canonical URL
 * @returns Post page data with all computed values
 */
export async function getPostPageData(
  post: CollectionEntry<'posts'>,
  prev: CollectionEntry<'posts'> | null,
  next: CollectionEntry<'posts'> | null,
  siteUrl: string = 'https://example.com'
): Promise<PostPageData> {
  // Render post content
  const { headings } = await render(post);

  // Format dates in Chinese format
  const formattedDate = formatChineseDate(post.data.date);

  // Check if post has been updated
  const updatedDate = post.data.updatedDate;
  const hasBeenUpdated = Boolean(updatedDate && !isSameDay(post.data.date, updatedDate));
  const formattedUpdatedDate =
    hasBeenUpdated && updatedDate ? formatChineseDate(updatedDate) : null;

  // Calculate reading time (200 words per minute)
  const wordCount = post.body?.split(/\s+/).length || 0;
  const readingTime = calculateReadingTime(wordCount);

  // Build canonical URL
  const canonicalUrl = new URL(`/posts/${post.id}/`, siteUrl).toString();

  // Build navigation items
  const prevNav: PostNavItem | null = prev ? { slug: prev.id, title: prev.data.title } : null;
  const nextNav: PostNavItem | null = next ? { slug: next.id, title: next.data.title } : null;

  return {
    post,
    headings,
    prev: prevNav,
    next: nextNav,
    formattedDate,
    formattedUpdatedDate,
    hasBeenUpdated,
    readingTime,
    canonicalUrl,
  };
}

/**
 * Get all posts data for listing pages
 *
 * @returns Array of posts sorted by date (newest first)
 */
export async function getAllPosts(): Promise<CollectionEntry<'posts'>[]> {
  return getSortedPosts();
}
