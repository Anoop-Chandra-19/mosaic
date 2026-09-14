import { useEffect, useState, type ReactNode } from 'react';
import { RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DEFAULT_OLLAMA_ADDRESS,
  isLocalOllamaAddress,
  normalizeOllamaAddress,
  ollamaHost,
} from '@/lib/ai/ollamaAddress';
import type { OllamaModels } from '@/types/ai';
import { SettingRow } from '../SettingRow';

function gigabytes(bytes: number): string | null {
  return bytes > 0 ? `${(bytes / 1e9).toFixed(1)} GB` : null;
}

function Command({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-zinc-100 px-1 font-mono text-[0.95em] whitespace-nowrap text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
      {children}
    </code>
  );
}

function Note({ tone, children }: { tone: 'error' | 'warning'; children: ReactNode }) {
  return (
    <span
      className={
        tone === 'error'
          ? 'mt-1 block text-red-700 dark:text-red-400'
          : 'mt-1 block text-amber-700 dark:text-amber-400'
      }
    >
      {children}
    </span>
  );
}

/**
 * Where Ollama is: this machine by default, or a box on the network. The address is saved
 * on Enter or when the field is left — never mid-typing, so a half-typed address is never
 * asked for anything — and the description says where resume text will go.
 */
export function OllamaAddressRow({
  address,
  onChange,
}: {
  address: string;
  onChange: (address: string) => void;
}) {
  // What is being typed; null while the field shows the saved address.
  const [draft, setDraft] = useState<string | null>(null);
  const invalid = draft !== null && draft.trim() !== '' && normalizeOllamaAddress(draft) === null;

  const commit = () => {
    if (draft === null) return;
    const next = normalizeOllamaAddress(draft);
    if (next !== null) onChange(next);
    // An empty field goes back to the saved address; a bad one stays for fixing.
    if (next !== null || draft.trim() === '') setDraft(null);
  };

  return (
    <SettingRow
      label="Ollama address"
      description={
        <>
          {isLocalOllamaAddress(address)
            ? 'Ollama on this machine — your resume text never leaves it.'
            : `Ollama at ${ollamaHost(address)} — your resume text goes there, on your network, when you ask for something.`}
          {invalid && (
            <Note tone="error">
              That isn’t an address. For example: <Command>192.168.1.50:11434</Command>
            </Note>
          )}
        </>
      }
    >
      <Input
        value={draft ?? address}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
          if (event.key === 'Escape') setDraft(null);
        }}
        aria-label="Ollama address"
        aria-invalid={invalid}
        spellCheck={false}
        autoComplete="off"
        className="h-8 w-54 font-mono text-xs"
      />
      {address !== DEFAULT_OLLAMA_ADDRESS && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          onClick={() => {
            setDraft(null);
            onChange(DEFAULT_OLLAMA_ADDRESS);
          }}
        >
          Use this machine
        </Button>
      )}
    </SettingRow>
  );
}

/**
 * Asks main for the chat models at `address` while `active` — only once AI is on, so
 * Settings contacts nothing before then. A new address, or `refresh`, asks again.
 */
function useOllamaModels(active: boolean, address: string) {
  const [asked, setAsked] = useState(0);
  const [answer, setAnswer] = useState<{ key: string; result: OllamaModels } | null>(null);
  const key = `${address}#${asked}`;

  useEffect(() => {
    if (!active) return;
    let current = true;
    const answered = (result: OllamaModels) => {
      if (current) setAnswer({ key: `${address}#${asked}`, result });
    };
    window.mosaic.ai.ollamaModels(address).then(answered, (error: unknown) => {
      console.error('Could not list Ollama models', error);
      answered({ ok: false, reason: 'failed' });
    });
    return () => {
      current = false;
    };
  }, [active, address, asked]);

  // An answer about another address says nothing about this one.
  const fresh = answer?.key.startsWith(`${address}#`) ? answer.result : null;
  return {
    result: fresh,
    checking: active && answer?.key !== key,
    refresh: () => setAsked((count) => count + 1),
  };
}

/** Ollama's model: one of the chat models pulled where Ollama runs. */
export function OllamaModelRow({
  active,
  address,
  model,
  onChange,
}: {
  /** AI is on, so Ollama may be asked for its models. */
  active: boolean;
  address: string;
  model: string;
  onChange: (model: string) => void;
}) {
  const { result, checking, refresh } = useOllamaModels(active, address);
  const pulled = result?.ok ? result.models : [];
  const isPulled = pulled.some((m) => m.name === model);
  // Only a list from a running Ollama can say a model is missing.
  const knownMissing = result?.ok === true && !isPulled;
  const host = ollamaHost(address);

  let note: ReactNode = null;
  if (active && result && !result.ok) {
    note =
      result.reason === 'unreachable'
        ? `Nothing answered at ${host}. Check Ollama is running there, then refresh.`
        : `Something at ${host} answered, but not like Ollama. Check the address.`;
  } else if (active && result?.ok && pulled.length === 0) {
    note = (
      <>
        No chat models are pulled yet. Run <Command>ollama pull {model}</Command>, then refresh.
      </>
    );
  } else if (knownMissing) {
    note = (
      <>
        “{model}” isn’t pulled. Pick one above, or run <Command>ollama pull {model}</Command>.
      </>
    );
  }

  return (
    <SettingRow
      label="Model"
      description={
        <>
          Models pulled into that Ollama.
          {note && <Note tone="warning">{note}</Note>}
        </>
      }
    >
      <Select value={model} onValueChange={onChange}>
        <SelectTrigger size="sm" className="w-54" aria-label="Ollama model">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {/* The chosen model stays listed, pulled or not, so the field never goes blank. */}
          {!isPulled && (
            <SelectItem value={model}>
              {model}
              {knownMissing && <span className="text-xs text-zinc-500">not pulled</span>}
            </SelectItem>
          )}
          {pulled.map((option) => (
            <SelectItem key={option.name} value={option.name}>
              {option.name}
              {gigabytes(option.sizeBytes) && (
                <span className="text-xs text-zinc-500">{gigabytes(option.sizeBytes)}</span>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Refresh Ollama models"
        title="Refresh"
        disabled={!active || checking}
        onClick={refresh}
      >
        <RotateCw />
      </Button>
    </SettingRow>
  );
}
