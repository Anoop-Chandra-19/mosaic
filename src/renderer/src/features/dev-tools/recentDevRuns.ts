import { MAX_RECENT_DEV_RUNS, type DevToolRun } from '@shared/types/devTools';

function isSameRun(a: DevToolRun, b: DevToolRun): boolean {
  if (a.toolId !== b.toolId) return false;
  const aKeys = Object.keys(a.args);
  return (
    aKeys.length === Object.keys(b.args).length && aKeys.every((key) => a.args[key] === b.args[key])
  );
}

/** Recent with `run` at the top: once, however often it ran, and the oldest dropped. */
export function addRecentRun(recent: readonly DevToolRun[], run: DevToolRun): DevToolRun[] {
  return [run, ...recent.filter((kept) => !isSameRun(kept, run))].slice(0, MAX_RECENT_DEV_RUNS);
}

/** A run's choices as the palette writes them beside its name: "Heavy · v12". */
export function describeRunArgs(run: DevToolRun): string {
  return Object.values(run.args).join(' · ');
}
