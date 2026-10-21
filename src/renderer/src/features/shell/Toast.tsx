import { AlertTriangle, Check, LoaderCircle, X } from 'lucide-react';
import { AppButton, Chip, Text } from '@/components/ui-kit';
import { cn } from '@/lib/utils';
import { useToastStore, type Toast as ToastShown } from '@/stores/toastStore';
import { usePresenceMotion } from '@/lib/motion/usePresenceMotion';

/** What a toast starts with: work under way, a failure, the developer tools' tag, or a tick. */
function ToastMark({ toast }: { toast: ToastShown }) {
  if (toast.progress) {
    return <LoaderCircle className="size-3.25 shrink-0 animate-spin motion-reduce:animate-none" />;
  }
  if (toast.tone === 'error') return <AlertTriangle className="size-3.25 shrink-0 text-del" />;
  if (toast.tag) {
    return (
      <Chip size="sm" tone="info">
        {toast.tag}
      </Chip>
    );
  }
  return <Check className="size-3.25 shrink-0 text-add" />;
}

/**
 * A short confirmation, or a failure, at the foot of the workspace. It clears itself, unless
 * it is work under way, which stays until the next toast.
 */
export function Toast() {
  const toast = useToastStore((s) => s.toast);
  const dismiss = useToastStore((s) => s.dismissToast);
  const { shown: shownToast, isLeaving, ref } = usePresenceMotion(toast, toast?.id ?? null);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 bottom-11 z-50 flex justify-center px-4"
    >
      {shownToast && (
        <div
          key={shownToast.id}
          ref={ref}
          data-state={isLeaving ? 'closed' : 'open'}
          inert={isLeaving}
          aria-hidden={isLeaving || undefined}
          className={cn(
            'pointer-events-auto flex max-w-full items-center gap-2.5 border border-line-strong bg-pane-raised py-2.5 pr-2.75 pl-3.5 text-body text-foreground shadow-overlay',
            shownToast.progress ? 'rounded-[0.5625rem] pr-3.5' : 'rounded-full'
          )}
        >
          <ToastMark toast={shownToast} />
          <span className="min-w-0">
            {shownToast.message}
            {shownToast.progress && (
              <span className="text-ink-muted">: {shownToast.progress.detail}</span>
            )}
          </span>
          {shownToast.progress?.percent != null && (
            <Text variant="meta" className="min-w-7.5 text-right text-foreground">
              {shownToast.progress.percent}%
            </Text>
          )}
          {shownToast.action && (
            <AppButton
              variant="ghost"
              size="sm"
              className="h-6 shrink-0 rounded-full px-2.5 font-strong text-amber hover:text-amber"
              onClick={() => {
                dismiss();
                shownToast.action?.run();
              }}
            >
              {shownToast.action.label}
            </AppButton>
          )}
          {!shownToast.progress && (
            <AppButton
              variant="ghost"
              size="sm"
              shape="square"
              className="size-6.25 shrink-0 rounded-[0.375rem]"
              onClick={dismiss}
              aria-label="Dismiss"
            >
              <X className="size-3" />
            </AppButton>
          )}
        </div>
      )}
    </div>
  );
}
