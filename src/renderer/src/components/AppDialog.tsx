import type { ComponentProps } from 'react';
import { X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { AppButton } from '@/components/AppButton';
import { cn } from '@/lib/utils';

/*
 * Mosaic's dialog, the design's `.modal` over its dimmed, blurred `.scrim`. A plain dialog is
 * padded, with a close button in its corner; the larger ones (Settings, Export, Import) pass
 * `showCloseButton={false}` and no padding, and draw `DialogFrame`'s bars instead. Built on
 * Radix directly: shadcn's dialog fixes its own overlay and draws a plain close button.
 */

export const AppDialog = Dialog.Root;

export function AppDialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: ComponentProps<typeof Dialog.Content> & { showCloseButton?: boolean }) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-scrim backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <Dialog.Content
        className={cn(
          'fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-1/2 gap-4 rounded-[0.875rem] border border-line-strong bg-background p-6 text-body text-ink-soft shadow-overlay duration-200 outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:max-w-lg',
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <Dialog.Close asChild>
            <AppButton
              variant="ghost"
              size="sm"
              shape="square"
              aria-label="Close"
              className="absolute top-3 right-3"
            >
              <X className="size-4" />
            </AppButton>
          </Dialog.Close>
        )}
      </Dialog.Content>
    </Dialog.Portal>
  );
}

export function AppDialogHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1.5', className)} {...props} />;
}

export function AppDialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  );
}

export function AppDialogTitle({ className, ...props }: ComponentProps<typeof Dialog.Title>) {
  return <Dialog.Title className={cn('text-title text-foreground', className)} {...props} />;
}

export function AppDialogDescription({
  className,
  ...props
}: ComponentProps<typeof Dialog.Description>) {
  return <Dialog.Description className={cn('text-body text-ink-muted', className)} {...props} />;
}
