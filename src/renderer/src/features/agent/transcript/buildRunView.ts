import type {
  TranscriptMessage,
  TranscriptMessageBody,
  TranscriptReplyPart,
} from '@shared/types/agentConversation';
import type { RunPart, RunView } from '@/types/agentRunView';

/**
 * The transcript as runs: the stored messages, oldest first, folded into one view per
 * run, in order. Every message a run writes carries its id, so a run's messages are the
 * ones in a row with the same id; a message written outside a run shows in none.
 */
export function buildRunView(messages: TranscriptMessage[]): RunView[] {
  const runs: RunView[] = [];
  for (const { runId, runModel, body, createdAt } of messages) {
    if (runId === null) continue;
    let run = runs.at(-1);
    if (run?.runId !== runId) {
      run = {
        runId,
        model: runModel,
        startedAt: createdAt,
        ask: null,
        switchedTo: null,
        parts: [],
        stop: null,
        stoppedAt: null,
      };
      runs.push(run);
    }
    addToRun(run, body, createdAt);
  }
  return runs;
}

function addToRun(run: RunView, body: TranscriptMessageBody, createdAt: number): void {
  switch (body.type) {
    case 'templateSwitched':
      run.switchedTo = { templateId: body.templateId, label: body.label };
      return;
    case 'user':
      run.ask = body.text;
      return;
    case 'assistant':
      run.parts.push(...body.content.map(toRunPart));
      return;
    case 'toolResults':
      for (const result of body.results) {
        const call = run.parts.find(
          (part) => part.type === 'toolCall' && part.callId === result.callId
        );
        if (call?.type === 'toolCall') call.status = result.isError ? 'refused' : 'done';
      }
      return;
    case 'runStopped':
      run.stop = body;
      run.stoppedAt = createdAt;
  }
}

function toRunPart(part: TranscriptReplyPart): RunPart {
  if (part.type !== 'toolCall') return part;
  return {
    type: 'toolCall',
    callId: part.callId,
    name: part.name,
    args: part.args,
    status: 'running',
  };
}
