import { AppToggleGroup, AppToggleGroupItem } from '@/components/AppToggleGroup';
import { HeaderLinkToggles } from '@/features/editor/header/HeaderLinkToggles';
import { useResumeStore } from '@/stores/resumeStore';
import { useUiStore } from '@/stores/uiStore';
import type { PaperSize } from '@/types/paper';
import { AlwaysOn, SettingRow } from '../SettingRow';

export function DocumentSection() {
  const paperSize = useUiStore((s) => s.paperSize);
  const setPaperSize = useUiStore((s) => s.setPaperSize);
  // Link looks belong to a resume, so they are offered only while one is open.
  const isResumeOpen = useResumeStore((s) => s.templateId !== null);

  return (
    <>
      <SettingRow
        label="Paper size"
        description="Used by the preview and the PDF. Switch any time: the content stays the same."
      >
        <AppToggleGroup
          type="single"
          value={paperSize}
          onValueChange={(value) => value && setPaperSize(value as PaperSize)}
          aria-label="Paper size"
        >
          <AppToggleGroupItem value="a4">A4</AppToggleGroupItem>
          <AppToggleGroupItem value="letter">US Letter</AppToggleGroupItem>
        </AppToggleGroup>
      </SettingRow>
      {isResumeOpen && (
        <SettingRow
          label="Header links"
          description="How the open resume’s links print in the preview and the PDF. Blue changes only the links; everything else stays black."
        >
          <HeaderLinkToggles />
        </SettingRow>
      )}
      <SettingRow
        label="ATS-safe headings"
        description="Section headers stay plain, with no small caps and no letter-spacing, so parsers read them."
      >
        <AlwaysOn />
      </SettingRow>
    </>
  );
}
