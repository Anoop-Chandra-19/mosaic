import type { ModelTool } from '../types/modelTool';

type PropertySchema =
  | { type: 'string' | 'boolean'; description?: string }
  | { type: 'array'; items: { type: 'string' }; description?: string };

export const stringArg = (description?: string): PropertySchema => ({
  type: 'string',
  description,
});

export const booleanArg = (description?: string): PropertySchema => ({
  type: 'boolean',
  description,
});

export const stringListArg = (description: string): PropertySchema => ({
  type: 'array',
  items: { type: 'string' },
  description,
});

/** A tool as the model is offered it: every argument a string, a yes/no, or a list of strings. */
export function defineAgentTool(
  name: string,
  description: string,
  properties: Record<string, PropertySchema> = {},
  required: string[] = []
): ModelTool {
  return { name, description, inputSchema: { type: 'object', properties, required } };
}
