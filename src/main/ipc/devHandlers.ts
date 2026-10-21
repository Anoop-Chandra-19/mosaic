import fsp from 'node:fs/promises';
import {
  ALL_DEV_SWITCHES_OFF,
  DEV_SWITCHES,
  MAX_RECENT_DEV_RUNS,
  type DevSwitches,
  type DevToolArgs,
  type DevToolRun,
} from '@shared/types/devTools';
import { replaceFileSafely } from '../replaceFileSafely';

/*
 * Main's side of `MosaicDev`, development builds only, kept free of Electron so tests can
 * drive it directly; `registerDevHandlers.ts` wires it to IPC. Recent, the switches and the
 * view to reopen live in their own small file beside the development database, so they are
 * never part of the app's data.
 */

const MAX_TOOL_ID_LENGTH = 64;
const MAX_ARGS = 16;
const MAX_ARG_TEXT_LENGTH = 512;

/** What the file keeps. */
export interface DevToolsFile {
  recent: DevToolRun[];
  switches: DevSwitches;
  reopenAddress: string | null;
}

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

/** Every switch, each on or off; one left out is off. */
export function parseDevSwitches(value: unknown): DevSwitches {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('switches must be an object');
  }
  const given: Record<string, unknown> = { ...value };
  const unknownName = Object.keys(given).find((name) => !DEV_SWITCHES.some((s) => s === name));
  if (unknownName) throw new Error(`no switch is called “${unknownName}”`);
  const switches = { ...ALL_DEV_SWITCHES_OFF };
  for (const name of DEV_SWITCHES) {
    const isOn = given[name] ?? false;
    if (typeof isOn !== 'boolean') throw new Error(`switch “${name}” must be true or false`);
    switches[name] = isOn;
  }
  return switches;
}

export function parseReopenAddress(value: unknown): string {
  if (typeof value !== 'string' || value === '' || value.length > MAX_ARG_TEXT_LENGTH) {
    throw new Error(`an address must be 1–${MAX_ARG_TEXT_LENGTH} characters`);
  }
  return value;
}

function readPart<T>(parse: () => T, fallback: T): T {
  try {
    return parse();
  } catch {
    return fallback;
  }
}

/** The file, each part read on its own: one that no longer reads is as if never kept. */
export async function readDevToolsFile(file: string): Promise<DevToolsFile> {
  let stored: Record<string, unknown> = {};
  try {
    stored = { ...JSON.parse(await fsp.readFile(file, 'utf8')) };
  } catch {
    // None yet, or it no longer reads.
  }
  return {
    recent: readPart(() => parseDevToolRuns(stored.recent), []),
    switches: readPart(() => parseDevSwitches(stored.switches), ALL_DEV_SWITCHES_OFF),
    reopenAddress: readPart(() => parseReopenAddress(stored.reopenAddress), null),
  };
}

let lastUpdate: Promise<unknown> = Promise.resolve();

/** Replaces the parts given, keeping the rest; one update at a time, so none is lost. */
export function updateDevToolsFile(file: string, change: Partial<DevToolsFile>): Promise<void> {
  const update = lastUpdate.then(async () => {
    const kept = await readDevToolsFile(file);
    await replaceFileSafely(file, `${JSON.stringify({ ...kept, ...change }, null, 2)}\n`);
  });
  lastUpdate = update.catch(() => undefined);
  return update;
}
