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

  const moveSection = (index: number, direction: -1 | 1) => {
    const ids = sorted.map((s) => s.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorderSections(ids);
  };

  return (
    <div>
      {sorted.map((section, i) => (
        <SectionItem
          key={section.id}
          section={section}
          nameAtStart={section.id === namingId}
          isFirst={i === 0}
          isLast={i === sorted.length - 1}
          onMoveUp={() => moveSection(i, -1)}
          onMoveDown={() => moveSection(i, 1)}
        />
      ))}

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
