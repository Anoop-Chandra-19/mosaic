import { AlertTriangle, Check, X } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { useToastStore } from '@/stores/toastStore';
import { usePresenceMotion } from '@/lib/motion/usePresenceMotion';

/** A short confirmation, or a failure, at the foot of the workspace. It clears itself. */
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
          className="pointer-events-auto flex max-w-full items-center gap-2.5 rounded-full border border-line-strong bg-pane-raised py-2.5 pr-2.75 pl-3.5 text-body text-foreground shadow-overlay"
        >
          {shownToast.tone === 'success' ? (
            <Check className="size-3.25 shrink-0 text-add" />
          ) : (
            <AlertTriangle className="size-3.25 shrink-0 text-del" />
          )}
          <span className="min-w-0">{shownToast.message}</span>
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
        </div>
      )}
    </div>
  );
}
