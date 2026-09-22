import { useEffect } from 'react';
import { useUiStore, type InterfaceDensity } from '@/stores/uiStore';

/** `.dense` on the page swaps the chrome's spacing steps (`--density-*` in index.css). */
export function applyDensityClass(density: InterfaceDensity): void {
  document.documentElement.classList.toggle('dense', density === 'compact');
}

/** Keeps the page's density class on the chosen density. Mounted once, by the shell. */
export function useApplyDensity(): void {
  const density = useUiStore((s) => s.interfaceDensity);
  useEffect(() => applyDensityClass(density), [density]);
}
