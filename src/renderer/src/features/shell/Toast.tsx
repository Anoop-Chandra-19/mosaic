import { AlertTriangle, Check, X } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { useOverlayStore } from '@/stores/overlayStore';

/** A short confirmation, or a failure, at the foot of the workspace. It clears itself. */
export function Toast() {
  const toast = useOverlayStore((s) => s.toast);
  const dismiss = useOverlayStore((s) => s.dismissToast);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 bottom-11 z-50 flex justify-center px-4"
    >
      {toast && (
        <div
          key={toast.id}
          className="pointer-events-auto flex max-w-full items-center gap-2.5 rounded-full border border-line-strong bg-pane-raised py-2 pr-2 pl-3.5 text-body text-foreground shadow-overlay duration-200 animate-in fade-in-0 slide-in-from-bottom-1 motion-reduce:animate-none"
        >
          {toast.tone === 'success' ? (
            <Check className="size-3.5 shrink-0 text-add" />
          ) : (
            <AlertTriangle className="size-3.5 shrink-0 text-del" />
          )}
          <span className="min-w-0">{toast.message}</span>
          {toast.action && (
            <AppButton
              variant="ghost"
              size="sm"
              className="h-6 shrink-0 rounded-full px-2.5 font-strong text-amber hover:text-amber"
              onClick={() => {
                dismiss();
                toast.action?.run();
              }}
            >
              {toast.action.label}
            </AppButton>
          )}
          <AppButton
            variant="ghost"
            size="sm"
            shape="square"
            className="size-6 shrink-0 rounded-full"
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
