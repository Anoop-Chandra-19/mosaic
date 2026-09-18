import { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Ellipsis,
  Eye,
  EyeOff,
  Link2,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { AppButton } from '@/components/AppButton';
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
  const [menuOpen, setMenuOpen] = useState(false);
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

  return (
    <div className="group/item relative flex items-start gap-2 rounded-md px-1.5 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-900">
      {shouldShowIcon && <Icon className="mt-1.5 size-3.5 shrink-0 text-zinc-500" aria-hidden />}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2">
        <AppButton
          type="button"
          variant="inline-edit"
          onClick={() => setEditing('text')}
          title="Edit text and link"
          className={cn(!item.shown && 'text-zinc-500 line-through')}
        >
          {item.text || <span className="text-muted-foreground">{label}</span>}
        </AppButton>

        {item.url && (
          <AppButton
            type="button"
            variant="link-chip"
            onClick={() => setEditing('url')}
            title={`Links to ${href || item.url}`}
            aria-label="Edit link"
          >
            <Link2 className="size-3 shrink-0" />
            {!isLinkSameAsText && <span className="truncate">{shortLink(item.url)}</span>}
          </AppButton>
        )}

        {item.shown && !item.text && item.url && (
          <span
            className="text-xs text-amber-700 dark:text-amber-400"
            title="Nothing prints for it, but the link is kept"
          >
            no text
          </span>
        )}
      </div>

      {/* Over the row's right end while it is hovered, so they take no width from the text. */}
      <div
        className={cn(
          'absolute top-1 right-1 items-center gap-0.5 rounded-md bg-zinc-100 pl-1 dark:bg-zinc-900',
          menuOpen ? 'flex' : 'hidden group-focus-within/item:flex group-hover/item:flex'
        )}
      >
        {!item.url && (
          <AppButton variant="muted" size="xs" onClick={() => setEditing('url')}>
            <Plus />
            link
          </AppButton>
        )}
        <AppButton
          variant="muted"
          size="icon-xs"
          onClick={toggleShown}
          aria-label={item.shown ? 'Leave off the page' : 'Put back on the page'}
          title={
            item.shown
              ? 'On the page — keep it, but leave it off'
              : 'Left off the page — put it back'
          }
        >
          {item.shown ? <Eye /> : <EyeOff />}
        </AppButton>
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <AppButton variant="muted" size="icon-xs" aria-label={`${label} actions`}>
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
    </div>
  );
}
