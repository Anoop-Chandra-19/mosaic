import { useId, useState, type KeyboardEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { resolveHeaderItemHref, getHeaderKindInfo } from '@shared/resume/resumeHeader';
import type { HeaderItem } from '@shared/types/resume';
import { EDITOR_INPUT_CLASS } from '../editorInputStyles';
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

const FIELD_LABEL =
  'w-[3.75rem] shrink-0 text-[0.625rem] tracking-[0.05em] whitespace-nowrap text-ink-faint uppercase';

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
  const save = () => onSave({ text: text.trim(), url: url.trim() });

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      save();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
    }
  };

  return (
    // It replaces the row in place, so it says which item it is: the row's own text is in
    // a field by now, and the kind is the only handle left.
    <div className="-mx-[0.5625rem] mt-1 mb-2 rounded-md border border-line-heavy bg-pane-sunken px-2.5 py-2">
      <div
        className={cn(
          'mb-[0.4375rem] flex items-center gap-[0.4375rem] text-[0.625rem] tracking-[0.07em] uppercase',
          item.shown ? 'text-ink-faint' : 'text-ink-muted'
        )}
      >
        <Icon className="size-3 shrink-0" />
        <span className="flex-1">{label}</span>
        <AppButton
          variant="ghost"
          size="xs"
          shape="square"
          onClick={onToggleShown}
          aria-label={item.shown ? 'Leave off the page' : 'Put back on the page'}
          title={
            item.shown
              ? 'On the page. Click to keep it but leave it off.'
              : 'Left off the page. Click to put it back.'
          }
        >
          {item.shown ? <Eye /> : <EyeOff />}
        </AppButton>
      </div>
      <div className="mb-1.5 flex items-start gap-2">
        <label htmlFor={`${fieldId}-text`} className={cn(FIELD_LABEL, 'mt-[0.4375rem]')}>
          Shows as
        </label>
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
          className={cn(
            EDITOR_INPUT_CLASS,
            'min-h-7 min-w-0 flex-1 resize-none px-[0.4375rem] py-[0.3125rem] text-[0.825rem] leading-[1.45] wrap-anywhere md:text-[0.825rem]'
          )}
        />
      </div>
      <div className="mb-1.5 flex items-center gap-2">
        <label htmlFor={`${fieldId}-url`} className={FIELD_LABEL}>
          Links to
        </label>
        <Input
          id={`${fieldId}-url`}
          value={url}
          autoFocus={focus === 'url'}
          placeholder="Optional"
          onChange={(event) => setUrl(event.target.value)}
          onKeyDown={handleKeyDown}
          className={cn(
            EDITOR_INPUT_CLASS,
            'h-7 min-w-0 flex-1 px-2 font-mono text-[0.7188rem] md:text-[0.7188rem]'
          )}
        />
      </div>
      <div className="mt-0.5 flex items-center gap-[0.3125rem]">
        {/* Worth saying only when the file gets something other than what was typed with
            https:// in front: a mail or phone link. */}
        <span
          className="min-w-0 flex-1 truncate font-mono text-[0.65625rem] text-ink-faint"
          title="How the link is written into exported files. The field keeps what you typed."
        >
          {/^(?:mailto|tel):/i.test(href) ? href : ''}
        </span>
        {text && (
          <AppButton
            variant="ghost"
            size="xs"
            onClick={() => setText('')}
            title="Keeps the link, prints nothing"
          >
            Clear text
          </AppButton>
        )}
        <AppButton variant="ghost" size="xs" onClick={onCancel}>
          Cancel
        </AppButton>
        <AppButton variant="outline" size="xs" onClick={save}>
          Done
        </AppButton>
      </div>
    </div>
  );
}
