import { Wrench } from 'lucide-react';
import { AppButton } from '@/components/ui-kit';
import { formatShortcutLabel } from '@/lib/keyboardShortcuts';
import { useTargetStore } from '@/stores/targetStore';

/**
 * The wrench, in the top bar's empty space between its two groups. It takes no room: the
 * space it sits in is the space a release build leaves empty (its negative margin cancels
 * the bar's gap), so every other item sits exactly where it does in release. It hides when
 * that space is too narrow to hold it.
 */
export function DevToolsWrench() {
  const requestTarget = useTargetStore((s) => s.requestTarget);
  return (
    <div className="@container -ml-3 flex min-w-0 flex-1 justify-end">
      <AppButton
        variant="ghost"
        size="sm"
        shape="square"
        onClick={() => requestTarget('devTools')}
        aria-label="Developer tools"
        title={`Developer tools  ${formatShortcutLabel('Mod+Shift+D')}`}
        className="mr-0.5 hidden @min-[3.75rem]:inline-flex"
      >
        <Wrench className="h-4 w-4" />
      </AppButton>
    </div>
  );
}
