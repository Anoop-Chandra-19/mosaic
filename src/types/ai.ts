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
  /**
   * `unreachable`: nothing answered at the address. `failed`: something answered, but not
   * like Ollama. `invalid-address`: the address isn't one (see `normalizeOllamaAddress`).
   */
  | { ok: false; reason: 'unreachable' | 'failed' | 'invalid-address' };

/** `window.mosaic.ai`: what main can find out about AI providers for the renderer. */
export interface MosaicAI {
  /**
   * The chat models pulled into the Ollama at `address` — this machine's by default, or one
   * on the network. Embedding-only models are left out.
   */
  ollamaModels(address: string): Promise<OllamaModels>;
}
