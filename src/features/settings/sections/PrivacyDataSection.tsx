import { useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { DangerActionRow } from '@/features/settings/DangerActionRow';
import { getSecretsClient } from '@/lib/secrets';
import { useResumeStore } from '@/stores/resumeStore';
import { useTemplateStore } from '@/stores/templateStore';
import { useUIStore } from '@/stores/uiStore';
import { useAIStore } from '@/stores/aiStore';

export function PrivacyDataSection() {
  const resetResume = useResumeStore((s) => s.resetResume);
  const resetTemplates = useTemplateStore((s) => s.resetTemplates);
  const resetUIState = useUIStore((s) => s.resetUIState);
  const resetAIConfig = useAIStore((s) => s.resetAIConfig);
  const secrets = useMemo(() => getSecretsClient(), []);
  const [feedback, setFeedback] = useState<string | null>(null);

  const clearApiKeys = async () => {
    await secrets.clearAllApiKeys();
    setFeedback('All API keys were cleared.');
  };

  const clearResumeData = async () => {
    resetResume();
    setFeedback('Resume content was reset to defaults.');
  };

  const clearUIPreferences = async () => {
    resetUIState();
    setFeedback('UI preferences were restored to defaults.');
  };

  const clearTemplates = () => {
    resetTemplates();
    setFeedback('All templates and version history were cleared.');
  };

  const clearEverything = async () => {
    await secrets.clearAllApiKeys();
    resetResume();
    resetTemplates();
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
            title="Reset Resume Content"
            description="Restore contact, sections, entries, and bullets to seed defaults."
            actionLabel="Reset Resume"
            confirmLabel="Reset Resume"
            onConfirm={clearResumeData}
            severity="caution"
          />

          <DangerActionRow
            title="Reset Templates"
            description="Delete all saved templates and their version history."
            actionLabel="Reset Templates"
            confirmLabel="Reset Templates"
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
            description="Clear API keys and reset AI config, resume content, and UI preferences."
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
