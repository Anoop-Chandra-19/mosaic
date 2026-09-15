import { useState } from 'react';
import { NoTemplates } from '@/features/templates/NoTemplates';
import { useResumeStore } from '@/stores/resumeStore';
import { ContactCard } from './ContactCard';
import { EmptyContentHint } from './EmptyContentHint';
import { SectionList } from './SectionList';

export function ContentTab() {
  const open = useResumeStore((s) => s.templateId !== null);
  // Until something is written, suggest sections instead of the plain Add Section menu.
  const empty = useResumeStore((s) => s.sections.every((section) => section.items.length === 0));
  // A custom section just added from either menu, so its name opens for editing.
  const [namingId, setNamingId] = useState<string | null>(null);

  // Edits need a template to be saved into; with none open, offer to start one instead.
  if (!open) return <NoTemplates />;

  return (
    <div className="space-y-5">
      <ContactCard />
      <SectionList showAddSection={!empty} namingId={namingId} onCustomAdded={setNamingId} />
      {empty && <EmptyContentHint onCustomAdded={setNamingId} />}
    </div>
  );
}
