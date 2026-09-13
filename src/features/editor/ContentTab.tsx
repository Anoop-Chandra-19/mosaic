import { NoTemplates } from '@/features/templates/NoTemplates';
import { useResumeStore } from '@/stores/resumeStore';
import { ContactCard } from './ContactCard';
import { EmptyContentHint } from './EmptyContentHint';
import { SectionList } from './SectionList';

export function ContentTab() {
  const open = useResumeStore((s) => s.templateId !== null);
  // Until something is written, suggest sections instead of the plain Add Section menu.
  const empty = useResumeStore((s) => s.sections.every((section) => section.items.length === 0));

  // Edits need a template to be saved into; with none open, offer to start one instead.
  if (!open) return <NoTemplates />;

  return (
    <div className="space-y-5">
      <ContactCard />
      <SectionList showAddSection={!empty} />
      {empty && <EmptyContentHint />}
    </div>
  );
}
