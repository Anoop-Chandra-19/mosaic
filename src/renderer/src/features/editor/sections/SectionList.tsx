import { useDeferredValue, useState } from 'react';
import { Plus } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import type { ResumeSection } from '@shared/types/resume';
import { useOutlineStore } from '@/stores/outlineStore';
import { useResumeStore } from '@/stores/resumeStore';
import { useListMotion } from '@/lib/motion/useListMotion';
import { SectionItem } from './SectionItem';
import { cn } from '@/lib/utils';
import { HIDDEN_WHILE_READING } from '../editorClasses';
import { swapNeighbours } from '../sort-list/listOrder';
import { SortList } from '../sort-list/SortList';
import { AddSectionMenu } from './AddSectionMenu';

export function SectionList({
  sections: shown,
  showAddSection = true,
}: {
  /** Sections of a document other than the draft, which is how an older version is read. */
  sections?: ResumeSection[];
  showAddSection?: boolean;
}) {
  const draftSections = useDraftSectionsBuiltInSlices();
  const sections = shown ?? draftSections;
  const reorderSections = useResumeStore((s) => s.reorderSections);
  // A custom section just added shows with its name open for editing.
  const namingId = useOutlineStore((s) => (s.addedSection?.isNaming ? s.addedSection.id : null));
  const [isAddSectionMenuOpen, setAddSectionMenuOpen] = useState(false);

  const sorted = [...sections].sort((a, b) => a.order - b.order);
  const sectionIds = sorted.map((section) => section.id);
  const [listRef] = useListMotion(sectionIds.join(' '));

  const moveSection = (index: number, direction: -1 | 1) => {
    const next = swapNeighbours(sectionIds, index, direction);
    if (next) reorderSections(next);
  };

  return (
    <div ref={listRef} className="relative">
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
        // Marked like a row, so it slides with them.
        <div data-sort-id="add-section">
          <AddSectionMenu
            isOpen={isAddSectionMenuOpen}
            onOpenChange={setAddSectionMenuOpen}
            align="start"
          >
            <AppButton
              variant="outline"
              size="xs"
              className={cn('mt-3 ml-1.5', HIDDEN_WHILE_READING)}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-3 shrink-0 items-center justify-center transition-transform duration-180 ease-settle motion-reduce:transition-none',
                  isAddSectionMenuOpen && 'rotate-45'
                )}
              >
                <Plus className="size-3" />
              </span>
              Add section
            </AppButton>
          </AddSectionMenu>
        </div>
      )}
    </div>
  );
}

/**
 * The draft's sections. Edits show at once; a whole other document (an import, a template
 * opened) is built in the background a slice at a time, so a long one doesn't hold the
 * window up, and the sections shown until then stay a moment.
 */
function useDraftSectionsBuiltInSlices(): ResumeSection[] {
  const templateId = useResumeStore((s) => s.templateId);
  const sections = useResumeStore((s) => s.sections);
  const builtTemplateId = useDeferredValue(templateId);
  const builtSections = useDeferredValue(sections);
  return templateId === builtTemplateId ? sections : builtSections;
}
