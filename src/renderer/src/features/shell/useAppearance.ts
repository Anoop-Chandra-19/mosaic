import { useEffect, useSyncExternalStore } from 'react';
import {
  applyDensityClass,
  applyThemeClass,
  isSystemDark,
  subscribeToSystemTheme,
} from '@/lib/appearance';
import { useUiStore } from '@/stores/uiStore';

export function useIsDarkTheme(): boolean {
  const theme = useUiStore((s) => s.theme);
  const systemDark = useSyncExternalStore(subscribeToSystemTheme, isSystemDark);
  return theme === 'system' ? systemDark : theme === 'dark';
}

export function useApplyTheme(): void {
  const isDark = useIsDarkTheme();
  useEffect(() => applyThemeClass(isDark), [isDark]);
}

export function useApplyDensity(): void {
  const density = useUiStore((s) => s.interfaceDensity);
  useEffect(() => applyDensityClass(density), [density]);
}
