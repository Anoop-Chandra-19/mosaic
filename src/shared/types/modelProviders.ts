export type ModelProviderId =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'ollama'
  | 'openrouter'
  | 'openaiCompatible';

/** Storage key for the renderer's assistant settings; main reads them when starting a run. */
export const AGENT_SETTINGS_KEY = 'agentSettings';

/** A chat model downloaded to the local Ollama server. */
export interface OllamaModel {
  /** Ollama model name, including its tag, such as `qwen3.5:9b`. */
  name: string;
  sizeBytes: number;
  /** Parameter count such as "9.7B", when reported by Ollama. */
  parameterSize: string | null;
  /** Maximum context length in tokens, when reported by Ollama. */
  maxContextTokens: number | null;
  /** Currently loaded context length in tokens; null if the model is not loaded. */
  loadedContextTokens: number | null;
}

/**
 * `unreachable`: no response from the address. `failed`: the response did not match the
 * expected server API. `invalid-address`: the address is invalid (see `serverAddress.ts`).
 */
export type ServerModelsFailure = {
  ok: false;
  reason: 'unreachable' | 'failed' | 'invalid-address';
};

export type OllamaModels = { ok: true; models: OllamaModel[] } | ServerModelsFailure;

/** Model names listed by an OpenAI-compatible server; no other model metadata is provided. */
export type OpenAiCompatibleModels = { ok: true; models: string[] } | ServerModelsFailure;

/** A provider and model the assistant has run with. */
export interface UsedModel {
  provider: ModelProviderId;
  model: string;
}

/** `window.mosaic.modelProviders`: provider information queried by main for the renderer. */
export interface MosaicModelProviders {
  /** Every provider and model a run has used, the most recently used first. */
  usedModels(): Promise<UsedModel[]>;
  /**
   * Chat models downloaded to the Ollama server at `address`, on this machine by default
   * or on the network. Excludes embedding-only models.
   */
  ollamaModels(address: string): Promise<OllamaModels>;
  /** The models the OpenAI-compatible server at `address` lists. */
  openAiCompatibleModels(address: string): Promise<OpenAiCompatibleModels>;
}
