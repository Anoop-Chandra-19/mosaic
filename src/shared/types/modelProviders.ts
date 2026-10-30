export type ModelProviderId =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'ollama'
  | 'openrouter'
  | 'openaiCompatible';

/** The setting the renderer keeps the assistant's settings in; main reads it to start a run. */
export const AGENT_SETTINGS_KEY = 'agentSettings';

/** A model pulled into the local Ollama that can hold a conversation. */
export interface OllamaModel {
  /** What Ollama calls it, tag included: `qwen3.5:9b`. */
  name: string;
  sizeBytes: number;
  /** "9.7B", when Ollama says. */
  parameterSize: string | null;
  /** The most the model supports, when Ollama says. */
  maxContextTokens: number | null;
  /** The window Ollama has it loaded with now; null while it isn't loaded. */
  loadedContextTokens: number | null;
}

/**
 * `unreachable`: nothing answered at the address. `failed`: something answered, but not
 * like the server it should be. `invalid-address`: the address isn't one
 * (see `serverAddress.ts`).
 */
export type ServerModelsFailure = {
  ok: false;
  reason: 'unreachable' | 'failed' | 'invalid-address';
};

export type OllamaModels = { ok: true; models: OllamaModel[] } | ServerModelsFailure;

/** The model names an OpenAI-compatible server lists, which is all it says about them. */
export type OpenAiCompatibleModels = { ok: true; models: string[] } | ServerModelsFailure;

/** A provider and model the assistant has run with. */
export interface UsedModel {
  provider: ModelProviderId;
  model: string;
}

/** `window.mosaic.modelProviders`: what main can find out about model providers for the renderer. */
export interface MosaicModelProviders {
  /** Every provider and model a run has used, the most recently used first. */
  usedModels(): Promise<UsedModel[]>;
  /**
   * The chat models pulled into the Ollama at `address` — this machine's by default, or one
   * on the network. Embedding-only models are left out.
   */
  ollamaModels(address: string): Promise<OllamaModels>;
  /** The models the OpenAI-compatible server at `address` lists. */
  openAiCompatibleModels(address: string): Promise<OpenAiCompatibleModels>;
}
