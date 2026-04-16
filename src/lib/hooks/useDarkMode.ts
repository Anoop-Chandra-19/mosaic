import { useEffect } from 'react';
import { useUIStore } from '@/stores/uiStore';

export function useDarkMode() {
  const darkMode = useUIStore((s) => s.darkMode);
  const toggleDarkMode = useUIStore((s) => s.toggleDarkMode);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  return { darkMode, toggleDarkMode };
}
