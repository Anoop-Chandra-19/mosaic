import { useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { AppInput } from '@/components/AppInput';
import { Text } from '@/components/Text';
import { textVariantClasses } from '@/components/textVariants';
import { formatShortcutKeys, isSameShortcut, readShortcutCombo } from '@/lib/keyboardShortcuts';
import { cn } from '@/lib/utils';
import { useAiStore } from '@/stores/aiStore';
import { listShortcutGroups, type ShortcutRow } from './shortcutList';

const PLATFORM_NAMES: Record<string, string> = {
  darwin: 'macOS',
  win32: 'Windows',
  linux: 'Linux',
};

/** A shortcut's keycaps; `alt` follows after a slash. */
export function ShortcutKeys({ combo, alt }: { combo: string; alt?: string }) {
  const caps = (keys: string) =>
    formatShortcutKeys(keys).map((key, index) => (
      <kbd
        key={`${keys}-${index}`}
        className={cn(
          textVariantClasses('meta'),
          'inline-flex h-4.75 min-w-4.75 items-center justify-center rounded-[0.25rem] border border-line-strong bg-line px-1.25 text-ink-soft'
        )}
      >
        {key}
      </kbd>
    ));
  return (
    <span className="flex shrink-0 items-center gap-0.75">
      {caps(combo)}
      {alt && (
        <>
          <Text variant="meta" className="mx-px">
            /
          </Text>
          {caps(alt)}
        </>
      )}
    </span>
  );
}

/** A label with the searched-for part picked out. */
function MarkedLabel({ label, query }: { label: string; query: string }) {
  const at = query ? label.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (at < 0) return label;
  return (
    <>
      {label.slice(0, at)}
      <em className="rounded-xs bg-amber-soft px-px text-amber not-italic">
        {label.slice(at, at + query.length)}
      </em>
      {label.slice(at + query.length)}
    </>
  );
}

function ShortcutRowView({
  row,
  query = '',
  groupTitle,
}: {
  row: ShortcutRow;
  query?: string;
  /** Shown beside the label when rows from several groups are listed together. */
  groupTitle?: string;
}) {
  return (
    <div
      className={cn(
        'flex h-7 items-center gap-2.5 rounded-sm px-1.75 text-body hover:bg-line hover:text-foreground dense:h-6.25',
        row.isUnavailable ? 'text-ink-faint' : 'text-ink-soft'
      )}
    >
      <span className="min-w-0 flex-1 truncate">
        <MarkedLabel label={row.label} query={query} />
      </span>
      {(groupTitle || row.isUnavailable) && (
        <Text
          variant="meta"
          className="shrink-0 rounded-[0.25rem] border border-line px-1.25 py-px"
        >
          {row.isUnavailable ? row.unavailableNote : groupTitle}
        </Text>
      )}
      <ShortcutKeys combo={row.combo} alt={row.alt} />
    </div>
  );
}

const GROUP_HEADING = 'mb-1.25 flex items-center gap-1.5';

/**
 * The shortcut sheet: every binding by group, a search over their names, and a lookup:
 * pressing a combination in the search field says what it does. In Settings it flows with
 * the section; on its own (Ctrl/⌘+/) it fills a dialog.
 */
export function ShortcutsPanel({
  isEmbedded = false,
  footerAction,
}: {
  isEmbedded?: boolean;
  /** At the end of the footer, such as the dialog's Done. */
  footerAction?: ReactNode;
}) {
  const isAiEnabled = useAiStore((s) => s.enabled);
  const [query, setQuery] = useState('');
  const [pressed, setPressed] = useState<string | null>(null);
  const { platform } = window.mosaic;
  const groups = listShortcutGroups({ platform, isAiEnabled });
  const rows = groups.flatMap((group) => group.rows.map((row) => ({ row, group: group.title })));

  const trimmed = query.trim();
  const matches = trimmed
    ? rows.filter(({ row }) => row.label.toLowerCase().includes(trimmed.toLowerCase()))
    : null;
  const found = pressed
    ? rows.find(({ row }) => [row.combo, row.alt].some((c) => c && isSameShortcut(c, pressed)))
    : undefined;

  const clear = () => {
    setQuery('');
    setPressed(null);
  };

  // A combination pressed in the field is a question, not a command: it is answered here
  // and goes no further.
  const lookUpPressedKeys = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && (query || pressed)) {
      event.preventDefault();
      event.stopPropagation();
      clear();
      return;
    }
    if (!(event.metaKey || event.ctrlKey || event.altKey)) return;
    const combo = readShortcutCombo(event.nativeEvent);
    if (!combo) return;
    event.preventDefault();
    event.stopPropagation();
    setQuery('');
    setPressed(combo);
  };

  return (
    <div className={cn('flex min-h-0 flex-col', !isEmbedded && 'flex-1')}>
      <div
        className={cn(
          'flex items-center gap-2 border-b border-line',
          isEmbedded ? 'pb-2.75' : 'px-3.5 py-2.75'
        )}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.25 size-3.25 -translate-y-1/2 text-ink-faint" />
          <AppInput
            value={query}
            spellCheck={false}
            autoFocus={!isEmbedded}
            aria-label="Search shortcuts"
            placeholder="Search an action, or press the keys you’re looking for"
            onKeyDown={lookUpPressedKeys}
            onChange={(event) => {
              setQuery(event.target.value);
              setPressed(null);
            }}
            className="h-7.5 pl-7.25"
          />
        </div>
        {(query || pressed) && (
          <AppButton variant="ghost" size="sm" onClick={clear}>
            Clear
          </AppButton>
        )}
      </div>

      <div
        className={cn(
          'min-h-0 flex-1 @container/shortcuts',
          isEmbedded ? 'py-3.5' : 'overflow-y-auto p-3.5'
        )}
      >
        {pressed && (
          <section aria-label="You pressed" className="mb-3.5 max-w-130">
            <Text as="h4" variant="eyebrow" className={GROUP_HEADING}>
              You pressed
            </Text>
            <div className="flex items-center gap-2.75 rounded-[0.5625rem] border border-line bg-pane-raised px-3.25 py-3">
              <ShortcutKeys combo={pressed} />
              {found ? (
                <>
                  <Text as="div" variant="body" className="min-w-0 flex-1">
                    is <b className="font-strong text-foreground">{found.row.label}</b>
                    <Text as="div" variant="secondary">
                      {found.group}
                    </Text>
                  </Text>
                  <AppButton
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      setPressed(null);
                      setQuery(found.row.label);
                    }}
                  >
                    Show in list
                  </AppButton>
                </>
              ) : (
                <Text as="div" variant="body" className="flex-1">
                  isn’t bound to anything.
                </Text>
              )}
            </div>
          </section>
        )}

        {matches && (
          <section aria-label="Matching shortcuts" className="max-w-130">
            <Text as="h4" variant="eyebrow" className={GROUP_HEADING}>
              {matches.length} {matches.length === 1 ? 'action' : 'actions'}
            </Text>
            {matches.map(({ row, group }) => (
              <ShortcutRowView key={row.id} row={row} query={trimmed} groupTitle={group} />
            ))}
            {matches.length === 0 && (
              <Text as="p" variant="secondary" className="mx-0.5 my-1">
                Nothing matches “{trimmed}”.
              </Text>
            )}
          </section>
        )}

        {!matches && !pressed && (
          <div className="grid grid-cols-1 content-start gap-x-4 @[36rem]/shortcuts:grid-cols-2">
            {groups.map((group) => (
              <section key={group.title} aria-label={group.title} className="mb-3.5">
                <Text as="h4" variant="eyebrow" className={GROUP_HEADING}>
                  {group.title}
                  {group.note && (
                    <Text
                      variant="tag"
                      className="inline-flex h-3.75 items-center rounded-[0.25rem] border border-line-strong px-1 text-ink-faint normal-case"
                    >
                      {group.note}
                    </Text>
                  )}
                </Text>
                {group.rows.map((row) => (
                  <ShortcutRowView key={row.id} row={row} />
                ))}
              </section>
            ))}
          </div>
        )}
      </div>

      <div
        className={cn(
          textVariantClasses('secondary'),
          'flex shrink-0 items-center gap-2.5 border-t border-line text-ink-faint',
          isEmbedded ? 'pt-2.5' : 'h-11 bg-chrome px-3.5'
        )}
      >
        <span className="flex-1">
          Keys are shown for {PLATFORM_NAMES[platform] ?? platform}, the system Mosaic is running
          on.
        </span>
        {footerAction}
      </div>
    </div>
  );
}
