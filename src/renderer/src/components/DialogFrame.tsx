import type { ReactNode } from 'react';
import { X, type LucideIcon } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { AppDialogDescription, AppDialogTitle } from '@/components/AppDialog';
import { cn } from '@/lib/utils';

/*
 * The chrome the design gives its larger dialogs (Settings, Export, Import): a titled bar
 * with a close button, a body, and a footer bar of actions. Use inside an `AppDialogContent`
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
    <header className="flex items-center justify-between gap-3 border-b border-line px-3.5 py-[0.8125rem]">
      <AppDialogTitle className="flex min-w-0 items-center gap-2.25">
        <Icon className="size-[0.9375rem] shrink-0 text-ink-muted" />
        {title}
      </AppDialogTitle>
      <AppDialogDescription className="sr-only">{description}</AppDialogDescription>
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
        'flex flex-wrap items-center justify-end gap-2 border-t border-line px-4 py-3',
        className
      )}
    >
      {note && <p className="mr-auto text-support text-ink-muted">{note}</p>}
      {children}
    </footer>
  );
}
