import { useEffect, useState } from 'react';
import type { OllamaModels } from '@shared/types/modelProviders';

export type OllamaModelsAnswer = ReturnType<typeof useOllamaModels>;

/**
 * Asks main for the chat models at `address` while `active` — only once AI is on, so
 * Settings contacts nothing before then. A new address, or `refresh`, asks again.
 */
export function useOllamaModels(active: boolean, address: string) {
  const [asked, setAsked] = useState(0);
  const [answer, setAnswer] = useState<{ key: string; result: OllamaModels } | null>(null);
  const key = `${address}#${asked}`;

  useEffect(() => {
    if (!active) return;
    let current = true;
    const answered = (result: OllamaModels) => {
      if (current) setAnswer({ key: `${address}#${asked}`, result });
    };
    window.mosaic.modelProviders.ollamaModels(address).then(answered, (error: unknown) => {
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
