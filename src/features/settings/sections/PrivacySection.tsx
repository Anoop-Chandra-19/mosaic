import { useMemo, useState } from 'react';
import { ShieldCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getSecretsClient } from '@/lib/secrets';
import { useAIStore } from '@/stores/aiStore';
import { attempt, showToast } from '@/stores/overlayStore';
import { useTemplateStore } from '@/stores/templateStore';
import { useUIStore } from '@/stores/uiStore';
import { SettingRow, SettingsNote } from '../SettingRow';

export function PrivacySection() {
  const secrets = useMemo(() => getSecretsClient(), []);
  const resetUIState = useUIStore((s) => s.resetUIState);
  const resetAIConfig = useAIStore((s) => s.resetAIConfig);
  const deleteAllTemplates = useTemplateStore((s) => s.deleteAllTemplates);
  const [confirmingErase, setConfirmingErase] = useState(false);

  const forgetKeys = async () => {
    if (await attempt(secrets.clearAllApiKeys(), 'Could not remove the keys')) {
      showToast('API keys removed');
    }
  };

  const erase = async () => {
    setConfirmingErase(false);
    const erased = await attempt(
      Promise.all([secrets.clearAllApiKeys(), deleteAllTemplates()]),
      'Could not erase everything'
    );
    if (!erased) return;
    resetUIState();
    resetAIConfig();
    showToast('Erased local data');
  };

  return (
    <>
      <SettingsNote icon={ShieldCheck} tone="safe" className="mb-4">
        Local storage on this machine is the only copy of your resume. Network access happens only
        when you ask the AI assistant for something.
      </SettingsNote>

      <SettingRow
        label="Forget stored API keys"
        description="Removes every saved key. AI stays enabled; you’ll be asked for a key next time."
      >
        <Button variant="outline" size="sm" onClick={() => void forgetKeys()}>
          Forget keys
        </Button>
      </SettingRow>

      <SettingRow
        label="Reset interface"
        description="Panel sizes, theme, and zoom go back to defaults. Content untouched."
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            resetUIState();
            showToast('Interface reset');
          }}
        >
          Reset
        </Button>
      </SettingRow>

      <SettingRow
        label="Delete everything"
        description="Templates, versions, settings, keys. Back up first — this cannot be undone."
      >
        <Button
          variant="outline"
          size="sm"
          className="border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950 dark:hover:text-red-300"
          onClick={() => setConfirmingErase(true)}
        >
          Erase local data
        </Button>
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
              machine. There is no other copy unless you exported one.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmingErase(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void erase()}>
              <Trash2 />
              Erase everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
