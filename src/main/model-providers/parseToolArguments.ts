/**
 * A model that loses its way can write tens of thousands of characters where the arguments
 * go. The conversation stores what it wrote and sends it back on every later step, so only
 * the start is kept: enough to show what went wrong.
 */
export const UNREAD_ARGUMENTS_MAX_CHARS = 200;

/**
 * Arguments that are not JSON, or are JSON text and not an object, go on as text, for the
 * tool to refuse and the model to write again. Some servers send nothing at all for a call
 * with no arguments, which is an empty object.
 */
export function parseToolArguments(written: string): unknown {
  if (written.trim() === '') return {};
  let parsed: unknown = written;
  try {
    parsed = JSON.parse(written);
  } catch {
    // Not JSON: `parsed` stays what the model wrote.
  }
  return typeof parsed === 'string' ? parsed.slice(0, UNREAD_ARGUMENTS_MAX_CHARS) : parsed;
}
