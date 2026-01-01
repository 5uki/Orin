// Theme toggle functionality

type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'theme';

function getStoredTheme(): Theme {
  if (typeof localStorage === 'undefined') return 'system';
  return (localStorage.getItem(STORAGE_KEY) as Theme) || 'system';
}

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getEffectiveTheme(theme: Theme): 'light' | 'dark' {
  return theme === 'system' ? getSystemTheme() : theme;
}

function applyTheme(theme: Theme): void {
  const effective = getEffectiveTheme(theme);
  document.documentElement.classList.toggle('dark', effective === 'dark');
}

function setTheme(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
  window.dispatchEvent(new CustomEvent('theme-change', { detail: { theme } }));
}

function toggleTheme(): void {
  const current = getStoredTheme();
  const effective = getEffectiveTheme(current);
  setTheme(effective === 'dark' ? 'light' : 'dark');
}

// Initialize theme on page load
function initTheme(): void {
  applyTheme(getStoredTheme());

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getStoredTheme() === 'system') {
      applyTheme('system');
    }
  });
}

// Export for use in components
export { getStoredTheme, setTheme, toggleTheme, initTheme, type Theme };
