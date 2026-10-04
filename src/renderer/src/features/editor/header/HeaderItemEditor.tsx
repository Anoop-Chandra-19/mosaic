import { useId, useState, type KeyboardEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { AppInput } from '@/components/AppInput';
import { AppTextarea } from '@/components/AppTextarea';
import { AppTooltip } from '@/components/AppTooltip';
import { Text } from '@/components/Text';
import { textVariantClasses } from '@/components/textVariants';
import { cn } from '@/lib/utils';
import { resolveHeaderItemHref, getHeaderKindInfo } from '@shared/resume/resumeHeader';
import type { HeaderItem } from '@shared/types/resume';
import { showHeaderItemText } from '../liveEdits';
import { useLiveEdit } from '../useLiveEdit';
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

/** The eye's hint while the item prints; once it is off, the button's name says enough. */
export const LEAVE_OFF_HINT = 'Leave off the page. You can put it back any time.';

const FIELD_LABEL = cn(
  textVariantClasses('tag'),
  'w-[3.75rem] shrink-0 whitespace-nowrap text-ink-faint'
);

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
  useLiveEdit(text, (typed) => showHeaderItemText(item.id, typed));
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
    <div className="-mx-[0.5625rem] mt-1 mb-2 animate-ring-in rounded-sm border border-line-heavy bg-pane-sunken px-2.5 py-2 motion-reduce:animate-none">
      <div
        className={cn(
          textVariantClasses('tag'),
          'mb-[0.4375rem] flex items-center gap-[0.4375rem]',
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
          title={item.shown ? LEAVE_OFF_HINT : undefined}
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
        <AppTextarea
          id={`${fieldId}-text`}
          value={text}
          rows={1}
          autoFocus={focus === 'text'}
          placeholder={placeholder}
          onChange={(event) => setText(event.target.value.replace(/\n/g, ' '))}
          onKeyDown={handleKeyDown}
          className="min-h-7 min-w-0 flex-1 px-[0.4375rem] py-[0.3125rem] wrap-anywhere"
        />
      </div>
      <div className="mb-1.5 flex items-center gap-2">
        <label htmlFor={`${fieldId}-url`} className={FIELD_LABEL}>
          Links to
        </label>
        <AppInput
          id={`${fieldId}-url`}
          value={url}
          autoFocus={focus === 'url'}
          placeholder="Optional"
          onChange={(event) => setUrl(event.target.value)}
          onKeyDown={handleKeyDown}
          className="h-7 flex-1 px-2"
        />
      </div>
      <div className="mt-0.5 flex items-center gap-[0.3125rem]">
        {/* Worth saying only when the file gets something other than what was typed with
            https:// in front: a mail or phone link. */}
        <AppTooltip content="The link as exported files write it. What you typed is unchanged.">
          <Text variant="meta" className="min-w-0 flex-1 truncate">
            {/^(?:mailto|tel):/i.test(href) ? href : ''}
          </Text>
        </AppTooltip>
        {text && (
          <AppButton
            variant="ghost"
            size="xs"
            onClick={() => setText('')}
            title="Clear the text and keep the link"
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
