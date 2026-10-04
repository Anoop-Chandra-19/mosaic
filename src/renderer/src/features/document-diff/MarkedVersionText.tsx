import type { ReactNode } from 'react';
import { AppTooltip } from '@/components/AppTooltip';
import { Text } from '@/components/Text';
import { textVariantClasses } from '@/components/textVariants';
import { cn } from '@/lib/utils';
import { describeChange, describeChangeTip } from '@shared/resume/changes/describeChanges';
import type { DiffLine, ResumeDiff } from '@shared/resume/changes/diffResumes';
import {
  getChangeTone,
  isShortFieldChange,
  type Change,
  type ChangeTargetType,
  type ChangeTone,
} from '@shared/resume/changes/resumeChange';
import { PhraseText } from './PhraseText';

/** A changed line keeps a bar at its left edge, in the chrome's colours. */
const LINE_TONE: Record<ChangeTone, string> = {
  edit: 'shadow-[-9px_0_0_-7px_var(--color-ink-muted)]',
  add: 'bg-add-soft text-foreground shadow-[-9px_0_0_-7px_var(--color-add)]',
  del: 'shadow-[-9px_0_0_-7px_var(--color-del)]',
};
const GONE = 'text-ink-faint line-through decoration-del-line';
const TEXT_LINE =
  'relative mt-0.75 rounded-[3px] pl-3 text-pretty before:absolute before:top-2 before:left-0.75 before:size-0.75 before:rounded-full before:bg-ink-faint';

const ROW_STYLES: Record<ChangeTargetType, { as: 'p' | 'h4' | 'h5'; className: string }> = {
  name: { as: 'h4', className: cn(textVariantClasses('editor'), 'mb-1.5') },
  section: {
    as: 'h5',
    className: cn(
      textVariantClasses('tag'),
      'mt-3.5 mb-1.5 border-b border-line pb-0.75 text-ink-faint'
    ),
  },
  entry: {
    as: 'p',
    className: cn(textVariantClasses('secondary'), 'mt-2 mb-0.5 font-strong text-foreground'),
  },
  entryField: { as: 'p', className: cn(textVariantClasses('secondary'), 'mt-0.5') },
  headerItem: { as: 'p', className: cn(textVariantClasses('secondary'), 'mt-0.5') },
  bullet: { as: 'p', className: TEXT_LINE },
  summaryLine: { as: 'p', className: TEXT_LINE },
  textLine: { as: 'p', className: TEXT_LINE },
};

const isGone = (change: Change) => change.kind === 'remove' || change.kind === 'hide';

function LineText({ line }: { line: DiffLine }) {
  const { change } = line;
  if (!change) return line.row.text;
  if (change.phrases) {
    return (
      <PhraseText
        phrases={change.phrases}
        side="both"
        deletedClassName="text-del line-through"
        insertedClassName="rounded-xs bg-add-soft text-foreground"
      />
    );
  }
  if (!isShortFieldChange(change)) return change.after || change.before;
  return (
    <>
      {change.before && <span className="text-del line-through">{change.before}</span>}
      {change.before && change.after ? ' ' : null}
      {change.after && (
        <span className="rounded-xs bg-add-soft text-foreground">{change.after}</span>
      )}
    </>
  );
}

/** A field or header item names itself, since it stands apart from the line it belongs to. */
function FieldLabel({ change }: { change: Change }) {
  return (
    <Text variant="meta" className="mr-2 inline-block min-w-18.5">
      {describeChange(change).noun}
    </Text>
  );
}

function MarkedRow({ line, otherSide }: { line: DiffLine; otherSide: string }) {
  const { row, change } = line;
  const { as: Tag, className } = ROW_STYLES[row.target.type];
  const isField = row.target.type === 'entryField' || row.target.type === 'headerItem';
  const element = (
    <Tag
      data-change-id={change && !change.parentId ? change.id : undefined}
      className={cn(
        className,
        change && LINE_TONE[getChangeTone(change)],
        change && isGone(change) && GONE
      )}
    >
      {isField && change && <FieldLabel change={change} />}
      <LineText line={line} />
      {change?.kind === 'hide' && (
        <Text variant="meta" className="ml-2 no-underline">
          hidden
        </Text>
      )}
    </Tag>
  );
  if (!change) return element;
  return <AppTooltip content={describeChangeTip(change, otherSide)}>{element}</AppTooltip>;
}

interface MarkedVersionTextProps {
  diff: ResumeDiff;
  otherSide: string;
  /** What heads the text: why it is text and not the page. */
  note: ReactNode;
}

/**
 * The version read as text, for a pane too narrow for the page, with the same marks the
 * page would carry: a bar by tone, the changed words, and what is gone struck in place.
 */
export function MarkedVersionText({ diff, otherSide, note }: MarkedVersionTextProps) {
  return (
    <Text as="div" variant="body" className="mx-auto block w-full max-w-105 px-4.5 text-ink-muted">
      {note}
      {diff.lines.map((line, index) => {
        const key = `${line.row.key}:${index}`;
        if (line.isMove && line.change) {
          const { noun, verb } = describeChange(line.change);
          return (
            <Text key={key} as="p" variant="meta" className="mt-0.5 ml-3">
              ↕ {noun} {verb}
            </Text>
          );
        }
        const isUnchangedField =
          !line.change &&
          (line.row.target.type === 'entryField' || line.row.target.type === 'headerItem');
        if (isUnchangedField) return null;
        return <MarkedRow key={key} line={line} otherSide={otherSide} />;
      })}
    </Text>
  );
}
