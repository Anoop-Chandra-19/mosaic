// Only type imports besides its sibling: the eval scripts load this with plain Node.
import type { PropertySchema } from '@shared/agent-tools/defineAgentTool';
import type { ModelTool } from '@shared/types/modelTool';
import { readList } from './readAgentToolArgs.ts';

/*
 * A call's arguments checked against the schema the model was given, after they are read
 * (`readAgentToolArgs.ts`): what is required, the type, an enum, and a pattern. A refusal
 * comes from the schema, so it is the same for every tool: the argument, what was given,
 * and the argument's own description. Unknown names are dropped, and an empty optional
 * text counts as left out ("after": "" means none).
 */

export type CheckedToolArgs = { args: Record<string, unknown> } | { problem: string };

const isLeftOut = (value: unknown) => value === undefined || value === null || value === '';

/** " name: its description", to end a refusal with what the argument is. */
const describeArg = (name: string, schema: PropertySchema) =>
  schema.description ? ` ${name}: ${schema.description}` : '';

type Checked = { value: unknown } | { problem: string };

function checkList(name: string, value: unknown, schema: PropertySchema): Checked {
  const list = readList(value);
  const about = describeArg(name, schema);
  if (!list) return { problem: `${name} is a list.${about}` };
  const pattern = schema.type === 'array' ? schema.items.pattern : undefined;
  const fits = (item: unknown) =>
    typeof item === 'string' && (!pattern || new RegExp(pattern).test(item.trim()));
  const misfit = list.find((item) => !fits(item));
  if (misfit !== undefined) {
    return { problem: `${JSON.stringify(misfit)} doesn't fit ${name}.${about}` };
  }
  return { value: (list as string[]).map((item) => item.trim()) };
}

function checkText(name: string, value: unknown, schema: PropertySchema): Checked {
  const about = describeArg(name, schema);
  if (typeof value !== 'string') return { problem: `${name} is text.${about}` };
  if (schema.type !== 'string') return { value };
  if (schema.enum && !schema.enum.includes(value.trim())) {
    return { problem: `${name} is one of ${schema.enum.join(', ')}.` };
  }
  if (schema.pattern && !new RegExp(schema.pattern).test(value.trim())) {
    return { problem: `"${value}" doesn't fit ${name}.${about}` };
  }
  return { value: schema.pattern || schema.enum ? value.trim() : value };
}

const CHECK_BY_TYPE: Record<
  PropertySchema['type'],
  (name: string, value: unknown, schema: PropertySchema) => Checked
> = {
  string: checkText,
  boolean: (name, value) =>
    typeof value === 'boolean' ? { value } : { problem: `${name} is true or false.` },
  array: checkList,
};

export function checkAgentToolArgs(
  tool: ModelTool,
  given: Record<string, unknown>
): CheckedToolArgs {
  const properties = (tool.inputSchema.properties ?? {}) as Record<string, PropertySchema>;
  const required = (tool.inputSchema.required ?? []) as string[];
  const args: Record<string, unknown> = {};
  for (const [name, schema] of Object.entries(properties)) {
    const value = given[name];
    if (isLeftOut(value) && required.includes(name)) {
      return { problem: `${name} is needed.${describeArg(name, schema)}` };
    }
    if (isLeftOut(value)) continue;
    const checked = CHECK_BY_TYPE[schema.type](name, value, schema);
    if ('problem' in checked) return checked;
    args[name] = checked.value;
  }
  return { args };
}
