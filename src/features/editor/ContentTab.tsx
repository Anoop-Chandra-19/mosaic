import { Button } from '@/components/ui/button';
import { useTemplateStore } from '@/stores/templateStore';
import { getResumeSnapshot } from '@/stores/resumeStore';
import { useTemplateStatus } from '@/lib/hooks/useTemplateStatus';
import { ContactCard } from './ContactCard';
import { SectionList } from './SectionList';

function TemplateActionStrip() {
  const status = useTemplateStatus();
  const activeTemplateId = useTemplateStore((s) => s.activeTemplateId);
  const updateActiveTemplate = useTemplateStore((s) => s.updateActiveTemplate);
  const saveNewTemplate = useTemplateStore((s) => s.saveNewTemplate);

  const handleCommit = () => {
    const snapshot = getResumeSnapshot();
    if (status === 'modified' && activeTemplateId) {
      updateActiveTemplate(snapshot);
    } else if (status === 'untracked') {
      saveNewTemplate('Untitled', snapshot);
    }
  };

  if (status === 'clean') return null;

  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
          {status === 'modified' ? 'Unsaved template changes' : 'Not saved as a template'}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {status === 'modified'
            ? 'Update the active template to make this the new baseline.'
            : 'Save this resume state as a reusable template.'}
        </p>
      </div>
      <Button size="sm" className="ml-3 h-7 shrink-0 text-xs" onClick={handleCommit}>
        {status === 'modified' ? 'Update' : 'Save'}
      </Button>
    </div>
  );
}

export function ContentTab() {
  return (
    <div className="space-y-5">
      <TemplateActionStrip />
      <ContactCard />
      <SectionList />
    </div>
  );
}
