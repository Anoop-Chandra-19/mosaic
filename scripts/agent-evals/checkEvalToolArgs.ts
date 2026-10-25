/**
 * A tool call's arguments checked against the tool's own schema before it runs, as the
 * app's `checkAgentToolArgs` would with B2b: what is required, the type, an enum, and a
 * pattern. The refusal comes from the schema, so it is the same for every tool and case:
 * the argument, what was given, and the argument's own description.
 */
import type { EvalTool } from './evalModelProviders.ts';

interface PropertySchema {
  type?: string;
  enum?: string[];
  pattern?: string;
  description?: string;
  items?: { type?: string; pattern?: string };
}

/** A list, also when a model sends it as a JSON string. */
function readList(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

const isGiven = (value: unknown) => value !== undefined && value !== null && value !== '';

/** " name: its description", to end a refusal with what the argument is. */
const describeArg = (name: string, schema: PropertySchema | undefined) =>
  schema?.description ? ` ${name}: ${schema.description}` : '';

function checkProperty(name: string, value: unknown, schema: PropertySchema): string | null {
  const about = describeArg(name, schema);
  if (schema.type === 'boolean') {
    return typeof value === 'boolean' ? null : `${name} is true or false.`;
  }
  if (schema.type === 'array') {
    const list = readList(value);
    if (!list) return `${name} is a list.${about}`;
    if (!schema.items?.pattern) return null;
    const itemPattern = new RegExp(schema.items.pattern);
    const misfit = list.find((item) => typeof item !== 'string' || !itemPattern.test(item.trim()));
    return misfit === undefined ? null : `${JSON.stringify(misfit)} doesn't fit ${name}.${about}`;
  }
  if (typeof value !== 'string') return `${name} is text.${about}`;
  if (schema.enum && !schema.enum.includes(value.trim())) {
    return `${name} is one of ${schema.enum.join(', ')}.`;
  }
  if (schema.pattern && !new RegExp(schema.pattern).test(value.trim())) {
    return `"${value}" doesn't fit ${name}.${about}`;
  }
  return null;
}

/** The first problem with a call's arguments, or null when they fit the tool's schema. */
export function checkEvalToolArgs(tool: EvalTool, args: Record<string, unknown>): string | null {
  const properties = (tool.parameters.properties ?? {}) as Record<string, PropertySchema>;
  const required = (tool.parameters.required ?? []) as string[];
  for (const name of required) {
    if (!isGiven(args[name])) return `${name} is needed.${describeArg(name, properties[name])}`;
  }
  for (const [name, schema] of Object.entries(properties)) {
    if (!isGiven(args[name])) continue;
    const problem = checkProperty(name, args[name], schema);
    if (problem) return problem;
  }
  return null;
}
