import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Ellipsis, Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { AppTooltip } from '@/components/AppTooltip';
import { Text } from '@/components/Text';
import { AppCollapsible, AppCollapsibleTrigger } from '@/components/AppCollapsible';
import { useListMotion } from '@/lib/motion/useListMotion';
import {
  AppMenu,
  AppMenuContent,
  AppMenuItem,
  AppMenuSeparator,
  AppMenuTrigger,
} from '@/components/AppMenu';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { cn } from '@/lib/utils';
import { useOutlineStore } from '@/stores/outlineStore';
import { useResumeStore } from '@/stores/resumeStore';
import type { ResumeSection } from '@shared/types/resume';
import { HIDDEN_WHILE_READING } from '../editorClasses';
import { EditorFold, FoldChevron } from '../EditorFold';
import { InlineEditField } from '../InlineEditField';
import { swapNeighbours } from '../sort-list/listOrder';
import { SortGripHandle, SortList, type SortGrip } from '../sort-list/SortList';
import { showSectionLabel } from '../liveEdits';
import { CUSTOM_ICONS, PRESET_ICONS } from './sectionIcons';
import { EntryCard } from './EntryCard';

interface SectionItemProps {
  section: ResumeSection;
  /** Just added and still unnamed: show the name open for editing. */
  nameAtStart?: boolean;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  /** Its place in the outline, so it can be dragged. */
  grip: SortGrip;
}

/**
 * A section in the outline: a row that opens and closes, with its shown/total count and,
 * on hover, leave-off, add-entry, and a menu. Renaming is in the menu.
 */
export function SectionItem({
  section,
  nameAtStart = false,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  grip,
}: SectionItemProps) {
  const updateSectionLabel = useResumeStore((s) => s.updateSectionLabel);
  const toggleSection = useResumeStore((s) => s.toggleSection);
  const removeSection = useResumeStore((s) => s.removeSection);
  const addEntry = useResumeStore((s) => s.addEntry);
  const reorderEntries = useResumeStore((s) => s.reorderEntries);
  const open = useOutlineStore((s) => !s.collapsedIds.includes(section.id));
  const setOpen = useOutlineStore((s) => s.setOpen);
  const [isRenaming, setIsRenaming] = useState(nameAtStart);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  // "Rename section" opens the field once the menu has closed, so the field keeps focus.
  const renameAfterMenu = useRef(false);

  const isHidden = section.hidden === true;
  const shownCount = section.items.filter((entry) => entry.selected).length;
  // A custom section has no kind to go by, so its icon shows its shape.
  const Icon =
    section.kind === 'custom' ? CUSTOM_ICONS[section.layout] : PRESET_ICONS[section.kind];

  const handleAddEntry = () => {
    setOpen(section.id, true);
    addEntry(section.id, {
      selected: true,
      bullets: [],
      ...(section.layout === 'lines' ? { text: '' } : { title: '' }),
    });
  };

  const entryIds = section.items.map((entry) => entry.id);
  const [entriesRef] = useListMotion(entryIds.join(' '));
  const moveEntry = (index: number, direction: -1 | 1) => {
    const next = swapNeighbours(entryIds, index, direction);
    if (next) reorderEntries(section.id, next);
  };

  const hiddenLabel = isHidden ? 'Put section on the resume' : 'Leave section off the resume';

  return (
    <AppCollapsible
      open={open}
      onOpenChange={(next) => setOpen(section.id, next)}
      className="mb-0.75"
    >
      {/* The whole row opens and closes the section; its buttons do their own thing. */}
      <div
        onClick={() => !isRenaming && setOpen(section.id, !open)}
        className="group/section flex h-9 cursor-pointer dense:h-7.5 items-center gap-2 rounded-sm px-1.5 hover:bg-line"
      >
        <SortGripHandle
          grip={grip}
          label={`Drag ${section.label} to reorder`}
          className="invisible group-focus-within/section:visible group-hover/section:visible"
        />
        <AppCollapsibleTrigger asChild>
          <AppButton
            variant="ghost"
            size="xs"
            shape="square"
            onClick={(event) => event.stopPropagation()}
            aria-label={open ? `Collapse ${section.label}` : `Expand ${section.label}`}
            className="-mx-1.5 size-6 text-ink-faint hover:bg-transparent"
          >
            <FoldChevron isOpen={open} />
          </AppButton>
        </AppCollapsibleTrigger>
        <Icon className="-ml-1 size-3.5 shrink-0 text-ink-muted" />
        {isRenaming ? (
          <div className="flex min-w-0 flex-1" onClick={(event) => event.stopPropagation()}>
            <InlineEditField
              value={section.label}
              onSave={(v) => updateSectionLabel(section.id, v)}
              livePreview={(label) => showSectionLabel(section.id, label)}
              onClose={() => setIsRenaming(false)}
              openAtStart
              label="Section name"
              placeholder="Section name"
              variant="editor"
            />
          </div>
        ) : (
          <Text
            variant="editor"
            className={cn(
              'min-w-0 truncate line-through transition-[color,text-decoration-color] duration-200',
              isHidden ? 'text-ink-faint decoration-line-heavy' : 'decoration-transparent'
            )}
          >
            {section.label || <span className="text-ink-faint">Untitled section</span>}
          </Text>
        )}
        {isHidden ? (
          <AppTooltip content="This whole section is left off the resume">
            <Text
              variant="meta"
              className="shrink-0 rounded-[0.3125rem] border border-line-strong bg-line px-1.5 py-px font-sans font-strong tracking-[0.02em] text-ink-muted"
            >
              not on resume
            </Text>
          </AppTooltip>
        ) : (
          <Text variant="meta" className="shrink-0">
            {shownCount}/{section.items.length}
          </Text>
        )}
        <div
          onClick={(event) => event.stopPropagation()}
          className={cn(
            'ml-auto flex shrink-0 items-center gap-0.5',
            actionsOpen
              ? 'visible'
              : 'invisible group-focus-within/section:visible group-hover/section:visible'
          )}
        >
          <AppButton
            variant="ghost"
            size="xs"
            shape="square"
            onClick={() => toggleSection(section.id)}
            aria-label={`${hiddenLabel}: ${section.label}`}
            title={
              isHidden
                ? 'Put this section back on the resume'
                : 'Leave this whole section off the resume'
            }
          >
            {isHidden ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
          </AppButton>
          <AppButton
            variant="ghost"
            size="xs"
            shape="square"
            onClick={handleAddEntry}
            aria-label={`Add entry to ${section.label}`}
            title="Add entry"
            className={HIDDEN_WHILE_READING}
          >
            <Plus className="size-3" />
          </AppButton>
          <AppMenu open={actionsOpen} onOpenChange={setActionsOpen}>
            <AppMenuTrigger asChild>
              <AppButton
                variant="ghost"
                size="xs"
                shape="square"
                aria-label={`${section.label} actions`}
                className={HIDDEN_WHILE_READING}
              >
                <Ellipsis />
              </AppButton>
            </AppMenuTrigger>
            <AppMenuContent
              align="end"
              onCloseAutoFocus={(event) => {
                if (!renameAfterMenu.current) return;
                renameAfterMenu.current = false;
                event.preventDefault();
                setIsRenaming(true);
              }}
            >
              <AppMenuItem onSelect={() => toggleSection(section.id)}>
                {isHidden ? <Eye /> : <EyeOff />}
                {hiddenLabel}
              </AppMenuItem>
              <AppMenuItem
                onSelect={() => {
                  renameAfterMenu.current = true;
                }}
              >
                <Pencil />
                Rename section
              </AppMenuItem>
              <AppMenuItem onSelect={handleAddEntry}>
                <Plus />
                Add entry
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
                Delete section…
              </AppMenuItem>
            </AppMenuContent>
          </AppMenu>
        </div>
      </div>

      <EditorFold>
        <div ref={entriesRef} className="relative">
          {section.items.length === 0 ? (
            <Text
              as="p"
              variant="secondary"
              className="ml-3.5 border-l border-line py-1.5 pl-2.25 text-ink-faint"
            >
              No entries yet. Add one with +.
            </Text>
          ) : (
            <SortList
              ids={entryIds}
              kind="entry"
              onReorder={(ids) => reorderEntries(section.id, ids)}
              renderRow={(id, grip) => {
                const i = section.items.findIndex((entry) => entry.id === id);
                return (
                  <EntryCard
                    entry={section.items[i]}
                    sectionId={section.id}
                    layout={section.layout}
                    isSectionHidden={isHidden}
                    grip={grip}
                    isFirst={i === 0}
                    isLast={i === section.items.length - 1}
                    onMoveUp={() => moveEntry(i, -1)}
                    onMoveDown={() => moveEntry(i, 1)}
                  />
                );
              }}
            />
          )}
        </div>
      </EditorFold>

      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete section?"
        description={`This will permanently remove “${section.label}” and all its entries.`}
        onConfirm={() => removeSection(section.id)}
      />
    </AppCollapsible>
  );
}
