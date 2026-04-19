import { Button } from '@/components/ui/button';
import { useTemplateStore } from '@/stores/templateStore';
import { getResumeSnapshot } from '@/stores/resumeStore';
import { useTemplateStatus } from '@/lib/hooks/useTemplateStatus';
import { TemplateStatusBadge } from '@/features/templates/TemplateStatusBadge';
import { ContactCard } from './ContactCard';
import { SectionList } from './SectionList';

function TemplateStatusStrip() {
  const status = useTemplateStatus();
  const activeTemplateId = useTemplateStore((s) => s.activeTemplateId);
  const templates = useTemplateStore((s) => s.templates);
  const updateActiveTemplate = useTemplateStore((s) => s.updateActiveTemplate);
  const saveNewTemplate = useTemplateStore((s) => s.saveNewTemplate);

  const activeTemplate = templates.find((t) => t.id === activeTemplateId);

  const handleCommit = () => {
    const snapshot = getResumeSnapshot();
    if (status === 'modified' && activeTemplateId) {
      updateActiveTemplate(snapshot);
    } else if (status === 'untracked') {
      saveNewTemplate('Untitled', snapshot);
    }
  };

  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-center gap-2 min-w-0">
        <span className="truncate text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {activeTemplate?.name ?? 'No template'}
        </span>
        <TemplateStatusBadge status={status} />
      </div>
      {(status === 'modified' || status === 'untracked') && (
        <Button size="sm" className="ml-2 h-7 shrink-0 text-xs" onClick={handleCommit}>
          {status === 'modified' ? 'Update Template' : 'Save as Template'}
        </Button>
      )}
    </div>
  );
}

export function ContentTab() {
  return (
    <div className="space-y-5">
      <TemplateStatusStrip />
      <ContactCard />
      <SectionList />
    </div>
  );
}
