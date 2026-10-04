import { AppTextarea } from '@/components/AppTextarea';
import { AppTooltip } from '@/components/AppTooltip';
import { textVariantClasses } from '@/components/textVariants';
import { cn } from '@/lib/utils';
import { useInlineEdit } from '@/lib/hooks/useInlineEdit';
import type { LiveEdit } from '@/stores/liveEditStore';
import { useLiveEdit } from './useLiveEdit';

/**
 * The design's three sizes of editable text: a name or title, a line of body text, and the
 * meta under an entry's title (`.emeta`), which sits tighter.
 */
const VARIANTS = {
  editor: { role: 'editor', padding: '-mx-1.5 px-1.5 py-0.75' },
  body: { role: 'body', padding: '-mx-1.5 px-1.5 py-0.75' },
  secondary: { role: 'secondary', padding: '-mx-[0.3125rem] px-[0.3125rem] py-0.5' },
} as const;

interface InlineEditFieldProps {
  value: string;
  onSave: (next: string) => void;
  /** The text's role, at rest and while it is edited. */
  variant?: keyof typeof VARIANTS;
  placeholder?: string;
  /** Layout around the text, at rest. */
  className?: string;
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
 * Text that turns into a field when clicked — the design's `.inline-edit`: its role's ink,
 * brightening on a hover fill, bleeding past its box so the text stays aligned with its row.
 */
export function InlineEditField({
  value,
  onSave,
  variant = 'body',
  placeholder = 'Click to edit...',
  className,
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
  const { role, padding } = VARIANTS[variant];

  // It wraps as the text does at rest, so a long title stays readable while it is edited.
  // Enter still saves, and a line break pasted in becomes a space.
  if (editing) {
    return (
      <AppTextarea
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
          textVariantClasses(role),
          // As wide as its text, up to the row; past that it wraps.
          'min-h-0 w-auto max-w-full min-w-12 flex-none px-1.5 py-0.75 wrap-anywhere text-foreground'
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
          textVariantClasses(role),
          padding,
          'min-w-0 flex-1 cursor-text rounded-[0.3125rem] text-pretty wrap-anywhere hover:bg-line hover:text-foreground',
          className
        )}
      >
        {value || <span className="text-ink-faint">{placeholder}</span>}
      </Tag>
    </AppTooltip>
  );
}
