import { create } from 'zustand';
import type { AgentStartRefusal } from '@shared/types/agentBridge';

/*
 * What the notice over the assistant's prompt box remembers beyond the stored log, for
 * this session only: a message main wouldn't start, a send made while a notice showed and
 * waiting for its answer, and the stops the user dismissed. Which notice shows is worked
 * out from this, the transcript and the live run (`features/agent/notices/pickNotice.ts`).
 * A send turned down because a run is going elsewhere is the running strip's to say, not a
 * notice's (`features/agent/conversations/RunningElsewhere.tsx`).
 */

/** What a notice can be about: a run going elsewhere has the strip. */
export type NoticeRefusalReason = Exclude<AgentStartRefusal, 'runInProgress'>;

export interface NoticeRefusal {
  conversationId: number | null;
  reason: NoticeRefusalReason;
  /** When the same refusal came back for a send made while it showed. */
  checkedAt: number | null;
}

/** The notice a send answers: a run's stop, or a refusal. */
export type NoticeSource =
  | { type: 'run'; runId: number }
  | { type: 'refusal'; reason: NoticeRefusalReason };

/** A send from one conversation that a run going in another turned down. */
export interface BlockedSend {
  conversationId: number | null;
  runId: number;
  /** Changes with each send turned down, so the strip flashes each time. */
  at: number;
}

/** A send made while a notice showed, so its answer can be told apart: through, same, or another. */
export interface NoticeResend {
  conversationId: number | null;
  from: NoticeSource;
  sentAt: number;
  /** Null until main has started its run. */
  runId: number | null;
}

interface AgentNoticeState {
  refusal: NoticeRefusal | null;
  resend: NoticeResend | null;
  dismissedRunIds: number[];
  blockedSend: BlockedSend | null;
  /**
   * A send is out with no run going, so a run that appears now is its own. Its first events
   * can land before the pane has moved to the conversation it made.
   */
  isStartingRun: boolean;
}

export const useAgentNoticeStore = create<AgentNoticeState>()(() => ({
  refusal: null,
  resend: null,
  dismissedRunIds: [],
  blockedSend: null,
  isStartingRun: false,
}));

/** A send goes; `from` is the notice it answers, when one showed. */
export function noteSendStarting(
  conversationId: number | null,
  from: NoticeSource | null,
  isRunGoing: boolean
): void {
  useAgentNoticeStore.setState({
    refusal: null,
    resend: from && { conversationId, from, sentAt: Date.now(), runId: null },
    isStartingRun: !isRunGoing,
  });
}

export function noteSendStarted(runId: number): void {
  useAgentNoticeStore.setState((state) => ({
    resend: state.resend && { ...state.resend, runId },
    isStartingRun: false,
  }));
}

/** The new run has said nothing yet: the transcript shows it from here, and the notice lets go. */
export function letNoticeGo(runId: number): void {
  useAgentNoticeStore.setState((state) =>
    state.resend?.runId === runId ? { resend: null } : state
  );
}

/** Main wouldn't start it. The same refusal again is a check made again, which the notice says. */
export function noteSendRefused(conversationId: number | null, reason: NoticeRefusalReason): void {
  useAgentNoticeStore.setState(({ resend }) => {
    const isSame = resend?.from.type === 'refusal' && resend.from.reason === reason;
    return {
      resend: null,
      isStartingRun: false,
      refusal: { conversationId, reason, checkedAt: isSame ? resend.sentAt : null },
    };
  });
}

/** A run in another conversation turned it down. */
export function noteSendBlocked(conversationId: number | null, runId: number): void {
  useAgentNoticeStore.setState({
    resend: null,
    isStartingRun: false,
    blockedSend: { conversationId, runId, at: Date.now() },
  });
}

/** The send failed in Mosaic before main answered; a toast says so, and nothing waits. */
export function noteSendFailed(): void {
  useAgentNoticeStore.setState({ resend: null, isStartingRun: false });
}

export function dismissNotice(source: NoticeSource): void {
  useAgentNoticeStore.setState((state) =>
    source.type === 'refusal'
      ? { refusal: null }
      : { resend: null, dismissedRunIds: [...state.dismissedRunIds, source.runId] }
  );
}
