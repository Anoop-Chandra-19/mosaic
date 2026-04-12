import { useEffect, useMemo, useState } from 'react';
import { Bot, KeyRound, Server, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useAIStore, AI_PROVIDER_DEFAULT_MODEL } from '@/stores/aiStore';
import { getSecretsClient } from '@/lib/secrets';
import { cn } from '@/lib/utils';
import type { AIProvider } from '@/types/resume';

type ProviderTrust = 'Direct API' | 'Proxy' | 'Local';

interface ProviderOption {
  id: AIProvider;
  label: string;
  trust: ProviderTrust;
  requiresKey: boolean;
  hint: string;
}

const providerOptions: ProviderOption[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    trust: 'Direct API',
    requiresKey: true,
    hint: 'Balanced quality and speed for writing workflows.',
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    trust: 'Direct API',
    requiresKey: true,
    hint: 'Strong reasoning and long-form response quality.',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    trust: 'Direct API',
    requiresKey: true,
    hint: 'Good cost-performance for frequent iterations.',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    trust: 'Proxy',
    requiresKey: true,
    hint: 'One gateway for multiple hosted providers.',
  },
  {
    id: 'ollama',
    label: 'Ollama',
    trust: 'Local',
    requiresKey: false,
    hint: 'Runs locally for maximum privacy.',
  },
];

const providerById = providerOptions.reduce(
  (acc, option) => ({ ...acc, [option.id]: option }),
  {} as Record<AIProvider, ProviderOption>
);

function storageModeDescription(mode: 'session' | 'keychain') {
  if (mode === 'keychain') {
    return 'Secure keychain storage (desktop)';
  }

  return 'Session memory storage (web default)';
}

export function AISettingsSection() {
  const enabled = useAIStore((s) => s.enabled);
  const provider = useAIStore((s) => s.provider);
  const model = useAIStore((s) => s.model);
  const setEnabled = useAIStore((s) => s.setEnabled);
  const setProvider = useAIStore((s) => s.setProvider);
  const setModel = useAIStore((s) => s.setModel);
  const useSuggestedModel = useAIStore((s) => s.useSuggestedModel);

  const secrets = useMemo(() => getSecretsClient(), []);
  const [keyInput, setKeyInput] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [loadingKeyStatus, setLoadingKeyStatus] = useState(true);
  const [isKeyMutationRunning, setIsKeyMutationRunning] = useState(false);
  const [keyFeedback, setKeyFeedback] = useState<string | null>(null);

  const activeProvider = providerById[provider];
  const suggestedModel = AI_PROVIDER_DEFAULT_MODEL[provider];
  const storageMode = secrets.getStorageMode();

  useEffect(() => {
    let alive = true;

    const loadStatus = async () => {
      if (!activeProvider.requiresKey) {
        if (alive) {
          setHasApiKey(false);
          setLoadingKeyStatus(false);
          setKeyFeedback(null);
        }
        return;
      }

      setLoadingKeyStatus(true);
      try {
        const stored = await secrets.getApiKey(provider);
        if (alive) {
          setHasApiKey(Boolean(stored));
        }
      } finally {
        if (alive) {
          setLoadingKeyStatus(false);
        }
      }
    };

    void loadStatus();

    return () => {
      alive = false;
    };
  }, [activeProvider.requiresKey, provider, secrets]);

  const handleSaveApiKey = async () => {
    const nextKey = keyInput.trim();
    if (!nextKey) {
      setKeyFeedback('Enter a key before saving.');
      return;
    }

    setIsKeyMutationRunning(true);
    setKeyFeedback(null);

    try {
      await secrets.setApiKey(provider, nextKey);
      setHasApiKey(true);
      setKeyInput('');
      setKeyFeedback('API key saved for current storage mode.');
    } catch {
      setKeyFeedback('Could not save key. Try again.');
    } finally {
      setIsKeyMutationRunning(false);
    }
  };

  const handleDeleteApiKey = async () => {
    setIsKeyMutationRunning(true);
    setKeyFeedback(null);

    try {
      await secrets.deleteApiKey(provider);
      setHasApiKey(false);
      setKeyFeedback('API key removed.');
    } catch {
      setKeyFeedback('Could not remove key. Try again.');
    } finally {
      setIsKeyMutationRunning(false);
    }
  };

  return (
    <section className="space-y-4">
      <article className="rounded-xl border border-zinc-300 bg-zinc-100 p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">AI Features</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Keep AI optional. Core editing works with AI disabled.
            </p>
          </div>

          <label className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
            <Checkbox
              checked={enabled}
              onCheckedChange={(checked) => setEnabled(Boolean(checked))}
            />
            Enable AI
          </label>
        </div>
      </article>

      <article className="rounded-xl border border-zinc-300 bg-zinc-100 p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Provider Router</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Choose the active provider and keep one unified app-level AI interface.
        </p>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {providerOptions.map((option) => {
            const isActive = option.id === provider;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setProvider(option.id);
                  setKeyFeedback(null);
                }}
                className={cn(
                  'rounded-xl border px-3 py-3 text-left transition-colors',
                  isActive
                    ? 'border-amber-500 bg-amber-100 dark:bg-zinc-800'
                    : 'border-zinc-300 bg-background hover:bg-zinc-200 dark:border-zinc-700 dark:hover:bg-zinc-800'
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {option.label}
                  </span>
                  <span className="rounded-full border border-zinc-300 px-2 py-0.5 text-[0.65rem] font-semibold tracking-widest text-zinc-600 uppercase dark:border-zinc-700 dark:text-zinc-300">
                    {option.trust}
                  </span>
                </span>

                <span className="mt-1 block text-xs text-zinc-600 dark:text-zinc-400">
                  {option.hint}
                </span>
              </button>
            );
          })}
        </div>
      </article>

      <article className="rounded-xl border border-zinc-300 bg-zinc-100 p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          <Bot className="size-4" />
          Model Selection
        </h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Model is config-only state. Secrets are handled separately.
        </p>

        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
          <Input
            value={model}
            onChange={(event) => setModel(event.target.value)}
            placeholder={suggestedModel}
            className="border-zinc-300 bg-background dark:border-zinc-700"
            aria-label="AI model"
          />

          <Button
            type="button"
            variant="outline"
            onClick={useSuggestedModel}
            className="border-zinc-300 bg-background text-zinc-800 hover:bg-zinc-200 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Use Suggested Model
          </Button>
        </div>
      </article>

      <article className="rounded-xl border border-zinc-300 bg-zinc-100 p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          <KeyRound className="size-4" />
          API Key Handling
        </h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Storage mode: {storageModeDescription(storageMode)}
        </p>

        {!activeProvider.requiresKey ? (
          <div className="mt-3 rounded-lg border border-zinc-300 bg-background p-3 dark:border-zinc-700">
            <p className="inline-flex items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
              <Server className="size-4" />
              {activeProvider.label} does not require an API key.
            </p>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              Ensure your local Ollama server is running and reachable.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-3 rounded-lg border border-zinc-300 bg-background p-3 dark:border-zinc-700">
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Key status:{' '}
                {loadingKeyStatus
                  ? 'Checking...'
                  : hasApiKey
                    ? 'Set for current storage mode'
                    : 'Not set'}
              </p>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                Keys are never stored in normal persisted Zustand state.
              </p>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
              <Input
                type="password"
                value={keyInput}
                onChange={(event) => setKeyInput(event.target.value)}
                placeholder={`Paste ${activeProvider.label} key`}
                className="border-zinc-300 bg-background dark:border-zinc-700"
                aria-label={`${activeProvider.label} API key`}
              />

              <Button
                type="button"
                onClick={handleSaveApiKey}
                disabled={isKeyMutationRunning}
                className="bg-zinc-900 text-zinc-100 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Save Key
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleDeleteApiKey}
                disabled={isKeyMutationRunning || !hasApiKey}
                className="border-zinc-300 bg-background text-zinc-800 hover:bg-zinc-200 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                Remove Key
              </Button>
            </div>

            {keyFeedback && (
              <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                <ShieldCheck className="size-3" />
                {keyFeedback}
              </p>
            )}
          </>
        )}
      </article>
    </section>
  );
}
