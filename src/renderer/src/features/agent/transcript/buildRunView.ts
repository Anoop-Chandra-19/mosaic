import type {
  TranscriptMessage,
  TranscriptMessageBody,
  TranscriptReplyPart,
} from '@shared/types/agentConversation';
import type { RunPart, RunView } from '@/types/agentRunView';

interface BuiltRun {
  first: TranscriptMessage;
  count: number;
  view: RunView;
}

/** By a run's last message: stored messages never change, so neither does the view of them. */
const builtRuns = new WeakMap<TranscriptMessage, BuiltRun>();

/**
 * The transcript as runs: the stored messages, oldest first, folded into one view per
 * run, in order. Every message a run writes carries its id, so a run's messages are the
 * ones in a row with the same id; a message written outside a run shows in none. A run
 * already built keeps its view, so older pages landing leave the runs shown alone.
 */
export function buildRunView(messages: TranscriptMessage[]): RunView[] {
  const runs: RunView[] = [];
  let start = 0;
  while (start < messages.length) {
    const { runId } = messages[start];
    let end = start + 1;
    while (end < messages.length && messages[end].runId === runId) end++;
    if (runId !== null) runs.push(readBuiltRun(messages.slice(start, end), runId));
    start = end;
  }
  return runs;
}

function readBuiltRun(messages: TranscriptMessage[], runId: number): RunView {
  const first = messages[0];
  const last = messages[messages.length - 1];
  const built = builtRuns.get(last);
  if (built?.first === first && built.count === messages.length) return built.view;
  const view = buildRun(messages, runId);
  builtRuns.set(last, { first, count: messages.length, view });
  return view;
}

function buildRun(messages: TranscriptMessage[], runId: number): RunView {
  const run: RunView = {
    runId,
    model: messages[0].runModel,
    startedAt: messages[0].createdAt,
    lastAt: messages[0].createdAt,
    ask: null,
    switchedTo: null,
    parts: [],
    stop: null,
    stoppedAt: null,
  };
  for (const { body, createdAt } of messages) {
    run.lastAt = createdAt;
    addToRun(run, body, createdAt);
  }
  return run;
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
        if (call?.type !== 'toolCall') continue;
        call.status = readToolStatus(result);
        if (result.target) call.target = result.target;
        if (result.durationMs !== undefined) call.durationMs = result.durationMs;
        if (result.startedAt !== undefined) call.startedAt = result.startedAt;
      }
      return;
    case 'runStopped':
      run.stop = body;
      run.stoppedAt = createdAt;
  }
}

function readToolStatus({ isError, notRun }: { isError?: boolean; notRun?: boolean }) {
  if (notRun) return 'notRun';
  return isError ? 'refused' : 'done';
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
