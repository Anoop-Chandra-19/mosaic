import { create } from 'zustand';

/*
 * What the assistant's pane is showing, which outlives any one view of it: the tab, and the
 * Trace's filter, open runs and open record. The Trace is drawn only while it is open, and a step
 * in the conversation links into it, so none of this can live in the Trace. The open record is
 * also the step marked in the conversation, which is how coming back finds its place.
 */

export type PaneTab = 'conversation' | 'trace';

export interface TraceCall {
  runId: number;
  callId: string;
}

/** A place in the Trace to bring into view: a step's record, or with no call, the run. */
export interface TraceTarget {
  runId: number;
  callId: string | null;
}

interface AgentPaneState {
  tab: PaneTab;
  isOnlyFlagged: boolean;
  /** Only runs opened or closed by hand; the newest is open until then. */
  openedRuns: Record<number, boolean>;
  openCall: TraceCall | null;
  /** Waiting for the Trace to land on it. */
  traceTarget: TraceTarget | null;
}

export const useAgentPaneStore = create<AgentPaneState>()(() => ({
  tab: 'conversation',
  isOnlyFlagged: false,
  openedRuns: {},
  openCall: null,
  traceTarget: null,
}));

/** The Trace opens on the record left open in it, if there is one. */
export function setPaneTab(tab: PaneTab): void {
  useAgentPaneStore.setState((state) => ({
    tab,
    traceTarget: tab === 'trace' ? state.openCall : null,
  }));
}

export function setOnlyFlagged(isOnlyFlagged: boolean): void {
  useAgentPaneStore.setState({ isOnlyFlagged });
}

export function setRunOpen(runId: number, isOpen: boolean): void {
  useAgentPaneStore.setState((state) => ({
    openedRuns: { ...state.openedRuns, [runId]: isOpen },
  }));
}

export const isSameCall = (call: TraceCall | null, runId: number, callId: string): boolean =>
  call !== null && call.runId === runId && call.callId === callId;

export function toggleTraceCall(runId: number, callId: string): void {
  useAgentPaneStore.setState((state) => ({
    openCall: isSameCall(state.openCall, runId, callId) ? null : { runId, callId },
  }));
}

/** Opens the Trace on a step's record, or at the top of a run. */
export function showInTrace({ runId, callId }: TraceTarget): void {
  useAgentPaneStore.setState((state) => ({
    tab: 'trace',
    traceTarget: { runId, callId },
    openedRuns: { ...state.openedRuns, [runId]: true },
    openCall: callId === null ? null : { runId, callId },
  }));
}

export function clearTraceTarget(): void {
  useAgentPaneStore.setState({ traceTarget: null });
}
