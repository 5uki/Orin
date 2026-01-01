/**
 * Archive Page Data Coordinator (L2)
 *
 * Orchestrates molecular layer capabilities to provide all data needed
 * for the archive page: posts grouped by year and month.
 *
 * @module coordinators/archive
 */

import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';

/**
 * Chinese month names
 */
const CHINESE_MONTHS = [
  '一月',
  '二月',
  '三月',
  '四月',
  '五月',
  '六月',
  '七月',
  '八月',
  '九月',
  '十月',
  '十一月',
  '十二月',
];

/**
 * Post data for archive display
 */
export interface ArchivePostData {
  id: string;
  title: string;
  date: Date;
  day: number;
}

/**
 * Posts grouped by year and month
 */
export interface PostsByYearMonth {
  [year: string]: {
    [month: string]: ArchivePostData[];
  };
}

/**
 * Archive page data structure
 */
export interface ArchivePageData {
  postsByYearMonth: PostsByYearMonth;
  years: string[];
  totalPosts: number;
}

/**
 * Convert collection entry to archive post data
 */
function toArchivePostData(entry: CollectionEntry<'posts'>): ArchivePostData {
  return {
    id: entry.id,
    title: entry.data.title,
    date: entry.data.date,
    day: entry.data.date.getDate(),
  };
}

/**
 * Get Chinese month name from date
 */
function getChineseMonth(date: Date): string {
  return CHINESE_MONTHS[date.getMonth()];
}

/**
 * Get archive page data
 *
 * Orchestrates:
 * - Fetching all published posts
 * - Sorting by date (newest first)
 * - Grouping by year and month
 *
 * @returns Archive page data with posts grouped by year/month
 */
export async function getArchivePageData(): Promise<ArchivePageData> {
  // Fetch all published posts
  const allPosts = await getCollection('posts', ({ data }) => !data.draft);

  // Sort by date (newest first)
  const sortedPosts = allPosts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  // Group posts by year and month
  const postsByYearMonth: PostsByYearMonth = {};

  for (const post of sortedPosts) {
    const year = post.data.date.getFullYear().toString();
    const month = getChineseMonth(post.data.date);

    if (!postsByYearMonth[year]) {
      postsByYearMonth[year] = {};
    }
    if (!postsByYearMonth[year][month]) {
      postsByYearMonth[year][month] = [];
    }
    postsByYearMonth[year][month].push(toArchivePostData(post));
  }

  // Get sorted years (newest first)
  const years = Object.keys(postsByYearMonth).sort((a, b) => Number(b) - Number(a));

  return {
    postsByYearMonth,
    years,
    totalPosts: sortedPosts.length,
  };
}
