import { useRef, useState, type KeyboardEvent } from 'react';
import { ArrowDown, ArrowUp, Copy, Ellipsis, Eye, EyeOff, Pencil, Trash2 } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SHORTCUTS } from '@/features/shortcuts/shortcutList';
import { matchesShortcut } from '@/lib/keyboardShortcuts';
import { cn } from '@/lib/utils';
import { useResumeStore } from '@/stores/resumeStore';
import type { Bullet } from '@shared/types/resume';
import { BulletEditor } from './BulletEditor';
import { EditorCheckbox } from './EditorCheckbox';
import { SortGripHandle, type SortGrip } from './SortList';

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
}: BulletItemProps) {
  const toggleBullet = useResumeStore((s) => s.toggleBullet);
  const updateBullet = useResumeStore((s) => s.updateBullet);
  const removeBullet = useResumeStore((s) => s.removeBullet);
  const duplicateBullet = useResumeStore((s) => s.duplicateBullet);
  const [editing, setEditing] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  // "Edit text" opens the editor once the menu has closed, so the editor keeps focus.
  const editAfterMenu = useRef(false);

  const toggle = () => toggleBullet(sectionId, entryId, bullet.id);
  const remove = () => removeBullet(sectionId, entryId, bullet.id);
  const saveText = (text: string) => {
    setEditing(false);
    if (text !== bullet.text) updateBullet(sectionId, entryId, bullet.id, text);
  };

  if (editing) {
    return (
      <BulletEditor
        initial={bullet.text}
        onSave={saveText}
        onCancel={() => setEditing(false)}
        onAddBelow={(text) => {
          saveText(text);
          onAddBelow();
        }}
        onMove={(direction) => {
          if (direction < 0 && !isFirst) onMoveUp();
          if (direction > 0 && !isLast) onMoveDown();
        }}
        onDelete={remove}
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
    if (!run) return;
    event.preventDefault();
    event.stopPropagation();
    run();
  };

  return (
    <div
      onKeyDown={handleKeyDown}
      className={cn(
        'group/bullet relative flex items-start gap-2 py-(--density-bullet) text-sm leading-[1.58] text-pretty',
        bullet.selected ? 'text-ink-soft' : 'text-ink-faint line-through decoration-line-heavy'
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
        className="mt-[0.21875rem]"
        aria-label="Toggle bullet visibility"
      />
      <div
        onClick={() => setEditing(true)}
        className="-mx-1 -my-px min-w-0 flex-1 cursor-text rounded-[0.3125rem] px-1 py-px hover:bg-line"
      >
        <span
          onClick={(event) => event.stopPropagation()}
          className={cn(
            'relative z-10 float-right -mt-0.5 -mr-0.5 ml-2 flex rounded-[0.4375rem] border border-line-strong bg-pane-raised p-0.5 shadow-md',
            actionsOpen
              ? 'visible'
              : 'invisible group-focus-within/bullet:visible group-hover/bullet:visible'
          )}
        >
          <DropdownMenu open={actionsOpen} onOpenChange={setActionsOpen}>
            <DropdownMenuTrigger asChild>
              <AppButton variant="ghost" size="xs" shape="square" aria-label="Bullet actions">
                <Ellipsis />
              </AppButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onCloseAutoFocus={(event) => {
                if (!editAfterMenu.current) return;
                editAfterMenu.current = false;
                event.preventDefault();
                setEditing(true);
              }}
            >
              <DropdownMenuItem onSelect={toggle}>
                {bullet.selected ? <EyeOff /> : <Eye />}
                {bullet.selected ? 'Leave off the resume' : 'Put on the resume'}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  editAfterMenu.current = true;
                }}
              >
                <Pencil />
                Edit text
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => duplicateBullet(sectionId, entryId, bullet.id)}>
                <Copy />
                Duplicate
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
                onSelect={remove}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 />
                Delete bullet
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
        {bullet.text || <span className="text-ink-faint no-underline">Empty bullet</span>}
      </div>
    </div>
  );
}
