import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { AppButton, AppInput, AppSwitch, Note, Text } from '@/components/ui-kit';
import { isLocalOllamaAddress } from '@shared/model-providers/ollamaAddress';
import { cn } from '@/lib/utils';
import { DEFAULT_MODEL_BY_PROVIDER, useAgentSettingsStore } from '@/stores/agentSettingsStore';
import type { ModelProviderId } from '@shared/types/modelProviders';
import { isKeyedProvider, type KeyedProvider } from '@shared/types/secrets';
import { SettingRow } from '../SettingRow';
import { useSecretsStatus } from '../useSecretsStatus';
import { KeyMessageLine } from './ApiKeyMessage';
import { ApiKeyRow } from './ApiKeyRow';
import { readKeyState } from './apiKeyWords';
import { KeyStatus } from './KeyStatus';
import { MODEL_PROVIDER_OPTION_BY_ID } from './modelProviderOptions';
import { OllamaAddressRow, OllamaContextRow, OllamaModelRow } from './OllamaRows';
import { ProviderMenu } from './ProviderMenu';
import { useOllamaModels } from './useOllamaModels';

/** A key that works but whose list doesn't have the model in settings. */
interface ModelWarning {
  provider: ModelProviderId;
  model: string;
}

export function AiSection() {
  const enabled = useAgentSettingsStore((s) => s.enabled);
  const provider = useAgentSettingsStore((s) => s.provider);
  const modelsByProvider = useAgentSettingsStore((s) => s.modelsByProvider);
  const setEnabled = useAgentSettingsStore((s) => s.setEnabled);
  const setProvider = useAgentSettingsStore((s) => s.setProvider);
  const setModel = useAgentSettingsStore((s) => s.setModelForActiveProvider);
  const resetModel = useAgentSettingsStore((s) => s.resetModelForProvider);
  const ollamaAddress = useAgentSettingsStore((s) => s.ollamaAddress);
  const setOllamaAddress = useAgentSettingsStore((s) => s.setOllamaAddress);
  const ollamaContextTokens = useAgentSettingsStore((s) => s.ollamaContextTokens);
  const setOllamaContextTokens = useAgentSettingsStore((s) => s.setOllamaContextTokens);
  const { status, loadFailed, show } = useSecretsStatus();
  const [modelWarning, setModelWarning] = useState<ModelWarning | null>(null);

  const active = MODEL_PROVIDER_OPTION_BY_ID[provider];
  const modelFor = (id: ModelProviderId) =>
    (modelsByProvider[id] ?? DEFAULT_MODEL_BY_PROVIDER[id]).trim() || DEFAULT_MODEL_BY_PROVIDER[id];
  const model = modelsByProvider[provider] ?? DEFAULT_MODEL_BY_PROVIDER[provider];
  const suggested = DEFAULT_MODEL_BY_PROVIDER[provider];
  const ollamaModel = modelFor('ollama');
  const ollamaModels = useOllamaModels(enabled && provider === 'ollama', ollamaAddress);
  const ollamaModelDetails = ollamaModels.result?.ok
    ? ollamaModels.result.models.find((pulled) => pulled.name === ollamaModel)
    : undefined;
  const keyState = readKeyState(provider, status);
  // Shown until the model changes: a new name gets its own check.
  const isModelWarned =
    modelWarning?.provider === provider && modelWarning.model === modelFor(provider);

  const handleKeyChecked = (checked: KeyedProvider, modelFound: boolean | null) => {
    // "Use it for …" saved the key under another provider: show that one.
    if (checked !== provider) setProvider(checked);
    setModelWarning(modelFound === false ? { provider: checked, model: modelFor(checked) } : null);
  };

  return (
    <>
      <Note icon={ShieldCheck} className="mb-4">
        Mosaic is a complete resume editor with AI switched off, and nothing is gated behind it.
        When it’s on, your resume text is sent to the provider you choose, and only when you ask for
        something.
      </Note>

      <SettingRow
        label="Enable AI assistant"
        description="Off by default. Nothing is sent anywhere until it is on and you ask."
      >
        <AppSwitch
          checked={enabled}
          onCheckedChange={setEnabled}
          aria-label="Enable AI assistant"
        />
      </SettingRow>

      {/* Visible but out of reach while AI is off, so it is clear what turning it on offers. */}
      <div inert={!enabled} className={cn(!enabled && 'opacity-50')}>
        {/* On its own, so the group heading below draws the line under it. */}
        <div>
          <SettingRow
            label="Provider"
            description={
              provider === 'ollama' && !isLocalOllamaAddress(ollamaAddress)
                ? 'Bring your own key. Ollama runs on your own hardware, here on your network.'
                : 'Bring your own key. Ollama runs entirely on your computer, so nothing leaves it.'
            }
          >
            <ProviderMenu provider={provider} status={status} onChange={setProvider} />
          </SettingRow>
        </div>

        {/* Everything that belongs to the chosen provider, under a heading named for it. */}
        <div className="flex items-center gap-2.5 border-b border-line pt-4 pb-1.5">
          <Text as="h4" variant="tag" className="text-ink-faint">
            {active.label}
          </Text>
          {keyState && <KeyStatus state={keyState} className="ml-auto" />}
        </div>

        {isKeyedProvider(provider) ? (
          <>
            {/* Keyed by provider: switching starts that provider's rows afresh. */}
            <ApiKeyRow
              key={provider}
              provider={provider}
              status={status}
              loadFailed={loadFailed}
              modelFor={modelFor}
              onStatus={show}
              onKeyChecked={handleKeyChecked}
            />
            <SettingRow
              label="Model"
              description={
                <>
                  Any chat model your key can reach.
                  {isModelWarned && (
                    <span className="mt-1.5 block">
                      <KeyMessageLine tone="warn">
                        Your key works, but {active.label} doesn’t offer “{modelFor(provider)}” to
                        it. Check the name, or pick {suggested}.
                      </KeyMessageLine>
                    </span>
                  )}
                </>
              }
            >
              <AppInput
                value={model}
                onChange={(event) => setModel(event.target.value)}
                placeholder={suggested}
                aria-label={`${active.label} model`}
                spellCheck={false}
                autoComplete="off"
                className="w-54 font-mono text-meta"
              />
              {model !== suggested && (
                <AppButton variant="ghost" size="sm" onClick={() => resetModel(provider)}>
                  Use {suggested}
                </AppButton>
              )}
            </SettingRow>
          </>
        ) : (
          <>
            <OllamaAddressRow address={ollamaAddress} onChange={setOllamaAddress} />
            <OllamaModelRow
              active={enabled}
              address={ollamaAddress}
              ollamaModels={ollamaModels}
              model={ollamaModel}
              onChange={setModel}
            />
            <OllamaContextRow
              model={ollamaModel}
              details={ollamaModelDetails}
              contextTokens={ollamaContextTokens}
              onChange={setOllamaContextTokens}
            />
          </>
        )}
      </div>
    </>
  );
}
