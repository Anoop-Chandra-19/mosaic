import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DangerActionRowProps {
  title: string;
  description: string;
  actionLabel: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void> | void;
  disabled?: boolean;
}

export function DangerActionRow({
  title,
  description,
  actionLabel,
  confirmLabel = 'Confirm',
  onConfirm,
  disabled = false,
}: DangerActionRowProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setIsRunning(true);
    setError(null);

    try {
      await onConfirm();
      setIsConfirming(false);
    } catch {
      setError('Action failed. Please try again.');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="rounded-xl border border-zinc-300 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-[44rem]">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
          {error && (
            <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-red-700 dark:text-red-400">
              <AlertTriangle className="size-3" />
              {error}
            </p>
          )}
        </div>

        <div className="shrink-0">
          {!isConfirming ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsConfirming(true)}
              disabled={disabled || isRunning}
              className="border-zinc-300 bg-background text-zinc-900 hover:bg-zinc-200 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              {actionLabel}
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setIsConfirming(false);
                  setError(null);
                }}
                disabled={isRunning}
                className={cn(
                  'text-zinc-700 hover:bg-zinc-200 hover:text-zinc-900',
                  'dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
                )}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleConfirm}
                disabled={isRunning}
              >
                {isRunning ? 'Working...' : confirmLabel}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
