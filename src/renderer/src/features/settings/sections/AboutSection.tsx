import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { SettingRow } from '../SettingRow';
import { KeyboardShortcutList } from './KeyboardShortcutList';

const SOURCE_URL = 'https://github.com/Anoop-Chandra-19/mosaic';

export function AboutSection() {
  const [shouldShowShortcuts, setShouldShowShortcuts] = useState(false);

  return (
    <>
      <div className="mt-1 mb-2 flex items-center gap-3">
        <div className="grid size-9.5 place-items-center rounded-lg bg-amber-500 text-lg font-bold text-white">
          M
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Mosaic {__APP_VERSION__}
          </p>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Everything stays on this machine. No account, no server.
          </p>
        </div>
      </div>
      <SettingRow
        label="Source"
        description="Open source. Fork it, audit it, or run it from source."
      >
        <AppButton variant="outline" size="sm" asChild>
          {/* Opens in the system browser: the app never navigates away from itself. */}
          <a href={SOURCE_URL} target="_blank" rel="noreferrer">
            <ExternalLink />
            GitHub
          </a>
        </AppButton>
      </SettingRow>
      <SettingRow label="Keyboard shortcuts">
        <AppButton
          variant="outline"
          size="sm"
          aria-expanded={shouldShowShortcuts}
          onClick={() => setShouldShowShortcuts(!shouldShowShortcuts)}
        >
          {shouldShowShortcuts ? 'Hide' : 'View all'}
        </AppButton>
      </SettingRow>
      {shouldShowShortcuts && <KeyboardShortcutList />}
    </>
  );
}
