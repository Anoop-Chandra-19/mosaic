import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useInlineEdit } from '@/lib/hooks/useInlineEdit';

interface InlineEditFieldProps {
  value: string;
  onSave: (next: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  as?: 'span' | 'div' | 'h3';
}

export function InlineEditField({
  value,
  onSave,
  placeholder = 'Click to edit...',
  className,
  inputClassName,
  as: Tag = 'span',
}: InlineEditFieldProps) {
  const { editing, draft, setDraft, startEditing, handleBlur, handleKeyDown } = useInlineEdit(
    value,
    onSave
  );

  if (editing) {
    return (
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        autoFocus
        placeholder={placeholder}
        className={cn('h-7 min-w-0 flex-1 px-2 py-0.5 text-sm leading-6', inputClassName)}
      />
    );
  }

  return (
    <Tag onClick={startEditing} className={cn('min-w-0 flex-1 cursor-pointer', className)}>
      {value || <span className="text-muted-foreground">{placeholder}</span>}
    </Tag>
  );
}
