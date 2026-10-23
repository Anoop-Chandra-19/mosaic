import { useRef, useState } from 'react';
import { ShortcutKeys } from '@/features/shortcuts/ShortcutKeys';
import { cn } from '@/lib/utils';

/**
 * The number only the user knows, typed into the sentence. Typing is a draft: the number
 * lands on Enter or when focus leaves, since each landing marks the sentence again.
 */
export function GapField({ value, onFill }: { value?: string; onFill: (number: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const isTyping = draft !== null;
  const shown = draft ?? value ?? '';
  const commit = () => {
    if (draft === null) return;
    onFill(draft);
    setDraft(null);
  };
  return (
    <span
      onClick={(event) => {
        event.stopPropagation();
        inputRef.current?.focus();
      }}
      className={cn(
        'relative mx-px inline-flex h-5 min-w-5.5 cursor-text items-center rounded-[0.25rem] border-[1.5px] border-dashed border-warn bg-warn-soft px-1 align-[-1px]',
        value && !isTyping && 'border-solid border-add-line bg-add-soft',
        isTyping && 'border-solid'
      )}
    >
      <input
        ref={inputRef}
        value={shown}
        placeholder="?"
        inputMode="decimal"
        aria-label="The number only you know. Enter to fill it in"
        size={Math.max(1, shown.length)}
        onBlur={commit}
        onChange={(event) => setDraft(event.target.value.replace(/[^\d.]/g, '').slice(0, 5))}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
            inputRef.current?.blur();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            setDraft(null);
            inputRef.current?.blur();
          }
        }}
        className="min-w-[1ch] bg-transparent text-center text-foreground tabular-nums outline-none placeholder:text-warn"
      />
      {isTyping && (
        <span className="absolute top-[calc(100%+0.25rem)] left-1/2 z-2 -translate-x-1/2">
          <ShortcutKeys combos={['enter']} />
        </span>
      )}
    </span>
  );
}
