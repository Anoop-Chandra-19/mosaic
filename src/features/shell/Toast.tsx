import { AlertTriangle, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
          className="pointer-events-auto flex max-w-full items-center gap-2.5 rounded-full border border-zinc-300 bg-white py-2 pr-2 pl-3.5 text-sm text-zinc-800 shadow-2xl duration-200 animate-in fade-in-0 slide-in-from-bottom-1 motion-reduce:animate-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
        >
          {toast.tone === 'success' ? (
            <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertTriangle className="size-3.5 shrink-0 text-red-600 dark:text-red-400" />
          )}
          <span className="min-w-0">{toast.message}</span>
          {toast.action && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 shrink-0 rounded-full px-2.5 font-semibold text-amber-700 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300"
              onClick={() => {
                dismiss();
                toast.action?.run();
              }}
            >
              {toast.action.label}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-6 shrink-0 rounded-full"
            onClick={dismiss}
            aria-label="Dismiss"
          >
            <X className="size-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
