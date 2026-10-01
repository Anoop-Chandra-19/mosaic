import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Info, Merge, Split } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { SHORTCUTS } from '@/features/shortcuts/shortcutList';
import { formatShortcutKeys, matchesShortcut } from '@/lib/keyboardShortcuts';
import { cn } from '@/lib/utils';
import type { LiveEdit } from '@/stores/liveEditStore';
import { useUiStore } from '@/stores/uiStore';
import { useLiveEdit } from '../useLiveEdit';
import { countBulletLines } from './countBulletLines';
import { parseBulletLines } from './parseBulletLines';
import {
  canSplitAt,
  describeSplitRefusal,
  findSentenceBreakNearMiddle,
  findSplitStart,
  moveSeamWithEdit,
} from './splitAndMergeBullets';

export interface BulletMerge {
  /** Where the lower bullet's text begins in the joined text. */
  seam: number;
  isFirstSelected: boolean;
  isSecondSelected: boolean;
  onMerge: (text: string, selected: boolean) => void;
}

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
  /** Shift+Enter: splits the text as edited at `at`. */
  onSplit?: (text: string, at: number) => void;
  /** Ctrl/⌘+Shift+J: merges with the bullet below, from the text as edited. */
  onMergeBelow?: (text: string) => void;
  startsSplitting?: boolean;
  cursorAt?: 'start' | 'end';
  isOff?: boolean;
  /** Opens merging two bullets, `initial` being their joined text. */
  merge?: BulletMerge;
  /** Holds a split's tail, so it keeps the tail's tint a moment. */
  startsTinted?: boolean;
  placeholder?: string;
  /** How the preview shows the text while it is typed. */
  livePreview?: (text: string) => LiveEdit;
}

type EditorMode = 'edit' | 'split' | 'merge';

const NOTE =
  'flex flex-wrap items-center gap-x-1.75 gap-y-1.25 border-t border-line py-1.25 pr-1.5 pl-2.5 text-[0.71875rem] leading-[1.4] text-pretty text-ink-muted [&>svg]:size-2.75 [&>svg]:shrink-0';
const NOTE_TEXT = 'min-w-0 flex-[1_1_9.375rem]';
const SEGMENT =
  'h-5.25 min-w-0 rounded-[0.3125rem] px-2 text-[0.71875rem] font-medium text-ink-muted hover:bg-transparent hover:text-foreground aria-checked:bg-pane-raised aria-checked:text-foreground aria-checked:shadow-[0_1px_2px_oklch(0_0_0/25%)]';

/**
 * The design's bullet editor: a box that grows with the text, its length as you type, a
 * warning once it gets long, and Save. Enter saves, Escape cancels, and clicking away saves.
 *
 * Split mode marks where the new bullet will begin; merge mode marks where the lower
 * bullet's text begins, and the mark follows edits made before it.
 */
export function BulletEditor({
  initial,
  onSave,
  onCancel,
  onPasteLines,
  onAddBelow,
  onMove,
  onDelete,
  onSplit,
  onMergeBelow,
  startsSplitting = false,
  cursorAt = 'end',
  isOff = false,
  merge,
  startsTinted = false,
  placeholder = 'Describe the outcome, then the method. Start with a verb.',
  livePreview,
}: BulletEditorProps) {
  const paperSize = useUiStore((s) => s.paperSize);
  const [draft, setDraft] = useState(initial);
  useLiveEdit(draft, livePreview);
  const [mode, setMode] = useState<EditorMode>(
    merge ? 'merge' : startsSplitting && onSplit ? 'split' : 'edit'
  );
  const [startCursor] = useState(() => {
    if (merge) return merge.seam;
    if (startsSplitting) return findSplitStart(initial);
    return cursorAt === 'start' ? 0 : initial.length;
  });
  const [cursor, setCursor] = useState(startCursor);
  const [seam, setSeam] = useState(merge?.seam ?? 0);
  // Why the last split was refused, until the next key.
  const [refusal, setRefusal] = useState<string | null>(null);
  const [isMergedSelected, setIsMergedSelected] = useState(merge?.isFirstSelected ?? true);
  const rootRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const noteId = useId();
  // Set once the editor has saved or cancelled, so a blur as it closes does nothing more.
  const isDone = useRef(false);
  // Set while the bullet moves: React may move the editor's node, which blurs it.
  const isMoving = useRef(false);
  const length = draft.trim().length;
  const lineCount = countBulletLines(draft, paperSize);

  useLayoutEffect(() => {
    textareaRef.current?.setSelectionRange(startCursor, startCursor);
  }, [startCursor]);

  const placeCursor = (at: number) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(at, at);
    setCursor(at);
  };

  const save = () => {
    if (isDone.current) return;
    isDone.current = true;
    onSave(draft.trim());
  };

  const cancel = () => {
    isDone.current = true;
    onCancel();
  };

  const split = () => {
    if (!onSplit) return;
    const at = textareaRef.current?.selectionStart ?? cursor;
    const reason = describeSplitRefusal(draft, at);
    if (reason) return setRefusal(reason);
    isDone.current = true;
    onSplit(draft, at);
  };

  const startSplitting = () => {
    setMode('split');
    setRefusal(null);
    placeCursor(findSplitStart(draft));
  };

  const stopSplitting = () => {
    setMode('edit');
    setRefusal(null);
    textareaRef.current?.focus();
  };

  const mergeDraft = () => {
    if (!merge || !draft.trim()) return;
    isDone.current = true;
    merge.onMerge(draft.trim(), isMergedSelected);
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
    setRefusal(null);
    let run: (() => void) | undefined;
    if (mode === 'edit') {
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
      } else if (matchesShortcut(keys, SHORTCUTS.splitBullet) && onSplit) run = split;
      else if (matchesShortcut(keys, SHORTCUTS.mergeBullets) && onMergeBelow) {
        run = () => {
          isDone.current = true;
          onMergeBelow(draft);
        };
      }
    }
    if (run) {
      event.preventDefault();
      event.stopPropagation();
      run();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const isPlain = !event.altKey && !event.ctrlKey && !event.metaKey;
      if (mode === 'edit') save();
      else if (mode === 'split' && isPlain) split();
      else if (mode === 'merge' && isPlain && !event.shiftKey) mergeDraft();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      if (mode === 'split') stopSplitting();
      else cancel();
    }
  };

  const takeText = (field: HTMLTextAreaElement) => {
    const next = field.value.replace(/\n/g, ' ');
    const at = field.selectionStart;
    if (mode === 'merge') setSeam(moveSeamWithEdit(seam, draft, next, at));
    setDraft(next);
    setCursor(at);
    setRefusal(null);
  };

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = event.clipboardData.getData('text');
    if (!pasted.includes('\n')) return;
    event.preventDefault();
    if (onPasteLines && mode === 'edit') {
      onPasteLines(parseBulletLines(pasted));
      return;
    }
    // One paragraph: the lines join with spaces, over the selection, the caret after them.
    const field = event.currentTarget;
    const { selectionStart, selectionEnd } = field;
    field.setRangeText(pasted.replace(/\s*\n\s*/g, ' '), selectionStart, selectionEnd, 'end');
    takeText(field);
  };

  const handleBlur = (event: FocusEvent) => {
    // Moving to Save inside the editor is not leaving it.
    if (isMoving.current || rootRef.current?.contains(event.relatedTarget)) return;
    // A merge is only made on purpose: leaving it puts both bullets back.
    if (mode === 'merge') {
      if (!isDone.current) cancel();
      return;
    }
    save();
  };

  const canSplitHere = canSplitAt(draft, cursor);
  // Three lines read fine on the page; four start to look like a paragraph.
  const isLong = lineCount >= 4;
  const shouldNudgeSplit =
    mode === 'edit' && onSplit !== undefined && isLong && findSentenceBreakNearMiddle(draft) > 0;
  const isNoteShown = mode === 'split' || refusal !== null;
  const isRefused = refusal !== null || (mode === 'split' && !canSplitHere);
  const splitNote =
    refusal ??
    describeSplitRefusal(draft, cursor) ??
    `The text after the marker becomes a new bullet below.${isOff ? ' Both stay off the resume.' : ''}`;
  const markAt = mode === 'merge' ? seam : cursor;

  const longChip = isLong && (
    <span className="inline-flex h-4 shrink-0 items-center rounded-md border border-amber-300 bg-amber-100 px-2 text-[0.625rem] font-medium whitespace-nowrap text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400">
      Long: will wrap to {lineCount} lines
    </span>
  );

  let hints: KeyHint[];
  let actions: ReactNode;
  if (mode === 'split') {
    hints = [
      { combo: 'enter', label: 'split' },
      { combo: 'esc', label: 'back' },
    ];
    actions = (
      <>
        <AppButton variant="ghost" size="xs" onClick={stopSplitting}>
          Cancel split
        </AppButton>
        <AppButton
          variant="accent"
          size="xs"
          className="font-semibold"
          disabled={!canSplitHere}
          onClick={split}
        >
          Split here
        </AppButton>
      </>
    );
  } else if (mode === 'merge') {
    hints = [
      { combo: 'enter', label: 'merge' },
      { combo: 'esc', label: 'cancel' },
    ];
    actions = (
      <>
        <AppButton variant="ghost" size="xs" onClick={cancel}>
          Cancel
        </AppButton>
        <AppButton
          variant="accent"
          size="xs"
          className="font-semibold"
          disabled={length === 0}
          onClick={mergeDraft}
        >
          Merge
        </AppButton>
      </>
    );
  } else {
    // Save and Escape are what any editor does; the split key is the one worth teaching.
    const keep = onSplit ? 'low' : undefined;
    hints = [
      { combo: 'enter', label: 'save', keep },
      ...(onSplit ? [{ combo: SHORTCUTS.splitBullet, label: 'split', keep: 'high' as const }] : []),
      { combo: 'esc', label: 'cancel', keep },
    ];
    actions = (
      <AppButton variant="accent" size="xs" className="font-semibold" onClick={save}>
        Save
      </AppButton>
    );
  }

  return (
    <div
      ref={rootRef}
      className="my-0.5 animate-ring-in overflow-hidden rounded-md border border-amber-line bg-pane-raised ring-[3px] ring-amber-soft @container motion-reduce:animate-none"
    >
      {mode === 'merge' && (
        <div className="flex items-center gap-1.5 px-2.5 pt-1.75 text-[0.71875rem] text-ink-muted">
          <Merge className="size-2.75 shrink-0 text-info" />
          Merging with the bullet below. Tidy the join, then merge.
        </div>
      )}
      <div className="relative">
        {/* The text again, unseen, under the textarea, so the marker and tint wrap with it. */}
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-0 overflow-hidden px-2.5 pt-2 pb-1.25 text-[0.8125rem] leading-normal wrap-break-word whitespace-pre-wrap text-transparent',
            mode === 'edit' && 'invisible'
          )}
        >
          {draft.slice(0, markAt)}
          <span
            className={cn(
              'relative inline-block h-[1.3em] w-0 align-[-0.3em] shadow-[0_0_0_1px_var(--color-info)] before:absolute before:-top-1 before:-left-0.75 before:size-1.5 before:rounded-full before:bg-info',
              mode !== 'edit' &&
                'animate-seam-in before:animate-seam-dot motion-reduce:animate-none motion-reduce:before:animate-none'
            )}
          />
          <span
            data-split-tail=""
            className={cn(
              'rounded-[0.1875rem] bg-info-soft box-decoration-clone',
              mode !== 'edit' && 'animate-tint-in'
            )}
          >
            {draft.slice(markAt)}
          </span>
          {'​'}
        </div>
        <textarea
          ref={textareaRef}
          value={draft}
          autoFocus
          rows={1}
          placeholder={placeholder}
          aria-label={
            mode === 'split'
              ? 'Bullet text. The new bullet starts at the cursor.'
              : mode === 'merge'
                ? 'Merged text of two bullets'
                : 'Bullet text'
          }
          aria-describedby={isNoteShown ? noteId : undefined}
          onChange={(event) => takeText(event.target)}
          onSelect={(event) => setCursor(event.currentTarget.selectionStart)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={handleBlur}
          className={cn(
            'relative block field-sizing-content w-full resize-none overflow-hidden border-0 bg-transparent px-2.5 pt-2 pb-1.25 text-[0.8125rem] leading-normal text-foreground outline-none placeholder:text-ink-faint',
            startsTinted && 'animate-carry-tint'
          )}
        />
      </div>
      {merge && merge.isFirstSelected !== merge.isSecondSelected && (
        <div className={NOTE}>
          <span className={NOTE_TEXT}>
            {merge.isFirstSelected
              ? 'The bullet below is off the resume.'
              : 'This bullet is off the resume.'}{' '}
            The merged bullet is
          </span>
          <ToggleGroup
            type="single"
            spacing={0.5}
            value={isMergedSelected ? 'on' : 'off'}
            onValueChange={(value) => value && setIsMergedSelected(value === 'on')}
            aria-label="The merged bullet is"
            className="rounded-md border border-line bg-line p-px"
          >
            <ToggleGroupItem value="on" className={SEGMENT}>
              On the resume
            </ToggleGroupItem>
            <ToggleGroupItem value="off" className={SEGMENT}>
              Left off
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      )}
      {shouldNudgeSplit && (
        <div className={NOTE}>
          {longChip}
          <span className="flex-1" />
          <AppButton
            variant="ghost"
            size="xs"
            title="Pick where the new bullet starts"
            onClick={startSplitting}
          >
            <Split />
            Split in two
          </AppButton>
        </div>
      )}
      {isNoteShown && (
        <div
          // A new reason drops in again.
          key={isRefused ? splitNote : 'tell'}
          id={noteId}
          role="status"
          className={cn(
            NOTE,
            'animate-note-in motion-reduce:animate-none',
            isRefused ? 'text-ink-soft [&>svg]:text-ink-muted' : '[&>svg]:text-info'
          )}
        >
          {isRefused ? <Info /> : <Split />}
          <span className={NOTE_TEXT}>{splitNote}</span>
        </div>
      )}
      <div className="flex items-center gap-1.5 overflow-hidden border-t border-line pt-1 pr-1.5 pb-1.25 pl-2.25">
        {/* Shrinks first, so the buttons stay whole in a narrow sidebar. */}
        <span className="min-w-0 truncate font-mono text-[0.6875rem] text-ink-faint">
          {mode === 'split' ? (
            <>
              {draft.slice(0, cursor).trim().length} + {draft.slice(cursor).trim().length}
              <span className="@max-[20.625rem]:hidden"> chars</span>
            </>
          ) : (
            `${length} chars`
          )}
        </span>
        {!shouldNudgeSplit && mode !== 'split' && longChip}
        <span className="flex-1" />
        <KeyHints hints={hints} />
        {actions}
      </div>
    </div>
  );
}

interface KeyHint {
  combo: string;
  label: string;
  /** How long it stays as the editor narrows: `low` goes first, `high` stays longest. */
  keep?: 'low' | 'high';
}

const KEEP_UNTIL = {
  low: '@max-[26rem]:hidden',
  normal: '@max-[20.625rem]:hidden',
  high: '@max-[16rem]:hidden',
};

/** The footer's keys, named as this platform names them: "Shift+Enter", or "⇧↵" on a Mac. */
function KeyHints({ hints }: { hints: KeyHint[] }) {
  const joiner = window.mosaic.platform === 'darwin' ? '' : '+';
  return (
    <span className="flex items-center gap-2 text-[0.6875rem] whitespace-nowrap text-ink-muted">
      {hints.map(({ combo, label, keep }) => (
        <span key={label} className={KEEP_UNTIL[keep ?? 'normal']}>
          <span className="font-medium text-ink-soft">
            {formatShortcutKeys(combo).join(joiner)}
          </span>{' '}
          {label}
        </span>
      ))}
    </span>
  );
}
