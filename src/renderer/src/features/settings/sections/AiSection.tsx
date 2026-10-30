import { ShieldCheck } from 'lucide-react';
import { AppSwitch, Note, Text } from '@/components/ui-kit';
import { isLocalServerAddress } from '@shared/model-providers/serverAddress';
import { cn } from '@/lib/utils';
import { DEFAULT_MODEL_BY_PROVIDER, useAgentSettingsStore } from '@/stores/agentSettingsStore';
import type { ModelProviderId } from '@shared/types/modelProviders';
import { isKeyedProvider, type KeyedProvider } from '@shared/types/secrets';
import { SettingRow } from '../SettingRow';
import { useSecretsStatus } from '../useSecretsStatus';
import { ApiKeyRow } from './ai/ApiKeyRow';
import { readKeyState } from './ai/apiKeyWords';
import { KeyedModelRow } from './ai/KeyedModelRow';
import { KeyStatus } from './ai/KeyStatus';
import { MODEL_PROVIDER_OPTION_BY_ID } from './ai/modelProviderOptions';
import { OllamaAddressRow, OllamaContextRow, OllamaModelRow } from './ai/OllamaRows';
import { ProviderMenu } from './ai/ProviderMenu';
import { useOllamaModels } from './ai/useOllamaModels';

/*
 * Settings › AI assistant: the switch, the provider menu, and that provider's rows under its
 * heading, all from `ai/`. A keyed provider gets the key row (`ApiKeyRow` and its messages)
 * and the model list (`KeyedModelRow`, `ModelCombobox`); Ollama gets `OllamaRows`. Outside
 * Settings, only `ai/modelProviderOptions.ts` is used.
 */
export function AiSection() {
  const enabled = useAgentSettingsStore((s) => s.enabled);
  const provider = useAgentSettingsStore((s) => s.provider);
  const modelsByProvider = useAgentSettingsStore((s) => s.modelsByProvider);
  const setEnabled = useAgentSettingsStore((s) => s.setEnabled);
  const setProvider = useAgentSettingsStore((s) => s.setProvider);
  const setModel = useAgentSettingsStore((s) => s.setModelForActiveProvider);
  const ollamaAddress = useAgentSettingsStore((s) => s.ollamaAddress);
  const setOllamaAddress = useAgentSettingsStore((s) => s.setOllamaAddress);
  const ollamaContextTokens = useAgentSettingsStore((s) => s.ollamaContextTokens);
  const setOllamaContextTokens = useAgentSettingsStore((s) => s.setOllamaContextTokens);
  const { status, loadFailed, show } = useSecretsStatus();

  const active = MODEL_PROVIDER_OPTION_BY_ID[provider];
  const modelFor = (id: ModelProviderId) =>
    (modelsByProvider[id] ?? DEFAULT_MODEL_BY_PROVIDER[id]).trim() || DEFAULT_MODEL_BY_PROVIDER[id];
  const ollamaModel = modelFor('ollama');
  const ollamaModels = useOllamaModels(enabled && provider === 'ollama', ollamaAddress);
  const ollamaModelDetails = ollamaModels.result?.ok
    ? ollamaModels.result.models.find((pulled) => pulled.name === ollamaModel)
    : undefined;
  const keyState = readKeyState(provider, status);

  const handleKeyChecked = (checked: KeyedProvider) => {
    // "Use it for …" saved the key under another provider: show that one.
    if (checked !== provider) setProvider(checked);
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
              provider === 'ollama' && !isLocalServerAddress(ollamaAddress)
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
              onStatus={show}
              onKeyChecked={handleKeyChecked}
            />
            <KeyedModelRow
              key={`${provider}-model`}
              active={enabled}
              provider={provider}
              status={status}
              model={modelFor(provider)}
              suggested={DEFAULT_MODEL_BY_PROVIDER[provider]}
              onChange={setModel}
            />
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
