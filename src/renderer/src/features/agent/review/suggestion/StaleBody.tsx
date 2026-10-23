import { Clock } from 'lucide-react';
import { Text } from '@/components/ui-kit';
import type { ProposalChange } from '@shared/types/agentProposal';
import type { ResumeData } from '@shared/types/resume';
import { findEntry, findTextItem, readShownName } from '../../proposals/proposalAnchor';
import { Caption } from './BodyParts';
import type { SuggestionBodyProps } from './SuggestionBody';
import { describeStaleChange, nameTextPlace } from './suggestionWords';

/** What the text an out-of-date suggestion is about says now, if it is still there. */
function readTextNow(draft: ResumeData, change: ProposalChange): string | undefined {
  switch (change.kind) {
    case 'rewrite':
      return findTextItem(draft, change.place)?.text;
    case 'select':
      return readShownName(draft, change.place);
    case 'split':
      return findTextItem(draft, { unit: 'bullet', ...pickBullet(change) })?.text;
    case 'merge': {
      const bullets = findEntry(draft, change.sectionId, change.entryId)?.bullets ?? [];
      const textOf = (id: string) => bullets.find((bullet) => bullet.id === id)?.text;
      const texts = [textOf(change.firstId), textOf(change.secondId)].filter(Boolean);
      return texts.length ? texts.join(' ') : undefined;
    }
    default:
      return undefined;
  }
}

const pickBullet = ({
  sectionId,
  entryId,
  bulletId,
}: Extract<ProposalChange, { kind: 'split' }>) => ({
  sectionId,
  entryId,
  bulletId,
});

/** What it was made for, and what it would have written; null where neither reads as text. */
function readWasAndWould(change: ProposalChange): { was: string; would?: string } | null {
  switch (change.kind) {
    case 'rewrite':
      return { was: change.before, would: change.after };
    case 'merge':
      return { was: change.before.join(' '), would: change.after };
    case 'split':
    case 'select':
      return { was: change.before };
    case 'add':
      return { was: '', would: change.text };
    default:
      return null;
  }
}

/** What a card calls its text in "Your bullet now": by its place. */
function nameNoun(draft: ResumeData, change: ProposalChange): string {
  if (change.kind === 'rewrite') return nameTextPlace(draft, change.place);
  if (change.kind !== 'select') return 'bullet';
  const { place } = change;
  return place.unit === 'bullet' || place.unit === 'line'
    ? nameTextPlace(draft, place)
    : place.unit;
}

/** How an undo brings it back. */
function readUndoHint(change: ProposalChange): string {
  if (change.kind === 'add') {
    return `An undo that brings that ${change.place.unit} back makes it current again.`;
  }
  return canUseAnyway(change)
    ? 'An undo that brings back the old text makes it current again.'
    : 'An undo that puts it back as it was makes this current again.';
}

const canUseAnyway = (change: ProposalChange) =>
  change.kind === 'rewrite' || change.kind === 'merge';

/** Out of date: what changed under it, what it was for, and the ways back to it. */
export function StaleBody({ proposal, draft }: SuggestionBodyProps) {
  const { change } = proposal;
  const now = readTextNow(draft, change);
  const texts = readWasAndWould(change);
  const noun = nameNoun(draft, change);
  const isAdded = change.kind === 'add';
  return (
    <>
      <div className="flex items-start gap-2 rounded-sm border border-line-strong bg-line px-2.5 py-2">
        <Clock className="mt-0.75 size-3.25 shrink-0 text-ink-muted" />
        <Text variant="secondary" className="text-foreground">
          {describeStaleChange(draft, change)}
        </Text>
      </div>
      {now !== undefined && (
        <>
          <Caption>Your {noun} now</Caption>
          <Text as="p" variant="body">
            {now}
          </Text>
        </>
      )}
      {texts?.was && (
        <>
          <Caption>It was suggested for</Caption>
          <Text as="p" variant="body" className="text-ink-muted">
            {texts.was}
          </Text>
        </>
      )}
      {texts?.would !== undefined && (
        <>
          <Caption>{isAdded ? `Suggested, new ${change.place.unit}` : 'Suggested'}</Caption>
          <Text
            as="p"
            variant="body"
            className={isAdded ? 'text-ink-muted' : 'text-ink-muted line-through'}
          >
            {texts.would}
          </Text>
        </>
      )}
      {(canUseAnyway(change) || isAdded) && (
        <Text
          as="p"
          variant="secondary"
          className="mt-3 border-t border-line pt-2.5 text-ink-faint"
        >
          Still want it?{' '}
          {isAdded ? (
            <>
              <b className="font-control text-ink-soft">Put it last</b> places it at the end, then
              keep or drop it as usual.
            </>
          ) : (
            <>
              <b className="font-control text-ink-soft">Use it anyway</b> puts it next to your
              edited {noun} so you can see what it would replace, then keep or drop it as usual.
            </>
          )}
        </Text>
      )}
      <Text as="p" variant="secondary" className="mt-2 text-ink-faint">
        {readUndoHint(change)}
      </Text>
    </>
  );
}
