import { useEffect, useState, type ReactNode } from 'react';
import { Text, textVariantClasses } from '@/components/ui-kit';
import { agentService } from '@/lib/services/agentService';
import { readOr } from '@/lib/services/readOr';
import { cn } from '@/lib/utils';
import { TracingDots } from '@/components/TracingDots';
import type { RowState } from '../run-view/runTimeline';
import { formatToolAnswer } from './traceWords';

/** Displays argument or result text in a scrollable preformatted block. */
export function RawBlock({ text }: { text: string }) {
  return (
    <pre
      tabIndex={0}
      className={cn(
        textVariantClasses('meta'),
        'max-h-72 overflow-y-auto rounded-sm border border-line bg-pane-sunken px-2.5 py-2 wrap-anywhere whitespace-pre-wrap text-ink-soft'
      )}
    >
      {text}
    </pre>
  );
}

function AnswerNote({ children }: { children: ReactNode }) {
  return (
    <Text
      as="p"
      variant="caption"
      className="flex items-center gap-2 rounded-sm border border-dashed border-line-strong px-2.5 py-2"
    >
      {children}
    </Text>
  );
}

function StoredAnswer({ messageId, callId }: { messageId: number; callId: string }) {
  // Undefined means loading; null means the result could not be read.
  const [content, setContent] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let isCurrent = true;
    void readOr(
      () => agentService.readToolResult(messageId, callId).then((result) => result.content),
      null,
      'Couldn’t read a tool’s answer'
    ).then((read) => {
      if (isCurrent) setContent(read);
    });
    return () => {
      isCurrent = false;
    };
  }, [messageId, callId]);

  if (content === undefined) {
    return (
      <AnswerNote>
        <TracingDots />
        Loading the result
      </AnswerNote>
    );
  }
  if (content === null) return <AnswerNote>Couldn’t read this result.</AnswerNote>;
  return <RawBlock text={formatToolAnswer(content)} />;
}

interface ToolAnswerProps {
  state: RowState;
  callId: string;
  /** Available after the completed run is loaded, although results are stored during the run. */
  messageId: number | undefined;
}

/** Loads a tool result only when its record opens, since the result can contain a whole resume. */
export function ToolAnswer({ state, callId, messageId }: ToolAnswerProps) {
  if (state === 'cut') return <AnswerNote>No result: the step was never made.</AnswerNote>;
  if (messageId !== undefined) return <StoredAnswer messageId={messageId} callId={callId} />;
  if (state === 'run' || state === 'wait') return <AnswerNote>Not back yet.</AnswerNote>;
  return <AnswerNote>Shows here once the run ends.</AnswerNote>;
}
