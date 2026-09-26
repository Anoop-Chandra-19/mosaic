import { useState, type KeyboardEvent } from 'react';
import { ArrowDown, ArrowUp, Copy, Ellipsis, Eye, EyeOff, Trash2 } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SHORTCUTS } from '@/features/shortcuts/shortcutList';
import { isTypingField, matchesShortcut } from '@/lib/keyboardShortcuts';
import { cn } from '@/lib/utils';
import { formatEntryHeading } from '@shared/resume/entryHeading';
import type { ResumeEntry, SectionLayout } from '@shared/types/resume';
import { useResumeStore } from '@/stores/resumeStore';
import { AddBulletButton } from './AddBulletButton';
import { BulletEditor } from './BulletEditor';
import { BulletItem } from './BulletItem';
import { EditorCheckbox } from './EditorCheckbox';
import { HIDDEN_WHILE_READING } from './editorClasses';
import { InlineEditField } from './InlineEditField';
import { swapNeighbours } from './listOrder';
import { SortGripHandle, SortList, type SortGrip } from './SortList';

interface EntryCardProps {
  entry: ResumeEntry;
  sectionId: string;
  layout: SectionLayout;
  /** The whole section is left off, so its entries are toned down with it. */
  isSectionHidden?: boolean;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  /** Its place in the section's list, so the card can be dragged by its heading. */
  grip: SortGrip;
}

/** The design's `.emeta` fields: small, and only as wide as their text. */
const META_FIELD =
  '-mx-[0.3125rem] max-w-full flex-none px-[0.3125rem] py-0.5 text-[0.775rem] text-ink-muted';

/**
 * An entry in the outline, hanging off its section's rail: its checkbox, its heading's
 * parts, its bullets, and — floating top-right on hover — its menu.
 */
export function EntryCard({
  entry,
  sectionId,
  layout,
  isSectionHidden = false,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  grip,
}: EntryCardProps) {
  const toggleEntry = useResumeStore((s) => s.toggleEntry);
  const updateEntry = useResumeStore((s) => s.updateEntry);
  const removeEntry = useResumeStore((s) => s.removeEntry);
  const duplicateEntry = useResumeStore((s) => s.duplicateEntry);
  const addBullet = useResumeStore((s) => s.addBullet);
  const reorderBullets = useResumeStore((s) => s.reorderBullets);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  // Alt+Enter on a bullet: an empty editor under it, which adds a bullet there once saved.
  const [addingAfterId, setAddingAfterId] = useState<string | null>(null);
  const isTextOnly = layout === 'lines';
  // The design fades a left-off entry; the repo's rule is tones, not opacity, so every
  // ink in it drops to the faintest.
  const isDimmed = !entry.selected || isSectionHidden;
  const update = (patch: Partial<ResumeEntry>) => updateEntry(sectionId, entry.id, patch);

  const bulletIds = entry.bullets.map((bullet) => bullet.id);
  const moveBullet = (index: number, direction: -1 | 1) => {
    const next = swapNeighbours(bulletIds, index, direction);
    if (next) reorderBullets(sectionId, entry.id, next);
  };

  // With focus anywhere in the entry, except a field being typed in.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (isTypingField(event.target)) return;
    if (!matchesShortcut(event.nativeEvent, SHORTCUTS.duplicateEntry)) return;
    event.preventDefault();
    event.stopPropagation();
    duplicateEntry(sectionId, entry.id);
  };

  return (
    <div
      onKeyDown={handleKeyDown}
      className={cn(
        'group/entry relative ml-3.5 rounded-md border-l border-line pt-1.75 pr-1.5 pb-2.25 pl-2.25 hover:bg-line dense:px-2 dense:py-1.75',
        isDimmed && '**:text-ink-faint'
      )}
    >
      <div className="flex items-start gap-2">
        {/* The controls align to the heading line, not the card: an entry grows downward
            with its meta and bullets, so centring on the box would drift them off. */}
        <SortGripHandle
          grip={grip}
          label="Drag entry to reorder"
          className="invisible mt-1 group-focus-within/entry:visible group-hover/entry:visible"
        />
        <EditorCheckbox
          dimmed={isDimmed}
          checked={entry.selected}
          onCheckedChange={() => toggleEntry(sectionId, entry.id)}
          className="mt-0.5"
          aria-label="Toggle entry visibility"
        />

        <div className="min-w-0 flex-1">
          {isTextOnly ? (
            <div className="flex pr-8.5">
              <InlineEditField
                value={entry.text ?? ''}
                onSave={(v) => update({ text: v })}
                placeholder="Click to edit..."
                className="leading-normal"
              />
            </div>
          ) : (
            <div className="flex flex-col gap-0.5 pr-8.5">
              <div className="flex min-w-0">
                <InlineEditField
                  value={entry.title ?? ''}
                  onSave={(v) => update({ title: v })}
                  placeholder="Role or title"
                  label="Title"
                  className="text-[0.9375rem] leading-[1.35] font-semibold tracking-[-0.012em] text-foreground"
                  inputClassName="text-[0.9375rem] font-semibold md:text-[0.9375rem]"
                />
              </div>
              <div className="flex min-w-0">
                <InlineEditField
                  value={entry.organization ?? ''}
                  onSave={(v) => update({ organization: v })}
                  placeholder="Company or context"
                  label="Organization"
                  className="text-[0.8375rem]"
                  inputClassName="text-[0.8375rem] md:text-[0.8375rem]"
                />
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-ink-faint">
                <InlineEditField
                  value={entry.location ?? ''}
                  onSave={(v) => update({ location: v })}
                  placeholder="Location or Remote"
                  label="Location"
                  className={META_FIELD}
                  inputClassName="text-[0.775rem] md:text-[0.775rem]"
                />
                <span aria-hidden="true" className="text-xs">
                  ·
                </span>
                <InlineEditField
                  value={entry.dates ?? ''}
                  onSave={(v) => update({ dates: v })}
                  placeholder="Dates"
                  label="Dates"
                  className={META_FIELD}
                  inputClassName="text-[0.775rem] md:text-[0.775rem]"
                />
              </div>
            </div>
          )}

          {/* A left-off entry keeps its bullets, but out of the way until it is back on. */}
          {!isTextOnly && entry.selected && (
            <div className="mt-(--density-gap) flex flex-col gap-(--density-row)">
              <SortList
                ids={bulletIds}
                kind="bullet"
                className="flex flex-col gap-(--density-row)"
                onReorder={(ids) => reorderBullets(sectionId, entry.id, ids)}
                renderRow={(id, grip) => {
                  const index = entry.bullets.findIndex((bullet) => bullet.id === id);
                  const row = (
                    <BulletItem
                      bullet={entry.bullets[index]}
                      sectionId={sectionId}
                      entryId={entry.id}
                      grip={grip}
                      isDimmed={isSectionHidden}
                      isFirst={index === 0}
                      isLast={index === entry.bullets.length - 1}
                      onMoveUp={() => moveBullet(index, -1)}
                      onMoveDown={() => moveBullet(index, 1)}
                      onAddBelow={() => setAddingAfterId(id)}
                    />
                  );
                  if (addingAfterId !== id) return row;
                  return (
                    <div className="flex flex-col gap-(--density-row)">
                      {row}
                      <BulletEditor
                        initial=""
                        onSave={(text) => {
                          if (text) addBullet(sectionId, entry.id, text, id);
                          setAddingAfterId(null);
                        }}
                        onCancel={() => setAddingAfterId(null)}
                        onAddBelow={(text) => {
                          setAddingAfterId(text ? addBullet(sectionId, entry.id, text, id) : null);
                        }}
                        onPasteLines={(lines) => {
                          lines.reduce(
                            (after, line) => addBullet(sectionId, entry.id, line, after),
                            id
                          );
                          setAddingAfterId(null);
                        }}
                      />
                    </div>
                  );
                }}
              />
              <AddBulletButton onAdd={(text) => addBullet(sectionId, entry.id, text)} />
            </div>
          )}
        </div>

        {/* Floats over the heading's top-right corner in a raised card, on hover. */}
        <div
          className={cn(
            'absolute top-1.25 right-1.25 z-10 flex rounded-[0.4375rem] border border-line-strong bg-pane-raised p-0.5 shadow-md',
            actionsOpen
              ? 'visible'
              : 'invisible group-focus-within/entry:visible group-hover/entry:visible'
          )}
        >
          <DropdownMenu open={actionsOpen} onOpenChange={setActionsOpen}>
            <DropdownMenuTrigger asChild>
              <AppButton
                variant="ghost"
                size="xs"
                shape="square"
                aria-label="Entry actions"
                className={HIDDEN_WHILE_READING}
              >
                <Ellipsis />
              </AppButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => toggleEntry(sectionId, entry.id)}>
                {entry.selected ? <EyeOff /> : <Eye />}
                {entry.selected ? 'Leave off the resume' : 'Put on the resume'}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => duplicateEntry(sectionId, entry.id)}>
                <Copy />
                Duplicate entry
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={isFirst} onSelect={onMoveUp}>
                <ArrowUp />
                Move up
              </DropdownMenuItem>
              <DropdownMenuItem disabled={isLast} onSelect={onMoveDown}>
                <ArrowDown />
                Move down
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => setConfirmOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 />
                Delete entry…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete entry?"
        description={`This will permanently remove “${formatEntryHeading(entry) || entry.text || 'this entry'}” and all its bullets.`}
        onConfirm={() => removeEntry(sectionId, entry.id)}
      />
    </div>
  );
}
