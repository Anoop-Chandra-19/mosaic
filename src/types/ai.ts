/** A model pulled into the local Ollama that can hold a conversation. */
export interface OllamaModel {
  /** What Ollama calls it, tag included: `qwen3.5:9b`. */
  name: string;
  sizeBytes: number;
  /** "9.7B", when Ollama says. */
  parameterSize: string | null;
}

export type OllamaModels =
  | { ok: true; models: OllamaModel[] }
  /** `not-running`: nothing answered on Ollama's port. `failed`: it answered with something else. */
  | { ok: false; reason: 'not-running' | 'failed' };

/** `window.mosaic.ai`: what main can find out about AI providers for the renderer. */
export interface MosaicAI {
  /** The chat models pulled into Ollama on this machine. Embedding-only models are left out. */
  ollamaModels(): Promise<OllamaModels>;
}
