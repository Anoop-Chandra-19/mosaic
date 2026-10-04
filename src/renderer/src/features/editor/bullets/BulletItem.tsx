import { useContext, useRef, useState, type KeyboardEvent } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Ellipsis,
  Eye,
  EyeOff,
  Merge,
  Pencil,
  Split,
  Trash2,
} from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { AppTooltip } from '@/components/AppTooltip';
import {
  AppMenu,
  AppMenuContent,
  AppMenuItem,
  AppMenuSeparator,
  AppMenuTrigger,
} from '@/components/AppMenu';
import { SHORTCUTS } from '@/features/shortcuts/shortcutList';
import { matchesShortcut } from '@/lib/keyboardShortcuts';
import { carryTint, travelFrom } from '@/lib/motion/rowMotions';
import { ListMotionContext, useSwapMotion } from '@/lib/motion/useListMotion';
import { cn } from '@/lib/utils';
import { useResumeStore } from '@/stores/resumeStore';
import type { Bullet } from '@shared/types/resume';
import { BulletEditor, type BulletMerge } from './BulletEditor';
import { EditorCheckbox } from '../EditorCheckbox';
import { HIDDEN_WHILE_READING } from '../editorClasses';
import { showBulletText } from '../liveEdits';
import { SortGripHandle, type SortGrip } from '../sort-list/SortList';
import { canSplitText } from './splitAndMergeBullets';
import type { BulletTint } from './useSplitAndMergeBullets';

interface EditorOpening {
  startsSplitting?: boolean;
  cursorAt?: 'start' | 'end';
}

interface BulletItemProps {
  bullet: Bullet;
  sectionId: string;
  entryId: string;
  /** Its section is left off the resume, so it is toned down with it. */
  isDimmed?: boolean;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  /** Opens an empty bullet editor right below it. */
  onAddBelow: () => void;
  /** Its place in the entry's list, so it can be dragged. */
  grip: SortGrip;
  onSplit: (text: string, at: number) => void;
  onStartMerge: (text: string) => void;
  /** Merging with the bullet below: the editor shows both, joined. */
  merge?: BulletMerge & { text: string; onCancel: () => void };
  /** Just came from a split: opens in the editor, the cursor at its start. */
  opensAfterSplit?: boolean;
  onEditorClose?: () => void;
  tint?: BulletTint;
}

/**
 * A bullet: its checkbox and its text, which opens the bullet editor when clicked. Its menu
 * floats at the text's top-right in a raised card, on hover.
 */
export function BulletItem({
  bullet,
  sectionId,
  entryId,
  isDimmed = false,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onAddBelow,
  grip,
  onSplit,
  onStartMerge,
  merge,
  opensAfterSplit = false,
  onEditorClose,
  tint,
}: BulletItemProps) {
  const toggleBullet = useResumeStore((s) => s.toggleBullet);
  const updateBullet = useResumeStore((s) => s.updateBullet);
  const removeBullet = useResumeStore((s) => s.removeBullet);
  const duplicateBullet = useResumeStore((s) => s.duplicateBullet);
  const [editing, setEditingNow] = useState<EditorOpening | null>(
    opensAfterSplit ? { cursorAt: 'start' } : null
  );
  const [actionsOpen, setActionsOpen] = useState(false);
  // Runs once the menu has closed, so the closing menu can't take focus from an editor.
  const afterMenu = useRef<(() => void) | null>(null);
  const motion = useContext(ListMotionContext);
  const beginSwap = useSwapMotion(editing !== null);

  const setEditing = (next: EditorOpening | null) => {
    if ((next === null) !== (editing === null)) beginSwap();
    setEditingNow(next);
  };
  const toggle = () => toggleBullet(sectionId, entryId, bullet.id);
  // The copy slides out from under the original.
  const duplicate = () => {
    const box = motion?.getBox();
    const original = box?.querySelector(`[data-sort-id="${CSS.escape(bullet.id)}"]`);
    const fromTop = original?.getBoundingClientRect().top;
    motion?.expect({
      arrive: (row) => {
        if (fromTop !== undefined) travelFrom(row, fromTop);
        carryTint(row.querySelector('[data-bullet-text]') ?? row);
      },
    });
    duplicateBullet(sectionId, entryId, bullet.id);
  };
  const remove = () => removeBullet(sectionId, entryId, bullet.id);
  const closeEditor = () => {
    setEditing(null);
    onEditorClose?.();
  };
  const saveText = (text: string) => {
    closeEditor();
    if (text !== bullet.text) updateBullet(sectionId, entryId, bullet.id, text);
  };
  const startMerge = isLast ? undefined : onStartMerge;

  if (merge) {
    return (
      <BulletEditor
        // Its own session: an editor already open on this bullet must not carry into it.
        key="merge"
        initial={merge.text}
        merge={merge}
        onSave={() => {}}
        onCancel={merge.onCancel}
      />
    );
  }

  if (editing) {
    return (
      <BulletEditor
        key="edit"
        initial={bullet.text}
        startsSplitting={editing.startsSplitting}
        cursorAt={editing.cursorAt}
        isOff={!bullet.selected}
        startsTinted={tint === 'carried'}
        livePreview={(text) => showBulletText(entryId, bullet.id, text)}
        onSave={saveText}
        onCancel={closeEditor}
        onAddBelow={(text) => {
          saveText(text);
          onAddBelow();
        }}
        onMove={(direction) => {
          if (direction < 0 && !isFirst) onMoveUp();
          if (direction > 0 && !isLast) onMoveDown();
        }}
        onDelete={remove}
        onSplit={(text, at) => {
          closeEditor();
          onSplit(text, at);
        }}
        onMergeBelow={
          startMerge &&
          ((text) => {
            closeEditor();
            startMerge(text);
          })
        }
      />
    );
  }

  // With focus anywhere in the row (its checkbox, grip, or menu button).
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys = event.nativeEvent;
    let run: (() => void) | undefined;
    if (matchesShortcut(keys, SHORTCUTS.moveBulletUp) && !isFirst) run = onMoveUp;
    else if (matchesShortcut(keys, SHORTCUTS.moveBulletDown) && !isLast) run = onMoveDown;
    else if (matchesShortcut(keys, SHORTCUTS.newBulletBelow)) run = onAddBelow;
    else if (matchesShortcut(keys, SHORTCUTS.deleteBullet)) run = remove;
    else if (matchesShortcut(keys, SHORTCUTS.mergeBullets) && startMerge) {
      run = () => startMerge(bullet.text);
    }
    if (!run) return;
    event.preventDefault();
    event.stopPropagation();
    run();
  };

  return (
    <div
      onKeyDown={handleKeyDown}
      className={cn(
        'group/bullet relative flex items-start gap-2 py-(--density-bullet) text-body text-pretty',
        // Struck through either way, so the line fades in and out with the colour.
        'line-through transition-[color,text-decoration-color] duration-200',
        bullet.selected
          ? 'text-ink-soft decoration-transparent'
          : 'text-ink-faint decoration-line-heavy'
      )}
    >
      <SortGripHandle
        grip={grip}
        label="Drag bullet to reorder"
        className="invisible mt-px group-focus-within/bullet:visible group-hover/bullet:visible"
      />
      <EditorCheckbox
        small
        dimmed={isDimmed}
        checked={bullet.selected}
        onCheckedChange={toggle}
        className="mt-[0.15625rem]"
        aria-label="Toggle bullet visibility"
      />
      <AppTooltip content={bullet.text ? 'Click to edit' : undefined} shouldFollowPointer>
        <div
          onClick={() => setEditing({})}
          data-bullet-text=""
          className={cn(
            '-mx-1 -my-px min-w-0 flex-1 cursor-text rounded-[0.3125rem] px-1 py-px hover:bg-line',
            tint === 'fresh' && 'animate-fresh-wash',
            tint === 'carried' && 'animate-carry-tint'
          )}
        >
          <span
            onClick={(event) => event.stopPropagation()}
            className={cn(
              'relative z-10 float-right -mt-0.5 -mr-0.5 ml-2 flex rounded-[0.4375rem] border border-line-strong bg-pane-raised p-0.5 shadow-floating',
              actionsOpen
                ? 'visible'
                : 'invisible group-focus-within/bullet:visible group-hover/bullet:visible'
            )}
          >
            <AppMenu open={actionsOpen} onOpenChange={setActionsOpen}>
              <AppMenuTrigger asChild>
                <AppButton
                  variant="ghost"
                  size="xs"
                  shape="square"
                  aria-label="Bullet actions"
                  className={HIDDEN_WHILE_READING}
                >
                  <Ellipsis />
                </AppButton>
              </AppMenuTrigger>
              <AppMenuContent
                align="end"
                onCloseAutoFocus={(event) => {
                  const open = afterMenu.current;
                  if (!open) return;
                  afterMenu.current = null;
                  event.preventDefault();
                  open();
                }}
              >
                <AppMenuItem onSelect={toggle}>
                  {bullet.selected ? <EyeOff /> : <Eye />}
                  {bullet.selected ? 'Leave off the resume' : 'Put on the resume'}
                </AppMenuItem>
                <AppMenuItem
                  onSelect={() => {
                    afterMenu.current = () => setEditing({});
                  }}
                >
                  <Pencil />
                  Edit text
                </AppMenuItem>
                <AppMenuItem onSelect={duplicate}>
                  <Copy />
                  Duplicate
                </AppMenuItem>
                <AppMenuSeparator />
                <AppMenuItem
                  disabled={!canSplitText(bullet.text)}
                  onSelect={() => {
                    afterMenu.current = () => setEditing({ startsSplitting: true });
                  }}
                >
                  <Split />
                  Split bullet
                </AppMenuItem>
                <AppMenuItem
                  disabled={!startMerge}
                  onSelect={() => {
                    afterMenu.current = () => startMerge?.(bullet.text);
                  }}
                >
                  <Merge />
                  Merge with bullet below
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
                <AppMenuItem variant="destructive" onSelect={remove}>
                  <Trash2 />
                  Delete bullet
                </AppMenuItem>
              </AppMenuContent>
            </AppMenu>
          </span>
          {bullet.text || <span className="text-ink-faint no-underline">Empty bullet</span>}
        </div>
      </AppTooltip>
    </div>
  );
}
