/**
 * Atoms Layer (L4) - Public Interface
 *
 * Single-responsibility utility functions that form the foundation of the application.
 * Each atom is a pure function with no dependencies on other atoms.
 *
 * @module atoms
 */

// Date formatting utilities
export { formatChineseDate, isSameDay, calculateReadingTime } from './date';

// URL slug encoding/decoding utilities
export { tagToSlug, slugToTag, groupToSlug, slugToGroup, getGroupDisplayName } from './slug';

// HTML escaping utilities for XSS prevention
export { escapeHtml, containsHtml, stripHtml } from './html';

// Safe Markdown rendering utilities
export { renderSafeMarkdown, validateSafeOutput, formatDisplayDate } from './render';

// Theme switching utilities
export { getStoredTheme, setTheme, toggleTheme, initTheme, type Theme } from './theme';

// API request utilities
export { getCsrfToken, apiGet, apiPost, buildApiUrl } from './api';
