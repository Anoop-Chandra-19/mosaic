import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { attempt, showToast } from '@/stores/overlayStore';
import { useUiStore } from '@/stores/uiStore';
import { Note } from '@/components/Note';
import { SettingRow } from '../SettingRow';
import { useSecretsStatus } from '../useSecretsStatus';

export function PrivacySection() {
  const { status, apply } = useSecretsStatus();
  const resetInterface = useUiStore((s) => s.resetInterface);
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
      <Note icon={ShieldCheck} tone="safe" className="mb-4">
        Local storage on your computer is the only copy of your resume. Network access happens only
        when you ask the AI assistant for something.
      </Note>

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
        description="Panel sizes, theme, and zoom go back to defaults. Content, paper size, and General settings stay."
      >
        <AppButton
          variant="outline"
          size="sm"
          onClick={() => {
            resetInterface();
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
        <AppButton variant="destructive" size="sm" onClick={() => setConfirmingErase(true)}>
          Erase local data
        </AppButton>
      </SettingRow>

      <ConfirmDeleteDialog
        open={confirmingErase}
        onOpenChange={setConfirmingErase}
        title="Erase local data"
        description="Every template, its history, your settings, and your API keys are deleted from this computer, and Mosaic starts over as if just installed. There is no other copy unless you made a backup."
        confirmLabel="Erase everything"
        isDeleting={erasing}
        shouldCloseOnConfirm={false}
        onConfirm={() => void erase()}
      />
    </>
  );
}
