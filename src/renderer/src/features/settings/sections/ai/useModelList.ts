import { useEffect, useState } from 'react';
import type { KeyedProvider, ModelListing, SavedKey } from '@shared/types/secrets';

export type ModelListAnswer = ReturnType<typeof useModelList>;

/**
 * The chat models a checked key can use, asked of main while `active`. After a check main
 * already holds the list, so it answers without asking the provider; `refresh` asks again.
 * A key saved without a check has no list until it passes one.
 */
export function useModelList(
  active: boolean,
  provider: KeyedProvider,
  saved: SavedKey | undefined
) {
  const [asked, setAsked] = useState(0);
  const [answer, setAnswer] = useState<{
    provider: KeyedProvider;
    savedAt: number;
    asked: number;
    listing: ModelListing;
  } | null>(null);
  const savedAt = saved?.savedAt ?? null;
  const isAsking = active && savedAt !== null && saved?.checkedAt !== null;

  useEffect(() => {
    if (!isAsking || savedAt === null) return;
    let current = true;
    const answered = (listing: ModelListing) => {
      if (current) setAnswer({ provider, savedAt, asked, listing });
    };
    window.mosaic.secrets.listModels(provider, asked > 0).then(answered, (error: unknown) => {
      console.error('Could not list the models', error);
      answered({ ok: false, reason: 'failed' });
    });
    return () => {
      current = false;
    };
  }, [isAsking, provider, savedAt, asked]);

  // An answer about another key says nothing about this one.
  const isForThisKey = answer?.provider === provider && answer.savedAt === savedAt;
  return {
    listing: isAsking && isForThisKey ? answer.listing : null,
    isLoading: isAsking && !(isForThisKey && answer.asked === asked),
    refresh: () => setAsked((count) => count + 1),
  };
}
