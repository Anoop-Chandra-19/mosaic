import type { ReactNode } from 'react';
import { X, type LucideIcon } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { AppDialogDescription, AppDialogTitle } from '@/components/AppDialog';
import { Text } from '@/components/Text';
import { cn } from '@/lib/utils';

/*
 * The chrome the design gives its dialogs (`.modal`'s `.mh` and `.mf`): a titled bar with a
 * close button, a body, and a footer bar of actions. Use inside an `AppDialogContent` with
 * `showCloseButton={false}` and no padding.
 */

/** A dialog that deletes says so in its icon. */
const ICON_TONE = { neutral: 'text-ink-muted', danger: 'text-del' } as const;

export function DialogFrameHeader({
  icon: Icon,
  tone = 'neutral',
  title,
  description,
  closeLabel,
  onClose,
}: {
  icon: LucideIcon;
  tone?: keyof typeof ICON_TONE;
  title: ReactNode;
  /**
   * Read out with the title by screen readers, for a dialog whose body has no single line
   * that says what it is for. Otherwise the body shows an `AppDialogDescription` itself.
   */
  description?: string;
  closeLabel: string;
  onClose: () => void;
}) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-line px-3.5 py-[0.8125rem]">
      <AppDialogTitle className="flex min-w-0 items-center gap-2.25">
        <Icon className={cn('size-[0.9375rem] shrink-0', ICON_TONE[tone])} />
        {title}
      </AppDialogTitle>
      {description && (
        <AppDialogDescription className="sr-only">{description}</AppDialogDescription>
      )}
      <AppButton variant="ghost" size="sm" shape="square" onClick={onClose} aria-label={closeLabel}>
        <X className="size-4" />
      </AppButton>
    </header>
  );
}

export function DialogFrameBody({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn('flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3.5', className)}
    >
      {children}
    </div>
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
      {note && (
        <Text as="p" variant="secondary" className="mr-auto">
          {note}
        </Text>
      )}
      {children}
    </footer>
  );
}
