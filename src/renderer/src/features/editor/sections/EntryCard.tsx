import { useState, type KeyboardEvent } from 'react';
import { ArrowDown, ArrowUp, Copy, Ellipsis, Eye, EyeOff, Trash2 } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import {
  AppMenu,
  AppMenuContent,
  AppMenuItem,
  AppMenuSeparator,
  AppMenuTrigger,
} from '@/components/AppMenu';
import { AppCollapsible } from '@/components/AppCollapsible';
import { matchesAction } from '@/features/shortcuts/shortcutBindings';
import { isTypingField } from '@/lib/keyboardShortcuts';
import { ListMotionContext, useSwapMotion } from '@/lib/motion/useListMotion';
import { Text } from '@/components/Text';
import { cn } from '@/lib/utils';
import { formatEntryHeading } from '@shared/resume/entryHeading';
import type { ResumeEntry, SectionLayout } from '@shared/types/resume';
import { useResumeStore } from '@/stores/resumeStore';
import { useUiStore } from '@/stores/uiStore';
import { AddBulletButton } from '../bullets/AddBulletButton';
import { BulletEditor } from '../bullets/BulletEditor';
import { BulletItem } from '../bullets/BulletItem';
import { useSplitAndMergeBullets } from '../bullets/useSplitAndMergeBullets';
import { EditorCheckbox } from '../EditorCheckbox';
import { HIDDEN_WHILE_READING } from '../editorClasses';
import { EditorFold } from '../EditorFold';
import { InlineEditField } from '../InlineEditField';
import { showEntryFields, showNewBullet } from '../liveEdits';
import { swapNeighbours } from '../sort-list/listOrder';
import { countHeadingLines } from './countHeadingLines';
import { SortGripHandle, SortList, type SortGrip } from '../sort-list/SortList';

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

/** The design's `.emeta` fields: only as wide as their text. */
const META_FIELD = 'max-w-full flex-none';

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
  const [addingAfterId, setAddingAfterIdNow] = useState<string | null>(null);
  const isTextOnly = layout === 'lines';
  // The design fades a left-off entry; the repo's rule is tones, not opacity, so every
  // ink in it drops to the faintest.
  const isDimmed = !entry.selected || isSectionHidden;
  const update = (patch: Partial<ResumeEntry>) => updateEntry(sectionId, entry.id, patch);
  const paperSize = useUiStore((s) => s.paperSize);
  const headingLines = isTextOnly ? null : countHeadingLines(entry, paperSize);

  const { motion, listRef, shownIds, isMerging, bulletRowProps } = useSplitAndMergeBullets(
    sectionId,
    entry
  );
  const beginAddSwap = useSwapMotion(addingAfterId, motion);
  const setAddingAfterId = (id: string | null) => {
    if (id !== addingAfterId) beginAddSwap();
    setAddingAfterIdNow(id);
  };

  const bulletIds = entry.bullets.map((bullet) => bullet.id);
  const moveBullet = (index: number, direction: -1 | 1) => {
    const next = swapNeighbours(bulletIds, index, direction);
    if (next) reorderBullets(sectionId, entry.id, next);
  };

  // With focus anywhere in the entry, except a field being typed in.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (isTypingField(event.target)) return;
    if (!matchesAction(event.nativeEvent, 'duplicateEntry')) return;
    event.preventDefault();
    event.stopPropagation();
    duplicateEntry(sectionId, entry.id);
  };

  return (
    <div
      onKeyDown={handleKeyDown}
      className={cn(
        'group/entry relative ml-3.5 rounded-sm border-l border-line pt-1.75 pr-1.5 pb-2.25 pl-2.25 hover:bg-line dense:px-2 dense:py-1.75',
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
                livePreview={(text) => showEntryFields(entry.id, { text })}
                placeholder="Click to edit..."
              />
            </div>
          ) : (
            <div className="flex flex-col gap-0.5 pr-8.5">
              <div className="flex min-w-0">
                <InlineEditField
                  value={entry.title ?? ''}
                  onSave={(v) => update({ title: v })}
                  livePreview={(title) => showEntryFields(entry.id, { title })}
                  placeholder="Role or title"
                  label="Title"
                  variant="editor"
                />
              </div>
              <div className="flex min-w-0">
                <InlineEditField
                  value={entry.organization ?? ''}
                  onSave={(v) => update({ organization: v })}
                  livePreview={(organization) => showEntryFields(entry.id, { organization })}
                  placeholder="Company or context"
                  label="Organization"
                />
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-ink-faint">
                <InlineEditField
                  value={entry.location ?? ''}
                  onSave={(v) => update({ location: v })}
                  livePreview={(location) => showEntryFields(entry.id, { location })}
                  placeholder="Location or Remote"
                  label="Location"
                  variant="secondary"
                  className={META_FIELD}
                />
                <Text aria-hidden variant="secondary" className="text-ink-faint">
                  ·
                </Text>
                <InlineEditField
                  value={entry.dates ?? ''}
                  onSave={(v) => update({ dates: v })}
                  livePreview={(dates) => showEntryFields(entry.id, { dates })}
                  placeholder="Dates"
                  label="Dates"
                  variant="secondary"
                  className={META_FIELD}
                />
              </div>
              {!isDimmed && headingLines !== null && headingLines > 1 && (
                <Text as="p" variant="secondary" className="mt-1 text-warn">
                  The heading prints on {headingLines} lines beside the dates. Shorten the title,
                  organization or location to keep it on one.
                </Text>
              )}
            </div>
          )}

          {/* A left-off entry keeps its bullets, but folded away until it is back on. */}
          {!isTextOnly && (
            <AppCollapsible open={entry.selected}>
              <EditorFold>
                <ListMotionContext value={motion}>
                  <div
                    ref={listRef}
                    className="relative mt-(--density-gap) flex flex-col gap-(--density-row)"
                  >
                    <SortList
                      ids={shownIds}
                      kind="bullet"
                      className="flex flex-col gap-(--density-row)"
                      // Mid-merge the list lacks the folded-in bullet, which an order would drop.
                      onReorder={(ids) => isMerging || reorderBullets(sectionId, entry.id, ids)}
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
                            {...bulletRowProps(entry.bullets[index])}
                          />
                        );
                        if (addingAfterId !== id) return row;
                        return (
                          <div className="flex flex-col gap-(--density-row)">
                            {row}
                            <BulletEditor
                              initial=""
                              livePreview={(text) => showNewBullet(entry.id, text, id)}
                              onSave={(text) => {
                                if (text) addBullet(sectionId, entry.id, text, id);
                                setAddingAfterId(null);
                              }}
                              onCancel={() => setAddingAfterId(null)}
                              onAddBelow={(text) => {
                                setAddingAfterId(
                                  text ? addBullet(sectionId, entry.id, text, id) : null
                                );
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
                    <AddBulletButton
                      onAdd={(text) => addBullet(sectionId, entry.id, text)}
                      livePreview={(text) => showNewBullet(entry.id, text)}
                    />
                  </div>
                </ListMotionContext>
              </EditorFold>
            </AppCollapsible>
          )}
        </div>

        {/* Floats over the heading's top-right corner in a raised card, on hover. */}
        <div
          className={cn(
            'absolute top-1.25 right-1.25 z-10 flex rounded-[0.4375rem] border border-line-strong bg-pane-raised p-0.5 shadow-floating',
            actionsOpen
              ? 'visible'
              : 'invisible group-focus-within/entry:visible group-hover/entry:visible'
          )}
        >
          <AppMenu open={actionsOpen} onOpenChange={setActionsOpen}>
            <AppMenuTrigger asChild>
              <AppButton
                variant="ghost"
                size="xs"
                shape="square"
                aria-label="Entry actions"
                className={HIDDEN_WHILE_READING}
              >
                <Ellipsis />
              </AppButton>
            </AppMenuTrigger>
            <AppMenuContent align="end">
              <AppMenuItem onSelect={() => toggleEntry(sectionId, entry.id)}>
                {entry.selected ? <EyeOff /> : <Eye />}
                {entry.selected ? 'Leave off the resume' : 'Put on the resume'}
              </AppMenuItem>
              <AppMenuItem onSelect={() => duplicateEntry(sectionId, entry.id)}>
                <Copy />
                Duplicate entry
              </AppMenuItem>
              <AppMenuSeparator />
              <AppMenuItem disabled={isFirst} onSelect={onMoveUp}>
                <ArrowUp />
                Move up
              </AppMenuItem>
              <AppMenuItem disabled={isLast} onSelect={onMoveDown}>
                <ArrowDown />
                Move down
              </AppMenuItem>
              <AppMenuSeparator />
              <AppMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
                <Trash2 />
                Delete entry…
              </AppMenuItem>
            </AppMenuContent>
          </AppMenu>
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
