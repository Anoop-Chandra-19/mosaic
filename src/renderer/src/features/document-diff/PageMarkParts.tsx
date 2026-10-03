import type { ReactNode } from 'react';
import { AppTooltip } from '@/components/AppTooltip';
import { cn } from '@/lib/utils';
import { describeChangeTip } from '@shared/resume/changes/describeChanges';
import type { EntryHeadingFields } from '@shared/resume/entryHeading';
import { ENTRY_HEADING_SEPARATOR } from '@shared/resume/entryHeading';
import {
  getChangeTone,
  type Change,
  type ChangeMove,
  type ChangeTone,
} from '@shared/resume/changes/resumeChange';
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

function describeTips(changes: Change[], otherSide: string): ReactNode {
  return changes.map((change, index) => <p key={index}>{describeChangeTip(change, otherSide)}</p>);
}

/** Room past the outermost margin mark, so it is easy to hover. */
const GUTTER_REACH_PX = 4;

/** How far into the left margin a line's hover reaches: past its bar, or its move glyph. */
function measureGutterReach(gutter: MarkGutter, hasMove: boolean): number {
  return (hasMove ? gutter.glyphPx : gutter.barPx) + GUTTER_REACH_PX;
}

interface TipProps {
  changes: Change[];
  otherSide: string;
  /** How far the hover reaches into the margin, over the line's marks there; none if 0. */
  gutterReachPx?: number;
  children: ReactNode;
}

/**
 * A marked line's one hover target: its text, and its marks in the margin up to the text.
 * The tip follows the pointer along the line, below it.
 */
function Tip({ changes, otherSide, gutterReachPx = 0, children }: TipProps) {
  const topLevel = changes.find((change) => !change.parentId && change.kind !== 'move');
  return (
    <AppTooltip content={describeTips(changes, otherSide)} shouldFollowPointer>
      <span data-change-id={topLevel?.id} className={HOVER}>
        {gutterReachPx > 0 && (
          <span
            aria-hidden
            className="absolute top-0 bottom-0"
            style={{ left: -gutterReachPx, width: gutterReachPx }}
          />
        )}
        {children}
      </span>
    </AppTooltip>
  );
}

/** The bar and any move glyph in the margin; hovering them is hovering the line's tip. */
function GutterMarks({
  tone,
  move,
  gutter,
}: {
  tone: ChangeTone;
  move?: Change;
  gutter: MarkGutter;
}) {
  return (
    <>
      <span aria-hidden className={cn(BAR, BAR_TONE[tone])} style={{ left: -gutter.barPx }} />
      {move && <MoveGlyph move={move} gutter={gutter} />}
    </>
  );
}

const MOVE_GLYPHS: Record<ChangeMove['direction'], string> = { up: '↑', down: '↓', across: '⇄' };

function MoveGlyph({ move, gutter }: { move: Change; gutter: MarkGutter }) {
  const glyph = MOVE_GLYPHS[move.move?.direction ?? 'down'];
  return (
    <i
      aria-hidden
      data-change-id={move.parentId ? undefined : move.id}
      className="pointer-events-none absolute top-0 font-sans text-[9px] leading-[inherit] font-bold text-paper-changed not-italic"
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
      <GutterMarks tone={change ? getChangeTone(change) : 'edit'} move={move} gutter={gutter} />
      <Tip
        changes={changes}
        otherSide={otherSide}
        gutterReachPx={measureGutterReach(gutter, move !== undefined)}
      >
        {change ? <MarkedContent change={change} text={text} /> : text}
      </Tip>
    </>
  );
}

/** The tone several changes on one line share, or an edit's when they differ. */
function toneOfChanges(changes: Change[]): ChangeTone {
  const tones = new Set(changes.map(getChangeTone));
  return tones.size === 1 ? [...tones][0] : 'edit';
}

/** The tone of an entry's line: its own change's, or its fields' if they agree. */
function toneOfEntry(entryChange: Change | undefined, fieldChanges: Change[]): ChangeTone {
  return entryChange ? getChangeTone(entryChange) : toneOfChanges(fieldChanges);
}

/** One bar for a header line, whatever changed in it. Its box must be positioned. */
export function HeaderLineBar({ changes }: { changes: Change[] }) {
  if (changes.length === 0) return null;
  return <GutterMarks tone={toneOfChanges(changes)} gutter={LINE_GUTTER} />;
}

/** A header item, marked in its line: old → new, new highlighted, or struck where it stood. */
export function MarkedItem({
  change,
  text,
  otherSide,
}: {
  change: Change;
  text: string;
  otherSide: string;
}) {
  return (
    <Tip changes={[change]} otherSide={otherSide}>
      <MarkedContent change={change} text={text} />
    </Tip>
  );
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
      <GutterMarks tone={toneOfEntry(entryChange, fieldChanges)} move={move} gutter={LINE_GUTTER} />
      <Tip
        changes={changes}
        otherSide={otherSide}
        gutterReachPx={measureGutterReach(LINE_GUTTER, move !== undefined)}
      >
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
