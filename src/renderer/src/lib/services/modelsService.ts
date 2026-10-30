import type { ModelProviderId, OllamaModels } from '@shared/types/modelProviders';
import { readOr } from './readOr';

/* The models Settings offers, beyond what a key lists (`secretsService.listModels`). */
export const modelsService = {
  /** The chat models pulled into the Ollama at `address`. Never rejects. */
  ollamaModels: (address: string) =>
    readOr<OllamaModels>(
      () => window.mosaic.modelProviders.ollamaModels(address),
      { ok: false, reason: 'failed' },
      'Could not list Ollama models'
    ),
  /** The models runs have used with this provider. Never rejects. */
  usedBefore: (provider: ModelProviderId) =>
    readOr(
      async () => {
        const used = await window.mosaic.modelProviders.usedModels();
        return used.filter((each) => each.provider === provider).map((each) => each.model);
      },
      [],
      'Could not read the models used before'
    ),
};
