import { secretsService } from '@/lib/services/secretsService';
import type { KeyedProvider, SavedKey } from '@shared/types/secrets';
import { useAskedAnswer } from './useAskedAnswer';

export type ModelListAnswer = ReturnType<typeof useModelList>;

/**
 * The chat models a checked key can use. After a check main already holds the list, so it
 * answers without asking the provider; `refresh` asks again. A key saved without a check has
 * no list until it passes one.
 */
export function useModelList(
  active: boolean,
  provider: KeyedProvider,
  saved: SavedKey | undefined
) {
  const isAsking = active && saved !== undefined && saved.checkedAt !== null;
  const { value, isWaiting, refresh } = useAskedAnswer(
    isAsking,
    `${provider}#${saved?.savedAt}`,
    (isRefresh) => secretsService.listModels(provider, isRefresh)
  );
  return { listing: isAsking ? value : null, isLoading: isWaiting, refresh };
}
