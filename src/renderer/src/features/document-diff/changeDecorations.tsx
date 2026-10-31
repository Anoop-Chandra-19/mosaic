import type { PageDecorations } from '@/features/preview/pageDecorations';
import type { Change } from '@/lib/resume/changes/resumeChange';
import type { EntryHeadingFields } from '@/lib/resume/entryHeading';
import { HeaderLineBar, MarkedDates, MarkedHeading, MarkedItem, MarkedLine } from './PageMarkParts';
import {
  BULLET_GUTTER,
  collectPageMarks,
  findMarks,
  LINE_GUTTER,
  type MarkPlace,
} from './pageMarks';

const NO_FIELDS: EntryHeadingFields = { title: '', organization: '', location: '' };

/** The page with `changes` marked, and hover tips that name the other side. */
export function decorateChanges(changes: readonly Change[], otherSide: string): PageDecorations {
  const marks = collectPageMarks(changes);
  const markLine =
    (place: MarkPlace, gutter = LINE_GUTTER) =>
    (id: string, text: string) => (
      <MarkedLine
        changes={findMarks(marks, place, id)}
        text={text}
        otherSide={otherSide}
        gutter={gutter}
      />
    );
  return {
    name: (name) => {
      const nameChanges = findMarks(marks, 'name', '');
      // A name that went prints the placeholder; the mark strikes the one it had.
      const text = nameChanges[0]?.kind === 'remove' ? nameChanges[0].before : name;
      return (
        <MarkedLine changes={nameChanges} text={text} otherSide={otherSide} gutter={LINE_GUTTER} />
      );
    },
    headerLine: (itemIds) => (
      <HeaderLineBar changes={itemIds.flatMap((id) => findMarks(marks, 'item', id))} />
    ),
    headerItem: (itemId, printed, text) => {
      const change = findMarks(marks, 'item', itemId)[0];
      // Marked, it says what changed on hover instead of where it links.
      return change ? <MarkedItem change={change} text={text} otherSide={otherSide} /> : printed;
    },
    sectionLabel: markLine('section'),
    line: markLine('entry'),
    entryHeading: (entryId, heading, fields = NO_FIELDS) => (
      <MarkedHeading
        changes={findMarks(marks, 'entry', entryId)}
        heading={heading}
        fields={fields}
        otherSide={otherSide}
      />
    ),
    entryDates: (entryId, dates) => (
      <MarkedDates
        changes={findMarks(marks, 'entry', entryId)}
        dates={dates}
        otherSide={otherSide}
      />
    ),
    bullet: markLine('bullet', BULLET_GUTTER),
  };
}
