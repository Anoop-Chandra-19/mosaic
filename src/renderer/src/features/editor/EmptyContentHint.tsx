import { Plus } from 'lucide-react';
import {
  AppButton,
  Text,
  AppMenu,
  AppMenuContent,
  AppMenuSeparator,
  AppMenuTrigger,
} from '@/components/ui-kit';
import { STARTER_KINDS } from '@/lib/resume/blankResume';
import { SECTION_PRESETS } from '@shared/resume/sectionPresets';
import { useOutlineStore } from '@/stores/outlineStore';
import { useResumeStore } from '@/stores/resumeStore';
import type { BuiltInSectionKind } from '@shared/types/resume';
import { PRESET_ICONS } from './sections/sectionIcons';
import { CustomMenuItems, PresetMenuItems } from './sections/SectionMenuItems';
import { sectionKindsToAdd } from './sections/sectionKindsToAdd';
import { useAddCustomSection } from './sections/useAddCustomSection';

/**
 * While the resume is still empty, the sections people usually add, one click each —
 * offered, not imposed. "Something else" lists the other kinds not on the resume yet, as
 * Add section does, and a custom section or list.
 */
export function EmptyContentHint() {
  const sections = useResumeStore((s) => s.sections);
  const addSection = useResumeStore((s) => s.addSection);
  const noteSectionAdded = useOutlineStore((s) => s.noteSectionAdded);
  const custom = useAddCustomSection((id) => noteSectionAdded(id, true));

  const used = new Set(sections.map((s) => s.kind));
  const suggested = STARTER_KINDS.filter((kind) => !used.has(kind));
  // The same kinds Add section offers, less the starters on their own buttons.
  const others = sectionKindsToAdd(sections).missing.filter(
    (kind) => !STARTER_KINDS.includes(kind)
  );

  const add = (kind: BuiltInSectionKind) => addSection({ kind, ...SECTION_PRESETS[kind] });

  return (
    <div className="rounded-[0.5625rem] border border-dashed border-line-heavy bg-pane-raised p-3.5">
      <Text as="p" variant="eyebrow" className="mb-2.5">
        Add a section
      </Text>
      <div className="flex flex-wrap gap-1.5">
        {suggested.map((kind) => {
          const Icon = PRESET_ICONS[kind];
          return (
            <AppButton
              key={kind}
              variant="outline"
              size="xs"
              shape="pill"
              onClick={() => add(kind)}
              className="font-regular"
            >
              <Icon />
              {SECTION_PRESETS[kind].label}
            </AppButton>
          );
        })}
        <AppMenu>
          <AppMenuTrigger asChild>
            <AppButton variant="dashed" size="xs" shape="pill" className="font-regular">
              <Plus />
              Something else
            </AppButton>
          </AppMenuTrigger>
          <AppMenuContent align="start" onCloseAutoFocus={custom.onCloseAutoFocus}>
            <PresetMenuItems kinds={others} onAdd={add} />
            {others.length > 0 && <AppMenuSeparator />}
            <CustomMenuItems onChoose={custom.choose} />
          </AppMenuContent>
        </AppMenu>
      </div>
    </div>
  );
}
