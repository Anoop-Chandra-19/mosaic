import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { AppInput } from '@/components/AppInput';
import { Text } from '@/components/Text';
import { textVariantClasses } from '@/components/textVariants';
import { isSameShortcut, readShortcutCombo } from '@/lib/keyboardShortcuts';
import {
  isFixedShortcut,
  resolveShortcutCombos,
  type ShortcutBindings,
  type ShortcutId,
  type ShortcutPlace,
} from '@/lib/shortcutCatalog';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/stores/uiStore';
import { ShortcutCapture } from './ShortcutCapture';
import { ShortcutKeys } from './ShortcutKeys';
import { ShortcutRowView } from './ShortcutRowView';
import {
  listPlaceShortcuts,
  listShortcutGroups,
  type ShortcutGroup,
  type ShortcutRow,
} from './shortcutList';

/*
 * The shortcut sheet: every action by group, with its keys and a pencil to change them, a
 * search over the names, and a lookup: keys pressed in the search field say what they do.
 * Opened from a place (a bullet being edited, the full history), that place's keys come
 * first. Its steps: `ShortcutRowView` per action, `ShortcutCapture` while one listens.
 */

const PLATFORM_NAMES: Record<string, string> = {
  darwin: 'macOS',
  win32: 'Windows',
  linux: 'Linux',
};

const GROUP_HEADING = 'mb-1.25 flex items-center gap-1.5';

/**
 * Every combination an action answers to, for the lookup. Windows and Linux redo with Ctrl+Y
 * as well, fixed with the rest. A row shows only the first: second keys are spares, and
 * listing them crowds the label out of a narrow column.
 */
function listAllCombos(id: ShortcutId, bindings: ShortcutBindings, platform: string): string[] {
  const combos = resolveShortcutCombos(id, bindings[id]);
  return id === 'redo' && platform !== 'darwin' ? [...combos, 'mod+Y'] : combos;
}

/** The row listening for keys: which action, in which group, as the same action can be in two. */
interface Editing {
  id: ShortcutId;
  group: string;
}

interface ShortcutsPanelProps {
  isEmbedded?: boolean;
  /** Where the sheet was opened from; that place's keys are listed first. */
  place?: ShortcutPlace | null;
  /** At the end of the footer, such as the dialog's Done. */
  footerAction?: ReactNode;
}

export function ShortcutsPanel({ isEmbedded = false, place, footerAction }: ShortcutsPanelProps) {
  const bindings = useUiStore((s) => s.shortcutBindings);
  const restoreDefaults = useUiStore((s) => s.restoreDefaultShortcuts);
  const [query, setQuery] = useState('');
  const [pressed, setPressed] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { platform } = window.mosaic;
  const groups = listShortcutGroups();
  const rows = groups.flatMap((group) => group.rows.map((row) => ({ row, group: group.title })));
  const changedCount = Object.keys(bindings).length;

  const trimmed = query.trim();
  const matches = trimmed
    ? rows.filter(({ row }) => row.label.toLowerCase().includes(trimmed.toLowerCase()))
    : null;
  const found = pressed
    ? rows.find(({ row }) =>
        listAllCombos(row.id, bindings, platform).some((combo) => isSameShortcut(combo, pressed))
      )
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

  // Focus goes back to the row whose keys were being changed.
  const finishEditing = () => {
    const rowId = editing && `${editing.group}:${editing.id}`;
    setEditing(null);
    requestAnimationFrame(() =>
      panelRef.current?.querySelector<HTMLElement>(`[data-shortcut-row="${rowId}"] button`)?.focus()
    );
  };

  const renderRow = (row: ShortcutRow, group: string, search?: { tag: string }) => {
    if (editing?.id === row.id && editing.group === group) {
      return <ShortcutCapture key={row.id} id={row.id} onDone={finishEditing} />;
    }
    return (
      <ShortcutRowView
        key={row.id}
        rowId={`${group}:${row.id}`}
        label={row.label}
        combos={listAllCombos(row.id, bindings, platform).slice(0, 1)}
        query={search ? trimmed : undefined}
        tag={search?.tag}
        isCustom={row.id in bindings}
        onEdit={isFixedShortcut(row.id) ? undefined : () => setEditing({ id: row.id, group })}
      />
    );
  };

  // The group for where the sheet was opened from has its tag in amber, to stand apart.
  const renderGroup = (group: ShortcutGroup, isWhereYouAre = false) => (
    <section key={group.title} aria-label={group.title} className="mb-3.5">
      <Text as="h4" variant="eyebrow" className={GROUP_HEADING}>
        {group.title}
        {group.note && (
          <Text
            variant="tag"
            className={cn(
              'inline-flex h-3.75 items-center rounded-[0.25rem] border px-1 normal-case',
              isWhereYouAre ? 'border-amber-line text-amber' : 'border-line-strong text-ink-faint'
            )}
          >
            {group.note}
          </Text>
        )}
      </Text>
      {group.rows.map((row) => renderRow(row, group.title))}
    </section>
  );

  return (
    <div ref={panelRef} className={cn('flex min-h-0 flex-col', !isEmbedded && 'flex-1')}>
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
            // While there is something to clear, Esc clears it rather than closing.
            data-keeps-escape={query || pressed ? '' : undefined}
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
              <ShortcutKeys combos={[pressed]} />
              {found ? (
                <>
                  <Text as="div" variant="body" className="min-w-0 flex-1">
                    is <b className="font-strong text-foreground">{found.row.label}</b>
                    <Text as="div" variant="secondary">
                      {found.group}
                    </Text>
                  </Text>
                  {!isFixedShortcut(found.row.id) && (
                    <AppButton
                      variant="ghost"
                      size="xs"
                      onClick={() => {
                        setPressed(null);
                        setQuery(found.row.label);
                        setEditing({ id: found.row.id, group: found.group });
                      }}
                    >
                      Change…
                    </AppButton>
                  )}
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
            {matches.map(({ row, group }) => renderRow(row, group, { tag: group }))}
            {matches.length === 0 && (
              <Text as="p" variant="secondary" className="mx-0.5 my-1">
                Nothing matches “{trimmed}”.
              </Text>
            )}
          </section>
        )}

        {!matches && !pressed && (
          <>
            {place && (
              <div className="max-w-130">{renderGroup(listPlaceShortcuts(place), true)}</div>
            )}
            <div className="grid grid-cols-1 content-start gap-x-4 @[36rem]/shortcuts:grid-cols-2">
              {groups.map((group) => renderGroup(group))}
            </div>
          </>
        )}
      </div>

      <div
        className={cn(
          textVariantClasses('secondary'),
          'flex shrink-0 items-center gap-2.5 border-t border-line text-ink-faint',
          isEmbedded ? 'pt-2.5' : 'h-11 bg-chrome px-3.5'
        )}
      >
        <span className={cn('flex-1', changedCount > 0 && 'text-amber')}>
          {changedCount > 0
            ? `${changedCount} ${changedCount === 1 ? 'shortcut differs' : 'shortcuts differ'} from the defaults.`
            : `Keys are shown for ${PLATFORM_NAMES[platform] ?? platform}, the system Mosaic is running on.`}
        </span>
        <AppButton
          variant="ghost"
          size="xs"
          disabled={changedCount === 0}
          onClick={() => {
            setEditing(null);
            restoreDefaults();
          }}
        >
          Restore defaults
        </AppButton>
        {footerAction}
      </div>
    </div>
  );
}
