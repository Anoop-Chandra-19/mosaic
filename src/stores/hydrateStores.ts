import { seedSettings } from '@/lib/storage/settingsStorage';
import type { BootState } from '@/types/db';
import { useAIStore } from './aiStore';
import { useUIStore } from './uiStore';

/**
 * Fill the stores from what boot loaded, before the first render. Settings storage is
 * synchronous, so each store is hydrated when this returns.
 */
export function hydrateStores(boot: BootState): void {
  seedSettings(boot.settings);
  void useUIStore.persist.rehydrate();
  void useAIStore.persist.rehydrate();
  // Set the theme now rather than in `useDarkMode`'s effect, which runs after the first paint.
  document.documentElement.classList.toggle('dark', useUIStore.getState().darkMode);
}
