import type { AgentToolResult } from '@shared/agent-tools/agentTools';
import type { AgentToolAnswer, AgentToolCall } from '@shared/types/agentBridge';
import type { ToolBridge } from './runToolRound';

/** Routes tool calls and answers between main and the renderer for one run. */
export interface IpcToolBridge extends ToolBridge {
  /** Resolves or rejects the matching call; ignores answers with no pending call. */
  answer(callId: string, answer: AgentToolAnswer): void;
  /** Discards pending calls without settling them and ignores subsequent answers. */
  close(): void;
}

interface WaitingCall {
  resolve: (result: AgentToolResult) => void;
  reject: (error: Error) => void;
}

/**
 * Sends calls through `sendCall` and settles them through `answer`. Cancellation and
 * timeouts belong to `runToolRound.ts`: a late answer may settle the bridge's promise,
 * but the round has already stopped waiting and ignores the result.
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
