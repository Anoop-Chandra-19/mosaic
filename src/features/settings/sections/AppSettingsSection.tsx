import type { ComponentType } from 'react';
import { MonitorSmartphone, Moon, Sun, FileText, LayoutTemplate, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PaperSize } from '@/types/ui';
import { useUIStore, type SidebarTab } from '@/stores/uiStore';
import { cn } from '@/lib/utils';

const sidebarTabs: {
  id: SidebarTab;
  label: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { id: 'content', label: 'Content', icon: FileText },
  { id: 'templates', label: 'Templates', icon: LayoutTemplate },
  { id: 'ai', label: 'AI Tools', icon: Sparkles },
];

const choiceButtonBaseClass =
  'border-zinc-300 bg-background text-zinc-800 hover:border-amber-500 hover:bg-zinc-200 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-amber-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-100';

const choiceButtonActiveClass =
  'border-amber-500 bg-amber-100 text-zinc-900 hover:border-amber-600 hover:bg-amber-200 dark:border-amber-500 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-amber-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100';

export function AppSettingsSection() {
  const darkMode = useUIStore((s) => s.darkMode);
  const setDarkMode = useUIStore((s) => s.setDarkMode);
  const paperSize = useUIStore((s) => s.paperSize);
  const setPaperSize = useUIStore((s) => s.setPaperSize);
  const activeSidebarTab = useUIStore((s) => s.activeSidebarTab);
  const setActiveSidebarTab = useUIStore((s) => s.setActiveSidebarTab);
  const resetUIState = useUIStore((s) => s.resetUIState);

  return (
    <section className="space-y-4">
      <article className="rounded-xl border border-zinc-300 bg-zinc-100 p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Appearance</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Choose the interface tone for your editing workspace.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => setDarkMode(false)}
            variant="outline"
            aria-pressed={!darkMode}
            className={cn(choiceButtonBaseClass, !darkMode && choiceButtonActiveClass)}
          >
            <Sun className="size-4" />
            Light
          </Button>

          <Button
            type="button"
            onClick={() => setDarkMode(true)}
            variant="outline"
            aria-pressed={darkMode}
            className={cn(choiceButtonBaseClass, darkMode && choiceButtonActiveClass)}
          >
            <Moon className="size-4" />
            Dark
          </Button>
        </div>
      </article>

      <article className="rounded-xl border border-zinc-300 bg-zinc-100 p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Preview Defaults</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Set the paper format used for preview and PDF export.
        </p>

        <div className="mt-3 inline-flex items-center rounded-lg border border-zinc-300 bg-background p-1 dark:border-zinc-700">
          {(['a4', 'letter'] as PaperSize[]).map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => setPaperSize(size)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-semibold uppercase transition-colors',
                paperSize === size
                  ? 'bg-zinc-900 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                  : 'text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100'
              )}
            >
              {size === 'a4' ? 'A4' : 'Letter'}
            </button>
          ))}
        </div>
      </article>

      <article className="rounded-xl border border-zinc-300 bg-zinc-100 p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          <MonitorSmartphone className="size-4" />
          Workspace Defaults
        </h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Pick which sidebar tab opens as your default focus.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {sidebarTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSidebarTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSidebarTab(tab.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors',
                  isActive ? choiceButtonActiveClass : choiceButtonBaseClass
                )}
                aria-pressed={isActive}
              >
                <Icon className="size-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={resetUIState}
            className="border-zinc-300 bg-background text-zinc-800 hover:border-amber-500 hover:bg-zinc-200 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-amber-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            Restore UI Defaults
          </Button>
        </div>
      </article>
    </section>
  );
}
