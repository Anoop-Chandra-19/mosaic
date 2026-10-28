import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { AppButton, Note } from '@/components/ui-kit';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { attempt, showToast } from '@/stores/toastStore';
import { useUiStore } from '@/stores/uiStore';
import type { KeyedProvider } from '@shared/types/secrets';
import { SettingRow } from '../SettingRow';
import { useSecretsStatus } from '../useSecretsStatus';
import { UnconfirmedKeysDialog } from './UnconfirmedKeysDialog';

/** Start over from the empty database, as a fresh install does. */
const startOver = () => window.location.reload();

export function PrivacySection() {
  const { status, show } = useSecretsStatus();
  const resetInterface = useUiStore((s) => s.resetInterface);
  const [confirmingErase, setConfirmingErase] = useState(false);
  const [erasing, setErasing] = useState(false);
  // Keys the keychain wouldn't confirm gone, and whether Erase is waiting to start over.
  const [unconfirmed, setUnconfirmed] = useState<{
    providers: KeyedProvider[];
    isErased: boolean;
  } | null>(null);
  const hasKeys = Object.keys(status?.saved ?? {}).length > 0;

  const forgetKeys = async () => {
    const forgetting = window.mosaic.secrets.forgetAll();
    if (!(await attempt(forgetting, 'Could not forget the keys'))) return;
    const result = await forgetting;
    show(result.status);
    if (result.unconfirmed.length > 0) {
      setUnconfirmed({ providers: result.unconfirmed, isErased: false });
    } else {
      showToast('API keys forgotten');
    }
  };

  const erase = async () => {
    setErasing(true);
    // Main forgets the keys first, then deletes the database.
    const erasure = window.mosaic.app.eraseAll();
    if (!(await attempt(erasure, 'Could not erase everything'))) {
      setErasing(false);
      return;
    }
    const { unconfirmedKeys } = await erasure;
    if (unconfirmedKeys.length === 0) return startOver();
    setConfirmingErase(false);
    setUnconfirmed({ providers: unconfirmedKeys, isErased: true });
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

      <UnconfirmedKeysDialog
        providers={unconfirmed?.providers ?? []}
        closeLabel={unconfirmed?.isErased ? 'Start over' : 'Done'}
        onClose={unconfirmed?.isErased ? startOver : () => setUnconfirmed(null)}
      />
    </>
  );
}
