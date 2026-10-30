import { applyDensityClass, applyThemeClass, isThemeDark } from '@/lib/appearance';
import { seedSettings } from '@/lib/services/settingsStorage';
import type { BootState } from '@shared/types/db';
import { useAgentSettingsStore } from './agentSettingsStore';
import { useOverlayStore } from './overlayStore';
import { useResumeStore } from './resumeStore';
import { useTemplateStore } from './templateStore';
import { useUiStore } from './uiStore';

/**
 * Fill the stores from what boot loaded, before the first render. Settings storage is
 * synchronous, so each store is hydrated when this returns.
 */
export function hydrateStores(boot: BootState): void {
  seedSettings(boot.settings);
  void useUiStore.persist.rehydrate();
  void useAgentSettingsStore.persist.rehydrate();
  useTemplateStore.getState().load(boot.templates);
  useResumeStore.getState().loadDraft(boot.draft);
  const { openOnLaunch, theme, interfaceDensity } = useUiStore.getState();
  // Nothing to open starts on the Start panel, and so does a launch set to show it.
  const hasTemplates = boot.templates.length > 0;
  if (!hasTemplates || openOnLaunch === 'start') {
    useOverlayStore.getState().openSurface({ kind: 'start' });
  } else {
    useOverlayStore.getState().closeSurface('start');
  }
  if (hasTemplates && openOnLaunch === 'templates') {
    useUiStore.getState().setActiveSidebarTab('templates');
    if (useUiStore.getState().sidebarCollapsed) useUiStore.getState().toggleSidebarCollapsed();
  }
  // Set the theme now rather than in `useApplyTheme`'s effect, which runs after the first paint.
  applyThemeClass(isThemeDark(theme));
  applyDensityClass(interfaceDensity);
}
