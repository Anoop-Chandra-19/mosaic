/*
 * The address of a model server the user runs: Ollama, or an OpenAI-compatible one. The
 * settings rows use these to say what's wrong as you type, and main before it sends anything.
 */

const OLLAMA_PORT = '11434';
/** llama.cpp's; LM Studio's is 1234 and vLLM's 8000, which the settings row says. */
const OPENAI_COMPATIBLE_PORT = '8080';

/** Where Ollama listens unless told otherwise. */
export const DEFAULT_OLLAMA_ADDRESS = `http://127.0.0.1:${OLLAMA_PORT}`;

export const DEFAULT_OPENAI_COMPATIBLE_ADDRESS = `http://127.0.0.1:${OPENAI_COMPATIBLE_PORT}`;

const SCHEME_DEFAULT_PORT: Record<string, string> = { 'http:': '80', 'https:': '443' };

/**
 * An address as Mosaic uses it — scheme, host, and port, nothing else — or null if the text
 * isn't one. Forgiving about what people type: `192.168.1.50` and `gpu-box:8080` are fine; a
 * missing scheme means http, a missing port means the server's own, and a path such as a
 * pasted `/v1` is dropped. Refused: anything but http(s), and credentials in the address.
 */
function normalizeServerAddress(input: string, defaultPort: string): string | null {
  let text = input.trim();
  if (text === '') return null;
  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(text)) text = `http://${text}`;

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.username || url.password || url.hostname === '') return null;

  // URL drops a port equal to the scheme's default, so look at what was typed and write it out.
  const authority = text.replace(/^[a-z][a-z\d+.-]*:\/\//i, '').split(/[/?#]/)[0];
  if (!/:\d+$/.test(authority)) url.port = defaultPort;
  return `${url.protocol}//${url.hostname}:${url.port || SCHEME_DEFAULT_PORT[url.protocol]}`;
}

export const normalizeOllamaAddress = (input: string): string | null =>
  normalizeServerAddress(input, OLLAMA_PORT);

export const normalizeOpenAiCompatibleAddress = (input: string): string | null =>
  normalizeServerAddress(input, OPENAI_COMPATIBLE_PORT);

/** Whether the address is this machine, so nothing sent there leaves it. */
export function isLocalServerAddress(address: string): boolean {
  const { hostname } = new URL(address);
  return (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === '[::1]' ||
    /^127\.\d+\.\d+\.\d+$/.test(hostname)
  );
}

/** "192.168.1.50:11434" — the address without its scheme, for sentences. */
export function serverHost(address: string): string {
  return new URL(address).host;
}
