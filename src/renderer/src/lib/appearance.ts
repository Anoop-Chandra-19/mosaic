export type ThemeChoice = 'dark' | 'light' | 'system';

/** How tightly the chrome is spaced. The resume page never changes with it. */
export type InterfaceDensity = 'comfortable' | 'compact';

const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';

export function isSystemDark(): boolean {
  return window.matchMedia(SYSTEM_DARK_QUERY).matches;
}

export function subscribeToSystemTheme(onChange: () => void): () => void {
  const query = window.matchMedia(SYSTEM_DARK_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

export function isThemeDark(theme: ThemeChoice): boolean {
  return theme === 'system' ? isSystemDark() : theme === 'dark';
}

export function applyThemeClass(isDark: boolean): void {
  document.documentElement.classList.toggle('dark', isDark);
}

/** `.dense` on the page swaps the chrome's spacing steps (`--density-*` in index.css). */
export function applyDensityClass(density: InterfaceDensity): void {
  document.documentElement.classList.toggle('dense', density === 'compact');
}
