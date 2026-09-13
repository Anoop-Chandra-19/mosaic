import { useState } from 'react';
import { Settings, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useAIStore } from '@/stores/aiStore';
import { SETTINGS_GROUPS, SETTINGS_SECTION_BY_ID, type SettingsSectionId } from './settings-nav';
import { AboutSection } from './sections/AboutSection';
import { AISection } from './sections/AISection';
import { AppearanceSection } from './sections/AppearanceSection';
import { DocumentSection } from './sections/DocumentSection';
import { GeneralSection } from './sections/GeneralSection';
import { ImportExportSection } from './sections/ImportExportSection';
import { PrivacySection } from './sections/PrivacySection';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [section, setSection] = useState<SettingsSectionId>('general');
  const aiEnabled = useAIStore((s) => s.enabled);
  const active = SETTINGS_SECTION_BY_ID[section];
  const close = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[min(37.5rem,90vh)] w-[min(54rem,96vw)] max-w-none flex-col gap-0 overflow-hidden rounded-xl border-zinc-200 bg-white p-0 sm:max-w-none dark:border-zinc-800 dark:bg-zinc-950"
      >
        <header className="flex items-center justify-between border-b border-zinc-200 px-3.5 py-3 dark:border-zinc-800">
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            <Settings className="size-4 text-zinc-500" />
            Settings
          </DialogTitle>
          <DialogDescription className="sr-only">
            How Mosaic behaves, looks, and handles your data on this machine.
          </DialogDescription>
          <Button variant="ghost" size="icon-sm" onClick={close} aria-label="Close settings">
            <X className="size-4" />
          </Button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <nav
            aria-label="Settings sections"
            className="flex shrink-0 gap-1 overflow-x-auto border-b border-zinc-200 bg-zinc-50 px-2 py-2 md:w-49 md:flex-col md:overflow-y-auto md:border-r md:border-b-0 md:py-2.5 dark:border-zinc-800 dark:bg-zinc-900"
          >
            {SETTINGS_GROUPS.map((group, index) => (
              <div key={group.label ?? index} className="flex gap-1 md:flex-col">
                {group.label && (
                  <p className="hidden px-2 pt-3 pb-1 text-[0.65rem] font-bold tracking-wider text-zinc-500 uppercase md:block">
                    {group.label}
                  </p>
                )}
                {group.sections.map((item) => {
                  const Icon = item.icon;
                  const isActive = item.id === section;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSection(item.id)}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'flex h-8 shrink-0 items-center gap-2 rounded-md px-2 text-left text-sm whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none',
                        isActive
                          ? 'bg-white font-medium text-zinc-900 ring-1 ring-zinc-200 ring-inset dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700'
                          : 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
                      )}
                    >
                      <Icon
                        className={cn(
                          'size-3.5',
                          isActive ? 'text-zinc-700 dark:text-zinc-300' : 'text-zinc-500'
                        )}
                      />
                      {item.label}
                      {item.id === 'ai' && !aiEnabled && (
                        <span className="ml-auto rounded border border-zinc-200 bg-zinc-100 px-1 text-[0.65rem] leading-4 font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                          off
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          <section
            aria-labelledby="settings-section-title"
            className="min-h-0 flex-1 overflow-y-auto px-5.5 pt-4.5 pb-6"
          >
            <h3
              id="settings-section-title"
              className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100"
            >
              {active.label}
            </h3>
            <p className="mt-1 mb-3 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
              {active.description}
            </p>
            {section === 'general' && <GeneralSection />}
            {section === 'appearance' && <AppearanceSection />}
            {section === 'document' && <DocumentSection />}
            {section === 'ai' && <AISection />}
            {section === 'portability' && <ImportExportSection onCloseSettings={close} />}
            {section === 'privacy' && <PrivacySection />}
            {section === 'about' && <AboutSection />}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
