/** Where Ollama listens unless told otherwise. */
export const DEFAULT_OLLAMA_ADDRESS = 'http://127.0.0.1:11434';

const OLLAMA_PORT = '11434';

/**
 * An Ollama address as Mosaic uses it — scheme, host, and port, nothing else — or null if
 * the text isn't one. Forgiving about what people type: `192.168.1.50` and
 * `gpu-box:8080` are fine; a missing scheme means http, a missing port means Ollama's.
 * Refused: anything but http(s), and credentials in the address. Used by the settings row
 * to say so as you type, and by main before it sends anything there.
 */
export function normalizeOllamaAddress(input: string): string | null {
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

  // URL drops a port equal to the scheme's default, so look at what was typed.
  const authority = text.replace(/^[a-z][a-z\d+.-]*:\/\//i, '').split(/[/?#]/)[0];
  if (!/:\d+$/.test(authority)) url.port = OLLAMA_PORT;
  return url.origin;
}

/** Whether the address is this machine, so nothing sent there leaves it. */
export function isLocalOllamaAddress(address: string): boolean {
  const { hostname } = new URL(address);
  return (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === '[::1]' ||
    /^127\.\d+\.\d+\.\d+$/.test(hostname)
  );
}

/** "192.168.1.50:11434" — the address without its scheme, for sentences. */
export function ollamaHost(address: string): string {
  return new URL(address).host;
}
