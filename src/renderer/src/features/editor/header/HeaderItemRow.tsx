import { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Ellipsis,
  Eye,
  EyeOff,
  Link,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { AppTooltip } from '@/components/AppTooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { resolveHeaderItemHref, getHeaderKindInfo } from '@shared/resume/resumeHeader';
import { cn } from '@/lib/utils';
import { useResumeStore } from '@/stores/resumeStore';
import { useUiStore } from '@/stores/uiStore';
import type { HeaderItem, HeaderLine } from '@shared/types/resume';
import { HIDDEN_WHILE_READING } from '../editorClasses';
import { HEADER_ICONS } from './headerIcons';
import { HeaderItemEditor, type HeaderItemField } from './HeaderItemEditor';

/** A link as a short label: no scheme, no "www.", no trailing slash. */
const shortLink = (link: string) =>
  link
    .trim()
    .replace(/^(?:[a-z][a-z\d+.-]*:(?:\/\/)?)?(?:www\.)?/i, '')
    .replace(/\/$/, '');

interface HeaderItemRowProps {
  item: HeaderItem;
  line: HeaderLine;
  lines: HeaderLine[];
  /** Open for editing when first shown: an item just added. */
  shouldStartEditing?: boolean;
}

/**
 * One item at rest: its text, its link, whether it is on the page. Hidden text is struck
 * through; an item with a link but no text prints nothing, and says so.
 */
export function HeaderItemRow({
  item,
  line,
  lines,
  shouldStartEditing = false,
}: HeaderItemRowProps) {
  const shouldShowIcon = useUiStore((s) => s.shouldShowHeaderIcons);
  const update = useResumeStore((s) => s.updateHeaderItem);
  const move = useResumeStore((s) => s.moveHeaderItem);
  const moveToLine = useResumeStore((s) => s.moveHeaderItemToLine);
  const duplicate = useResumeStore((s) => s.duplicateHeaderItem);
  const remove = useResumeStore((s) => s.removeHeaderItem);
  const [editing, setEditing] = useState<HeaderItemField | null>(
    shouldStartEditing ? 'text' : null
  );
  const editAfterMenu = useRef(false);

  const toggleShown = () => update(item.id, { shown: !item.shown });

  if (editing) {
    return (
      <HeaderItemEditor
        item={item}
        focus={editing}
        onToggleShown={toggleShown}
        onCancel={() => setEditing(null)}
        onSave={(patch) => {
          setEditing(null);
          update(item.id, patch);
        }}
      />
    );
  }

  const { label } = getHeaderKindInfo(item.kind);
  const Icon = HEADER_ICONS[item.kind];
  const index = line.items.indexOf(item);
  const href = resolveHeaderItemHref(item);
  const isLinkSameAsText = shortLink(item.url) === shortLink(item.text);
  const isUnprinted = item.shown && !item.text;

  return (
    <div
      className={cn(
        'flex min-h-[2.125rem] items-center gap-[0.4375rem] py-px',
        // The text's hover fill bleeds left, so its words line up with the caption above.
        !shouldShowIcon && '-ml-1.5'
      )}
    >
      {shouldShowIcon && (
        <Icon className="-mr-1.5 size-[0.8125rem] shrink-0 text-ink-faint" aria-hidden />
      )}
      <AppButton
        variant="ghost"
        size="sm"
        shape="text"
        onClick={() => setEditing('text')}
        title="Click to edit text and link"
        className={cn(
          // Sized by its words, so a short item keeps them whole beside a long link.
          'flex-auto text-[0.8875rem] leading-[1.45]',
          !item.shown && 'text-ink-faint line-through decoration-line-heavy',
          isUnprinted && 'text-ink-faint'
        )}
      >
        {item.text || <span className="text-ink-faint">{label}</span>}
      </AppButton>

      {item.url ? (
        <AppButton
          variant="outline"
          size="2xs"
          shape="pill"
          onClick={() => setEditing('url')}
          title={`Links to ${href || item.url}`}
          aria-label="Edit link"
          className={cn(
            // In a narrow pane the link shows as its glyph alone, so the text keeps its words.
            'max-w-[7rem] min-w-[1.375rem] shrink-[8] font-normal text-ink-muted @max-[20rem]/pane:w-[1.375rem] @max-[20rem]/pane:px-0',
            !item.shown && 'border-line text-ink-faint',
            isLinkSameAsText && 'w-[1.375rem] px-0'
          )}
        >
          <Link className="size-2.5" />
          {!isLinkSameAsText && (
            <span className="truncate @max-[20rem]/pane:hidden">{shortLink(item.url)}</span>
          )}
        </AppButton>
      ) : (
        <AppButton
          variant="dashed"
          size="2xs"
          shape="pill"
          onClick={() => setEditing('url')}
          title="Add a link"
          className={cn('border-line-strong font-normal text-ink-faint', HIDDEN_WHILE_READING)}
        >
          <Plus className="size-2.5" />
          <span>link</span>
        </AppButton>
      )}

      {isUnprinted && item.url && (
        <AppTooltip content="No text, so nothing prints for it. The link is kept.">
          <span className="shrink-0 rounded border border-line-strong px-[0.3125rem] py-px text-[0.65625rem] tracking-[0.02em] text-ink-faint">
            no text
          </span>
        </AppTooltip>
      )}

      <AppButton
        variant="ghost"
        size="xs"
        shape="square"
        onClick={toggleShown}
        aria-label={item.shown ? 'Leave off the page' : 'Put back on the page'}
        title={
          item.shown
            ? 'On the page. Click to keep it but leave it off.'
            : 'Left off the page. Click to put it back.'
        }
      >
        {item.shown ? <Eye /> : <EyeOff />}
      </AppButton>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <AppButton
            variant="ghost"
            size="xs"
            shape="square"
            aria-label={`${label} actions`}
            className={HIDDEN_WHILE_READING}
          >
            <Ellipsis />
          </AppButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          onCloseAutoFocus={(event) => {
            // The editor opens once the menu has closed: while open, the menu holds focus
            // and would take it back from the text field.
            if (!editAfterMenu.current) return;
            editAfterMenu.current = false;
            event.preventDefault();
            setEditing('text');
          }}
        >
          <DropdownMenuItem
            onSelect={() => {
              editAfterMenu.current = true;
            }}
          >
            <Pencil />
            Edit text and link
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={toggleShown}>
            {item.shown ? <EyeOff /> : <Eye />}
            {item.shown ? 'Leave off the page' : 'Put back on the page'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!item.text} onSelect={() => update(item.id, { text: '' })}>
            <X />
            Clear text
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!item.url} onSelect={() => update(item.id, { url: '' })}>
            <X />
            Clear link
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={index === 0} onSelect={() => move(item.id, -1)}>
            <ArrowUp />
            Move up
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={index === line.items.length - 1}
            onSelect={() => move(item.id, 1)}
          >
            <ArrowDown />
            Move down
          </DropdownMenuItem>
          {lines.map((other, number) =>
            other.id === line.id ? null : (
              <DropdownMenuItem key={other.id} onSelect={() => moveToLine(item.id, other.id)}>
                <ArrowDown className={cn(number < lines.indexOf(line) && 'rotate-180')} />
                Move to line {number + 1}
              </DropdownMenuItem>
            )
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => duplicate(item.id)}>
            <Copy />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => remove(item.id)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 />
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
