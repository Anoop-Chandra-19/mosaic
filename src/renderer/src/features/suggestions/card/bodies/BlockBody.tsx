import { Eye, EyeOff } from 'lucide-react';
import { Text } from '@/components/ui-kit';
import { cn } from '@/lib/utils';
import { formatEntryHeading } from '@/lib/resume/entryHeading';
import type { ShowPlace } from '@/types/agentProposal';
import type { ResumeData, ResumeEntry, ResumeSection } from '@shared/types/resume';
import { findEntry, findSection } from '../../proposals/proposalAnchor';
import { Caption, TagLine } from './BodyParts';
import type { SuggestionBodyProps } from './suggestionBodyProps';

/** How many rows a block lists before "and n more". */
const SHOWN_ROWS = 4;

interface Block {
  heading: string;
  dates?: string;
  isSection: boolean;
  /** What goes with it: an entry's bullets, a section's entries or lines. */
  rows: string[];
  areRowsBullets: boolean;
  /** "3 bullets", "2 entries", "1 line". */
  count: string;
  isMany: boolean;
}

const countOf = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function readEntryBlock(entry: ResumeEntry): Block {
  return {
    heading: formatEntryHeading(entry) || 'Untitled entry',
    dates: entry.dates?.trim() || undefined,
    isSection: false,
    rows: entry.bullets.map((bullet) => bullet.text),
    areRowsBullets: true,
    count: countOf(entry.bullets.length, 'bullet', 'bullets'),
    isMany: entry.bullets.length !== 1,
  };
}

function readSectionBlock(section: ResumeSection): Block {
  const isLines = section.layout === 'lines';
  return {
    heading: section.label,
    isSection: true,
    rows: section.items.map((item) => (isLines ? (item.text ?? '') : formatEntryHeading(item))),
    areRowsBullets: false,
    count: isLines
      ? countOf(section.items.length, 'line', 'lines')
      : countOf(section.items.length, 'entry', 'entries'),
    isMany: section.items.length !== 1,
  };
}

function readBlock(draft: ResumeData, place: ShowPlace): Block | undefined {
  if (place.unit === 'entry') {
    const entry = findEntry(draft, place.sectionId, place.entryId);
    return entry && readEntryBlock(entry);
  }
  const section = place.unit === 'section' ? findSection(draft, place.sectionId) : undefined;
  return section && readSectionBlock(section);
}

/** What leaves with it, or comes back with it; an empty one says only where it stays. */
function describeWhatGoes(block: Block, isBack: boolean): string {
  const hasRows = block.rows.length > 0;
  if (isBack) {
    return hasRows
      ? `Back as it is in your content, with ${block.count}. Nothing in it is rewritten.`
      : 'Back as it is in your content.';
  }
  if (!hasRows) return 'It stays in your content; show it again from the editor any time.';
  const count = block.count.charAt(0).toUpperCase() + block.count.slice(1);
  return `${count} ${block.isMany ? 'go' : 'goes'} with it. All of it stays in your content; show it again from the editor any time.`;
}

/**
 * A whole entry or section leaving the page, or coming back. Named by its heading; what
 * goes with it is counted and listed, never struck line by line.
 */
export function BlockBody({ proposal, draft }: SuggestionBodyProps) {
  const { change } = proposal;
  if (change.kind !== 'select') return null;
  const block = readBlock(draft, change.place);
  if (!block) return null;
  const isBack = change.selected;
  const listed = block.rows.slice(0, SHOWN_ROWS);
  const more = block.rows.length - listed.length;

  return (
    <>
      <Caption>{isBack ? 'Suggested, back on the page' : 'Suggested, off the page'}</Caption>
      <div
        className={cn(
          'rounded-sm border border-line bg-pane-raised px-2.25 pt-1.75 pb-2',
          isBack && 'bg-add-soft shadow-[inset_2px_0_0_var(--add)]'
        )}
      >
        <div className="flex items-baseline gap-2.5">
          <Text
            variant={block.isSection ? 'strong' : 'body'}
            className={cn(
              'flex-1',
              !block.isSection && 'italic',
              !isBack && 'line-through decoration-del decoration-[1.5px]'
            )}
          >
            {block.heading}
          </Text>
          {block.dates && (
            <Text variant="secondary" className="whitespace-nowrap text-ink-muted">
              {block.dates}
            </Text>
          )}
        </div>
        <div className={cn('mt-1', isBack ? 'text-ink-soft' : 'text-ink-faint')}>
          {listed.map((row, index) => (
            <div key={index} className="flex gap-1.75">
              {block.areRowsBullets && (
                <Text variant="meta" className="min-w-2.5 text-ink-faint">
                  •
                </Text>
              )}
              <Text variant="secondary" className="text-inherit">
                {row}
              </Text>
            </div>
          ))}
          {more > 0 && (
            <Text as="p" variant="secondary" className="pl-4.25 text-ink-faint">
              and {more} more
            </Text>
          )}
        </div>
      </div>
      <TagLine icon={isBack ? Eye : EyeOff}>{describeWhatGoes(block, isBack)}</TagLine>
    </>
  );
}
