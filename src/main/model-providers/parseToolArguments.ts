/** A call whose arguments won't parse goes on as written, for the repair round. */
export function parseToolArguments(written: string): unknown {
  try {
    return JSON.parse(written);
  } catch {
    return written;
  }
}
