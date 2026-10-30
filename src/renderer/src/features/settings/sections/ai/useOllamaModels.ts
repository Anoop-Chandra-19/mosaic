import { modelsService } from '@/lib/services/modelsService';
import { useAskedAnswer } from './useAskedAnswer';

export type OllamaModelsAnswer = ReturnType<typeof useOllamaModels>;

/** The chat models at `address`. */
export function useOllamaModels(active: boolean, address: string) {
  const { value, isWaiting, refresh } = useAskedAnswer(active, address, () =>
    modelsService.ollamaModels(address)
  );
  return { result: value, checking: isWaiting, refresh };
}
