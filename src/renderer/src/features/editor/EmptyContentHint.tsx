import { Plus } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { STARTER_KINDS } from '@/features/start/blankResume';
import { BUILT_IN_KINDS, SECTION_PRESETS } from '@shared/resume/sectionPresets';
import { useResumeStore } from '@/stores/resumeStore';
import type { BuiltInSectionKind } from '@shared/types/resume';
import { PRESET_ICONS } from './sectionIcons';
import { CustomMenuItems, PresetMenuItems } from './SectionMenuItems';
import { useAddCustomSection } from './useAddCustomSection';

/**
 * While the resume is still empty, the sections people usually add, one click each —
 * offered, not imposed. "Something else" lists the other built-in kinds and a custom
 * section or list.
 */
export function EmptyContentHint({
  onCustomAdded,
}: {
  onCustomAdded: (sectionId: string) => void;
}) {
  const sections = useResumeStore((s) => s.sections);
  const addSection = useResumeStore((s) => s.addSection);
  const custom = useAddCustomSection(onCustomAdded);

  const used = new Set(sections.map((s) => s.kind));
  const suggested = STARTER_KINDS.filter((kind) => !used.has(kind));
  const others = BUILT_IN_KINDS.filter((kind) => !used.has(kind) && !STARTER_KINDS.includes(kind));

  const add = (kind: BuiltInSectionKind) => addSection({ kind, ...SECTION_PRESETS[kind] });

  return (
    <div className="rounded-lg border border-dashed border-line-heavy bg-zinc-50 p-3.5 dark:bg-zinc-900">
      <p className="mb-2.5 text-xs font-semibold tracking-wider text-zinc-500 uppercase">
        Add a section
      </p>
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
              className="font-normal"
            >
              <Icon />
              {SECTION_PRESETS[kind].label}
            </AppButton>
          );
        })}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <AppButton variant="dashed" size="xs" shape="pill" className="font-normal">
              <Plus />
              Something else
            </AppButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" onCloseAutoFocus={custom.onCloseAutoFocus}>
            <PresetMenuItems kinds={others} onAdd={add} />
            {others.length > 0 && <DropdownMenuSeparator />}
            <CustomMenuItems onChoose={custom.choose} />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
