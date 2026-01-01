/**
 * Date formatting utilities for Chinese locale
 *
 * Requirements: 12.4 - THE date format SHALL be in Chinese format (如：2026年1月1日)
 */

/**
 * Format a date in Chinese format (年月日)
 * @param date - The date to format
 * @returns Formatted date string like "2026年1月1日"
 */
export function formatChineseDate(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}年${month}月${day}日`;
}

/**
 * Check if two dates represent the same day
 * @param date1 - First date
 * @param date2 - Second date
 * @returns true if both dates are on the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}
