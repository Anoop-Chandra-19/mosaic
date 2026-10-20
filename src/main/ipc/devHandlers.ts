import fsp from 'node:fs/promises';
import { MAX_RECENT_DEV_RUNS, type DevToolArgs, type DevToolRun } from '@shared/types/devTools';
import { replaceFileSafely } from '../replaceFileSafely';

/*
 * Main's side of `MosaicDev`, development builds only, kept free of Electron so tests can
 * drive it directly; `registerDevHandlers.ts` wires it to IPC. Recent lives in its own small
 * file beside the development database, so it is never part of the app's data.
 */

const MAX_TOOL_ID_LENGTH = 64;
const MAX_ARGS = 16;
const MAX_ARG_TEXT_LENGTH = 512;

function isArgValue(value: unknown): value is DevToolArgs[string] {
  if (typeof value === 'string') return value.length <= MAX_ARG_TEXT_LENGTH;
  return typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value));
}

function parseDevToolRun(value: unknown): DevToolRun {
  const run = value as Partial<DevToolRun> | null;
  const toolId = run?.toolId;
  if (typeof toolId !== 'string' || toolId === '' || toolId.length > MAX_TOOL_ID_LENGTH) {
    throw new Error(`a run's tool must be 1–${MAX_TOOL_ID_LENGTH} characters`);
  }
  const args = run?.args;
  if (typeof args !== 'object' || args === null || Array.isArray(args)) {
    throw new Error("a run's choices must be an object");
  }
  const entries = Object.entries(args);
  if (entries.length > MAX_ARGS || !entries.every(([, arg]) => isArgValue(arg))) {
    throw new Error(`a run has at most ${MAX_ARGS} choices, each text, a number or true/false`);
  }
  return { toolId, args: Object.fromEntries(entries) };
}

/** Recent, checked: at most `MAX_RECENT_DEV_RUNS` runs. */
export function parseDevToolRuns(value: unknown): DevToolRun[] {
  if (!Array.isArray(value) || value.length > MAX_RECENT_DEV_RUNS) {
    throw new Error(`recent must be a list of at most ${MAX_RECENT_DEV_RUNS} runs`);
  }
  return value.map(parseDevToolRun);
}

/** Recent from `file`: empty when there is none yet, or it no longer reads. */
export async function readRecentDevRuns(file: string): Promise<DevToolRun[]> {
  try {
    return parseDevToolRuns(JSON.parse(await fsp.readFile(file, 'utf8')).recent);
  } catch {
    return [];
  }
}

export async function saveRecentDevRuns(file: string, runs: unknown): Promise<void> {
  const recent = parseDevToolRuns(runs);
  await replaceFileSafely(file, `${JSON.stringify({ recent }, null, 2)}\n`);
}
