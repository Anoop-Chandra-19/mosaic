import { useEffect, useState, type ReactNode } from 'react';
import { RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { OllamaModels } from '@/types/ai';
import { SettingRow } from '../SettingRow';

function gigabytes(bytes: number): string | null {
  return bytes > 0 ? `${(bytes / 1e9).toFixed(1)} GB` : null;
}

/**
 * Asks main for Ollama's chat models while `active` — only once AI is on, so Settings
 * contacts nothing before then, not even Ollama on this machine. `refresh` asks again.
 */
function useOllamaModels(active: boolean) {
  const [asked, setAsked] = useState(0);
  const [answer, setAnswer] = useState<{ asked: number; result: OllamaModels } | null>(null);

  useEffect(() => {
    if (!active) return;
    let current = true;
    window.mosaic.ai.ollamaModels().then(
      (result) => current && setAnswer({ asked, result }),
      (error: unknown) => {
        console.error('Could not list Ollama models', error);
        if (current) setAnswer({ asked, result: { ok: false, reason: 'failed' } });
      }
    );
    return () => {
      current = false;
    };
  }, [active, asked]);

  return {
    result: answer?.result ?? null,
    checking: active && answer?.asked !== asked,
    refresh: () => setAsked((count) => count + 1),
  };
}

function Command({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-zinc-100 px-1 font-mono whitespace-nowrap text-[0.95em] text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
      {children}
    </code>
  );
}

/** Ollama's model: one of the chat models pulled on this machine. */
export function OllamaModelRow({
  active,
  model,
  onChange,
}: {
  /** AI is on, so Ollama may be asked for its models. */
  active: boolean;
  model: string;
  onChange: (model: string) => void;
}) {
  const { result, checking, refresh } = useOllamaModels(active);
  const pulled = result?.ok ? result.models : [];
  const isPulled = pulled.some((m) => m.name === model);
  // Only a list from a running Ollama can say a model is missing.
  const knownMissing = result?.ok === true && !isPulled;

  let note: ReactNode = null;
  if (active && result && !result.ok) {
    note =
      result.reason === 'not-running'
        ? 'Ollama isn’t running on this machine. Start it, then refresh.'
        : 'Couldn’t read the models from Ollama. Try refreshing.';
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
          Pulled models on this machine.
          {note && <span className="mt-1 block text-amber-700 dark:text-amber-400">{note}</span>}
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
