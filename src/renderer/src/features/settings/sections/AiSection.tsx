import { useState, type ReactNode } from 'react';
import { Check, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { Note } from '@/components/Note';
import { AppInput } from '@/components/AppInput';
import {
  AppSelect,
  AppSelectContent,
  AppSelectItem,
  AppSelectTrigger,
  AppSelectValue,
} from '@/components/AppSelect';
import { AppSwitch } from '@/components/AppSwitch';
import { AppToggleGroup, AppToggleGroupItem } from '@/components/AppToggleGroup';
import { isLocalOllamaAddress } from '@shared/ai/ollamaAddress';
import { cn } from '@/lib/utils';
import { AI_PROVIDER_DEFAULT_MODEL, useAiStore } from '@/stores/aiStore';
import type { AiProvider } from '@shared/types/resume';
import {
  isKeyedProvider,
  type KeyedProvider,
  type KeyLocation,
  type KeyTest,
} from '@shared/types/secrets';
import { SettingRow } from '../SettingRow';
import { useSecretsStatus } from '../useSecretsStatus';
import { AI_PROVIDER_BY_ID, AI_PROVIDER_OPTIONS } from './aiProviderOptions';
import { OllamaAddressRow, OllamaModelRow } from './OllamaRows';

export function AiSection() {
  const enabled = useAiStore((s) => s.enabled);
  const provider = useAiStore((s) => s.provider);
  const modelsByProvider = useAiStore((s) => s.modelsByProvider);
  const setEnabled = useAiStore((s) => s.setEnabled);
  const setProvider = useAiStore((s) => s.setProvider);
  const setModel = useAiStore((s) => s.setModelForActiveProvider);
  const resetModel = useAiStore((s) => s.resetModelForProvider);
  const ollamaAddress = useAiStore((s) => s.ollamaAddress);
  const setOllamaAddress = useAiStore((s) => s.setOllamaAddress);

  const active = AI_PROVIDER_BY_ID[provider];
  const model = modelsByProvider[provider] ?? AI_PROVIDER_DEFAULT_MODEL[provider];
  const suggested = AI_PROVIDER_DEFAULT_MODEL[provider];

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
          <AppSelect value={provider} onValueChange={(value) => setProvider(value as AiProvider)}>
            <AppSelectTrigger className="w-44" aria-label="Provider">
              <AppSelectValue />
            </AppSelectTrigger>
            <AppSelectContent>
              {AI_PROVIDER_OPTIONS.map((option) => (
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
              model={model.trim() || suggested}
              onChange={setModel}
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
          <ApiKeyRows key={provider} provider={provider} model={model.trim() || suggested} />
        )}
      </div>
    </>
  );
}

function testMessage(result: KeyTest, label: string, model: string): ReactNode {
  if (result.ok) {
    return result.modelFound === false ? (
      <span className="text-warn">
        The key works, but it can’t reach “{model}”. Check the model name above.
      </span>
    ) : null;
  }
  const messages: Record<typeof result.reason, string> = {
    refused: `${label} turned this key down. Check it was copied in full.`,
    unreachable: `Couldn’t reach ${label}. Check your connection and try again.`,
    'no-key': `No ${label} key is saved.`,
    keychain: 'The keychain didn’t hand over the saved key. Unlock it and try again.',
    failed: `${label} answered with an error${result.httpStatus ? ` (${result.httpStatus})` : ''}. Try again in a moment.`,
  };
  return <ErrorText>{messages[result.reason]}</ErrorText>;
}

function ErrorText({ children }: { children: ReactNode }) {
  return <span className="text-del">{children}</span>;
}

const LOCATION_DESCRIPTIONS: Record<KeyLocation | 'unavailable', string> = {
  keychain:
    'Stored in the operating system keychain. Mosaic asks the OS for it when needed and never keeps a copy.',
  session: 'Held in memory for this session only. You will paste it again next launch.',
  unavailable:
    'No keychain was found on this computer, so keys are held in memory for this session only. You will paste them again next launch.',
};

/** A Test and the key and model it was for. Once either changes, its result no longer applies. */
interface TestRun {
  subject: string;
  result: KeyTest | 'testing';
}

function ApiKeyRows({ provider, model }: { provider: KeyedProvider; model: string }) {
  const { status, loadFailed, apply } = useSecretsStatus();
  const label = AI_PROVIDER_BY_ID[provider].label;
  const [draft, setDraft] = useState('');
  const [reveal, setReveal] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [test, setTest] = useState<TestRun | null>(null);

  const savedIn = status?.saved[provider];
  const key = draft.trim();
  // Main refuses these too; saying so here beats a failed Test.
  const keyHasSpaces = /\s/.test(key);
  const subject = JSON.stringify([savedIn ? 'saved' : key, model]);
  const tested = test?.subject === subject ? test.result : null;

  const runTest = async () => {
    const run = subject;
    setTest({ subject: run, result: 'testing' });
    let result: KeyTest;
    try {
      result = await window.mosaic.secrets.test(provider, model, savedIn ? undefined : key);
    } catch (error) {
      console.error('Key test failed', error);
      result = { ok: false, reason: 'failed' };
    }
    setTest((latest) => (latest?.subject === run ? { subject: run, result } : latest));
  };

  const save = async () => {
    if (!key || keyHasSpaces) return;
    try {
      await apply(window.mosaic.secrets.save(provider, key));
    } catch (error) {
      console.error('Could not save the key', error);
      setKeyError('Could not save the key. Try again.');
      return;
    }
    // A result for the key just saved still holds for it.
    if (tested && tested !== 'testing') {
      setTest({ subject: JSON.stringify(['saved', model]), result: tested });
    }
    setDraft('');
    setReveal(false);
    setKeyError(null);
  };

  const remove = async () => {
    try {
      await apply(window.mosaic.secrets.remove(provider));
      setKeyError(null);
    } catch (error) {
      console.error('Could not remove the key', error);
      setKeyError('Could not remove the key. If the keychain is locked, unlock it and try again.');
    }
  };

  const move = async (location: KeyLocation) => {
    setMoving(true);
    try {
      await apply(window.mosaic.secrets.setLocation(location));
      setMoveError(null);
    } catch (error) {
      console.error('Could not move the keys', error);
      setMoveError(
        'The keychain didn’t release the saved keys, so nothing moved. Unlock it and try again.'
      );
    } finally {
      setMoving(false);
    }
  };

  const testButton = (
    <AppButton
      type="button"
      variant="outline"
      size="sm"
      disabled={tested === 'testing' || (!savedIn && (!key || keyHasSpaces))}
      onClick={() => void runTest()}
    >
      {tested === 'testing' ? (
        'Testing…'
      ) : tested?.ok ? (
        <>
          <Check className="text-add" />
          Reachable
        </>
      ) : (
        'Test'
      )}
    </AppButton>
  );

  const note =
    keyError !== null ? (
      <ErrorText>{keyError}</ErrorText>
    ) : !savedIn && keyHasSpaces ? (
      <ErrorText>Keys have no spaces. Check what was pasted.</ErrorText>
    ) : loadFailed ? (
      <ErrorText>Could not check for a saved key.</ErrorText>
    ) : tested && tested !== 'testing' ? (
      testMessage(tested, label, model)
    ) : null;

  return (
    <>
      <SettingRow
        label="API key"
        description={
          <>
            Pasted keys are never written into your resume file or any backup.
            {note && <span className="mt-1 block">{note}</span>}
          </>
        }
      >
        {status === null && !loadFailed ? null : savedIn ? (
          <>
            <span className="text-support font-control text-ink-soft">
              {savedIn === 'keychain' ? 'Saved in the keychain' : 'Saved for this session'}
            </span>
            {testButton}
            <AppButton variant="outline" size="sm" onClick={() => void remove()}>
              Remove
            </AppButton>
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
              <AppInput
                type={reveal ? 'text' : 'password'}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
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
            {testButton}
            <AppButton type="submit" variant="outline" size="sm" disabled={!key || keyHasSpaces}>
              Save
            </AppButton>
          </form>
        )}
      </SettingRow>

      <SettingRow
        label="Where to keep the key"
        description={
          <>
            {
              LOCATION_DESCRIPTIONS[
                status?.keychain === 'unavailable'
                  ? 'unavailable'
                  : (status?.location ?? 'keychain')
              ]
            }
            {moveError && (
              <span className="mt-1 block">
                <ErrorText>{moveError}</ErrorText>
              </span>
            )}
          </>
        }
      >
        <AppToggleGroup
          type="single"
          value={status?.location ?? ''}
          // A single-choice group reports '' when the pressed item is pressed again.
          onValueChange={(value) => {
            if (value && value !== status?.location) void move(value as KeyLocation);
          }}
          disabled={status === null || moving}
          aria-label="Where to keep the key"
        >
          <AppToggleGroupItem value="keychain" disabled={status?.keychain === 'unavailable'}>
            OS keychain
          </AppToggleGroupItem>
          <AppToggleGroupItem value="session">This session</AppToggleGroupItem>
        </AppToggleGroup>
      </SettingRow>
    </>
  );
}
