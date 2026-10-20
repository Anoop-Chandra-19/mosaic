import type { DevToolArgs } from '@shared/types/devTools';

/** The palette's groups, in its order. */
export const DEV_TOOL_GROUPS = ['Data', 'Go to', 'Address'] as const;
export type DevToolGroup = (typeof DEV_TOOL_GROUPS)[number];

/** One choice a step offers. */
export interface StepOption {
  value: string | number;
  label: string;
  /** After the label: a version's name or what it holds. */
  detail?: string;
  /** At the row's end: a count, a date. */
  hint?: string;
  /** Taken by Ctrl+Enter, which goes with the rest as default. */
  isDefault?: boolean;
  /** A named version, which reads stronger. */
  isNamed?: boolean;
}

/** One choice a tool needs, made in the palette as a chip: which template, which version. */
export interface DevToolStep {
  key: string;
  placeholder: string;
  /** The choices, given those made before it. */
  listOptions: (args: DevToolArgs) => Promise<StepOption[]>;
  /** How a choice reads as its chip and beside a Recent row. */
  describe?: (value: DevToolArgs[string]) => string;
}

export interface DevTool {
  id: string;
  group: DevToolGroup;
  label: string;
  description: string;
  /** Choices made one at a time before it runs; its `args` hold them by `key`. */
  steps?: DevToolStep[];
  /** Keys that run it from the palette, shown on its row. */
  keys?: string;
  /** Asks for text in the field instead (an address to paste); runs with it as `text`. */
  prompt?: string;
  /** Resolves with what to tell the user; nothing when what it did is on screen. */
  run: (args: DevToolArgs) => Promise<string>;
}
