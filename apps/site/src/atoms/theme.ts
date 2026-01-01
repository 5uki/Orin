/**
 * Theme Switching Atom (L4)
 *
 * Provides light/dark theme switching functionality.
 * Manages theme state in localStorage and applies to DOM.
 *
 * @module atoms/theme
 */

/** Theme options */
export type Theme = 'light' | 'dark' | 'system';

/** LocalStorage key for theme preference */
const STORAGE_KEY = 'theme';

/**
 * Get the stored theme preference from localStorage
 *
 * @returns Stored theme or 'system' as default
 *
 * @example
 * getStoredTheme() // 'dark' or 'light' or 'system'
 */
export function getStoredTheme(): Theme {
  if (typeof localStorage === 'undefined') return 'system';
  return (localStorage.getItem(STORAGE_KEY) as Theme) || 'system';
}

/**
 * Get the system's preferred color scheme
 */
function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Get the effective theme (resolves 'system' to actual theme)
 */
function getEffectiveTheme(theme: Theme): 'light' | 'dark' {
  return theme === 'system' ? getSystemTheme() : theme;
}

/**
 * Apply theme to the document
 */
function applyTheme(theme: Theme): void {
  const effective = getEffectiveTheme(theme);
  document.documentElement.classList.toggle('dark', effective === 'dark');
}

/**
 * Set and persist theme preference
 *
 * @param theme - Theme to set
 *
 * @example
 * setTheme('dark')
 */
export function setTheme(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
  window.dispatchEvent(new CustomEvent('theme-change', { detail: { theme } }));
}

/**
 * Toggle between light and dark themes
 *
 * @example
 * toggleTheme() // switches from current to opposite
 */
export function toggleTheme(): void {
  const current = getStoredTheme();
  const effective = getEffectiveTheme(current);
  setTheme(effective === 'dark' ? 'light' : 'dark');
}

/**
 * Initialize theme on page load
 * Sets up initial theme and listens for system preference changes
 *
 * @example
 * // Call once on page load
 * initTheme()
 */
export function initTheme(): void {
  applyTheme(getStoredTheme());

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getStoredTheme() === 'system') {
      applyTheme('system');
    }
  });
}
