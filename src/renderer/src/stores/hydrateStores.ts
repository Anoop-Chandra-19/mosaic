import { seedSettings } from '@/lib/storage/settingsStorage';
import type { BootState } from '@shared/types/db';
import { useAIStore } from './aiStore';
import { useOverlayStore } from './overlayStore';
import { useResumeStore } from './resumeStore';
import { useTemplateStore } from './templateStore';
import { useUIStore } from './uiStore';

/**
 * Fill the stores from what boot loaded, before the first render. Settings storage is
 * synchronous, so each store is hydrated when this returns.
 */
export function hydrateStores(boot: BootState): void {
  seedSettings(boot.settings);
  void useUIStore.persist.rehydrate();
  void useAIStore.persist.rehydrate();
  useTemplateStore.getState().load(boot.templates);
  useResumeStore.getState().loadDraft(boot.draft);
  // Nothing to open: the launch starts on the Start panel.
  useOverlayStore.getState().setStartOpen(boot.templates.length === 0);
  // Set the theme now rather than in `useDarkMode`'s effect, which runs after the first paint.
  document.documentElement.classList.toggle('dark', useUIStore.getState().darkMode);
}
