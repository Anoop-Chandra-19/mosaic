import { Plus } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BUILT_IN_KINDS, SECTION_PRESETS } from '@shared/resume/sectionPresets';
import type { ResumeSection } from '@shared/types/resume';
import { useResumeStore } from '@/stores/resumeStore';
import { SectionItem } from './SectionItem';
import { CustomMenuItems, PresetMenuItems } from './SectionMenuItems';
import { swapNeighbours } from './listOrder';
import { SortList } from './SortList';
import { useAddCustomSection } from './useAddCustomSection';

export function SectionList({
  sections: shown,
  showAddSection = true,
  namingId,
  onCustomAdded,
}: {
  /** Sections of a document other than the draft, which is how an older version is read. */
  sections?: ResumeSection[];
  showAddSection?: boolean;
  /** A custom section just added: it shows with its name open for editing. */
  namingId: string | null;
  onCustomAdded: (sectionId: string) => void;
}) {
  const draftSections = useResumeStore((s) => s.sections);
  const sections = shown ?? draftSections;
  const addSection = useResumeStore((s) => s.addSection);
  const reorderSections = useResumeStore((s) => s.reorderSections);
  const custom = useAddCustomSection(onCustomAdded);

  const sorted = [...sections].sort((a, b) => a.order - b.order);
  const sectionIds = sorted.map((section) => section.id);

  const moveSection = (index: number, direction: -1 | 1) => {
    const next = swapNeighbours(sectionIds, index, direction);
    if (next) reorderSections(next);
  };

  return (
    <div>
      <SortList
        ids={sectionIds}
        kind="section"
        onReorder={reorderSections}
        renderRow={(id, grip) => {
          const i = sectionIds.indexOf(id);
          return (
            <SectionItem
              section={sorted[i]}
              nameAtStart={id === namingId}
              grip={grip}
              isFirst={i === 0}
              isLast={i === sorted.length - 1}
              onMoveUp={() => moveSection(i, -1)}
              onMoveDown={() => moveSection(i, 1)}
            />
          );
        }}
      />

      {showAddSection && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <AppButton variant="outline" size="xs" className="mt-3 ml-1.5">
              <Plus />
              Add section
            </AppButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" onCloseAutoFocus={custom.onCloseAutoFocus}>
            <PresetMenuItems
              kinds={BUILT_IN_KINDS}
              onAdd={(kind) => addSection({ kind, ...SECTION_PRESETS[kind] })}
            />
            <DropdownMenuSeparator />
            <CustomMenuItems onChoose={custom.choose} />
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
