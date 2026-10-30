import { useState, type ReactNode } from 'react';
import { RotateCw } from 'lucide-react';
import {
  AppButton,
  AppInput,
  AppSelect,
  AppSelectContent,
  AppSelectItem,
  AppSelectTrigger,
  AppSelectValue,
  Text,
} from '@/components/ui-kit';
import {
  DEFAULT_OLLAMA_ADDRESS,
  isLocalServerAddress,
  normalizeOllamaAddress,
  serverHost,
} from '@shared/model-providers/serverAddress';
import type { OllamaModel } from '@shared/types/modelProviders';
import { SettingRow } from '../../SettingRow';
import { ServerAddressRow, ServerCommand, ServerNote } from './ServerAddressRow';
import type { OllamaModelsAnswer } from './useOllamaModels';

function gigabytes(bytes: number): string | null {
  return bytes > 0 ? `${(bytes / 1e9).toFixed(1)} GB` : null;
}

/** Where Ollama is, and where resume text will go from there. */
export function OllamaAddressRow({
  address,
  onChange,
}: {
  address: string;
  onChange: (address: string) => void;
}) {
  return (
    <ServerAddressRow
      label="Ollama address"
      address={address}
      defaultAddress={DEFAULT_OLLAMA_ADDRESS}
      normalize={normalizeOllamaAddress}
      example="192.168.1.50:11434"
      description={
        isLocalServerAddress(address)
          ? 'Ollama on your computer, so your resume text never leaves it.'
          : `Ollama at ${serverHost(address)}, so your resume text goes there, on your network, when you ask for something.`
      }
      onChange={onChange}
    />
  );
}

/** Ollama's model: one of the chat models pulled where Ollama runs. */
export function OllamaModelRow({
  active,
  address,
  ollamaModels,
  model,
  onChange,
}: {
  /** AI is on, so Ollama may be asked for its models. */
  active: boolean;
  address: string;
  ollamaModels: OllamaModelsAnswer;
  model: string;
  onChange: (model: string) => void;
}) {
  const { result, checking, refresh } = ollamaModels;
  const pulled = result?.ok ? result.models : [];
  const isPulled = pulled.some((m) => m.name === model);
  // Only a list from a running Ollama can say a model is missing.
  const knownMissing = result?.ok === true && !isPulled;
  const host = serverHost(address);

  let note: ReactNode = null;
  if (active && result && !result.ok) {
    note =
      result.reason === 'unreachable'
        ? `Nothing answered at ${host}. Check Ollama is running there, then refresh.`
        : `Something at ${host} answered, but not like Ollama. Check the address.`;
  } else if (active && result?.ok && pulled.length === 0) {
    note = (
      <>
        No chat models are pulled yet. Run <ServerCommand>ollama pull {model}</ServerCommand>, then
        refresh.
      </>
    );
  } else if (knownMissing) {
    note = (
      <>
        “{model}” isn’t pulled. Pick one above, or run{' '}
        <ServerCommand>ollama pull {model}</ServerCommand>.
      </>
    );
  }

  return (
    <SettingRow
      label="Model"
      description={
        <>
          Models pulled into that Ollama.
          {note && <ServerNote tone="warning">{note}</ServerNote>}
        </>
      }
    >
      <AppSelect value={model} onValueChange={onChange}>
        <AppSelectTrigger className="w-54" aria-label="Ollama model">
          <AppSelectValue />
        </AppSelectTrigger>
        <AppSelectContent>
          {/* The chosen model stays listed, pulled or not, so the field never goes blank. */}
          {!isPulled && (
            <AppSelectItem value={model}>
              {model}
              {knownMissing && (
                <Text variant="secondary" className="text-ink-faint">
                  not pulled
                </Text>
              )}
            </AppSelectItem>
          )}
          {pulled.map((option) => (
            <AppSelectItem key={option.name} value={option.name}>
              {option.name}
              {gigabytes(option.sizeBytes) && (
                <Text variant="secondary" className="text-ink-faint">
                  {gigabytes(option.sizeBytes)}
                </Text>
              )}
            </AppSelectItem>
          ))}
        </AppSelectContent>
      </AppSelect>
      <AppButton
        variant="ghost"
        size="sm"
        shape="square"
        aria-label="Refresh Ollama models"
        title="Refresh"
        disabled={!active || checking}
        onClick={refresh}
      >
        <RotateCw />
      </AppButton>
    </SettingRow>
  );
}

const TOKEN_COUNT_FORMAT = new Intl.NumberFormat('en-US');

/** A typed token count, grouping marks allowed; null unless it is a positive whole number. */
function parseTokenCount(text: string): number | null {
  const digits = text.replace(/[\s,_]/g, '');
  if (!/^\d+$/.test(digits)) return null;
  const tokens = Number(digits);
  return tokens > 0 && Number.isSafeInteger(tokens) ? tokens : null;
}

/**
 * The context window Ollama runs the model with. Empty leaves it to Ollama's own setting,
 * shown as the placeholder while Ollama has the model loaded. Saved like the address: on
 * Enter or when the field is left.
 */
export function OllamaContextRow({
  model,
  details,
  contextTokens,
  onChange,
}: {
  model: string;
  /** What Ollama said about `model`, when it is pulled. */
  details: OllamaModel | undefined;
  contextTokens: number | null;
  onChange: (tokens: number | null) => void;
}) {
  // What is being typed; null while the field shows the saved window.
  const [draft, setDraft] = useState<string | null>(null);
  const invalid = draft !== null && draft.trim() !== '' && parseTokenCount(draft) === null;
  const maxTokens = details?.maxContextTokens ?? null;
  const loadedTokens = details?.loadedContextTokens ?? null;

  const commit = () => {
    if (draft === null) return;
    const tokens = draft.trim() === '' ? null : parseTokenCount(draft);
    if (tokens === null && draft.trim() !== '') return;
    onChange(tokens);
    setDraft(null);
  };

  return (
    <SettingRow
      label="Context window"
      description={
        <>
          Larger fits longer conversations but needs more memory.
          {maxTokens !== null &&
            ` ${model} supports up to ${TOKEN_COUNT_FORMAT.format(maxTokens)} tokens.`}
          {invalid && (
            <ServerNote tone="error">
              That isn’t a number of tokens. For example: <ServerCommand>32768</ServerCommand>
            </ServerNote>
          )}
        </>
      }
    >
      <AppInput
        value={draft ?? (contextTokens === null ? '' : TOKEN_COUNT_FORMAT.format(contextTokens))}
        placeholder={
          loadedTokens === null
            ? 'Ollama’s setting'
            : `${TOKEN_COUNT_FORMAT.format(loadedTokens)} · Ollama’s setting`
        }
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
          if (event.key === 'Escape') setDraft(null);
        }}
        aria-label="Ollama context window, in tokens"
        aria-invalid={invalid}
        inputMode="numeric"
        spellCheck={false}
        autoComplete="off"
        className="w-54 font-mono text-meta"
      />
      {contextTokens !== null && (
        <AppButton
          variant="ghost"
          size="sm"
          onClick={() => {
            setDraft(null);
            onChange(null);
          }}
        >
          Use Ollama’s setting
        </AppButton>
      )}
    </SettingRow>
  );
}
