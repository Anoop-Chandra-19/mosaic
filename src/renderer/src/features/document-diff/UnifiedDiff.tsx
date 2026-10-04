import { Fragment, useState, type ReactNode } from 'react';
import { AppButton } from '@/components/AppButton';
import { Text } from '@/components/Text';
import { textVariantClasses } from '@/components/textVariants';
import { cn } from '@/lib/utils';
import {
  describeChange,
  describeChangeTip,
  describeFormattingChange,
} from '@shared/resume/changes/describeChanges';
import type { DiffLine, ResumeDiff } from '@shared/resume/changes/diffResumes';
import type { FormattingChange } from '@shared/resume/changes/diffFormatting';
import { getChangeTone, type Change } from '@shared/resume/changes/resumeChange';
import { groupDiffLinesIntoHunks } from './groupDiffLines';
import { PhraseText } from './PhraseText';

interface UnifiedDiffProps {
  diff: ResumeDiff;
  formatting: FormattingChange[];
  cursorId: string | null;
  onPick: (change: Change) => void;
  otherSide: string;
  isDetailed: boolean;
}

const DELETED_WORDS = 'rounded-xs bg-del-word text-foreground';
/** The narrow label a field or setting names itself with, before its value. */
const FIELD_LABEL = 'mr-2 inline-block min-w-18.5';
const INSERTED_WORDS = 'rounded-xs bg-add-word text-foreground';

/** Each line: before and after numbers when detailed, a sign, then the text. */
function lineGrid(isDetailed: boolean) {
  return cn(
    'grid w-full items-baseline text-left text-body',
    isDetailed
      ? 'grid-cols-[1.625rem_1.625rem_1rem_minmax(0,1fr)]'
      : 'grid-cols-[1rem_minmax(0,1fr)]'
  );
}

function LineNumbers({ before, after }: { before: number | null; after: number | null }) {
  const number = 'self-stretch pt-px pr-1.5 text-right';
  return (
    <>
      <Text variant="meta" className={number}>
        {before ?? ''}
      </Text>
      <Text variant="meta" className={number}>
        {after ?? ''}
      </Text>
    </>
  );
}

interface LineProps {
  isDetailed: boolean;
  numbers: { before: number | null; after: number | null };
  sign: string;
  className?: string;
  signClassName?: string;
  children: ReactNode;
}

function Line({ isDetailed, numbers, sign, className, signClassName, children }: LineProps) {
  return (
    <div className={cn(lineGrid(isDetailed), className)}>
      {isDetailed && <LineNumbers {...numbers} />}
      <Text variant="meta" className={cn('text-center', signClassName)}>
        {sign}
      </Text>
      <span className="py-0.75 pr-3 pl-0.5 text-pretty">{children}</span>
    </div>
  );
}

const isTextRow = (line: DiffLine) =>
  ['bullet', 'summaryLine', 'textLine'].includes(line.row.target.type);

/** A heading's field or a header item says which it is, in a narrow label. */
function FieldLabel({ change }: { change: Change }) {
  if (change.target.type !== 'entryField' && change.target.type !== 'headerItem') return null;
  return (
    <Text variant="meta" className={cn(FIELD_LABEL, 'not-italic')}>
      {describeChange(change).noun}
    </Text>
  );
}

function ChangeLines({
  line,
  change,
  isDetailed,
}: {
  line: DiffLine;
  change: Change;
  isDetailed: boolean;
}) {
  const text = (content: ReactNode) =>
    isTextRow(line) ? content : <span className="italic">{content}</span>;
  const tone = getChangeTone(change);
  const isPair = !!change.phrases || (change.kind === 'edit' && !!change.before && !!change.after);

  if (change.kind === 'move') {
    return (
      <Line
        isDetailed={isDetailed}
        numbers={{ before: null, after: null }}
        sign="↕"
        signClassName="text-ink-muted"
      >
        <Text variant="secondary">{describeChange(change).verb}</Text>
      </Line>
    );
  }
  if (isPair) {
    return (
      <>
        <Line
          isDetailed={isDetailed}
          numbers={{ before: line.beforeNumber, after: null }}
          sign="−"
          className="bg-del-soft text-ink-soft"
          signClassName="text-del"
        >
          <FieldLabel change={change} />
          {text(
            change.phrases ? (
              <PhraseText phrases={change.phrases} side="before" deletedClassName={DELETED_WORDS} />
            ) : (
              change.before
            )
          )}
        </Line>
        <Line
          isDetailed={isDetailed}
          numbers={{ before: null, after: line.afterNumber }}
          sign="+"
          className="bg-add-soft text-foreground"
          signClassName="text-add"
        >
          <FieldLabel change={change} />
          {text(
            change.phrases ? (
              <PhraseText
                phrases={change.phrases}
                side="after"
                insertedClassName={INSERTED_WORDS}
              />
            ) : (
              change.after
            )
          )}
        </Line>
      </>
    );
  }
  const isAdded = tone === 'add';
  return (
    <Line
      isDetailed={isDetailed}
      numbers={
        isAdded
          ? { before: null, after: line.afterNumber }
          : { before: line.beforeNumber, after: null }
      }
      sign={isAdded ? '+' : '−'}
      className={isAdded ? 'bg-add-soft text-foreground' : 'bg-del-soft text-ink-soft'}
      signClassName={isAdded ? 'text-add' : 'text-del'}
    >
      <FieldLabel change={change} />
      {text(change.after || change.before)}
      {(change.kind === 'show' || change.kind === 'hide') && (
        <Text variant="meta" className="ml-2 not-italic">
          {change.kind === 'show' ? 'was left off' : 'left off the page, still in the document'}
        </Text>
      )}
    </Line>
  );
}

interface UnifiedLineProps {
  line: DiffLine;
  isCurrent: boolean;
  onPick: (change: Change) => void;
  otherSide: string;
  isDetailed: boolean;
}

function UnifiedLine({ line, isCurrent, onPick, otherSide, isDetailed }: UnifiedLineProps) {
  const { change } = line;
  if (!change) {
    return (
      <Line
        isDetailed={isDetailed}
        numbers={{ before: line.beforeNumber, after: line.afterNumber }}
        sign=""
        className="text-ink-faint"
      >
        {isTextRow(line) ? line.row.text : <span className="italic">{line.row.text}</span>}
      </Line>
    );
  }
  const tip = describeChangeTip(change, otherSide);
  if (change.parentId) {
    return (
      <div title={tip} className="text-ink-muted">
        <ChangeLines line={line} change={change} isDetailed={isDetailed} />
      </div>
    );
  }
  return (
    <AppButton
      variant="plain"
      shape="text"
      title={tip}
      data-change-id={change.id}
      aria-current={isCurrent || undefined}
      onClick={() => onPick(change)}
      className="relative block w-full rounded-none p-0 aria-current:before:absolute aria-current:before:inset-y-0 aria-current:before:left-0 aria-current:before:z-1 aria-current:before:w-0.5 aria-current:before:bg-ink-soft"
    >
      <ChangeLines line={line} change={change} isDetailed={isDetailed} />
    </AppButton>
  );
}

const HUNK = 'overflow-hidden rounded-sm border border-line bg-background';
const HUNK_HEADER = cn(
  textVariantClasses('secondary'),
  'flex items-center gap-1.75 border-b border-line bg-pane-raised px-2.5 py-1.5 text-ink-soft'
);

/**
 * "Changes only": one hunk per entry, section, or the header, with the lines that differ,
 * unchanged ones folded, and the formatting last.
 */
export function UnifiedDiff({
  diff,
  formatting,
  cursorId,
  onPick,
  otherSide,
  isDetailed,
}: UnifiedDiffProps) {
  const [openFoldIds, setOpenFoldIds] = useState<ReadonlySet<string>>(new Set());
  const hunks = groupDiffLinesIntoHunks(diff.lines, openFoldIds);
  return (
    <div className="flex flex-col gap-3 px-3.5 pt-1.5 pb-5">
      {hunks.map((hunk) => (
        <section key={hunk.key} aria-label={hunk.title} className={HUNK}>
          <header className={HUNK_HEADER}>
            {isDetailed && (
              <Text variant="meta" className="text-info">
                @@
              </Text>
            )}
            {hunk.title.split(' › ').map((part, index) => (
              <Fragment key={index}>
                {index > 0 && <span className="text-ink-faint">›</span>}
                {part}
              </Fragment>
            ))}
          </header>
          {hunk.items.map((item, index) =>
            item.kind === 'fold' ? (
              <AppButton
                key={item.id}
                variant="plain"
                shape="text"
                onClick={() => setOpenFoldIds((open) => new Set(open).add(item.id))}
                className="group block w-full rounded-none p-0 hover:bg-line"
              >
                <Line isDetailed={isDetailed} numbers={{ before: null, after: null }} sign="⋯">
                  <Text variant="meta" className="group-hover:text-ink-soft">
                    {item.lines.length} unchanged {item.noun}
                    {item.lines.length === 1 ? '' : 's'}
                  </Text>
                </Line>
              </AppButton>
            ) : (
              <UnifiedLine
                key={`${item.line.row.key}:${index}`}
                line={item.line}
                isCurrent={!!item.line.change && item.line.change.id === cursorId}
                onPick={onPick}
                otherSide={otherSide}
                isDetailed={isDetailed}
              />
            )
          )}
        </section>
      ))}
      {formatting.length > 0 && (
        <section aria-label="Formatting" className={HUNK}>
          <header className={HUNK_HEADER}>Formatting</header>
          {formatting.map((change) => {
            const wording = describeFormattingChange(change, otherSide);
            return (
              <div
                key={`${change.setting}:${change.lineId}`}
                title={`${wording.row}. Formatting isn’t marked on the page or counted as a change.`}
              >
                <Line
                  isDetailed={isDetailed}
                  numbers={{ before: null, after: null }}
                  sign=""
                  className="text-ink-soft"
                >
                  <Text variant="meta" className={FIELD_LABEL}>
                    {wording.setting}
                  </Text>
                  {wording.from} → {wording.to}
                </Line>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
