import { useRef, useState, type ClipboardEvent, type FocusEvent, type KeyboardEvent } from 'react';
import { AppButton } from '@/components/AppButton';
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
  placeholder = 'Describe the outcome, then the method. Start with a verb.',
}: BulletEditorProps) {
  const [draft, setDraft] = useState(initial);
  const rootRef = useRef<HTMLDivElement>(null);
  // Set once the editor has saved or cancelled, so a blur as it closes does nothing more.
  const isDone = useRef(false);
  const length = draft.trim().length;

  const save = () => {
    if (isDone.current) return;
    isDone.current = true;
    onSave(draft.trim());
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
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
    if (rootRef.current?.contains(event.relatedTarget)) return;
    save();
  };

  return (
    <div
      ref={rootRef}
      className="my-0.5 overflow-hidden rounded-md border border-amber-300 bg-pane-raised ring-[3px] ring-amber-100 @container dark:border-amber-800 dark:ring-amber-950"
    >
      <textarea
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
        className="block field-sizing-content w-full resize-none overflow-hidden border-0 bg-transparent px-2.5 pt-2 pb-[0.3125rem] text-[0.8125rem] leading-normal text-foreground outline-none placeholder:text-ink-faint"
      />
      <div className="flex items-center gap-1.5 overflow-hidden border-t border-line pt-1 pr-1.5 pb-[0.3125rem] pl-[0.5625rem]">
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
