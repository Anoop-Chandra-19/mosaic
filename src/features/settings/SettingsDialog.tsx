import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { cn } from '@/lib/utils';
import { SettingsContent } from './SettingsContent';
import { SettingsNavRail } from './SettingsNavRail';
import { SETTINGS_SECTIONS, type SettingsSectionId } from './settings-nav';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const isMobile = useIsMobile();
  const [selectedSection, setSelectedSection] = useState<SettingsSectionId>('app');
  const [searchValue, setSearchValue] = useState('');

  const visibleSections = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) {
      return SETTINGS_SECTIONS;
    }

    return SETTINGS_SECTIONS.filter((section) => {
      const haystack = `${section.label} ${section.description} ${section.group}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [searchValue]);

  const activeSection = visibleSections.some((section) => section.id === selectedSection)
    ? selectedSection
    : (visibleSections[0]?.id ?? 'app');

  const handleSectionSelect = (sectionId: SettingsSectionId) => {
    setSelectedSection(sectionId);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSearchValue('');
      setSelectedSection('app');
    }

    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="h-[90vh] w-[96vw] max-w-none translate-x-[-50%] translate-y-[-50%] overflow-hidden border-zinc-300 p-0 shadow-2xl dark:border-zinc-700 md:h-[86vh] md:max-h-224 md:w-[92vw] md:max-w-296"
      >
        <DialogTitle className="sr-only">Mosaic Settings</DialogTitle>
        <DialogDescription className="sr-only">
          Configure application, AI providers, and local privacy controls.
        </DialogDescription>

        <div
          className={cn('grid h-full min-h-0', isMobile ? 'grid-cols-1' : 'grid-cols-[20rem_1fr]')}
        >
          {!isMobile && (
            <SettingsNavRail
              sections={visibleSections}
              activeSection={activeSection}
              onSectionSelect={handleSectionSelect}
              searchValue={searchValue}
              onSearchChange={setSearchValue}
            />
          )}

          <SettingsContent
            activeSection={activeSection}
            visibleSections={visibleSections}
            isMobile={isMobile}
            onSectionSelect={handleSectionSelect}
            onClose={() => handleOpenChange(false)}
            searchValue={searchValue}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
