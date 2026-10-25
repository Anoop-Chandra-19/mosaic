import type { ModelTool } from '../types/modelTool';
import { describeHandleKinds, HANDLE_PREFIXES, type HandleKind } from './handleKinds.ts';

/**
 * One argument as the model is offered it. `pattern` and `enum` are what the renderer's
 * reading takes another reading of, and what its check refuses with the description.
 */
export type PropertySchema =
  | { type: 'string'; description?: string; pattern?: string; enum?: string[] }
  | { type: 'boolean'; description?: string }
  | { type: 'array'; items: { type: 'string'; pattern?: string }; description?: string };

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

export const enumArg = (values: string[], description: string): PropertySchema => ({
  type: 'string',
  enum: values,
  description,
});

const handleLetters = (kinds: readonly HandleKind[]) =>
  kinds.map((kind) => HANDLE_PREFIXES[kind]).join('');

const handlePattern = (kinds: readonly HandleKind[]) => `^[${handleLetters(kinds)}][0-9]+$`;

const sentence = (text: string) => `${text[0].toUpperCase()}${text.slice(1)}.`;

/** A handle of one of `kinds`: what it is for, which kinds, an example, and its pattern. */
export function handleArg(kinds: readonly HandleKind[], role: string): PropertySchema {
  return {
    type: 'string',
    pattern: handlePattern(kinds),
    description: `${role} ${sentence(describeHandleKinds(kinds))}`,
  };
}

/** Where something new goes, written once for every tool that places. */
export function afterArg(kinds: readonly HandleKind[]): PropertySchema {
  return {
    type: 'string',
    pattern: `^(start|[${handleLetters(kinds)}][0-9]+)$`,
    description: `The one it goes right after, in the same list: ${describeHandleKinds(kinds)}, or "start" to put it first. Leave out to put it last.`,
  };
}

export const handleListArg = (
  kinds: readonly HandleKind[],
  description: string
): PropertySchema => ({
  type: 'array',
  items: { type: 'string', pattern: handlePattern(kinds) },
  description,
});

/** A tool as the model is offered it. */
export function defineAgentTool(
  name: string,
  description: string,
  properties: Record<string, PropertySchema> = {},
  required: string[] = []
): ModelTool {
  return { name, description, inputSchema: { type: 'object', properties, required } };
}
