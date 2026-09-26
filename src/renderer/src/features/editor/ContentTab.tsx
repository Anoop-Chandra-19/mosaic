import { useState } from 'react';
import { NoTemplates } from '@/features/templates/NoTemplates';
import { useResumeStore } from '@/stores/resumeStore';
import type { ResumeData } from '@shared/types/resume';
import { ResumeHeaderCard } from './header/ResumeHeaderCard';
import { cn } from '@/lib/utils';
import { EmptyContentHint } from './EmptyContentHint';
import { HIDDEN_WHILE_READING } from './editorClasses';
import { SectionList } from './SectionList';

/**
 * The draft, laid out to be worked on. `doc` shows another document instead — an older
 * version being read — which the sidebar shows without letting anything reach it.
 */
export function ContentTab({ doc }: { doc?: ResumeData }) {
  const open = useResumeStore((s) => s.templateId !== null);
  const draftSections = useResumeStore((s) => s.sections);
  // A custom section just added from either menu, so its name opens for editing.
  const [namingId, setNamingId] = useState<string | null>(null);

  // Edits need a template to be saved into; with none open, offer to start one instead.
  if (!open) return <NoTemplates />;

  const sections = doc?.sections ?? draftSections;
  // Until something is written, suggest sections instead of the plain Add Section menu.
  const empty = sections.every((section) => section.items.length === 0);

  return (
    <div>
      <ResumeHeaderCard contact={doc?.contact} />
      <SectionList
        sections={doc?.sections}
        showAddSection={!empty}
        namingId={namingId}
        onCustomAdded={setNamingId}
      />
      {empty && (
        <div className={cn('mt-3', HIDDEN_WHILE_READING)}>
          <EmptyContentHint onCustomAdded={setNamingId} />
        </div>
      )}
    </div>
  );
}
