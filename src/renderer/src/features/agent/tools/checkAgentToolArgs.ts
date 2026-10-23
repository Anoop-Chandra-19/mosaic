import {
  AGENT_TOOLS,
  type AgentToolArgs,
  type AgentToolName,
} from '@shared/agent-tools/agentTools';

type ArgType = 'string' | 'boolean' | 'array';

interface ToolInputSchema {
  properties: Record<string, { type: ArgType }>;
  required: string[];
}

export type CheckedToolArgs<N extends AgentToolName> =
  | { args: AgentToolArgs[N] }
  | { problem: string };

/** A list may come as JSON text: some models send it that way. */
function checkStringList(value: unknown): string[] | undefined {
  let list = value;
  if (typeof value === 'string') {
    try {
      list = JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  const isStringList = Array.isArray(list) && list.every((item) => typeof item === 'string');
  return isStringList ? (list as string[]) : undefined;
}

/** A yes/no may come as "true" or "false". */
function checkBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 'false') return value === 'true';
  return undefined;
}

const CHECK_BY_TYPE: Record<ArgType, (value: unknown) => unknown> = {
  string: (value) => (typeof value === 'string' ? value : undefined),
  boolean: checkBoolean,
  array: checkStringList,
};

const EXPECTED_TYPE: Record<ArgType, string> = {
  string: 'text',
  boolean: 'true or false',
  array: 'a list of text',
};

const isLeftOut = (value: unknown) => value === undefined || value === null || value === '';

/**
 * A call's arguments, checked against the schema the model was given. Unknown names are
 * dropped, and an empty optional text counts as left out ("bulletId": "" means none).
 */
export function checkAgentToolArgs<N extends AgentToolName>(
  name: N,
  rawArgs: unknown
): CheckedToolArgs<N> {
  const givenArgs =
    typeof rawArgs === 'object' && rawArgs !== null ? (rawArgs as Record<string, unknown>) : {};
  const { properties, required } = AGENT_TOOLS[name].inputSchema as unknown as ToolInputSchema;
  const checkedArgs: Record<string, unknown> = {};

  for (const [argName, { type }] of Object.entries(properties)) {
    const given = givenArgs[argName];
    if (isLeftOut(given) && !required.includes(argName)) continue;
    const checked = isLeftOut(given) ? undefined : CHECK_BY_TYPE[type](given);
    if (checked === undefined) {
      return { problem: `${argName} is needed, as ${EXPECTED_TYPE[type]}.` };
    }
    checkedArgs[argName] = checked;
  }
  return { args: checkedArgs as AgentToolArgs[N] };
}
