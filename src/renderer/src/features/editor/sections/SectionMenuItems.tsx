import { Copy } from 'lucide-react';
import {
  AppMenuItem,
  AppMenuSub,
  AppMenuSubContent,
  AppMenuSubTrigger,
} from '@/components/AppMenu';
import { Text } from '@/components/Text';
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
      <AppMenuItem key={kind} onSelect={() => onAdd(kind)}>
        <Icon />
        {SECTION_PRESETS[kind].label}
      </AppMenuItem>
    );
  });
}

/** "Another like…": the kinds the resume has, to add another of one right below it. */
export function AnotherLikeMenuItem({
  kinds,
  onAdd,
}: {
  kinds: BuiltInSectionKind[];
  onAdd: (kind: BuiltInSectionKind) => void;
}) {
  return (
    <AppMenuSub>
      <AppMenuSubTrigger>
        <Copy />
        Another like…
      </AppMenuSubTrigger>
      <AppMenuSubContent className="min-w-42.5">
        <PresetMenuItems kinds={kinds} onAdd={onAdd} />
      </AppMenuSubContent>
    </AppMenuSub>
  );
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
      <AppMenuItem key={layout} onSelect={() => onChoose(layout)}>
        <Icon />
        {label}
        <Text variant="secondary" className="ml-auto pl-4 text-ink-faint">
          {hint}
        </Text>
      </AppMenuItem>
    );
  });
}
