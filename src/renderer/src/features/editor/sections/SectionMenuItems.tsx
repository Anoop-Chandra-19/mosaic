import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { SECTION_PRESETS } from '@shared/resume/sectionPresets';
import type { BuiltInSectionKind, SectionLayout } from '@shared/types/resume';
import { CUSTOM_ICONS, PRESET_ICONS } from './sectionIcons';

/** Menu items that add a built-in section, one per kind. */
export function PresetMenuItems({
  kinds,
  onAdd,
}: {
  kinds: BuiltInSectionKind[];
  onAdd: (kind: BuiltInSectionKind) => void;
}) {
  return kinds.map((kind) => {
    const Icon = PRESET_ICONS[kind];
    return (
      <DropdownMenuItem key={kind} onSelect={() => onAdd(kind)}>
        <Icon className="mr-2 size-4" />
        {SECTION_PRESETS[kind].label}
      </DropdownMenuItem>
    );
  });
}

const CUSTOM_ITEMS: { layout: SectionLayout; label: string; hint: string }[] = [
  { layout: 'entries', label: 'Custom section', hint: 'titles and bullets' },
  { layout: 'lines', label: 'Custom list', hint: 'one line each' },
];

/** "Custom section" and "Custom list": a section the user names, in either shape. */
export function CustomMenuItems({ onChoose }: { onChoose: (layout: SectionLayout) => void }) {
  return CUSTOM_ITEMS.map(({ layout, label, hint }) => {
    const Icon = CUSTOM_ICONS[layout];
    return (
      <DropdownMenuItem key={layout} onSelect={() => onChoose(layout)}>
        <Icon className="mr-2 size-4" />
        {label}
        <span className="ml-auto pl-4 text-xs text-zinc-500">{hint}</span>
      </DropdownMenuItem>
    );
  });
}
