import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  SETTINGS_GROUP_LABELS,
  type SettingsGroupId,
  type SettingsSection,
  type SettingsSectionId,
} from './settings-nav';

const GROUP_ORDER: SettingsGroupId[] = ['workspace', 'intelligence', 'safety', 'meta'];

interface SettingsNavRailProps {
  sections: SettingsSection[];
  activeSection: SettingsSectionId;
  onSectionSelect: (sectionId: SettingsSectionId) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
}

export function SettingsNavRail({
  sections,
  activeSection,
  onSectionSelect,
  searchValue,
  onSearchChange,
}: SettingsNavRailProps) {
  return (
    <aside className="flex h-full flex-col border-r border-zinc-300 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="border-b border-zinc-300 px-4 py-4 dark:border-zinc-800">
        <p className="text-xs font-semibold tracking-widest text-zinc-600 uppercase dark:text-zinc-400">
          Settings
        </p>
        <h2 className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Mosaic Control
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Tune behavior and privacy.</p>

        <div className="relative mt-4">
          <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-zinc-500 dark:text-zinc-400" />
          <Input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search settings"
            className="h-9 border-zinc-300 bg-zinc-50 pl-9 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            aria-label="Search settings"
          />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {GROUP_ORDER.map((group) => {
          const groupedSections = sections.filter((section) => section.group === group);
          if (groupedSections.length === 0) {
            return null;
          }

          return (
            <div key={group} className="mb-4">
              <p className="px-2 text-xs font-semibold tracking-widest text-zinc-500 uppercase dark:text-zinc-500">
                {SETTINGS_GROUP_LABELS[group]}
              </p>

              <div className="mt-2 space-y-1">
                {groupedSections.map((section) => {
                  const Icon = section.icon;
                  const isActive = activeSection === section.id;

                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => onSectionSelect(section.id)}
                      className={cn(
                        'group flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors',
                        isActive
                          ? 'border-amber-500 bg-amber-100 text-zinc-900 dark:border-amber-500 dark:bg-zinc-800 dark:text-zinc-100'
                          : 'border-transparent text-zinc-700 hover:border-zinc-300 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-900'
                      )}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <Icon className="mt-0.5 size-4 shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{section.label}</span>
                        <span
                          className={cn(
                            'mt-0.5 block text-xs',
                            isActive
                              ? 'text-zinc-700 dark:text-zinc-300'
                              : 'text-zinc-500 dark:text-zinc-500'
                          )}
                        >
                          {section.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
