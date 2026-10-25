import type { AgentToolResult } from '@shared/agent-tools/agentTools';
import type { AgentToolAnswer, AgentToolCall } from '@shared/types/agentBridge';
import type { ToolBridge } from './runToolRound';

/** One run's tool calls to the page, and the page's answers back. */
export interface IpcToolBridge extends ToolBridge {
  /** The page's answer to a call; one nothing is waiting for is dropped. */
  answer(callId: string, answer: AgentToolAnswer): void;
  /** The run has ended: answers still to come are dropped. */
  close(): void;
}

interface WaitingCall {
  resolve: (result: AgentToolResult) => void;
  reject: (error: Error) => void;
}

/**
 * Sends each call with `sendCall` and waits for `answer`. The round gives up on a call at
 * its deadline or a Stop; an answer arriving after that settles a wait no one is on.
 */
export function createIpcToolBridge(sendCall: (call: AgentToolCall) => void): IpcToolBridge {
  const waiting = new Map<string, WaitingCall>();
  let isClosed = false;
  return {
    runTool(call) {
      return new Promise((resolve, reject) => {
        if (isClosed) return reject(new Error('The run has ended'));
        waiting.set(call.callId, { resolve, reject });
        sendCall(call);
      });
    },
    answer(callId, answer) {
      const call = waiting.get(callId);
      if (!call) return;
      waiting.delete(callId);
      if (answer.ok) call.resolve(answer.result);
      else call.reject(new Error(answer.message));
    },
    close() {
      isClosed = true;
      waiting.clear();
    },
  };
}
