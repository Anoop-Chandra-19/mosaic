import { Plus } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { STARTER_SECTIONS } from '@/features/start/blankResume';
import { useResumeStore } from '@/stores/resumeStore';
import type { SectionType } from '@/types/resume';
import { SECTION_ICONS, SECTION_TYPE_OPTIONS } from './section-icons';
import { useAddCustomSection } from './useAddCustomSection';

const CHIP =
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none';

/**
 * While the resume is still empty, the sections people usually add, one click each —
 * offered, not imposed. "Something else" lists every other section type, and a custom one.
 */
export function EmptyContentHint({
  onCustomAdded,
}: {
  onCustomAdded: (sectionId: string) => void;
}) {
  const sections = useResumeStore((s) => s.sections);
  const addSection = useResumeStore((s) => s.addSection);
  const custom = useAddCustomSection(onCustomAdded);

  const used = new Set(sections.map((s) => s.type));
  const suggested = STARTER_SECTIONS.filter((s) => !used.has(s.type));
  const others = SECTION_TYPE_OPTIONS.filter(
    (o) => !used.has(o.type) && !STARTER_SECTIONS.some((s) => s.type === o.type)
  );
  const CustomIcon = SECTION_ICONS.custom;

  const add = (type: SectionType, label: string) => addSection(type, label);

  return (
    <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-3.5 dark:border-zinc-700 dark:bg-zinc-900">
      <p className="mb-2.5 text-xs font-semibold tracking-wider text-zinc-500 uppercase">
        Add a section
      </p>
      <div className="flex flex-wrap gap-1.5">
        {suggested.map(({ type, label }) => {
          const Icon = SECTION_ICONS[type];
          return (
            <button
              key={type}
              type="button"
              onClick={() => add(type, label)}
              className={`${CHIP} border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:text-zinc-100`}
            >
              <Icon className="size-3" />
              {label}
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
            {others.map(({ type, label }) => {
              const Icon = SECTION_ICONS[type];
              return (
                <DropdownMenuItem key={type} onClick={() => add(type, label)}>
                  <Icon className="mr-2 size-4" />
                  {label}
                </DropdownMenuItem>
              );
            })}
            {others.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem onSelect={custom.choose}>
              <CustomIcon className="mr-2 size-4" />
              Custom section
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
