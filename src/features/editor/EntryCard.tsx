import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { ItemActionsMenu } from '@/components/ItemActionsMenu';
import { cn } from '@/lib/utils';
import { InlineEditField } from './InlineEditField';
import { BulletItem } from './BulletItem';
import { AddBulletInput } from './AddBulletInput';
import type { ResumeEntry, SectionType } from '@/types/resume';
import { useResumeStore } from '@/stores/resumeStore';

interface EntryCardProps {
  entry: ResumeEntry;
  sectionId: string;
  sectionType: SectionType;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const TEXT_ONLY_TYPES: SectionType[] = ['summary', 'skills'];

export function EntryCard({
  entry,
  sectionId,
  sectionType,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
}: EntryCardProps) {
  const toggleEntry = useResumeStore((s) => s.toggleEntry);
  const updateEntry = useResumeStore((s) => s.updateEntry);
  const removeEntry = useResumeStore((s) => s.removeEntry);
  const addBullet = useResumeStore((s) => s.addBullet);
  const updateBullet = useResumeStore((s) => s.updateBullet);
  const removeBullet = useResumeStore((s) => s.removeBullet);
  const toggleBullet = useResumeStore((s) => s.toggleBullet);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const isTextOnly = TEXT_ONLY_TYPES.includes(sectionType);

  return (
    <div
      className={cn(
        'group/entry rounded-md px-2.5 py-2 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900',
        !entry.selected && 'text-zinc-500 dark:text-zinc-500'
      )}
    >
      <div className="flex items-start gap-2">
        <Checkbox
          checked={entry.selected}
          onCheckedChange={() => toggleEntry(sectionId, entry.id)}
          className="mt-1 shrink-0"
          aria-label="Toggle entry visibility"
        />

        <div className="min-w-0 flex-1">
          {isTextOnly ? (
            <InlineEditField
              value={entry.text ?? ''}
              onSave={(v) => updateEntry(sectionId, entry.id, { text: v })}
              placeholder="Click to edit..."
              className="text-sm leading-7 wrap-break-word"
              inputClassName="h-8 text-sm leading-7"
            />
          ) : (
            <>
              <InlineEditField
                value={entry.title ?? ''}
                onSave={(v) => updateEntry(sectionId, entry.id, { title: v })}
                placeholder="Click to edit title..."
                className="text-base leading-6 font-medium"
                inputClassName="h-8 text-base leading-6 font-medium"
                as="div"
              />
              <InlineEditField
                value={entry.subtitle ?? ''}
                onSave={(v) => updateEntry(sectionId, entry.id, { subtitle: v })}
                placeholder="Click to edit subtitle..."
                className="text-sm leading-6 text-muted-foreground"
                inputClassName="h-7 text-sm leading-6 text-muted-foreground"
                as="div"
              />
            </>
          )}
        </div>

        <div
          className={cn(
            'flex shrink-0 items-center',
            actionsOpen
              ? 'visible'
              : 'invisible group-hover/entry:visible group-focus-within/entry:visible'
          )}
        >
          <ItemActionsMenu
            label="Entry actions"
            deleteLabel="Delete Entry"
            isFirst={isFirst}
            isLast={isLast}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            onDelete={() => setConfirmOpen(true)}
            open={actionsOpen}
            onOpenChange={setActionsOpen}
          />
        </div>
      </div>

      {!isTextOnly && (
        <div className="mt-2 ml-6 space-y-1.5">
          {entry.bullets.map((b) => (
            <BulletItem
              key={b.id}
              bullet={b}
              onToggle={() => toggleBullet(sectionId, entry.id, b.id)}
              onUpdate={(text) => updateBullet(sectionId, entry.id, b.id, text)}
              onRemove={() => removeBullet(sectionId, entry.id, b.id)}
            />
          ))}
          <AddBulletInput onAdd={(text) => addBullet(sectionId, entry.id, text)} />
        </div>
      )}

      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete entry?"
        description={`This will permanently remove \u201c${entry.title || entry.text || 'this entry'}\u201d and all its bullets.`}
        onConfirm={() => removeEntry(sectionId, entry.id)}
      />
    </div>
  );
}
