import { Pencil } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { Text } from '@/components/Text';
import { cn } from '@/lib/utils';
import { ShortcutKeys } from './ShortcutKeys';

interface ShortcutRowViewProps {
  label: string;
  combos: string[];
  /** The search, picked out in the label. */
  query?: string;
  /** The group, after the label, in a search across groups. */
  tag?: string;
  isCustom: boolean;
  /** Fixed keys are listed with no pencil. */
  onEdit?: () => void;
  /** Marks the row, so focus can come back to it after its keys change. */
  rowId: string;
}

/** A label with the searched-for part picked out. */
function MarkedLabel({ label, query }: { label: string; query: string }) {
  const at = query ? label.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (at < 0) return label;
  return (
    <>
      {label.slice(0, at)}
      <em className="rounded-xs bg-amber-soft px-px text-amber not-italic">
        {label.slice(at, at + query.length)}
      </em>
      {label.slice(at + query.length)}
    </>
  );
}

/** One action and its keys; the pencil, or a double-click, changes them. */
export function ShortcutRowView({
  label,
  combos,
  query = '',
  tag,
  isCustom,
  onEdit,
  rowId,
}: ShortcutRowViewProps) {
  return (
    <div
      data-shortcut-row={rowId}
      onDoubleClick={onEdit}
      className={cn(
        'group/shortcut flex h-7 items-center gap-2.5 rounded-sm px-1.75 text-body hover:bg-line hover:text-foreground dense:h-6.25',
        combos.length === 0 ? 'text-ink-faint' : 'text-ink-soft'
      )}
    >
      <span className="min-w-0 flex-1 truncate">
        <MarkedLabel label={label} query={query} />
      </span>
      {tag && <ShortcutTag>{tag}</ShortcutTag>}
      {isCustom && combos.length > 0 && (
        <ShortcutTag className="border-amber-line text-amber">custom</ShortcutTag>
      )}
      {onEdit && (
        <AppButton
          variant="ghost"
          size="2xs"
          shape="square"
          aria-label={`Change the keys for ${label}`}
          title="Change this shortcut"
          onClick={onEdit}
          className="size-4.5 text-ink-faint opacity-0 group-hover/shortcut:opacity-100 focus-visible:opacity-100"
        >
          <Pencil className="size-3" />
        </AppButton>
      )}
      <ShortcutKeys combos={combos} />
    </div>
  );
}

function ShortcutTag({ className, children }: { className?: string; children: string }) {
  return (
    <Text
      variant="meta"
      className={cn('shrink-0 rounded-[0.25rem] border border-line px-1.25 py-px', className)}
    >
      {children}
    </Text>
  );
}
