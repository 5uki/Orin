/**
 * Date Formatting Atom (L4)
 *
 * Provides date formatting utilities for Chinese locale and reading time calculation.
 * Pure functions with no external dependencies.
 *
 * @module atoms/date
 */

/**
 * Format a date in Chinese format (年月日)
 *
 * @param date - The date to format
 * @returns Formatted date string like "2026年1月1日"
 *
 * @example
 * formatChineseDate(new Date('2026-01-01')) // "2026年1月1日"
 */
export function formatChineseDate(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}年${month}月${day}日`;
}

/**
 * Check if two dates represent the same day
 *
 * @param date1 - First date
 * @param date2 - Second date
 * @returns true if both dates are on the same day
 *
 * @example
 * isSameDay(new Date('2026-01-01'), new Date('2026-01-01T23:59:59')) // true
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Calculate estimated reading time in minutes
 *
 * @param wordCount - Number of words in the content
 * @param wordsPerMinute - Reading speed (default: 200 for Chinese/mixed content)
 * @returns Estimated reading time in minutes (minimum 1)
 *
 * @example
 * calculateReadingTime(400) // 2
 * calculateReadingTime(100) // 1
 */
export function calculateReadingTime(wordCount: number, wordsPerMinute = 200): number {
  if (wordCount <= 0 || wordsPerMinute <= 0) {
    return 1;
  }
  return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
}
