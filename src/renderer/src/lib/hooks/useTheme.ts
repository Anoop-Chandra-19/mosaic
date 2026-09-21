import { useEffect, useSyncExternalStore } from 'react';
import { useUiStore, type ThemeChoice } from '@/stores/uiStore';

const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';

function isSystemDark(): boolean {
  return window.matchMedia(SYSTEM_DARK_QUERY).matches;
}

function subscribeToSystemTheme(onChange: () => void): () => void {
  const query = window.matchMedia(SYSTEM_DARK_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/** Whether `theme` draws dark right now. */
export function isThemeDark(theme: ThemeChoice): boolean {
  return theme === 'system' ? isSystemDark() : theme === 'dark';
}

export function applyThemeClass(isDark: boolean): void {
  document.documentElement.classList.toggle('dark', isDark);
}

/** Whether the chrome is dark, following the operating system while the theme is System. */
export function useIsDarkTheme(): boolean {
  const theme = useUiStore((s) => s.theme);
  const systemDark = useSyncExternalStore(subscribeToSystemTheme, isSystemDark);
  return theme === 'system' ? systemDark : theme === 'dark';
}

/** Keeps the page's theme class on the chosen theme. Mounted once, by the shell. */
export function useApplyTheme(): void {
  const isDark = useIsDarkTheme();
  useEffect(() => applyThemeClass(isDark), [isDark]);
}
