import { useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { DangerActionRow } from '@/features/settings/DangerActionRow';
import { getSecretsClient } from '@/lib/secrets';
import { attempt } from '@/stores/overlayStore';
import { useTemplateStore } from '@/stores/templateStore';
import { useUIStore } from '@/stores/uiStore';
import { useAIStore } from '@/stores/aiStore';

export function PrivacyDataSection() {
  const deleteAllTemplates = useTemplateStore((s) => s.deleteAllTemplates);
  const resetUIState = useUIStore((s) => s.resetUIState);
  const resetAIConfig = useAIStore((s) => s.resetAIConfig);
  const secrets = useMemo(() => getSecretsClient(), []);
  const [feedback, setFeedback] = useState<string | null>(null);

  const clearApiKeys = async () => {
    await secrets.clearAllApiKeys();
    setFeedback('All API keys were cleared.');
  };

  const clearUIPreferences = async () => {
    resetUIState();
    setFeedback('UI preferences were restored to defaults.');
  };

  const clearTemplates = async () => {
    if (await attempt(deleteAllTemplates(), 'Could not delete the templates')) {
      setFeedback('All templates and version history were deleted.');
    }
  };

  const clearEverything = async () => {
    await secrets.clearAllApiKeys();
    if (!(await attempt(deleteAllTemplates(), 'Could not delete the templates'))) return;
    resetUIState();
    resetAIConfig();
    setFeedback('Local app state was reset.');
  };

  return (
    <section className="space-y-4">
      <article className="rounded-xl border border-zinc-300 bg-zinc-100 p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Local Data Controls
        </h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          These actions affect only this device and current local storage.
        </p>

        <div className="mt-3 space-y-3">
          <DangerActionRow
            title="Clear API Keys"
            description="Remove API keys from active key storage so AI features require re-entry."
            actionLabel="Clear Keys"
            confirmLabel="Clear Keys Now"
            onConfirm={clearApiKeys}
            severity="safe"
          />

          <DangerActionRow
            title="Delete All Templates"
            description="Delete every template, its draft, and its version history."
            actionLabel="Delete Templates"
            confirmLabel="Delete Templates"
            onConfirm={clearTemplates}
            severity="caution"
          />

          <DangerActionRow
            title="Reset UI Preferences"
            description="Restore theme, preview defaults, sidebar state, and panel behavior."
            actionLabel="Reset UI"
            confirmLabel="Reset UI"
            onConfirm={clearUIPreferences}
            severity="caution"
          />

          <DangerActionRow
            title="Clear All Local Data"
            description="Clear API keys, delete every template, and reset AI config and UI preferences."
            actionLabel="Clear Everything"
            confirmLabel="Confirm Full Reset"
            onConfirm={clearEverything}
            severity="danger"
          />
        </div>

        {feedback && (
          <p className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">
            <ShieldCheck className="size-3" />
            {feedback}
          </p>
        )}
      </article>
    </section>
  );
}
