import { useRef, useState, type ClipboardEvent, type FocusEvent, type KeyboardEvent } from 'react';
import { AppButton } from '@/components/AppButton';
import { SHORTCUTS } from '@/features/shortcuts/shortcutList';
import { matchesShortcut } from '@/lib/keyboardShortcuts';
import { parseBulletLines } from './parseBulletLines';

/** Past this many characters a bullet wraps to a third line on the page. */
const LONG_BULLET_CHARS = 190;

interface BulletEditorProps {
  initial: string;
  /** Saves the text, trimmed. It may be empty: nothing in the editor is required. */
  onSave: (text: string) => void;
  onCancel: () => void;
  /** Several lines pasted at once; when given, each line becomes a bullet. */
  onPasteLines?: (lines: string[]) => void;
  /** Alt+Enter: saves the text, trimmed, and asks for a new bullet below. */
  onAddBelow?: (text: string) => void;
  /** Alt+↑/↓: the bullet moves with the editor still open on it. */
  onMove?: (direction: -1 | 1) => void;
  /** Ctrl/⌘+Shift+K: the bullet goes, text and all. */
  onDelete?: () => void;
  placeholder?: string;
}

/**
 * The design's bullet editor: a box that grows with the text, its length as you type, a
 * warning once it gets long, and Save. Enter saves, Escape cancels, and clicking away saves.
 * A bullet is one paragraph, so Shift+Enter adds no line break.
 */
export function BulletEditor({
  initial,
  onSave,
  onCancel,
  onPasteLines,
  onAddBelow,
  onMove,
  onDelete,
  placeholder = 'Describe the outcome, then the method. Start with a verb.',
}: BulletEditorProps) {
  const [draft, setDraft] = useState(initial);
  const rootRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Set once the editor has saved or cancelled, so a blur as it closes does nothing more.
  const isDone = useRef(false);
  // Set while the bullet moves: React may move the editor's node, which blurs it.
  const isMoving = useRef(false);
  const length = draft.trim().length;

  const save = () => {
    if (isDone.current) return;
    isDone.current = true;
    onSave(draft.trim());
  };

  const move = (direction: -1 | 1) => {
    isMoving.current = true;
    onMove?.(direction);
    requestAnimationFrame(() => {
      isMoving.current = false;
      textareaRef.current?.focus();
    });
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    const keys = event.nativeEvent;
    let run: (() => void) | undefined;
    if (matchesShortcut(keys, SHORTCUTS.newBulletBelow) && onAddBelow) {
      run = () => {
        isDone.current = true;
        onAddBelow(draft.trim());
      };
    } else if (matchesShortcut(keys, SHORTCUTS.moveBulletUp) && onMove) run = () => move(-1);
    else if (matchesShortcut(keys, SHORTCUTS.moveBulletDown) && onMove) run = () => move(1);
    else if (matchesShortcut(keys, SHORTCUTS.deleteBullet) && onDelete) {
      run = () => {
        isDone.current = true;
        onDelete();
      };
    }
    if (run) {
      event.preventDefault();
      event.stopPropagation();
      run();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      save();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      isDone.current = true;
      onCancel();
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = event.clipboardData.getData('text');
    if (!pasted.includes('\n')) return;
    event.preventDefault();
    if (onPasteLines) {
      onPasteLines(parseBulletLines(pasted));
    } else {
      setDraft((current) => current + pasted.replace(/\s*\n\s*/g, ' '));
    }
  };

  const handleBlur = (event: FocusEvent) => {
    // Moving to Save inside the editor is not leaving it.
    if (isMoving.current || rootRef.current?.contains(event.relatedTarget)) return;
    save();
  };

  return (
    <div
      ref={rootRef}
      className="my-0.5 overflow-hidden rounded-md border border-amber-300 bg-pane-raised ring-[3px] ring-amber-100 @container dark:border-amber-800 dark:ring-amber-950"
    >
      <textarea
        ref={textareaRef}
        value={draft}
        autoFocus
        rows={1}
        placeholder={placeholder}
        aria-label="Bullet text"
        onChange={(event) => setDraft(event.target.value.replace(/\n/g, ' '))}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onBlur={handleBlur}
        onFocus={(event) => {
          const end = event.target.value.length;
          event.target.setSelectionRange(end, end);
        }}
        className="block field-sizing-content w-full resize-none overflow-hidden border-0 bg-transparent px-2.5 pt-2 pb-1.25 text-[0.8125rem] leading-normal text-foreground outline-none placeholder:text-ink-faint"
      />
      <div className="flex items-center gap-1.5 overflow-hidden border-t border-line pt-1 pr-1.5 pb-1.25 pl-2.25">
        <span className="font-mono text-[0.6875rem] text-ink-faint">{length} chars</span>
        {length > LONG_BULLET_CHARS && (
          <span className="inline-flex h-4 shrink-0 items-center rounded-md border border-amber-300 bg-amber-100 px-2 text-[0.625rem] font-medium whitespace-nowrap text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400">
            Long: will wrap to 3 lines
          </span>
        )}
        <span className="flex-1" />
        <span className="font-mono text-[0.59375rem] whitespace-nowrap text-ink-faint @max-[20.625rem]:hidden">
          ↵ save · esc cancel
        </span>
        <AppButton variant="accent" size="xs" className="font-semibold" onClick={save}>
          Save
        </AppButton>
      </div>
    </div>
  );
}
