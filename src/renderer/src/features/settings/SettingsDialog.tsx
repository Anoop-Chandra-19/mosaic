import { useState } from 'react';
import { Settings } from 'lucide-react';
import { useOverlayStore } from '@/stores/overlayStore';
import { AppButton } from '@/components/AppButton';
import { AppDialog, AppDialogContent } from '@/components/AppDialog';
import { DialogFrameHeader } from '@/components/DialogFrame';
import { Text } from '@/components/Text';
import { cn } from '@/lib/utils';
import { useAiStore } from '@/stores/aiStore';
import { ShortcutsPanel } from '@/features/shortcuts/ShortcutsPanel';
import type { SettingsSectionId } from '@/types/settings';
import { SETTINGS_GROUPS, SETTINGS_SECTION_BY_ID } from './settingsNav';
import { AboutSection } from './sections/AboutSection';
import { AiSection } from './sections/AiSection';
import { AppearanceSection } from './sections/AppearanceSection';
import { DocumentSection } from './sections/DocumentSection';
import { GeneralSection } from './sections/GeneralSection';
import { HistorySection } from './sections/HistorySection';
import { ImportExportSection } from './sections/ImportExportSection';
import { PrivacySection } from './sections/PrivacySection';

/** Open from anywhere with `openSettings(section)`; mounted once, in the app shell. */
export function SettingsDialog() {
  const showing = useOverlayStore((s) => s.settingsSection);
  const setSection = useOverlayStore((s) => s.openSettings);
  const close = useOverlayStore((s) => s.closeSettings);
  // While the dialog animates closed, keep drawing the section it had.
  const [lastSection, setLastSection] = useState<SettingsSectionId>('general');
  if (showing !== null && showing !== lastSection) setLastSection(showing);
  const section = showing ?? lastSection;
  const aiEnabled = useAiStore((s) => s.enabled);
  const active = SETTINGS_SECTION_BY_ID[section];

  return (
    <AppDialog open={showing !== null} onOpenChange={(open) => !open && close()}>
      <AppDialogContent
        showCloseButton={false}
        className="flex h-[min(37.5rem,90vh)] w-[min(54rem,96vw)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
      >
        <DialogFrameHeader
          icon={Settings}
          title="Settings"
          description="How Mosaic behaves, looks, and handles your data on this computer."
          closeLabel="Close settings"
          onClose={close}
        />

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <nav
            aria-label="Settings sections"
            className="flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-pane px-2 py-2 md:w-49 md:flex-col md:gap-0 md:overflow-y-auto md:border-r md:border-b-0 md:py-2.5"
          >
            {SETTINGS_GROUPS.map((group, index) => (
              <div key={group.label ?? index} className="flex gap-1 md:flex-col md:gap-0">
                {group.label && (
                  <Text
                    as="p"
                    variant="tag"
                    className="hidden px-2.25 pt-2.75 pb-1.25 text-ink-faint md:block"
                  >
                    {group.label}
                  </Text>
                )}
                {group.sections.map((item) => {
                  const Icon = item.icon;
                  const isActive = item.id === section;
                  return (
                    <AppButton
                      key={item.id}
                      variant="ghost"
                      size="sm"
                      onClick={() => setSection(item.id)}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'justify-start gap-2.25 rounded-sm px-2.25 font-regular',
                        isActive &&
                          'bg-pane-raised font-control text-foreground ring-1 ring-line-strong ring-inset hover:bg-pane-raised'
                      )}
                    >
                      <Icon
                        className={cn('size-3.5', isActive ? 'text-ink-soft' : 'text-ink-faint')}
                      />
                      {item.label}
                      {item.id === 'ai' && !aiEnabled && (
                        <span className="ml-auto inline-flex h-4 items-center rounded-sm border border-line bg-line px-1.5 text-tag font-control tracking-normal text-ink-soft normal-case">
                          off
                        </span>
                      )}
                    </AppButton>
                  );
                })}
              </div>
            ))}
          </nav>

          <section
            aria-labelledby="settings-section-title"
            className="min-h-0 flex-1 overflow-y-auto px-5.5 pt-4.5 pb-6 dense:px-5 dense:pt-3.5 dense:pb-5.5"
          >
            <Text as="h3" variant="heading" id="settings-section-title">
              {active.label}
            </Text>
            <Text as="p" variant="secondary" className="mt-1 mb-3">
              {active.description}
            </Text>
            {section === 'general' && <GeneralSection />}
            {section === 'appearance' && <AppearanceSection />}
            {section === 'document' && <DocumentSection />}
            {section === 'history' && <HistorySection />}
            {section === 'keys' && <ShortcutsPanel isEmbedded />}
            {section === 'ai' && <AiSection />}
            {section === 'portability' && <ImportExportSection onCloseSettings={close} />}
            {section === 'privacy' && <PrivacySection />}
            {section === 'about' && <AboutSection />}
          </section>
        </div>
      </AppDialogContent>
    </AppDialog>
  );
}
