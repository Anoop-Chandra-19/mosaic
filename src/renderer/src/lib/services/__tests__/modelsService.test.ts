import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { modelsService } from '../modelsService';

const modelProviders = { usedModels: vi.fn(), ollamaModels: vi.fn() };

beforeEach(() => vi.stubGlobal('window', { mosaic: { modelProviders } }));
afterEach(() => vi.unstubAllGlobals());

describe('modelsService', () => {
  it('gives the models used before with this provider only', async () => {
    modelProviders.usedModels.mockResolvedValueOnce([
      { provider: 'openai', model: 'gpt-5.6-terra' },
      { provider: 'ollama', model: 'qwen3.5:9b' },
      { provider: 'openai', model: 'gpt-6.1-terra' },
    ]);
    await expect(modelsService.usedBefore('openai')).resolves.toEqual([
      'gpt-5.6-terra',
      'gpt-6.1-terra',
    ]);
  });

  it('answers a failed read as an answer, and logs it once', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    modelProviders.usedModels.mockRejectedValueOnce(new Error('No answer'));
    modelProviders.ollamaModels.mockRejectedValueOnce(new Error('No answer'));

    await expect(modelsService.usedBefore('openai')).resolves.toEqual([]);
    await expect(modelsService.ollamaModels('http://127.0.0.1:11434')).resolves.toEqual({
      ok: false,
      reason: 'failed',
    });
    expect(logged).toHaveBeenCalledTimes(2);
    logged.mockRestore();
  });
});
