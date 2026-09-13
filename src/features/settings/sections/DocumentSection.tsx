import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useUIStore } from '@/stores/uiStore';
import type { PaperSize } from '@/types/ui';
import { AlwaysOn, SettingRow } from '../SettingRow';

export function DocumentSection() {
  const paperSize = useUIStore((s) => s.paperSize);
  const setPaperSize = useUIStore((s) => s.setPaperSize);

  return (
    <>
      <SettingRow
        label="Paper size"
        description="Used by the preview and the PDF. Switch any time — the content stays the same."
      >
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={paperSize}
          onValueChange={(value) => value && setPaperSize(value as PaperSize)}
          aria-label="Paper size"
        >
          <ToggleGroupItem value="a4">A4</ToggleGroupItem>
          <ToggleGroupItem value="letter">US Letter</ToggleGroupItem>
        </ToggleGroup>
      </SettingRow>
      <SettingRow
        label="ATS-safe headings"
        description="Section headers stay plain — no small caps, no letter-spacing — so parsers read them."
      >
        <AlwaysOn />
      </SettingRow>
    </>
  );
}
