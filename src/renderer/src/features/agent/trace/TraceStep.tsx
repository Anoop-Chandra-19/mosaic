import type { ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { AppButton, Chip, Text, textVariantClasses } from '@/components/ui-kit';
import { shortModelName } from '@/lib/shortModelName';
import { cn } from '@/lib/utils';
import type { ReadOutcome } from '@shared/types/agentBridge';
import type { RunModel } from '@shared/types/agentConversation';
import { LiveTime } from '../run-view/LiveTime';
import { runAnchorProps } from '../run-view/runAnchors';
import { StepMark } from '../run-view/RunLine';
import type { StepRow } from '../run-view/runTimeline';
import { RawBlock, ToolAnswer } from './ToolAnswer';
import {
  describeCheck,
  describeRetry,
  formatSharedTokens,
  formatToolArguments,
  formatTraceTime,
  READ_CHIPS,
  STATE_CHIPS,
  STATE_WORDS,
} from './traceWords';

function RecordRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-ink-faint">{label}</dt>
      <dd className="min-w-0 wrap-anywhere text-ink-soft">{children}</dd>
    </>
  );
}

function RecordLabel({ children }: { children: ReactNode }) {
  return (
    <Text as="p" variant="tag" className="mt-2 mb-1 text-ink-faint">
      {children}
    </Text>
  );
}

function StepAttempts({ row }: { row: StepRow }) {
  const retries = row.call.request?.retries ?? [];
  if (retries.length === 0) return null;
  return (
    <RecordRow label="Attempts">
      {retries.map((retry, index) => (
        <span key={index} className="block">
          {index + 1}. {describeRetry(retry)}
        </span>
      ))}
      <span className="block">{retries.length + 1}. Answered</span>
    </RecordRow>
  );
}

function StepRecord({ row, model }: { row: StepRow; model: RunModel | null }) {
  const { call } = row;
  const why = describeCheck(call.checkName);
  const usage = call.request?.usage;
  return (
    <div className="mx-1 mb-2.5 ml-6.25 rounded-sm border border-line bg-pane-raised px-3 py-2.5">
      {why && (
        <Text as="p" variant="secondary" className="mb-2.5 text-pretty text-ink-soft">
          {why}
        </Text>
      )}
      <dl
        className={cn(
          textVariantClasses('secondary'),
          'grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3.5 gap-y-1'
        )}
      >
        <RecordRow label="Status">{STATE_WORDS[row.state]}</RecordRow>
        {row.note && <RecordRow label="Worked on">{row.note}</RecordRow>}
        {model && <RecordRow label="Model">{shortModelName(model.model)}</RecordRow>}
        {usage && (
          <RecordRow label="Tokens">
            {formatSharedTokens(usage, call.request?.callCount ?? 1)}
          </RecordRow>
        )}
        {row.durationMs !== undefined && (
          <RecordRow label="Took">{formatTraceTime(row.durationMs)}</RecordRow>
        )}
        <StepAttempts row={row} />
      </dl>
      <RecordLabel>Arguments</RecordLabel>
      {call.args === undefined ? (
        <Text as="p" variant="caption">
          Still arriving.
        </Text>
      ) : (
        <RawBlock text={formatToolArguments(call.args)} />
      )}
      <RecordLabel>Result</RecordLabel>
      <ToolAnswer state={row.state} callId={call.callId} messageId={call.resultMessageId} />
    </div>
  );
}

function StepTime({ row }: { row: StepRow }) {
  if (row.state === 'run' && row.startedAt !== undefined) {
    return (
      <Text variant="meta" className="shrink-0 text-amber">
        <LiveTime since={row.startedAt} />
      </Text>
    );
  }
  if (row.durationMs === undefined) return null;
  return (
    <Text variant="meta" className="shrink-0">
      {formatTraceTime(row.durationMs)}
    </Text>
  );
}

interface TraceStepProps {
  runId: number;
  row: StepRow;
  model: RunModel | null;
  readOutcome: ReadOutcome | undefined;
  isOpen: boolean;
  onToggle: () => void;
}

/** One tool call: its name, what it was about, and, opened, its whole record. */
export function TraceStep({ runId, row, model, readOutcome, isOpen, onToggle }: TraceStepProps) {
  const chip = STATE_CHIPS[row.state];
  const retries = row.call.request?.retries.length ?? 0;
  return (
    <div className="border-t border-line first:border-t-0">
      <AppButton
        variant="plain"
        aria-expanded={isOpen}
        onClick={onToggle}
        {...runAnchorProps(runId, row.key)}
        className={cn(
          textVariantClasses('secondary'),
          'flex h-auto w-full flex-col items-stretch gap-px rounded-sm px-1 pt-1.5 pb-1.5 text-left text-ink-soft hover:bg-line hover:text-foreground'
        )}
      >
        <span className="flex min-w-0 gap-2">
          <StepMark state={row.state} />
          <span className="min-w-0 truncate">{row.words}</span>
          <Text variant="meta" className="min-w-0 flex-1 truncate @max-[27.5rem]/trace:hidden">
            {row.call.name}
          </Text>
          <span className="ml-auto" />
          <StepTime row={row} />
          {isOpen ? (
            <ChevronDown aria-hidden className="size-2.75 shrink-0 text-ink-faint" />
          ) : (
            <ChevronRight aria-hidden className="size-2.75 shrink-0 text-ink-faint" />
          )}
        </span>
        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 pr-1 pl-5.25 empty:hidden">
          {row.note && (
            <Text variant="caption" className="max-w-full min-w-0 truncate">
              {row.note}
            </Text>
          )}
          {chip && (
            <Chip size="sm" tone="warn">
              {chip}
            </Chip>
          )}
          {readOutcome && <Chip size="sm">{READ_CHIPS[readOutcome]}</Chip>}
          {retries > 0 && <Chip size="sm">{retries + 1} attempts</Chip>}
        </span>
      </AppButton>
      {isOpen && <StepRecord row={row} model={model} />}
    </div>
  );
}
