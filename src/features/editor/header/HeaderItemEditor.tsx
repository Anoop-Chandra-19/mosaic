import { useId, useState, type KeyboardEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { resolveHeaderItemHref, getHeaderKindInfo } from '@/lib/resume/resumeHeader';
import type { HeaderItem } from '@/types/resume';
import { HEADER_ICONS } from './headerIcons';

export type HeaderItemField = 'text' | 'url';

interface HeaderItemEditorProps {
  item: HeaderItem;
  /** The field the editor opens on. */
  focus: HeaderItemField;
  onToggleShown: () => void;
  onSave: (patch: Pick<HeaderItem, 'text' | 'url'>) => void;
  onCancel: () => void;
}

/**
 * An item's text and link, edited together in place of its row: the two are independent,
 * and seeing both at once is what shows how they relate. Enter saves, Escape cancels.
 */
export function HeaderItemEditor({
  item,
  focus,
  onToggleShown,
  onSave,
  onCancel,
}: HeaderItemEditorProps) {
  const [text, setText] = useState(item.text);
  const [url, setUrl] = useState(item.url);
  const fieldId = useId();
  const { label, placeholder } = getHeaderKindInfo(item.kind);
  const Icon = HEADER_ICONS[item.kind];
  const href = resolveHeaderItemHref({ url });

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      onSave({ text: text.trim(), url: url.trim() });
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="space-y-2 rounded-md border border-zinc-300 bg-white p-2.5 dark:border-zinc-700 dark:bg-zinc-950">
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Icon className="size-3.5 shrink-0" />
        <span className="flex-1">{label}</span>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onToggleShown}
          aria-label={item.shown ? 'Leave off the page' : 'Put back on the page'}
          className="text-muted-foreground"
        >
          {item.shown ? <Eye /> : <EyeOff />}
        </Button>
      </div>
      <div className="grid gap-1">
        <div className="flex h-5 items-center justify-between">
          <label htmlFor={`${fieldId}-text`} className="text-xs text-zinc-500">
            Shows as
          </label>
          {text && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setText('')}
              title="Prints nothing, but keeps the link"
              className="h-5 text-muted-foreground"
            >
              Clear
            </Button>
          )}
        </div>
        {/* A header item is often a whole clause, so the field grows instead of scrolling;
            it is one line on the page, so Enter saves rather than breaking it. */}
        <Textarea
          id={`${fieldId}-text`}
          value={text}
          rows={1}
          autoFocus={focus === 'text'}
          placeholder={placeholder}
          onChange={(event) => setText(event.target.value.replace(/\n/g, ' '))}
          onKeyDown={handleKeyDown}
          className="min-h-8 resize-none px-2 py-1.5 text-sm"
        />
      </div>
      <div className="grid gap-1">
        <label htmlFor={`${fieldId}-url`} className="text-xs leading-5 text-zinc-500">
          Links to
        </label>
        <Input
          id={`${fieldId}-url`}
          value={url}
          autoFocus={focus === 'url'}
          placeholder="Optional"
          onChange={(event) => setUrl(event.target.value)}
          onKeyDown={handleKeyDown}
          className="h-8 px-2 font-mono text-xs"
        />
      </div>
      {/* Worth saying only when the file gets something other than what was typed with
          https:// in front: a mail or phone link. */}
      {/^(?:mailto|tel):/i.test(href) && (
        <p
          className="truncate font-mono text-xs text-zinc-500"
          title="How the link is written into exported files"
        >
          {href}
        </p>
      )}
      <div className="flex items-center justify-end gap-1">
        <Button variant="ghost" size="xs" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="outline"
          size="xs"
          onClick={() => onSave({ text: text.trim(), url: url.trim() })}
        >
          Done
        </Button>
      </div>
    </div>
  );
}
