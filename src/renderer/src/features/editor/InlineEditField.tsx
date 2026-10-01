import { AppTooltip } from '@/components/AppTooltip';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useInlineEdit } from '@/lib/hooks/useInlineEdit';
import type { LiveEdit } from '@/stores/liveEditStore';
import { EDITOR_INPUT_CLASS } from './editorClasses';
import { useLiveEdit } from './useLiveEdit';

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
  /** How the preview shows the text while it is typed. */
  livePreview?: (text: string) => LiveEdit;
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
  livePreview,
}: InlineEditFieldProps) {
  const { editing, draft, setDraft, startEditing, handleBlur, handleKeyDown } = useInlineEdit(
    value,
    onSave,
    openAtStart,
    onClose
  );
  useLiveEdit(editing ? draft : null, livePreview);

  // It wraps as the text does at rest, so a long title stays readable while it is edited.
  // Enter still saves, and a line break pasted in becomes a space.
  if (editing) {
    return (
      <Textarea
        value={draft}
        rows={1}
        onChange={(e) => setDraft(e.target.value.replace(/\s*\n\s*/g, ' '))}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onFocus={openAtStart ? (e) => e.target.select() : undefined}
        autoFocus
        placeholder={placeholder}
        aria-label={label}
        className={cn(
          EDITOR_INPUT_CLASS,
          // As wide as its text, up to the row; past that it wraps.
          'min-h-[1.625rem] w-auto max-w-full min-w-12 flex-none resize-none px-1.5 py-[0.1875rem] text-[0.8875rem] leading-[1.45] wrap-anywhere',
          inputClassName
        )}
      />
    );
  }

  // Empty, the placeholder already says it.
  return (
    <AppTooltip content={value ? 'Click to edit' : undefined}>
      <Tag
        onClick={startEditing}
        className={cn(
          '-mx-1.5 min-w-0 flex-1 cursor-text rounded-[0.3125rem] px-1.5 py-[0.1875rem] text-[0.8875rem] leading-[1.45] text-pretty wrap-anywhere text-ink-soft hover:bg-line hover:text-foreground',
          className
        )}
      >
        {value || <span className="text-ink-faint">{placeholder}</span>}
      </Tag>
    </AppTooltip>
  );
}
