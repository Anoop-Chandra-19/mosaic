import { create } from 'zustand';
import type { AgentStartRefusal } from '@shared/types/agentBridge';

/*
 * What the notice over the assistant's prompt box remembers beyond the stored log, for
 * this session only: a message main wouldn't start, a send made while a notice showed and
 * waiting for its answer, and the stops the user dismissed. Which notice shows is worked
 * out from this, the transcript and the live run (`features/agent/notices/pickNotice.ts`).
 */

export interface NoticeRefusal {
  conversationId: number | null;
  reason: AgentStartRefusal;
  /** When the same refusal came back for a send made while it showed. */
  checkedAt: number | null;
}

/** The notice a send answers: a run's stop, or a refusal. */
export type NoticeSource =
  | { type: 'run'; runId: number }
  | { type: 'refusal'; reason: AgentStartRefusal };

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
}

export const useAgentNoticeStore = create<AgentNoticeState>()(() => ({
  refusal: null,
  resend: null,
  dismissedRunIds: [],
}));

/** A send goes; `from` is the notice it answers, when one showed. */
export function noteSendStarting(conversationId: number | null, from: NoticeSource | null): void {
  useAgentNoticeStore.setState({
    refusal: null,
    resend: from && { conversationId, from, sentAt: Date.now(), runId: null },
  });
}

export function noteSendStarted(runId: number): void {
  useAgentNoticeStore.setState((state) => ({
    resend: state.resend && { ...state.resend, runId },
  }));
}

/** The new run has said nothing yet: the transcript shows it from here, and the notice lets go. */
export function letNoticeGo(runId: number): void {
  useAgentNoticeStore.setState((state) =>
    state.resend?.runId === runId ? { resend: null } : state
  );
}

/** Main wouldn't start it. The same refusal again is a check made again, which the notice says. */
export function noteSendRefused(conversationId: number | null, reason: AgentStartRefusal): void {
  useAgentNoticeStore.setState(({ resend }) => {
    const isSame = resend?.from.type === 'refusal' && resend.from.reason === reason;
    return {
      resend: null,
      refusal: { conversationId, reason, checkedAt: isSame ? resend.sentAt : null },
    };
  });
}

/** The send failed in Mosaic before main answered; a toast says so, and nothing waits. */
export function noteSendFailed(): void {
  useAgentNoticeStore.setState({ resend: null });
}

export function dismissNotice(source: NoticeSource): void {
  useAgentNoticeStore.setState((state) =>
    source.type === 'refusal'
      ? { refusal: null }
      : { resend: null, dismissedRunIds: [...state.dismissedRunIds, source.runId] }
  );
}
