import { useEffect, useId, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Ellipsis, Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  AppButton,
  AppTooltip,
  Badge,
  Text,
  AppCollapsible,
  AppCollapsibleTrigger,
  AppMenu,
  AppMenuContent,
  AppMenuItem,
  AppMenuSeparator,
  AppMenuTrigger,
} from '@/components/ui-kit';
import { prefersReducedMotion } from '@/lib/motion/motionTiming';
import { washLanded } from '@/lib/motion/rowMotions';
import { useListMotion } from '@/lib/motion/useListMotion';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { SuggestionDot } from '@/features/agent/review/SuggestionDot';
import { useSuggestionDot } from '@/features/agent/review/useSuggestionDot';
import { cn } from '@/lib/utils';
import { useOutlineStore } from '@/stores/outlineStore';
import { useResumeStore } from '@/stores/resumeStore';
import type { ResumeSection } from '@shared/types/resume';
import {
  EDITOR_CONTROL_REVEAL_CLASSES,
  HIDDEN_WHILE_READING,
  MENU_BUTTON_SPACE,
} from '../editorClasses';
import { useEditorMenu } from '../useEditorMenu';
import { useRowInUse } from '../useRowInUse';
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
  const foldId = useId();
  const setOpen = useOutlineStore((s) => s.setOpen);
  const [isRenaming, setIsRenaming] = useState(nameAtStart);
  const rowRef = useRef<HTMLDivElement>(null);
  const isLanding = useOutlineStore((s) => s.addedSection?.id === section.id);
  const clearAddedSection = useOutlineStore((s) => s.clearAddedSection);
  // Just added from a menu: into view, and washed once, so it's clear where it went.
  useEffect(() => {
    const row = rowRef.current;
    if (!isLanding || !row) return;
    showInPane(row);
    washLanded(row);
    clearAddedSection();
  }, [isLanding, clearAddedSection]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Mounted once asked for, then kept so it can animate closed.
  const [isConfirmMounted, setIsConfirmMounted] = useState(false);
  const { isMenuOpen, isMenuVisible, setMenuOpen, finishMenuClose } = useEditorMenu();
  const { isInUse, rowProps } = useRowInUse(isMenuVisible || grip.lifted);
  // "Rename section" opens the field once the menu has closed, so the field keeps focus.
  const renameAfterMenu = useRef(false);

  const isHidden = section.hidden === true;
  // A rename, a move, leaving the page, or something new suggested for this section.
  const suggestion = useSuggestionDot(section.id);
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
        ref={rowRef}
        {...rowProps}
        onClick={() => !isRenaming && setOpen(section.id, !open)}
        className="group/section flex h-9 cursor-pointer dense:h-7.5 items-center gap-2 rounded-sm px-1.5 hover:bg-line"
      >
        <SortGripHandle
          grip={grip}
          label={`Drag ${section.label} to reorder`}
          isInUse={isInUse}
          className={EDITOR_CONTROL_REVEAL_CLASSES.section}
        />
        <AppCollapsibleTrigger asChild aria-controls={foldId}>
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
        {suggestion && <SuggestionDot dot={suggestion} className="-mr-1.5 shrink-0" />}
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
              // Struck only while off: a selection paints even a transparent line.
              'min-w-0 truncate transition-colors duration-200',
              isHidden && 'text-ink-faint line-through decoration-line-heavy'
            )}
          >
            {section.label || <span className="text-ink-faint">Untitled section</span>}
          </Text>
        )}
        {isHidden ? (
          <AppTooltip content="This whole section is left off the resume">
            <Badge size="sm" tone="filled">
              not on resume
            </Badge>
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
            isMenuVisible ? 'visible' : EDITOR_CONTROL_REVEAL_CLASSES.section
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
          {isInUse ? (
            <AppMenu open={isMenuOpen} onOpenChange={setMenuOpen}>
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
                  finishMenuClose();
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
                <AppMenuItem
                  variant="destructive"
                  onSelect={() => {
                    setIsConfirmMounted(true);
                    setConfirmOpen(true);
                  }}
                >
                  <Trash2 />
                  Delete section…
                </AppMenuItem>
              </AppMenuContent>
            </AppMenu>
          ) : (
            <span className={MENU_BUTTON_SPACE} />
          )}
        </div>
      </div>

      <EditorFold isOpen={open} id={foldId}>
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

      {isConfirmMounted && (
        <ConfirmDeleteDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Delete section?"
          description={`This will permanently remove “${section.label}” and all its entries.`}
          onConfirm={() => removeSection(section.id)}
        />
      )}
    </AppCollapsible>
  );
}

/** Room left above a row brought into its pane, so what's above it still shows. */
const LANDING_OFFSET_PX = 56;
/** How far inside the pane's edges a row counts as in view, and close enough to its place. */
const IN_VIEW_MARGIN_PX = 8;
/** How long a row brought into view is kept there while what the scroll passed is drawn. */
const LANDING_SETTLE_MS = 1500;

/**
 * Scrolls the pane that holds `row` to it, when it is out of sight; nothing else moves.
 * Entries off screen hold a guessed height until they are drawn (`EntryCard`), so as they
 * come into view they take their real one and push the row on: while the pane's content
 * keeps changing size, it aims again, once any smooth scroll has ended.
 */
function showInPane(row: HTMLElement) {
  let pane = row.parentElement;
  while (pane && !isScrollPane(pane)) pane = pane.parentElement;
  const content = pane?.firstElementChild;
  if (!pane || !content || isInView(row, pane)) return;
  const isSmooth = !prefersReducedMotion();
  const observer = new ResizeObserver(() => aim());
  let isScrolling = false;
  let settled = 0;
  const aim = () => {
    if (isScrolling) return;
    window.clearTimeout(settled);
    settled = window.setTimeout(() => observer.disconnect(), LANDING_SETTLE_MS);
    const offset =
      row.getBoundingClientRect().top - pane.getBoundingClientRect().top - LANDING_OFFSET_PX;
    const top = Math.min(
      Math.max(0, pane.scrollTop + offset),
      pane.scrollHeight - pane.clientHeight
    );
    const distance = top - pane.scrollTop;
    if (Math.abs(distance) <= IN_VIEW_MARGIN_PX) return;
    if (!isSmooth) {
      pane.scrollTo({ top });
      return;
    }
    // A long way: jump to a pane short of it, rather than draw every entry on the way, and
    // glide the rest.
    if (Math.abs(distance) > pane.clientHeight) {
      pane.scrollTo({ top: top - Math.sign(distance) * pane.clientHeight });
      requestAnimationFrame(aim);
      return;
    }
    pane.scrollTo({ top, behavior: 'smooth' });
    isScrolling = true;
    const finish = () => {
      isScrolling = false;
      aim();
    };
    pane.addEventListener('scrollend', finish, { once: true });
  };
  aim();
  observer.observe(content);
}

function isInView(row: HTMLElement, pane: HTMLElement): boolean {
  const rowBox = row.getBoundingClientRect();
  const paneBox = pane.getBoundingClientRect();
  return (
    rowBox.top >= paneBox.top + IN_VIEW_MARGIN_PX &&
    rowBox.bottom <= paneBox.bottom - IN_VIEW_MARGIN_PX
  );
}

function isScrollPane(element: HTMLElement): boolean {
  return (
    element.scrollHeight > element.clientHeight &&
    /auto|scroll/.test(getComputedStyle(element).overflowY)
  );
}
