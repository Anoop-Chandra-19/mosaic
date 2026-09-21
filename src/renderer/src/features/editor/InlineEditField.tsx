import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useInlineEdit } from '@/lib/hooks/useInlineEdit';
import { EDITOR_INPUT_CLASS } from './editorInputStyles';

interface InlineEditFieldProps {
  value: string;
  onSave: (next: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  as?: 'span' | 'div' | 'h3';
  /** Open for editing when first shown, with the text selected so typing replaces it. */
  openAtStart?: boolean;
  /** Called when editing ends, saved or not. */
  onClose?: () => void;
  /** The input's accessible name. */
  label?: string;
}

/**
 * Text that turns into a field when clicked — the design's `.inline-edit`: a soft ink that
 * brightens on a hover fill, bleeding past its box so the text stays aligned with its row.
 */
export function InlineEditField({
  value,
  onSave,
  placeholder = 'Click to edit...',
  className,
  inputClassName,
  as: Tag = 'span',
  openAtStart = false,
  onClose,
  label,
}: InlineEditFieldProps) {
  const { editing, draft, setDraft, startEditing, handleBlur, handleKeyDown } = useInlineEdit(
    value,
    onSave,
    openAtStart,
    onClose
  );

  if (editing) {
    return (
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onFocus={openAtStart ? (e) => e.target.select() : undefined}
        autoFocus
        placeholder={placeholder}
        aria-label={label}
        className={cn(
          EDITOR_INPUT_CLASS,
          'h-[1.625rem] min-w-0 flex-1 px-1.5 py-0 text-[0.8875rem]',
          inputClassName
        )}
      />
    );
  }

  return (
    <Tag
      onClick={startEditing}
      className={cn(
        '-mx-1.5 min-w-0 flex-1 cursor-text rounded-[0.3125rem] px-1.5 py-[0.1875rem] text-[0.8875rem] leading-[1.45] text-pretty wrap-anywhere text-ink-soft hover:bg-line hover:text-foreground',
        className
      )}
    >
      {value || <span className="text-ink-faint">{placeholder}</span>}
    </Tag>
  );
}
