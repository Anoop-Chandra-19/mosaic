import type { ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { AppButton, Text, textVariantClasses } from '@/components/ui-kit';
import { shortModelName } from '@/lib/shortModelName';
import { cn } from '@/lib/utils';
import type { RunModel } from '@shared/types/agentConversation';
import { LiveTime } from '../run-line/LiveTime';
import { StepMark } from '../run-line/RunLine';
import type { StepRow } from '../run-line/runTimeline';
import { RawBlock, ToolAnswer } from './ToolAnswer';
import {
  describeCheck,
  describeRetry,
  formatSharedTokens,
  formatToolArguments,
  formatTraceTime,
  STATE_CHIPS,
  STATE_WORDS,
} from './traceWords';

export function TraceChip({ children, isWarning }: { children: ReactNode; isWarning?: boolean }) {
  return (
    <Text
      variant="caption"
      className={cn(
        'rounded-[0.25rem] px-1.5 py-px whitespace-nowrap',
        isWarning ? 'bg-warn-soft text-warn-text' : 'bg-line text-ink-muted'
      )}
    >
      {children}
    </Text>
  );
}

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
  row: StepRow;
  model: RunModel | null;
  isOpen: boolean;
  onToggle: () => void;
}

/** One tool call: its name, what it was about, and, opened, its whole record. */
export function TraceStep({ row, model, isOpen, onToggle }: TraceStepProps) {
  const chip = STATE_CHIPS[row.state];
  const retries = row.call.request?.retries.length ?? 0;
  return (
    <div className="border-t border-line first:border-t-0">
      <AppButton
        variant="plain"
        aria-expanded={isOpen}
        onClick={onToggle}
        className={cn(
          textVariantClasses('secondary'),
          'flex h-auto w-full gap-2 px-1 pt-1.5 pb-px text-left text-ink-soft hover:text-foreground'
        )}
      >
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
      </AppButton>
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 pr-1 pb-1.5 pl-6.25">
        {row.note && (
          <Text variant="caption" className="max-w-full min-w-0 truncate">
            {row.note}
          </Text>
        )}
        {chip && <TraceChip isWarning>{chip}</TraceChip>}
        {retries > 0 && <TraceChip>{retries + 1} attempts</TraceChip>}
      </div>
      {isOpen && <StepRecord row={row} model={model} />}
    </div>
  );
}
