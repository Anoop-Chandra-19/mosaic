import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  SETTINGS_SECTION_BY_ID,
  type SettingsSection,
  type SettingsSectionId,
} from './settings-nav';
import { AppSettingsSection } from './sections/AppSettingsSection';
import { AISettingsSection } from './sections/AISettingsSection';
import { PrivacyDataSection } from './sections/PrivacyDataSection';
import { AboutSection } from './sections/AboutSection';

interface SettingsContentProps {
  activeSection: SettingsSectionId;
  visibleSections: SettingsSection[];
  isMobile: boolean;
  onSectionSelect: (sectionId: SettingsSectionId) => void;
  onClose: () => void;
  searchValue: string;
}

function renderSection(section: SettingsSectionId) {
  switch (section) {
    case 'app':
      return <AppSettingsSection />;
    case 'ai':
      return <AISettingsSection />;
    case 'privacy':
      return <PrivacyDataSection />;
    case 'about':
      return <AboutSection />;
    default:
      return null;
  }
}

export function SettingsContent({
  activeSection,
  visibleSections,
  isMobile,
  onSectionSelect,
  onClose,
  searchValue,
}: SettingsContentProps) {
  const activeMeta = SETTINGS_SECTION_BY_ID[activeSection];
  const ActiveIcon = activeMeta.icon;

  return (
    <section className="flex h-full min-h-0 flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-zinc-300 bg-background px-4 py-3 dark:border-zinc-800">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-widest text-zinc-500 uppercase dark:text-zinc-400">
              Settings
            </p>
            <h2 className="mt-1 inline-flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              <ActiveIcon className="size-4" />
              {activeMeta.label}
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {activeMeta.description}
            </p>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close settings"
          >
            <X className="size-4" />
          </Button>
        </div>

        {isMobile && (
          <div className="mt-3 flex flex-wrap gap-2">
            {visibleSections.map((section) => {
              const Icon = section.icon;
              const isActive = section.id === activeSection;

              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => onSectionSelect(section.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                    isActive
                      ? 'border-amber-500 bg-amber-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                      : 'border-zinc-300 bg-background text-zinc-600 hover:bg-zinc-200 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'
                  )}
                >
                  <Icon className="size-3" />
                  {section.label}
                </button>
              );
            })}
          </div>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {visibleSections.length === 0 ? (
          <div className="rounded-xl border border-zinc-300 bg-zinc-100 p-5 dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              No matching settings
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              No section matches "{searchValue.trim()}". Try another term.
            </p>
          </div>
        ) : (
          renderSection(activeSection)
        )}
      </div>
    </section>
  );
}
