import { useEffect, useRef, useState } from 'react';
import { Bookmark, Pencil } from 'lucide-react';
import { textVariantClasses } from '@/components/textVariants';
import { cn } from '@/lib/utils';
import { MAX_DB_TEXT_LENGTH, type VersionMeta } from '@shared/types/db';

interface VersionNameFieldProps {
  version: VersionMeta;
  label: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}

/**
 * A row's summary line as a text field. Enter keeps and Escape cancels, stopped here so the
 * history view stays open. Clicking away keeps what was typed, like renaming a file: losing
 * typing is worse than an unwanted name. An empty field cancels.
 */
export function VersionNameField({ version, label, onCommit, onCancel }: VersionNameFieldProps) {
  const isNamed = version.kind === 'named';
  const [name, setName] = useState(isNamed ? version.summary : '');
  const inputRef = useRef<HTMLInputElement>(null);
  const isDone = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
    // Switching to another app blurs the field too, and that isn't clicking away.
    const comeBack = () => {
      if (!isDone.current) inputRef.current?.focus();
    };
    window.addEventListener('focus', comeBack);
    return () => window.removeEventListener('focus', comeBack);
  }, []);

  const finish = (shouldKeep: boolean) => {
    if (isDone.current) return;
    isDone.current = true;
    const trimmed = name.trim();
    if (shouldKeep && trimmed) onCommit(trimmed);
    else onCancel();
  };

  const Icon = isNamed ? Pencil : Bookmark;
  return (
    <div className="relative -my-0.5 -ml-1.5 flex">
      <Icon
        aria-hidden
        className={cn(
          'pointer-events-none absolute top-1.5 left-1.75 size-2.75',
          isNamed ? 'text-ink-muted' : 'text-amber'
        )}
      />
      <input
        ref={inputRef}
        value={name}
        maxLength={MAX_DB_TEXT_LENGTH}
        aria-label={`${isNamed ? 'Rename' : 'Name'} ${label}`}
        placeholder={isNamed ? 'A name you’ll recognise later' : 'Named versions are kept for good'}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === 'Enter' || event.key === 'Escape') {
            event.preventDefault();
            finish(event.key === 'Enter');
          }
        }}
        onBlur={() => {
          if (document.hasFocus()) finish(true);
        }}
        className={cn(
          textVariantClasses('strong'),
          'h-5.5 min-w-0 flex-1 rounded-[0.3125rem] bg-pane-raised pr-1.5 pl-5.5 shadow-[inset_0_0_0_1px_var(--line-heavy),0_0_0_3px_var(--amber-soft)] outline-none placeholder:font-regular placeholder:text-ink-faint'
        )}
      />
    </div>
  );
}

/** Where the time was in the meta line, while the field is open. */
export function VersionNameKeys() {
  return (
    <span className="inline-flex items-center gap-1 text-ink-faint">
      <Kbd>Enter</Kbd>keeps<Kbd className="ml-1">Esc</Kbd>cancels
    </span>
  );
}

function Kbd({ className, children }: { className?: string; children: string }) {
  return (
    <kbd
      className={cn(
        textVariantClasses('key'),
        'rounded-[0.1875rem] border border-line-strong bg-line px-1 leading-3.5 text-ink-muted',
        className
      )}
    >
      {children}
    </kbd>
  );
}
