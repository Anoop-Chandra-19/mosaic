import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, KeyRound, Server, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { getSecretsClient } from '@/lib/secrets';
import { cn } from '@/lib/utils';
import { AI_PROVIDER_DEFAULT_MODEL, useAIStore } from '@/stores/aiStore';
import type { AIProvider } from '@/types/resume';
import {
  AI_PROVIDER_BY_ID,
  AI_PROVIDER_OPTIONS,
  type ProviderOption,
  type ProviderTrust,
} from './ai-provider-meta';

type KeyStatus = 'loading' | 'set' | 'missing' | 'error';

type ProviderMap<T> = Record<AIProvider, T>;

interface ProviderFeedback {
  provider: AIProvider;
  tone: 'success' | 'error' | 'info';
  message: string;
}

function createProviderMap<T>(factory: (provider: ProviderOption) => T): ProviderMap<T> {
  const map = {} as ProviderMap<T>;

  for (const provider of AI_PROVIDER_OPTIONS) {
    map[provider.id] = factory(provider);
  }

  return map;
}

function storageModeDescription(mode: 'session' | 'keychain') {
  if (mode === 'keychain') {
    return 'Secure keychain storage on desktop';
  }

  return 'Session memory storage on web';
}

function keyStatusLabel(status: KeyStatus, requiresKey: boolean) {
  if (!requiresKey) {
    return 'No key required';
  }

  if (status === 'loading') {
    return 'Checking…';
  }

  if (status === 'set') {
    return 'Key configured';
  }

  if (status === 'missing') {
    return 'Key missing';
  }

  return 'Status unavailable';
}

function trustBadgeClass(trust: ProviderTrust) {
  if (trust === 'Local') {
    return 'border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300';
  }

  if (trust === 'Proxy') {
    return 'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300';
  }

  return 'border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300';
}

function keyStatusClass(status: KeyStatus, requiresKey: boolean) {
  if (!requiresKey) {
    return 'border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
  }

  if (status === 'set') {
    return 'border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-700 dark:bg-zinc-800 dark:text-emerald-300';
  }

  if (status === 'error') {
    return 'border-red-300 bg-red-100 text-red-700 dark:border-red-700 dark:bg-zinc-800 dark:text-red-300';
  }

  if (status === 'loading') {
    return 'border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
  }

  return 'border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
}

export function AISettingsSection() {
  const enabled = useAIStore((state) => state.enabled);
  const provider = useAIStore((state) => state.provider);
  const modelsByProvider = useAIStore((state) => state.modelsByProvider);
  const setEnabled = useAIStore((state) => state.setEnabled);
  const setProvider = useAIStore((state) => state.setProvider);
  const setModelForActiveProvider = useAIStore((state) => state.setModelForActiveProvider);
  const resetModelForProvider = useAIStore((state) => state.resetModelForProvider);

  const secrets = useMemo(() => getSecretsClient(), []);

  const [keyStatusByProvider, setKeyStatusByProvider] = useState<ProviderMap<KeyStatus>>(() =>
    createProviderMap((currentProvider) => (currentProvider.requiresKey ? 'loading' : 'missing'))
  );
  const [keyInputByProvider, setKeyInputByProvider] = useState<ProviderMap<string>>(() =>
    createProviderMap(() => '')
  );
  const [isMutatingProvider, setIsMutatingProvider] = useState<AIProvider | null>(null);
  const [feedback, setFeedback] = useState<ProviderFeedback | null>(null);
  const [flashCredentials, setFlashCredentials] = useState(false);
  const flashTimeoutRef = useRef<number | null>(null);

  const activeProvider = AI_PROVIDER_BY_ID[provider];
  const activeModel = modelsByProvider[provider] ?? AI_PROVIDER_DEFAULT_MODEL[provider];
  const activeKeyStatus = keyStatusByProvider[provider];
  const activeKeyInput = keyInputByProvider[provider];
  const storageMode = secrets.getStorageMode();
  const isMutatingActiveProvider = isMutatingProvider === provider;

  const modelInputId = `ai-model-${provider}`;
  const keyInputId = `ai-key-${provider}`;
  const credentialsHighlightClass = flashCredentials
    ? 'motion-safe:animate-settings-credentials-flash motion-reduce:animate-none'
    : undefined;

  useEffect(() => {
    let alive = true;

    const loadKeyStatus = async () => {
      const providersThatNeedKeys = AI_PROVIDER_OPTIONS.filter((item) => item.requiresKey).map(
        (item) => item.id
      );

      const results = await Promise.all(
        providersThatNeedKeys.map(async (providerId) => {
          try {
            const key = await secrets.getApiKey(providerId);
            return [providerId, key ? 'set' : 'missing'] as const;
          } catch {
            return [providerId, 'error'] as const;
          }
        })
      );

      if (!alive) {
        return;
      }

      setKeyStatusByProvider((previous) => {
        const next = { ...previous };

        for (const [providerId, status] of results) {
          next[providerId] = status;
        }

        return next;
      });
    };

    void loadKeyStatus();

    return () => {
      alive = false;
    };
  }, [secrets]);

  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current !== null) {
        window.clearTimeout(flashTimeoutRef.current);
      }
    };
  }, []);

  const triggerCredentialsFlash = () => {
    if (flashTimeoutRef.current !== null) {
      window.clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = null;
    }

    setFlashCredentials(false);

    window.requestAnimationFrame(() => {
      setFlashCredentials(true);
      flashTimeoutRef.current = window.setTimeout(() => {
        setFlashCredentials(false);
        flashTimeoutRef.current = null;
      }, 840);
    });
  };

  const handleEnabledChange = (checked: boolean | 'indeterminate') => {
    const nextEnabled = Boolean(checked);

    if (!enabled && nextEnabled) {
      triggerCredentialsFlash();
    }

    setEnabled(nextEnabled);
  };

  const handleSelectProvider = (nextProvider: AIProvider) => {
    setProvider(nextProvider);
    setFeedback(null);
  };

  const handleModelChange = (nextModel: string) => {
    setModelForActiveProvider(nextModel);
  };

  const handleUseSuggestedModel = () => {
    resetModelForProvider(provider);
    setFeedback({
      provider,
      tone: 'info',
      message: `${activeProvider.label} model reset to suggested default.`,
    });
  };

  const handleKeyInputChange = (value: string) => {
    setKeyInputByProvider((previous) => ({
      ...previous,
      [provider]: value,
    }));
  };

  const handleSaveApiKey = async () => {
    const key = activeKeyInput.trim();

    if (!key) {
      setFeedback({
        provider,
        tone: 'error',
        message: 'Enter an API key before saving.',
      });
      return;
    }

    setIsMutatingProvider(provider);
    setFeedback(null);

    try {
      await secrets.setApiKey(provider, key);

      setKeyStatusByProvider((previous) => ({
        ...previous,
        [provider]: 'set',
      }));

      setKeyInputByProvider((previous) => ({
        ...previous,
        [provider]: '',
      }));

      setFeedback({
        provider,
        tone: 'success',
        message: `${activeProvider.label} API key saved for current storage mode.`,
      });
    } catch {
      setKeyStatusByProvider((previous) => ({
        ...previous,
        [provider]: 'error',
      }));

      setFeedback({
        provider,
        tone: 'error',
        message: 'Could not save API key. Check the key format and try again.',
      });
    } finally {
      setIsMutatingProvider(null);
    }
  };

  const handleRemoveApiKey = async () => {
    setIsMutatingProvider(provider);
    setFeedback(null);

    try {
      await secrets.deleteApiKey(provider);

      setKeyStatusByProvider((previous) => ({
        ...previous,
        [provider]: 'missing',
      }));

      setFeedback({
        provider,
        tone: 'success',
        message: `${activeProvider.label} API key removed.`,
      });
    } catch {
      setKeyStatusByProvider((previous) => ({
        ...previous,
        [provider]: 'error',
      }));

      setFeedback({
        provider,
        tone: 'error',
        message: 'Could not remove API key. Try again.',
      });
    } finally {
      setIsMutatingProvider(null);
    }
  };

  const activeFeedback = feedback?.provider === provider ? feedback : null;

  return (
    <section className="space-y-4">
      <article className="rounded-xl border border-zinc-300 bg-zinc-100 p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">General</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Keep AI optional. Core editing works with AI disabled.
            </p>
          </div>

          <label
            htmlFor="ai-enabled"
            className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-200"
          >
            <Checkbox id="ai-enabled" checked={enabled} onCheckedChange={handleEnabledChange} />
            Enable AI
          </label>
        </div>
      </article>

      <article className="rounded-xl border border-zinc-300 bg-zinc-100 p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Provider Profiles
        </h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Select a provider and configure model + credentials together.
        </p>

        <div className="mt-3 grid gap-3 lg:grid-cols-[15rem_1fr]">
          <nav
            className="rounded-xl border border-zinc-300 bg-background p-4 dark:border-zinc-700"
            aria-label="AI provider profiles"
          >
            <p className="px-1 text-xs font-semibold tracking-widest text-zinc-500 uppercase dark:text-zinc-400">
              Providers
            </p>

            <div className="mt-3 space-y-3">
              {AI_PROVIDER_OPTIONS.map((option) => {
                const isActive = option.id === provider;
                const providerKeyStatus = keyStatusByProvider[option.id];

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleSelectProvider(option.id)}
                    className={cn(
                      'w-full rounded-lg border px-3 py-3 text-left transition-colors',
                      isActive
                        ? 'border-amber-500 bg-amber-100 text-zinc-900 dark:border-amber-500 dark:bg-zinc-800 dark:text-zinc-100'
                        : 'border-zinc-300 bg-background text-zinc-700 hover:border-zinc-400 hover:bg-zinc-200 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-amber-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
                    )}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          'min-w-0 text-sm font-semibold',
                          isActive
                            ? 'text-zinc-900 dark:text-zinc-100'
                            : 'text-zinc-900 dark:text-zinc-100'
                        )}
                      >
                        {option.label}
                      </span>

                      <span
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold tracking-widest uppercase',
                          trustBadgeClass(option.trust)
                        )}
                      >
                        {option.trust}
                      </span>
                    </span>

                    <span
                      className={cn(
                        'mt-2 inline-flex rounded-full border px-1.5 py-0.5 text-[0.62rem] font-semibold tracking-widest uppercase',
                        keyStatusClass(providerKeyStatus, option.requiresKey)
                      )}
                    >
                      {keyStatusLabel(providerKeyStatus, option.requiresKey)}
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>

          <div
            className={cn(
              'rounded-xl border border-zinc-300 bg-background p-4 dark:border-zinc-700',
              credentialsHighlightClass
            )}
          >
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {activeProvider.label}
                </p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {activeProvider.hint}
                </p>
              </div>

              <span
                className={cn(
                  'rounded-full border px-2 py-1 text-xs font-semibold tracking-widest uppercase',
                  trustBadgeClass(activeProvider.trust)
                )}
              >
                {activeProvider.trust}
              </span>
            </header>

            <section className="mt-4 border-t border-zinc-300 pt-4 dark:border-zinc-700">
              <h4 className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                <Bot className="size-4" aria-hidden="true" />
                Model
              </h4>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Stored per provider so switching providers keeps each model intact.
              </p>

              <label
                htmlFor={modelInputId}
                className="mt-3 block text-xs font-semibold tracking-widest text-zinc-500 uppercase dark:text-zinc-400"
              >
                Model Name
              </label>

              <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                <Input
                  id={modelInputId}
                  name={modelInputId}
                  value={activeModel}
                  onChange={(event) => handleModelChange(event.target.value)}
                  placeholder={`e.g. ${AI_PROVIDER_DEFAULT_MODEL[provider]}…`}
                  className="border-zinc-300 bg-background dark:border-zinc-700"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label={`${activeProvider.label} model`}
                />

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleUseSuggestedModel}
                  className="border-zinc-300 bg-background text-zinc-800 hover:bg-zinc-200 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
                >
                  Use Suggested Model
                </Button>
              </div>
            </section>

            <section className="mt-4 border-t border-zinc-300 pt-4 dark:border-zinc-700">
              <h4 className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                <KeyRound className="size-4" aria-hidden="true" />
                Credentials
              </h4>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Storage mode: {storageModeDescription(storageMode)}
              </p>

              {!activeProvider.requiresKey ? (
                <div className="mt-3 rounded-lg border border-zinc-300 bg-zinc-100 p-3 dark:border-zinc-700 dark:bg-zinc-900">
                  <p className="inline-flex items-center gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                    <Server className="size-4" aria-hidden="true" />
                    No API key required for {activeProvider.label}.
                  </p>
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                    Ensure local runtime is available before running AI actions.
                  </p>
                </div>
              ) : (
                <>
                  <div className="mt-3 rounded-lg border border-zinc-300 bg-zinc-100 p-3 dark:border-zinc-700 dark:bg-zinc-900">
                    <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                      Key status: {keyStatusLabel(activeKeyStatus, activeProvider.requiresKey)}
                    </p>
                    <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                      Keys are handled separately from normal persisted app state.
                    </p>
                  </div>

                  <label
                    htmlFor={keyInputId}
                    className="mt-3 block text-xs font-semibold tracking-widest text-zinc-500 uppercase dark:text-zinc-400"
                  >
                    API Key
                  </label>

                  <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                    <Input
                      id={keyInputId}
                      type="password"
                      name={keyInputId}
                      value={activeKeyInput}
                      onChange={(event) => handleKeyInputChange(event.target.value)}
                      placeholder={`Paste ${activeProvider.label} API key…`}
                      className="border-zinc-300 bg-background dark:border-zinc-700"
                      autoComplete="off"
                      spellCheck={false}
                      aria-label={`${activeProvider.label} API key`}
                    />

                    <Button
                      type="button"
                      onClick={handleSaveApiKey}
                      disabled={isMutatingActiveProvider}
                      className="bg-zinc-900 text-zinc-100 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                    >
                      {isMutatingActiveProvider ? 'Saving…' : 'Save API Key'}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleRemoveApiKey}
                      disabled={isMutatingActiveProvider || activeKeyStatus !== 'set'}
                      className="border-zinc-300 bg-background text-zinc-800 hover:bg-zinc-200 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
                    >
                      Remove API Key
                    </Button>
                  </div>
                </>
              )}
            </section>

            {activeFeedback && (
              <p
                className={cn(
                  'mt-3 inline-flex items-center gap-1 text-xs font-medium',
                  activeFeedback.tone === 'error'
                    ? 'text-red-700 dark:text-red-300'
                    : 'text-zinc-700 dark:text-zinc-300'
                )}
                aria-live="polite"
              >
                <ShieldCheck className="size-3" aria-hidden="true" />
                {activeFeedback.message}
              </p>
            )}
          </div>
        </div>
      </article>
    </section>
  );
}
