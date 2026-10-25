import type { ModelStreamEvent } from '@shared/types/modelReply';
import type { ModelMessage, ModelProvider } from '../model-providers/modelProvider';

/*
 * The Scripted model developer switch: a model that plays back a script, so the assistant
 * runs with no provider, by hand and in e2e. The script reads the resume, suggests a
 * rewrite of its first bullet and showing or hiding its second, then says it's done. Each
 * step is chosen from the request's last message, so it plays the same in every run.
 */

const FINISH: ModelStreamEvent = { type: 'finish', reason: 'complete', usage: null };

interface ReadBullet {
  handle: string;
  isShown: boolean;
  text: string;
}

/** The bullets as read_document writes them: "- b2 (hidden): Wrote the runbook". */
function readBullets(readResult: string): ReadBullet[] {
  return [...readResult.matchAll(/^- (b\d+)( \(hidden\))?: (.*)$/gm)].map(
    ([, handle, hiddenNote, text]) => ({ handle, isShown: !hiddenNote, text })
  );
}

/** A change no check refuses: the closing full stop taken off, or put on. */
const toggleFullStop = (text: string) => (text.endsWith('.') ? text.slice(0, -1) : `${text}.`);

function suggestFrom(readResult: string, step: number): ModelStreamEvent[] {
  const [first, second = first] = readBullets(readResult);
  if (!first) return [{ type: 'textDelta', text: 'There are no bullets to change.' }, FINISH];
  return [
    { type: 'textDelta', text: 'Two suggestions.' },
    {
      type: 'toolCall',
      callId: `scripted-${step}-1`,
      name: 'propose_rewrite',
      args: { id: first.handle, text: toggleFullStop(first.text), reason: 'Scripted.' },
    },
    {
      type: 'toolCall',
      callId: `scripted-${step}-2`,
      name: 'propose_select',
      args: { id: second.handle, show: !second.isShown, reason: 'Scripted.' },
    },
    FINISH,
  ];
}

function playStep(messages: ModelMessage[]): ModelStreamEvent[] {
  const last = messages.at(-1);
  const step = messages.length;
  if (last?.role === 'user') {
    return [
      { type: 'toolCall', callId: `scripted-${step}-1`, name: 'read_document', args: {} },
      FINISH,
    ];
  }
  if (last?.role === 'toolResult' && last.toolName === 'read_document') {
    return suggestFrom(last.content, step);
  }
  return [{ type: 'textDelta', text: 'Done. They’re waiting for your review.' }, FINISH];
}

export function createScriptedModelProvider(): ModelProvider {
  return {
    async *streamReply(request) {
      yield* playStep(request.messages);
    },
  };
}
