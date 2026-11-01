import { formatSeconds, toSeconds } from '@shared/time/formatTime';
import type { RunPart } from '@/types/agentRunView';
import { describeStepNote, readStepWords } from './stepWords';

/*
 * A run's parts as the pane shows them, in the order they happened: words, a line of steps,
 * words. Each unbroken stretch of steps and thinking is one line, and words end it. No timers
 * or elements here, so the rules can be read and tested. Steps are the only rows counted;
 * thinking is listed but never a step.
 */

export interface RunState {
  isRunning: boolean;
  /** Anything ended it before the model finished. */
  isStopped: boolean;
  /** The user's Stop, in particular. */
  isCancelled: boolean;
}

/** `wait`: the connection dropped as the model wrote this step, and a retry is coming. */
export type RowState = 'run' | 'wait' | 'done' | 'fail' | 'cut';

export type StepRow = {
  kind: 'step';
  key: string;
  state: RowState;
  words: string;
  note: string | null;
  startedAt: number | undefined;
  /** How long a finished step took, when that was stored. */
  durationMs: number | undefined;
  /** The call itself, for the Trace's record. */
  call: Extract<RunPart, { type: 'toolCall' }>;
};

export type ThinkRow = {
  kind: 'think';
  key: string;
  state: Exclude<RowState, 'fail' | 'wait'>;
  durationMs: number | null;
  startedAt: number | undefined;
  textLength: number | undefined;
};

export type RunLineRow = StepRow | ThinkRow;

function toStep(part: Extract<RunPart, { type: 'toolCall' }>, isRunning: boolean): StepRow {
  const words = readStepWords(part.name);
  const { status, target, callId, startedAt, durationMs } = part;
  const note = describeStepNote(target);
  const base = { kind: 'step', key: callId, startedAt, durationMs, note, call: part } as const;
  switch (status) {
    case 'done':
      return { ...base, state: 'done', words: words.done(target) };
    case 'refused':
      return { ...base, state: 'fail', words: words.refused(target) };
    case 'notRun':
      return { ...base, state: 'cut', words: words.running };
    case 'waiting':
      return { ...base, state: 'wait', words: words.running };
    case 'running':
      return { ...base, state: isRunning ? 'run' : 'cut', words: words.running };
  }
}

/**
 * Gemini signs the part after a thought even when it showed none: stored, since the next request
 * must send it back, but no thought anyone saw, so it draws nothing.
 */
const isSignatureOnly = (part: Extract<RunPart, { type: 'reasoning' }>) =>
  part.durationMs === 0 && !part.textLength;

function toThink(
  part: Extract<RunPart, { type: 'reasoning' }>,
  index: number,
  isRunning: boolean
): ThinkRow {
  const isGoing = part.durationMs === null;
  return {
    kind: 'think',
    key: `think-${index}`,
    state: isGoing ? (isRunning ? 'run' : 'cut') : 'done',
    durationMs: part.durationMs,
    startedAt: part.startedAt,
    textLength: part.textLength,
  };
}

export interface RunLineItems {
  rows: RunLineRow[];
  steps: StepRow[];
  /** When its first row began; only the running line needs it, and it is known then. */
  startedAt: number | undefined;
  /** From its first row beginning to its last ending; null while that isn't known. */
  durationMs: number | null;
}

export type TimelineItem =
  | { kind: 'text'; key: string; text: string; isLast: boolean }
  | { kind: 'line'; key: string; line: RunLineItems; isLast: boolean };

const isFinishedStep = (step: StepRow) => step.state === 'done' || step.state === 'fail';

const sumThinking = (rows: RunLineRow[]) =>
  rows.reduce((sum, row) => sum + (row.kind === 'think' ? (row.durationMs ?? 0) : 0), 0);

/**
 * The span of its finished steps, with any thinking before the first or after the last. Each
 * step's own time would double-count: calls in one reply overlap, and the gaps between are time.
 */
function readLineDurationMs(rows: RunLineRow[]): number | null {
  const finished = rows.filter((row): row is StepRow => row.kind === 'step' && isFinishedStep(row));
  const timed = finished.flatMap(({ startedAt, durationMs }) =>
    startedAt === undefined || durationMs === undefined ? [] : [{ startedAt, durationMs }]
  );
  if (timed.length === 0 || timed.length < finished.length) return null;
  const first = rows.indexOf(finished[0]);
  const last = rows.indexOf(finished[finished.length - 1]);
  const begins = Math.min(...timed.map(({ startedAt }) => startedAt));
  const ends = Math.max(...timed.map(({ startedAt, durationMs }) => startedAt + durationMs));
  return ends - begins + sumThinking(rows.slice(0, first)) + sumThinking(rows.slice(last + 1));
}

function toLine(rows: RunLineRow[]): RunLineItems {
  return {
    rows,
    steps: rows.filter((row) => row.kind === 'step'),
    startedAt: rows.find((row) => row.startedAt !== undefined)?.startedAt,
    durationMs: readLineDurationMs(rows),
  };
}

/** The run in order, its text and its lines. */
export function listRunTimeline(parts: RunPart[], { isRunning }: RunState): TimelineItem[] {
  const items: TimelineItem[] = [];
  let rows: RunLineRow[] = [];
  const endLine = () => {
    if (rows.length === 0) return;
    items.push({ kind: 'line', key: rows[0].key, line: toLine(rows), isLast: false });
    rows = [];
  };
  parts.forEach((part, index) => {
    if (part.type === 'text') {
      endLine();
      items.push({ kind: 'text', key: `text-${index}`, text: part.text, isLast: false });
    } else if (part.type === 'toolCall') {
      rows.push(toStep(part, isRunning));
    } else if (!isSignatureOnly(part)) {
      rows.push(toThink(part, index, isRunning));
    }
  });
  endLine();
  const last = items.at(-1);
  if (last) last.isLast = true;
  return items;
}

const NO_TIME_UNDER_MS = 1000;

/** A time worth showing: under a second, a run feels instant, and nothing says otherwise. */
export const isTimeShown = (ms: number) => ms >= NO_TIME_UNDER_MS;

export const countSteps = (count: number) => `${count} ${count === 1 ? 'step' : 'steps'}`;

/** "Thought for 3.4s": what a line of only thinking says once it is over. */
export const describeThinking = ({ rows }: RunLineItems) =>
  `Thought for ${formatSeconds(sumThinking(rows))}`;

/** The newest row, when it is thinking now. */
export const isThinkingNow = ({ rows }: RunLineItems) => {
  const newest = rows.at(-1);
  return newest?.kind === 'think' && newest.state === 'run';
};

export interface RunLineLabel {
  text: string;
  /** Thinking shimmers where a step's name would be. */
  isThinking: boolean;
}

/** What a line of two or more steps says now. */
export function describeRunLine(
  line: RunLineItems,
  isGoing: boolean,
  isOpen: boolean
): RunLineLabel {
  const { rows, steps } = line;
  if (!isGoing) {
    const isCut = rows.some((row) => row.state === 'cut');
    return {
      text: countSteps(isCut ? steps.filter(isFinishedStep).length : steps.length),
      isThinking: false,
    };
  }
  if (isOpen) return { text: `${countSteps(steps.length)} so far`, isThinking: false };
  if (isThinkingNow(line)) return { text: 'Thinking', isThinking: true };
  const newest = rows.at(-1);
  const isOnStep = newest?.kind === 'step' && newest.state === 'run';
  return { text: isOnStep ? `${newest.words}…` : 'Working…', isThinking: false };
}

/** The steps a run took, or as far as it got when something stopped it. */
export function countRunSteps(items: TimelineItem[], { isStopped }: RunState): number {
  const steps = items.flatMap((item) => (item.kind === 'line' ? item.line.steps : []));
  return (isStopped ? steps.filter(isFinishedStep) : steps).length;
}

/** The run's one total, shown once it has ended; null with no steps to count. */
export function describeRunTotal(
  items: TimelineItem[],
  state: RunState,
  elapsedMs: number
): string | null {
  const count = countRunSteps(items, state);
  if (state.isRunning || count === 0) return null;
  const said = state.isCancelled ? `Stopped by you after ${countSteps(count)}` : countSteps(count);
  return isTimeShown(elapsedMs) ? `${said} · ${formatSeconds(elapsedMs)}` : said;
}

/** What a screen reader hears: the start and the end of the run, never each step. */
export function describeRunAloud(
  items: TimelineItem[],
  state: RunState,
  elapsedMs: number
): string {
  if (state.isRunning) return 'Working';
  const count = countRunSteps(items, state);
  if (state.isStopped) return `Stopped after ${countSteps(count)}`;
  if (count === 0) return 'Done';
  return `Done. ${countSteps(count)}, ${toSeconds(elapsedMs)} seconds`;
}

/**
 * The run is waiting on the model: nothing yet, or a step or a think is over and what comes next
 * hasn't started. Words being written have their caret instead.
 */
export function isWaitingForModel(parts: RunPart[], { isRunning }: RunState): boolean {
  if (!isRunning) return false;
  const newest = parts.at(-1);
  if (!newest) return true;
  if (newest.type === 'toolCall') return newest.status !== 'running';
  return newest.type === 'reasoning' && newest.durationMs !== null;
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
