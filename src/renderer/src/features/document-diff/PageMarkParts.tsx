import type { ReactNode } from 'react';
import { AppTooltip } from '@/components/AppTooltip';
import { cn } from '@/lib/utils';
import { describeChangeTip } from '@shared/resume/changes/describeChanges';
import type { EntryHeadingFields } from '@shared/resume/entryHeading';
import { ENTRY_HEADING_SEPARATOR } from '@shared/resume/entryHeading';
import { getChangeTone, type Change, type ChangeTone } from '@shared/resume/changes/resumeChange';
import { LINE_GUTTER, type MarkGutter } from './pageMarks';
import { PhraseText } from './PhraseText';

/*
 * Marks drawn on the printed page, in paper ink. Moves are a glyph in the left margin and
 * changed lines a bar there, so marking a page never reflows it.
 */

const BAR = 'pointer-events-none absolute top-0.75 bottom-0.75 w-[2.5px] rounded-[2px] not-italic';
const BAR_TONE: Record<ChangeTone, string> = {
  edit: 'bg-paper-changed',
  add: 'bg-paper-add',
  del: 'bg-paper-del',
};
const ADDED = 'rounded-[2px] bg-paper-add-soft [box-decoration-break:clone]';
const REMOVED = 'text-paper-del-text line-through decoration-paper-del decoration-1';
const INSERTED_WORDS = 'rounded-[1.5px] border-b border-paper-add bg-paper-add-soft';
const DELETED_WORDS = 'text-paper-del line-through decoration-1';
const HOVER = 'cursor-help rounded-[2px] hover:shadow-[0_0_0_2px_var(--paper-mark-hover)]';

const isGone = (change: Change) => change.kind === 'remove' || change.kind === 'hide';

function Tip({
  changes,
  otherSide,
  children,
}: {
  changes: Change[];
  otherSide: string;
  children: ReactNode;
}) {
  const tips = changes.map((change) => describeChangeTip(change, otherSide));
  const topLevel = changes.find((change) => !change.parentId && change.kind !== 'move');
  return (
    <AppTooltip
      content={tips.map((tip, index) => (
        <p key={index}>{tip}</p>
      ))}
    >
      <span data-change-id={topLevel?.id} className={HOVER}>
        {children}
      </span>
    </AppTooltip>
  );
}

function Bar({ tone, gutter }: { tone: ChangeTone; gutter: MarkGutter }) {
  return <span aria-hidden className={cn(BAR, BAR_TONE[tone])} style={{ left: -gutter.barPx }} />;
}

function MoveGlyph({ move, gutter }: { move: Change; gutter: MarkGutter }) {
  const placement = move.move?.placement;
  const glyph = placement?.relation === 'in' ? '⇄' : move.move?.isMovedUp ? '↑' : '↓';
  return (
    <i
      aria-hidden
      data-change-id={move.parentId ? undefined : move.id}
      className="pointer-events-none absolute top-0 font-sans text-[9px] leading-none font-bold text-paper-changed not-italic"
      style={{ left: -gutter.glyphPx }}
    >
      {glyph}
    </i>
  );
}

/** A short field as old, struck, then new: never a word diff. */
function ShortField({ change }: { change: Change }) {
  return (
    <>
      {change.before && <span className={DELETED_WORDS}>{change.before}</span>}
      {change.before && change.after ? ' ' : null}
      {change.after && <span className={INSERTED_WORDS}>{change.after}</span>}
    </>
  );
}

function MarkedContent({ change, text }: { change: Change; text: string }) {
  if (isGone(change)) {
    return (
      <>
        <span className={REMOVED}>{text}</span>
        {change.kind === 'hide' && (
          <span className="ml-1.5 rounded-[3px] border-[0.5px] border-paper-tag-line px-[3px] align-[1px] font-sans text-[7.5px] font-bold tracking-[0.05em] text-paper-tag uppercase not-italic">
            hidden
          </span>
        )}
      </>
    );
  }
  if (change.kind === 'add' || change.kind === 'show') return <span className={ADDED}>{text}</span>;
  if (change.kind !== 'edit') return text;
  if (!change.phrases) return <ShortField change={change} />;
  // A line split across pages prints part of its text; only the whole one carries its words.
  if (change.after !== text) return text;
  return (
    <PhraseText
      phrases={change.phrases}
      side="both"
      deletedClassName={DELETED_WORDS}
      insertedClassName={INSERTED_WORDS}
    />
  );
}

interface MarkedLineProps {
  changes: Change[];
  text: string;
  otherSide: string;
  gutter: MarkGutter;
}

/**
 * A bullet, a text line, or a section's name, marked. Its box must be positioned, for the
 * bar and the glyph.
 */
export function MarkedLine({ changes, text, otherSide, gutter }: MarkedLineProps) {
  const move = changes.find((change) => change.kind === 'move');
  const change = changes.find((each) => each.kind !== 'move');
  if (!change && !move) return text;
  return (
    <>
      <Bar tone={change ? getChangeTone(change) : 'edit'} gutter={gutter} />
      {move && <MoveGlyph move={move} gutter={gutter} />}
      <Tip changes={changes} otherSide={otherSide}>
        {change ? <MarkedContent change={change} text={text} /> : text}
      </Tip>
    </>
  );
}

/** The tone of an entry's line: its own change's, or its fields' if they agree. */
function toneOfEntry(entryChange: Change | undefined, fieldChanges: Change[]): ChangeTone {
  if (entryChange) return getChangeTone(entryChange);
  const tones = new Set(fieldChanges.map(getChangeTone));
  return tones.size === 1 ? [...tones][0] : 'edit';
}

interface MarkedHeadingProps {
  changes: Change[];
  heading: string;
  fields: EntryHeadingFields;
  otherSide: string;
}

/**
 * An entry's line, marked: only the parts that changed, or all of it when the entry came,
 * went, or was left off. Its box must be positioned.
 */
export function MarkedHeading({ changes, heading, fields, otherSide }: MarkedHeadingProps) {
  const move = changes.find((change) => change.kind === 'move');
  const entryChange = changes.find(
    (change) => change.target.type === 'entry' && change.kind !== 'move'
  );
  const fieldChanges = changes.filter((change) => change.target.type === 'entryField');
  if (!move && !entryChange && fieldChanges.length === 0) return heading;
  const fieldChange = (field: keyof EntryHeadingFields) =>
    fieldChanges.find((change) => change.target.field === field);
  const parts = (['title', 'organization', 'location'] as const)
    .map((field) => {
      const change = fieldChange(field);
      if (!change) return fields[field] ? <span key={field}>{fields[field]}</span> : null;
      return <ShortField key={field} change={change} />;
    })
    .filter((part) => part !== null);
  return (
    <>
      <Bar tone={toneOfEntry(entryChange, fieldChanges)} gutter={LINE_GUTTER} />
      {move && <MoveGlyph move={move} gutter={LINE_GUTTER} />}
      <Tip changes={changes} otherSide={otherSide}>
        {entryChange ? (
          <MarkedContent change={entryChange} text={heading} />
        ) : (
          parts.map((part, index) => (
            <span key={index}>
              {index > 0 && ENTRY_HEADING_SEPARATOR}
              {part}
            </span>
          ))
        )}
      </Tip>
    </>
  );
}

/** An entry's dates, marked when they changed, or with the entry when it came or went. */
export function MarkedDates({
  changes,
  dates,
  otherSide,
}: {
  changes: Change[];
  dates: string;
  otherSide: string;
}) {
  const entryChange = changes.find(
    (change) => change.target.type === 'entry' && change.kind !== 'move'
  );
  const datesChange = changes.find((change) => change.target.field === 'dates');
  if (entryChange && isGone(entryChange)) return <span className={REMOVED}>{dates}</span>;
  if (!datesChange) return dates;
  return (
    <Tip changes={[datesChange]} otherSide={otherSide}>
      <ShortField change={datesChange} />
    </Tip>
  );
}
