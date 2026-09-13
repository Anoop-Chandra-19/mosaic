import { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { getSecretsClient } from '@/lib/secrets';
import { cn } from '@/lib/utils';
import { AI_PROVIDER_DEFAULT_MODEL, useAIStore } from '@/stores/aiStore';
import type { AIProvider } from '@/types/resume';
import { SettingRow, SettingsNote } from '../SettingRow';
import { AI_PROVIDER_BY_ID, AI_PROVIDER_OPTIONS } from './ai-provider-meta';

export function AISection() {
  const enabled = useAIStore((s) => s.enabled);
  const provider = useAIStore((s) => s.provider);
  const modelsByProvider = useAIStore((s) => s.modelsByProvider);
  const setEnabled = useAIStore((s) => s.setEnabled);
  const setProvider = useAIStore((s) => s.setProvider);
  const setModel = useAIStore((s) => s.setModelForActiveProvider);
  const resetModel = useAIStore((s) => s.resetModelForProvider);

  const active = AI_PROVIDER_BY_ID[provider];
  const model = modelsByProvider[provider] ?? AI_PROVIDER_DEFAULT_MODEL[provider];
  const suggested = AI_PROVIDER_DEFAULT_MODEL[provider];

  return (
    <>
      <SettingsNote icon={ShieldCheck} className="mb-4">
        Mosaic is a complete resume editor with AI switched off — nothing is gated behind it. When
        it’s on, your resume text is sent to the provider you choose, and only when you ask for
        something.
      </SettingsNote>

      <SettingRow
        label="Enable AI assistant"
        description="Off by default. Nothing is sent anywhere until it is on and you ask."
      >
        <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Enable AI assistant" />
      </SettingRow>

      {/* Visible but out of reach while AI is off, so it is clear what turning it on offers. */}
      <div inert={!enabled} className={cn(!enabled && 'opacity-50')}>
        <SettingRow
          label="Provider"
          description="Bring your own key. Ollama runs entirely on this machine — nothing leaves it."
        >
          <Select value={provider} onValueChange={(value) => setProvider(value as AIProvider)}>
            <SelectTrigger size="sm" className="w-44" aria-label="Provider">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AI_PROVIDER_OPTIONS.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.id === 'ollama' ? 'Ollama (local)' : option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>

        <SettingRow
          label="Model"
          description={
            provider === 'ollama'
              ? 'A model you have pulled on this machine.'
              : 'Any chat model your key can reach.'
          }
        >
          <Input
            value={model}
            onChange={(event) => setModel(event.target.value)}
            placeholder={suggested}
            aria-label={`${active.label} model`}
            spellCheck={false}
            autoComplete="off"
            className="h-8 w-54 text-sm"
          />
          {model !== suggested && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => resetModel(provider)}
            >
              Use {suggested}
            </Button>
          )}
        </SettingRow>

        {active.requiresKey && <ApiKeyRows provider={provider} />}
      </div>
    </>
  );
}

function ApiKeyRows({ provider }: { provider: AIProvider }) {
  const secrets = useMemo(() => getSecretsClient(), []);
  const label = AI_PROVIDER_BY_ID[provider].label;
  // Keyed by provider: switching providers starts from that provider's own state.
  const [saved, setSaved] = useState<{ provider: AIProvider; has: boolean } | null>(null);
  const [draft, setDraft] = useState('');
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasKey = saved?.provider === provider ? saved.has : null;

  useEffect(() => {
    let current = true;
    secrets.getApiKey(provider).then(
      (key) => current && setSaved({ provider, has: key !== null }),
      () => current && setError('Could not check for a saved key.')
    );
    return () => {
      current = false;
    };
  }, [secrets, provider]);

  const save = async () => {
    const key = draft.trim();
    if (!key) return;
    try {
      await secrets.setApiKey(provider, key);
      setSaved({ provider, has: true });
      setDraft('');
      setReveal(false);
      setError(null);
    } catch {
      setError('Could not save the key. Check it and try again.');
    }
  };

  const remove = async () => {
    try {
      await secrets.deleteApiKey(provider);
      setSaved({ provider, has: false });
      setError(null);
    } catch {
      setError('Could not remove the key. Try again.');
    }
  };

  return (
    <>
      <SettingRow
        label="API key"
        description={
          <>
            Pasted keys are never written into your resume file or any backup.
            {error && <span className="mt-1 block text-red-700 dark:text-red-400">{error}</span>}
          </>
        }
      >
        {hasKey ? (
          <>
            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              {label} key saved
            </span>
            <Button variant="outline" size="sm" className="h-8" onClick={() => void remove()}>
              Remove
            </Button>
          </>
        ) : (
          <form
            className="flex items-center gap-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <div className="relative">
              <Input
                type={reveal ? 'text' : 'password'}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={`Paste your ${label} key`}
                aria-label={`${label} API key`}
                autoComplete="off"
                spellCheck={false}
                className="h-8 w-54 pr-8 font-mono text-xs"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="absolute top-1 right-1"
                onClick={() => setReveal((value) => !value)}
                aria-label={reveal ? 'Hide key' : 'Show key'}
              >
                {reveal ? <EyeOff /> : <Eye />}
              </Button>
            </div>
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="h-8"
              disabled={!draft.trim()}
            >
              Save
            </Button>
          </form>
        )}
      </SettingRow>

      <SettingRow
        label="Where to keep the key"
        description={
          secrets.getStorageMode() === 'keychain'
            ? 'Stored in the operating system keychain. Mosaic asks the OS for it when needed.'
            : 'Held in memory for this session only. You will paste it again next launch.'
        }
      >
        <span className="text-xs font-medium text-zinc-500">
          {secrets.getStorageMode() === 'keychain' ? 'OS keychain' : 'This session'}
        </span>
      </SettingRow>
    </>
  );
}
