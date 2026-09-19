import type { ReactNode } from 'react';
import { X, type LucideIcon } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/*
 * The chrome the design gives its larger dialogs (Settings, Export, Import): a titled bar
 * with a close button, a body, and a footer bar of actions. Use inside a `DialogContent`
 * with `showCloseButton={false}` and no padding.
 */

export function DialogFrameHeader({
  icon: Icon,
  title,
  description,
  closeLabel,
  onClose,
}: {
  icon: LucideIcon;
  title: ReactNode;
  /** Read out with the title by screen readers; the body shows the rest. */
  description: string;
  closeLabel: string;
  onClose: () => void;
}) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <DialogTitle className="flex min-w-0 items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        <Icon className="size-4 shrink-0 text-zinc-500" />
        {title}
      </DialogTitle>
      <DialogDescription className="sr-only">{description}</DialogDescription>
      <AppButton variant="ghost" size="sm" shape="square" onClick={onClose} aria-label={closeLabel}>
        <X className="size-4" />
      </AppButton>
    </header>
  );
}

export function DialogFrameFooter({
  note,
  className,
  children,
}: {
  /** A quiet line at the start of the bar. */
  note?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <footer
      className={cn(
        'flex flex-wrap items-center justify-end gap-2 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800',
        className
      )}
    >
      {note && <p className="mr-auto text-xs text-zinc-500">{note}</p>}
      {children}
    </footer>
  );
}
