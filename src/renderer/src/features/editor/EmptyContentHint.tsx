import { Plus } from 'lucide-react';
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

const CHIP =
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none';

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
    <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-3.5 dark:border-zinc-700 dark:bg-zinc-900">
      <p className="mb-2.5 text-xs font-semibold tracking-wider text-zinc-500 uppercase">
        Add a section
      </p>
      <div className="flex flex-wrap gap-1.5">
        {suggested.map((kind) => {
          const Icon = PRESET_ICONS[kind];
          return (
            <button
              key={kind}
              type="button"
              onClick={() => add(kind)}
              className={`${CHIP} border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:text-zinc-100`}
            >
              <Icon className="size-3" />
              {SECTION_PRESETS[kind].label}
            </button>
          );
        })}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={`${CHIP} border-dashed border-zinc-300 text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-700 dark:hover:border-zinc-600 dark:hover:text-zinc-300`}
          >
            <Plus className="size-3" />
            Something else
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
