// Only type imports: the eval scripts load this with plain Node.
import type { PropertySchema } from '@shared/agent-tools/defineAgentTool';
import type { ModelTool } from '@shared/types/modelTool';

/*
 * Normalize tool arguments before schema validation (`checkAgentToolArgs.ts`).
 * Accept supported alternative forms and report each adjustment so the model learns
 * the expected form:
 *
 * - "true" or "false" for a yes or no;
 * - an enum value in another case ("Skills" for `skills`);
 * - a handle in another case ("B2"), inside other text ("b2."), or at the end of a path of
 *   handles that hold each other (`e1b2` is b2 when e1 holds b2);
 * - an item's own words where its handle goes, when exactly one item has them.
 *
 * Leave unresolved arguments unchanged for schema validation to reject.
 */

export interface ReadToolArgs {
  args: Record<string, unknown>;
  /** Notes on normalized arguments, such as 'Took "Spanish, fluent" as "l4".'. */
  took: string[];
}

/** Receipt lookups needed to normalize model-supplied references. */
export interface ResumeLookup {
  /** The handle of the one bullet, line, entry or section with these words, if one has them. */
  findByText: (text: string) => string | null;
  /** Whether `holder` holds `handle`, directly or through an entry. */
  holds: (holder: string, handle: string) => boolean;
}

const HANDLE = /[sebl][0-9]+/g;

/**
 * Resolve concatenated handles ("e1b2") to the last handle if each handle contains
 * the next. Return null if the value is not a handle sequence or the path is invalid.
 */
function readHandlePath(lower: string, lookup: ResumeLookup): string | null {
  const handles = lower.match(HANDLE) ?? [];
  if (handles.length < 2 || handles.join('') !== lower) return null;
  const isPath = handles.slice(1).every((handle, i) => lookup.holds(handles[i], handle));
  return isPath ? handles.at(-1)! : null;
}

/** The one handle inside other text ("b2." or "handle b2"), if there is exactly one. */
function readOneHandleInside(lower: string): string | null {
  const handles = [...new Set(lower.match(HANDLE) ?? [])];
  return handles.length === 1 ? handles[0] : null;
}

/** Try normalized text, a handle reference, then receipt text; return the first pattern match. */
function readPatterned(value: string, pattern: string, lookup: ResumeLookup): string | null {
  const whole = new RegExp(pattern);
  const lower = value.trim().toLowerCase();
  const isHandleRun = (lower.match(HANDLE) ?? []).join('') === lower;
  const readings = [
    lower,
    isHandleRun ? readHandlePath(lower, lookup) : readOneHandleInside(lower),
    lookup.findByText(value),
  ];
  return readings.find((reading) => reading !== null && whole.test(reading)) ?? null;
}

/** Normalize a supported argument form, or return undefined when no adjustment applies. */
function readProperty(value: unknown, schema: PropertySchema, lookup: ResumeLookup): unknown {
  if (schema.type === 'boolean') {
    if (typeof value !== 'string') return undefined;
    const lower = value.trim().toLowerCase();
    return lower === 'true' || lower === 'false' ? lower === 'true' : undefined;
  }
  if (schema.type !== 'string' || typeof value !== 'string') return undefined;
  if (schema.enum && !schema.enum.includes(value)) {
    return schema.enum.find((option) => option === value.trim().toLowerCase());
  }
  if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
    return readPatterned(value, schema.pattern, lookup) ?? undefined;
  }
  return undefined;
}

/** Accept an array or a JSON-encoded array; return null for other values. */
export function readList(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Normalize patterned list items, leaving matching or unresolved items unchanged. */
function readListItems(list: unknown[], pattern: string, lookup: ResumeLookup): unknown[] {
  return list.map((item) =>
    typeof item === 'string' && !new RegExp(pattern).test(item)
      ? (readPatterned(item, pattern, lookup) ?? item)
      : item
  );
}

const isLeftOut = (value: unknown) => value === undefined || value === null || value === '';

export function readAgentToolArgs(
  tool: ModelTool,
  given: Record<string, unknown>,
  lookup: ResumeLookup
): ReadToolArgs {
  const properties = (tool.inputSchema.properties ?? {}) as Record<string, PropertySchema>;
  const args = { ...given };
  const took: string[] = [];
  for (const [name, schema] of Object.entries(properties)) {
    const value = args[name];
    if (isLeftOut(value)) continue;
    const list = schema.type === 'array' && schema.items.pattern ? readList(value) : null;
    if (list && schema.type === 'array' && schema.items.pattern) {
      const items = readListItems(list, schema.items.pattern, lookup);
      if (items.every((item, i) => item === list[i])) continue;
      args[name] = items;
      took.push(`Took ${name} as ${JSON.stringify(items)}.`);
      continue;
    }
    const reading = readProperty(value, schema, lookup);
    if (reading === undefined || reading === value) continue;
    args[name] = reading;
    took.push(`Took ${JSON.stringify(value)} as ${JSON.stringify(reading)}.`);
  }
  return { args, took };
}
