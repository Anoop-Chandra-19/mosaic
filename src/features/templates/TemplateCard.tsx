import { useState } from 'react';
import { Copy, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { useTemplateStore } from '@/stores/templateStore';
import type { TemplateRecord } from '@/types/resume';

interface TemplateCardProps {
  template: TemplateRecord;
  isActive: boolean;
  onApply: (templateId: string) => void;
}

export function TemplateCard({ template, isActive, onApply }: TemplateCardProps) {
  const renameTemplate = useTemplateStore((s) => s.renameTemplate);
  const duplicateTemplate = useTemplateStore((s) => s.duplicateTemplate);
  const deleteTemplate = useTemplateStore((s) => s.deleteTemplate);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(template.name);
  const [pendingDelete, setPendingDelete] = useState(false);

  const submitRename = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== template.name) {
      renameTemplate(template.id, trimmed);
    } else {
      setName(template.name);
    }
    setEditing(false);
  };

  const versionCount = useTemplateStore((s) => s.versionsByTemplateId[template.id]?.length ?? 0);

  return (
    <div
      className={`rounded-lg border p-3 transition-colors ${
        isActive
          ? 'border-amber-500 bg-amber-50 dark:bg-amber-950'
          : 'border-zinc-300 bg-zinc-50 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {editing ? (
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={submitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitRename();
                if (e.key === 'Escape') {
                  setName(template.name);
                  setEditing(false);
                }
              }}
              className="h-7 text-sm"
              aria-label="Template name"
              autoFocus
            />
          ) : (
            <button
              onClick={() => onApply(template.id)}
              className="truncate text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100"
            >
              {template.name}
            </button>
          )}
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {versionCount} {versionCount === 1 ? 'version' : 'versions'} &middot;{' '}
            {new Date(template.updatedAt).toLocaleDateString()}
          </p>
        </div>

        <div className="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setEditing(true)}
            aria-label="Rename template"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => duplicateTemplate(template.id)}
            aria-label="Duplicate template"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-red-500 hover:text-red-600"
            onClick={() => setPendingDelete(true)}
            aria-label="Delete template"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {!isActive && (
        <Button
          variant="outline"
          size="sm"
          className="mt-2 w-full text-xs"
          onClick={() => onApply(template.id)}
        >
          Apply
        </Button>
      )}

      <ConfirmDeleteDialog
        open={pendingDelete}
        onOpenChange={setPendingDelete}
        title="Delete template"
        description={`This will permanently delete "${template.name}" and all its version history.`}
        onConfirm={() => deleteTemplate(template.id)}
      />
    </div>
  );
}
