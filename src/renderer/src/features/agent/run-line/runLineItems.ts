import type { RunPart } from '@/types/agentRunView';
import { describeStepNote, readStepWords } from './stepWords';

/*
 * A run's parts as the run line shows them, with no timers or elements, so its rules can be
 * read and tested here. Steps are the only rows counted; thinking is listed but never a step.
 */

export interface RunState {
  isRunning: boolean;
  isStopped: boolean;
}

export type RowState = 'run' | 'done' | 'fail' | 'cut';

export type RunLineRow =
  | {
      kind: 'step';
      key: string;
      state: RowState;
      words: string;
      note: string | null;
      startedAt: number | undefined;
      /** How long a finished step took, when that was stored. */
      durationMs: number | undefined;
    }
  | {
      kind: 'think';
      key: string;
      state: Exclude<RowState, 'fail'>;
      durationMs: number | null;
      startedAt: number | undefined;
    }
  | { kind: 'text'; key: string; text: string };

function toStep(part: Extract<RunPart, { type: 'toolCall' }>, isRunning: boolean): RunLineRow {
  const words = readStepWords(part.name);
  const { status, target, callId, startedAt, durationMs } = part;
  const note = describeStepNote(target);
  const base = { kind: 'step', key: callId, startedAt, durationMs, note } as const;
  switch (status) {
    case 'done':
      return { ...base, state: 'done', words: words.done(target) };
    case 'refused':
      return { ...base, state: 'fail', words: words.refused(target) };
    case 'notRun':
      return { ...base, state: 'cut', words: words.running };
    case 'running':
      return { ...base, state: isRunning ? 'run' : 'cut', words: words.running };
  }
}

function toRow(part: RunPart, index: number, isRunning: boolean): RunLineRow {
  switch (part.type) {
    case 'toolCall':
      return toStep(part, isRunning);
    case 'text':
      return { kind: 'text', key: `text-${index}`, text: part.text };
    case 'reasoning': {
      const isGoing = part.durationMs === null;
      return {
        kind: 'think',
        key: `think-${index}`,
        state: isGoing ? (isRunning ? 'run' : 'cut') : 'done',
        durationMs: part.durationMs,
        startedAt: part.startedAt,
      };
    }
  }
}

export interface RunLineItems {
  /** Steps and thinking, and text written between them, which sits among them while open. */
  rows: RunLineRow[];
  stepCount: number;
  /** Text before the first row or after the last: under the line whether it is open or not. */
  textOutside: Extract<RunPart, { type: 'text' }>[];
  textAll: Extract<RunPart, { type: 'text' }>[];
}

const isListed = (part: RunPart) => part.type !== 'text';

export function listRunLineItems(parts: RunPart[], { isRunning }: RunState): RunLineItems {
  const first = parts.findIndex(isListed);
  const last = parts.findLastIndex(isListed);
  const rows = parts.flatMap((part, index) =>
    part.type !== 'text' || (index > first && index < last) ? [toRow(part, index, isRunning)] : []
  );
  const textAll = parts.filter((part) => part.type === 'text');
  const textOutside = parts.flatMap((part, index) =>
    part.type === 'text' && (first < 0 || index < first || index > last) ? [part] : []
  );
  return { rows, stepCount: rows.filter(isStep).length, textOutside, textAll };
}

const isStep = (row: RunLineRow) => row.kind === 'step';

const NO_TIME_UNDER_MS = 1000;

/** "3.4s". */
export const formatSeconds = (ms: number) => `${(Math.max(0, ms) / 1000).toFixed(1)}s`;

/** A time worth showing: under a second, a run feels instant, and nothing says otherwise. */
export const isTimeShown = (ms: number) => ms >= NO_TIME_UNDER_MS;

const countSteps = (count: number) => `${count} ${count === 1 ? 'step' : 'steps'}`;

const sumThinking = (rows: RunLineRow[]) =>
  rows.reduce((sum, row) => sum + (row.kind === 'think' ? (row.durationMs ?? 0) : 0), 0);

export interface RunLineLabel {
  text: string;
  /** Thinking shimmers where a step's name would be. */
  isThinking: boolean;
  /** The run's time shows beside it, climbing while it runs. */
  showsTime: boolean;
  /** What a screen reader hears: the start and the end, never each step. */
  spoken: string;
}

/** What the closed or open line says now. */
export function describeRunLine(
  { rows, stepCount }: RunLineItems,
  { isRunning, isStopped }: RunState,
  isOpen: boolean,
  elapsedMs: number
): RunLineLabel {
  const listed = rows.filter((row) => row.kind !== 'text');
  const current = listed.at(-1);
  if (isRunning) {
    const isThinking = current?.kind === 'think' && current.state === 'run';
    let text = 'Working…';
    if (isOpen && stepCount > 0) text = `${countSteps(stepCount)} so far`;
    else if (isThinking) text = 'Thinking';
    else if (current?.kind === 'step' && current.state === 'run') text = `${current.words}…`;
    return {
      text,
      isThinking: isThinking && text === 'Thinking',
      showsTime: true,
      spoken: 'Working',
    };
  }
  if (stepCount > 0) {
    const finished = rows.filter((row) => isStep(row) && row.state !== 'cut').length;
    const count = isStopped ? finished : stepCount;
    return {
      text: countSteps(count),
      isThinking: false,
      showsTime: true,
      spoken: isStopped
        ? `Stopped after ${countSteps(count)}`
        : `${countSteps(count)}, ${(elapsedMs / 1000).toFixed(1)} seconds`,
    };
  }
  const thought = sumThinking(rows);
  return {
    text: `Thought for ${formatSeconds(thought)}`,
    isThinking: false,
    showsTime: false,
    spoken: `Thought for ${(thought / 1000).toFixed(1)} seconds`,
  };
}

/** Words that keep coming mean its steps may be over; a short aside doesn't fold the line. */
const FOLD_AFTER_WORDS_MS = 1000;
/** Once it has opened on its own, so a run ending just past the moment doesn't flash. */
const HOLD_OPEN_MS = 1000;

/** How long an open line waits to fold, once the steps have given way to words or the end. */
export function readFoldDelay(state: RunState, msSinceOpened: number): number {
  if (state.isStopped) return 0;
  const held = Math.max(0, HOLD_OPEN_MS - msSinceOpened);
  return state.isRunning ? Math.max(held, FOLD_AFTER_WORDS_MS) : held;
}

/** When a running line opens: two seconds into its steps, or as the third starts. */
export function findAutoOpenAt(stepStarts: readonly number[]): number | null {
  const [first, , third] = stepStarts;
  if (first === undefined) return null;
  return Math.min(first + 2000, third ?? Infinity);
}
