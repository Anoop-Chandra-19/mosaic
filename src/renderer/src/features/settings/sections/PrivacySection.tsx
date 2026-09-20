import { useState } from 'react';
import { ShieldCheck, Trash2 } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { attempt, showToast } from '@/stores/overlayStore';
import { useUiStore } from '@/stores/uiStore';
import { SettingRow, SettingsNote } from '../SettingRow';
import { useSecretsStatus } from '../useSecretsStatus';

export function PrivacySection() {
  const { status, apply } = useSecretsStatus();
  const resetUiState = useUiStore((s) => s.resetUiState);
  const [confirmingErase, setConfirmingErase] = useState(false);
  const [erasing, setErasing] = useState(false);
  const hasKeys = Object.keys(status?.saved ?? {}).length > 0;

  const forgetKeys = async () => {
    if (await attempt(apply(window.mosaic.secrets.forgetAll()), 'Could not forget the keys')) {
      showToast('API keys forgotten');
    }
  };

  const erase = async () => {
    setErasing(true);
    // Main forgets the keys first, then deletes the database.
    const erased = await attempt(window.mosaic.app.eraseAll(), 'Could not erase everything');
    // Start over from the empty database, as a fresh install does.
    if (erased) window.location.reload();
    else setErasing(false);
  };

  return (
    <>
      <SettingsNote icon={ShieldCheck} tone="safe" className="mb-4">
        Local storage on this machine is the only copy of your resume. Network access happens only
        when you ask the AI assistant for something.
      </SettingsNote>

      <SettingRow
        label="Forget stored API keys"
        description="Removes every saved key, from the keychain and from memory. AI stays enabled; you’ll be asked for a key next time."
      >
        <AppButton
          variant="outline"
          size="sm"
          disabled={!hasKeys}
          onClick={() => void forgetKeys()}
        >
          Forget keys
        </AppButton>
      </SettingRow>

      <SettingRow
        label="Reset interface"
        description="Panel sizes, theme, and zoom go back to defaults. Content untouched."
      >
        <AppButton
          variant="outline"
          size="sm"
          onClick={() => {
            resetUiState();
            showToast('Interface reset');
          }}
        >
          Reset
        </AppButton>
      </SettingRow>

      <SettingRow
        label="Delete everything"
        description="Templates, versions, settings, keys. Back up first: this cannot be undone."
      >
        <AppButton
          variant="outline"
          size="sm"
          className="border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950 dark:hover:text-red-300"
          onClick={() => setConfirmingErase(true)}
        >
          Erase local data
        </AppButton>
      </SettingRow>

      <Dialog open={confirmingErase} onOpenChange={setConfirmingErase}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="size-4 text-red-600 dark:text-red-400" />
              Erase local data
            </DialogTitle>
            <DialogDescription>
              Every template, its history, your settings, and your API keys are deleted from this
              machine, and Mosaic starts over as if just installed. There is no other copy unless
              you made a backup.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <AppButton variant="ghost" onClick={() => setConfirmingErase(false)}>
              Cancel
            </AppButton>
            <AppButton variant="destructive" disabled={erasing} onClick={() => void erase()}>
              <Trash2 />
              Erase everything
            </AppButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
