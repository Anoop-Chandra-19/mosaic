import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTemplateStore } from '@/stores/templateStore';
import { getResumeSnapshot } from '@/stores/resumeStore';
import { useUIStore } from '@/stores/uiStore';
import { useTemplateStatus } from '@/lib/hooks/useTemplateStatus';
import { TemplateCard } from './TemplateCard';
import { UnsavedChangesDialog } from './dialogs/UnsavedChangesDialog';

export function TemplatesTab() {
  const templates = useTemplateStore((s) => s.templates);
  const activeTemplateId = useTemplateStore((s) => s.activeTemplateId);
  const saveNewTemplate = useTemplateStore((s) => s.saveNewTemplate);
  const updateActiveTemplate = useTemplateStore((s) => s.updateActiveTemplate);
  const applyTemplate = useTemplateStore((s) => s.applyTemplate);
  const setActiveSidebarTab = useUIStore((s) => s.setActiveSidebarTab);
  const status = useTemplateStatus();

  const [showNewInput, setShowNewInput] = useState(false);
  const [newName, setNewName] = useState('');

  // Unsaved changes dialog state
  const [pendingApplyId, setPendingApplyId] = useState<string | null>(null);

  const handleSaveNew = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    saveNewTemplate(trimmed, getResumeSnapshot());
    setNewName('');
    setShowNewInput(false);
  };

  const handleApply = (templateId: string) => {
    if (templateId === activeTemplateId) return;

    if (status === 'clean') {
      applyTemplate(templateId);
      setActiveSidebarTab('content');
    } else {
      setPendingApplyId(templateId);
    }
  };

  const handleDiscardAndApply = () => {
    if (!pendingApplyId) return;
    applyTemplate(pendingApplyId);
    setPendingApplyId(null);
    setActiveSidebarTab('content');
  };

  const handleSaveAndApply = () => {
    if (!pendingApplyId) return;
    const snapshot = getResumeSnapshot();
    if (status === 'modified' && activeTemplateId) {
      updateActiveTemplate(snapshot);
    } else {
      saveNewTemplate('Untitled', snapshot);
    }
    applyTemplate(pendingApplyId);
    setPendingApplyId(null);
    setActiveSidebarTab('content');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Templates</h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setShowNewInput((v) => !v)}
          aria-label="New template"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {showNewInput && (
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveNew();
              if (e.key === 'Escape') {
                setShowNewInput(false);
                setNewName('');
              }
            }}
            placeholder="Template name…"
            className="h-8 text-sm"
            aria-label="Template name"
            autoFocus
          />
          <Button
            size="sm"
            className="h-8 shrink-0"
            onClick={handleSaveNew}
            disabled={!newName.trim()}
          >
            Save
          </Button>
        </div>
      )}

      {templates.length === 0 && !showNewInput && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No templates yet. Save your current resume as a template to get started.
        </p>
      )}

      <div className="space-y-2">
        {templates.map((tmpl) => (
          <TemplateCard
            key={tmpl.id}
            template={tmpl}
            isActive={tmpl.id === activeTemplateId}
            onApply={handleApply}
          />
        ))}
      </div>

      <UnsavedChangesDialog
        open={pendingApplyId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingApplyId(null);
        }}
        onDiscard={handleDiscardAndApply}
        onSave={handleSaveAndApply}
        saveLabel={status === 'modified' ? 'Update Template' : 'Save Template'}
      />
    </div>
  );
}
