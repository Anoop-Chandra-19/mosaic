import { useState, type ReactNode } from 'react';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import {
  AppButton,
  Note,
  AppInput,
  AppSelect,
  AppSelectContent,
  AppSelectItem,
  AppSelectTrigger,
  AppSelectValue,
  AppSwitch,
  Text,
} from '@/components/ui-kit';
import { isLocalOllamaAddress } from '@shared/model-providers/ollamaAddress';
import { cn } from '@/lib/utils';
import { DEFAULT_MODEL_BY_PROVIDER, useAgentSettingsStore } from '@/stores/agentSettingsStore';
import type { ModelProviderId } from '@shared/types/modelProviders';
import { isKeyedProvider, type KeyCheck, type KeyedProvider } from '@shared/types/secrets';
import { SettingRow } from '../SettingRow';
import { useSecretsStatus } from '../useSecretsStatus';
import { MODEL_PROVIDER_OPTION_BY_ID, MODEL_PROVIDER_OPTIONS } from './modelProviderOptions';
import { OllamaAddressRow, OllamaContextRow, OllamaModelRow } from './OllamaRows';
import { useOllamaModels } from './useOllamaModels';

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

  const active = MODEL_PROVIDER_OPTION_BY_ID[provider];
  const model = modelsByProvider[provider] ?? DEFAULT_MODEL_BY_PROVIDER[provider];
  const suggested = DEFAULT_MODEL_BY_PROVIDER[provider];
  const ollamaModel = model.trim() || suggested;
  const ollamaModels = useOllamaModels(enabled && provider === 'ollama', ollamaAddress);
  const ollamaModelDetails = ollamaModels.result?.ok
    ? ollamaModels.result.models.find((pulled) => pulled.name === ollamaModel)
    : undefined;

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
        <SettingRow
          label="Provider"
          description={
            provider === 'ollama' && !isLocalOllamaAddress(ollamaAddress)
              ? 'Bring your own key. Ollama runs on your own hardware, here on your network.'
              : 'Bring your own key. Ollama runs entirely on your computer, so nothing leaves it.'
          }
        >
          <AppSelect
            value={provider}
            onValueChange={(value) => setProvider(value as ModelProviderId)}
          >
            <AppSelectTrigger className="w-44" aria-label="Provider">
              <AppSelectValue />
            </AppSelectTrigger>
            <AppSelectContent>
              {MODEL_PROVIDER_OPTIONS.map((option) => (
                <AppSelectItem key={option.id} value={option.id}>
                  {option.id === 'ollama' ? 'Ollama (local)' : option.label}
                </AppSelectItem>
              ))}
            </AppSelectContent>
          </AppSelect>
        </SettingRow>

        {provider === 'ollama' ? (
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
        ) : (
          <SettingRow label="Model" description="Any chat model your key can reach.">
            <AppInput
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder={suggested}
              aria-label={`${active.label} model`}
              spellCheck={false}
              autoComplete="off"
              className="w-54"
            />
            {model !== suggested && (
              <AppButton variant="ghost" size="sm" onClick={() => resetModel(provider)}>
                Use {suggested}
              </AppButton>
            )}
          </SettingRow>
        )}

        {/* Keyed by provider: switching starts that provider's rows afresh. */}
        {isKeyedProvider(provider) && (
          <ApiKeyRow key={provider} provider={provider} model={model.trim() || suggested} />
        )}
      </div>
    </>
  );
}

type KeyCheckFailure = Extract<KeyCheck, { ok: false }>;

function checkMessage(result: KeyCheck, label: string, model: string): ReactNode {
  if (result.ok) {
    return result.modelFound === false ? (
      <span className="text-warn">
        The key works, but it can’t reach “{model}”. Check the model name above.
      </span>
    ) : null;
  }
  const messages: Record<KeyCheckFailure['reason'], string> = {
    refused: `${label} turned this key down. Check it was copied in full.`,
    unreachable: `Couldn’t reach ${label} to check this key.`,
    'no-key': `No ${label} key is saved.`,
    keychain: 'The keychain didn’t hand over the saved key. Unlock it and try again.',
    failed: `${label} answered with an error${result.httpStatus ? ` (${result.httpStatus})` : ''}, so the key wasn’t checked.`,
  };
  return <ErrorText>{messages[result.reason]}</ErrorText>;
}

function ErrorText({ children }: { children: ReactNode }) {
  return <span className="text-del">{children}</span>;
}

/** The key was never turned down, so it can be kept unchecked. */
const canSaveUnchecked = (result: KeyCheck | null) =>
  result !== null && !result.ok && (result.reason === 'unreachable' || result.reason === 'failed');

function ApiKeyRow({ provider, model }: { provider: KeyedProvider; model: string }) {
  const { status, loadFailed, show } = useSecretsStatus();
  const label = MODEL_PROVIDER_OPTION_BY_ID[provider].label;
  const [draft, setDraft] = useState('');
  const [reveal, setReveal] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState<KeyCheck | null>(null);

  const saved = status?.saved[provider];
  const key = draft.trim();
  // Main refuses these too; saying so here beats a failed check.
  const keyHasSpaces = /\s/.test(key);

  const runCheck = async (request: () => Promise<KeyCheck>) => {
    setChecking(true);
    setKeyError(null);
    try {
      const result = await request();
      setChecked(result);
      if (result.ok) {
        show(result.status);
        setDraft('');
        setReveal(false);
      }
    } catch (error) {
      console.error('Could not check the key', error);
      setKeyError('Could not check the key. Try again.');
    } finally {
      setChecking(false);
    }
  };

  const save = (check: boolean) => {
    if (!key || keyHasSpaces) return;
    void runCheck(() =>
      window.mosaic.secrets.save(provider, key, { model, check, forgetOnClose: false })
    );
  };

  const remove = async () => {
    try {
      show(await window.mosaic.secrets.remove(provider));
      setChecked(null);
      setKeyError(null);
    } catch (error) {
      console.error('Could not remove the key', error);
      setKeyError('Could not remove the key. If the keychain is locked, unlock it and try again.');
    }
  };

  const note =
    keyError !== null ? (
      <ErrorText>{keyError}</ErrorText>
    ) : !saved && keyHasSpaces ? (
      <ErrorText>Keys have no spaces. Check what was pasted.</ErrorText>
    ) : loadFailed ? (
      <ErrorText>Could not check for a saved key.</ErrorText>
    ) : checked ? (
      checkMessage(checked, label, model)
    ) : null;

  return (
    <SettingRow
      label="API key"
      description={
        <>
          {status?.keychain === 'unavailable'
            ? 'This computer has no keychain, so the key is kept until Mosaic closes.'
            : 'Kept in your system keychain, never in your resume or backups.'}
          {note && <span className="mt-1 block">{note}</span>}
          {!saved && canSaveUnchecked(checked) && (
            <AppButton variant="ghost" size="xs" className="mt-1" onClick={() => save(false)}>
              Save without checking
            </AppButton>
          )}
        </>
      }
    >
      {status === null && !loadFailed ? null : saved ? (
        <>
          <Text variant="secondary" className="font-control text-ink-soft">
            {saved.where === 'keychain' ? 'Saved in the keychain' : 'Saved for this session'}
          </Text>
          {saved.checkedAt === null && (
            <AppButton
              variant="outline"
              size="sm"
              disabled={checking}
              onClick={() => void runCheck(() => window.mosaic.secrets.check(provider, model))}
            >
              {checking ? 'Checking…' : 'Check now'}
            </AppButton>
          )}
          <AppButton variant="outline" size="sm" onClick={() => void remove()}>
            Remove
          </AppButton>
        </>
      ) : (
        <form
          className="flex items-center gap-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            save(true);
          }}
        >
          <div className="relative">
            <AppInput
              type={reveal ? 'text' : 'password'}
              value={draft}
              disabled={checking}
              onChange={(event) => {
                setDraft(event.target.value);
                setChecked(null);
              }}
              placeholder="Paste your key"
              aria-label={`${label} API key`}
              autoComplete="off"
              spellCheck={false}
              className="w-54 pr-8 font-mono text-meta"
            />
            <AppButton
              type="button"
              variant="ghost"
              size="xs"
              shape="square"
              className="absolute top-1 right-1"
              onClick={() => setReveal((value) => !value)}
              aria-label={reveal ? 'Hide key' : 'Show key'}
            >
              {reveal ? <EyeOff /> : <Eye />}
            </AppButton>
          </div>
          <AppButton
            type="submit"
            variant="outline"
            size="sm"
            disabled={checking || !key || keyHasSpaces}
          >
            {checking ? 'Checking…' : 'Save'}
          </AppButton>
        </form>
      )}
    </SettingRow>
  );
}
