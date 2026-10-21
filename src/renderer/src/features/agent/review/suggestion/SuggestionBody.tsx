import type { ReactNode } from 'react';
import { Clock, Eye, EyeOff, Info, Move, Undo2 } from 'lucide-react';
import { AppButton, Chip, Text, type TextVariant } from '@/components/ui-kit';
import { cn } from '@/lib/utils';
import type { Proposal, ProposalChange, ProposalChangeKind } from '@shared/types/agentProposal';
import type { ResumeData } from '@shared/types/resume';
import { findEntry, findSection } from '../../proposals/proposalAnchor';
import {
  cancelStaleReview,
  chooseVersionWithoutNumber,
  clearProposalEdit,
  fillProposalNumber,
} from '../../proposals/proposalActions';
import { resolveChange } from '../../proposals/reviewedChange';
import { readFlaggedWords, readLostWords } from './describeFlag';
import { EntryFacts } from './EntryFacts';
import { GapField } from './GapField';
import { SuggestionEditor } from './SuggestionEditor';
import { SuggestionFlags } from './SuggestionFlags';
import { FlaggedText, MarkedText } from './SuggestionText';

/*
 * One suggestion, read beside the user's words: shared by the inspector and the Compare all
 * cards. A body per kind; an out-of-date one shows what changed under it instead.
 */

export interface SuggestionBodyProps {
  proposal: Proposal;
  /** The draft as it is now, for what a bullet says today. */
  draft: ResumeData;
  isEditing: boolean;
  onEditingChange: (isEditing: boolean) => void;
}

export function SuggestionBody(props: SuggestionBodyProps) {
  if (props.proposal.isStale) return <StaleBody {...props} />;
  const Body = KIND_BODIES[props.proposal.change.kind];
  return <Body {...props} />;
}

const KIND_BODIES: Record<ProposalChangeKind, (props: SuggestionBodyProps) => ReactNode> = {
  rewrite: RewriteBody,
  merge: RewriteBody,
  split: SplitBody,
  reorder: ReorderBody,
  select: SelectBody,
  entry: ({ proposal }) => <EntryFacts proposal={proposal} />,
};

function Caption({ children }: { children: ReactNode }) {
  return (
    <Text as="p" variant="tag" className="mt-3 mb-1.5 flex items-center gap-1.75 first:mt-0.5">
      {children}
    </Text>
  );
}

/** A small label beside a caption: "in your words", "same words". */
function CaptionTag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-4 items-center rounded-[0.25rem] bg-line px-1.25 text-ink-soft">
      {children}
    </span>
  );
}

interface LinesProps {
  lines: ReactNode[];
  isNumbered: boolean;
  variant: TextVariant;
  className?: string;
}

/** Lines of the user's own text, numbered when there are several. */
function Lines({ lines, isNumbered, variant, className }: LinesProps) {
  return lines.map((line, index) => (
    <div key={index} className="flex items-start gap-1.75 [&+&]:mt-1">
      {isNumbered && (
        <Text variant="meta" className="min-w-2.5 text-ink-faint">
          {index + 1}
        </Text>
      )}
      <Text variant={variant} className={className}>
        {line}
      </Text>
    </div>
  ));
}

/** A quiet text button under a body: back to an earlier choice. */
function BackLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <AppButton variant="quiet" size="xs" onClick={onClick} className="mt-1.5 -ml-2">
      <Undo2 className="size-2.75" />
      {children}
    </AppButton>
  );
}

/** What the suggestion writes before the gap is filled: the user's words, or the assistant's. */
function readShownAfter({ change, review }: Proposal): string {
  if (change.kind !== 'rewrite' && change.kind !== 'merge') return '';
  if (review.userText !== undefined) return review.userText;
  if (change.kind === 'rewrite' && change.gap && review.isWithoutNumber) {
    return change.gap.withoutNumber;
  }
  return change.after;
}

function RewriteBody({ proposal, isEditing, onEditingChange }: SuggestionBodyProps) {
  const change = resolveChange(proposal);
  if (change.kind !== 'rewrite' && change.kind !== 'merge') return null;
  const { review, flags } = proposal;
  const isMerge = change.kind === 'merge';
  const isRebased = review.rebasedBefore !== undefined;
  const before = isMerge ? change.before : [change.before];
  const lost = readLostWords(flags);
  const gap = (
    <GapField
      value={review.filledNumber}
      onFill={(number) => fillProposalNumber(proposal.id, number)}
    />
  );
  const original = proposal.change;
  const withoutNumber =
    original.kind === 'rewrite' && review.userText === undefined
      ? original.gap?.withoutNumber
      : undefined;

  return (
    <>
      {isRebased && <RebasedNote proposal={proposal} />}
      <Caption>{isMerge ? 'Now, two bullets' : isRebased ? 'Your edited bullet' : 'Now'}</Caption>
      <div>
        <Lines
          isNumbered={isMerge}
          variant="secondary"
          className="text-ink-soft"
          lines={before.map((text) => (
            <FlaggedText key={text} text={text} words={lost} />
          ))}
        />
      </div>
      <Caption>
        {isMerge ? 'Suggested, one bullet' : 'Suggested'}
        {review.userText !== undefined && !isEditing && <CaptionTag>in your words</CaptionTag>}
      </Caption>
      {isEditing ? (
        <SuggestionEditor proposal={proposal} onDone={() => onEditingChange(false)} />
      ) : (
        <>
          <Text
            as="p"
            variant="body"
            className="text-pretty"
            onDoubleClick={() => onEditingChange(true)}
          >
            <MarkedText
              before={before.join(' ')}
              after={readShownAfter(proposal)}
              words={readFlaggedWords(flags)}
              gap={gap}
            />
          </Text>
          <SuggestionFlags flags={flags} />
          {withoutNumber !== undefined &&
            (review.isWithoutNumber ? (
              <BackLink onClick={() => chooseVersionWithoutNumber(proposal.id, false)}>
                Back to the version with a number
              </BackLink>
            ) : (
              <div className="mt-2.5 rounded-sm border border-line-strong bg-pane-raised px-2.5 pt-2 pb-2.5">
                <Caption>Or, with no number</Caption>
                <Text as="p" variant="secondary" className="text-ink-soft">
                  {withoutNumber}
                </Text>
                <AppButton
                  variant="outline"
                  size="xs"
                  className="mt-2"
                  onClick={() => chooseVersionWithoutNumber(proposal.id, true)}
                >
                  Use this one
                </AppButton>
              </div>
            ))}
          {review.userText !== undefined && (
            <BackLink onClick={() => clearProposalEdit(proposal.id)}>
              Back to the assistant’s wording
            </BackLink>
          )}
        </>
      )}
    </>
  );
}

/** Out of date, but shown against the bullet as the user left it, on their say-so. */
function RebasedNote({ proposal }: { proposal: Proposal }) {
  return (
    <div className="mb-1 flex flex-wrap items-start gap-x-1.75 gap-y-1 rounded-sm bg-line px-2.25 py-1.75">
      <Info className="mt-0.75 size-3 shrink-0 text-ink-muted" />
      <Text variant="secondary" className="min-w-45 flex-1 text-ink-soft">
        Now shown against your edited bullet. Keeping it replaces your edit; undo and history still
        have it.
      </Text>
      <AppButton
        variant="link"
        size="xs"
        shape="text"
        className="p-0"
        onClick={() => cancelStaleReview(proposal.id)}
      >
        Cancel
      </AppButton>
    </div>
  );
}

function SplitBody({ proposal }: SuggestionBodyProps) {
  const { change } = proposal;
  if (change.kind !== 'split') return null;
  const parts = [change.before.slice(0, change.at), change.before.slice(change.at)];
  return (
    <>
      <Caption>Now, one bullet</Caption>
      <Text as="p" variant="secondary" className="text-ink-soft">
        {parts[0]}
        <span
          title="Splits here"
          className="mx-0.75 -mb-0.5 inline-block h-3.5 w-0.5 rounded-[0.0625rem] bg-amber"
        />
        {parts[1]}
      </Text>
      <Caption>
        Suggested, two bullets <CaptionTag>same words</CaptionTag>
      </Caption>
      <div>
        <Lines isNumbered variant="body" lines={parts.map((part) => part.trim())} />
      </div>
    </>
  );
}

/** What a reordered bullet or entry is called: its text, or the entry's name. */
function nameReordered(
  draft: ResumeData,
  change: Extract<ProposalChange, { kind: 'reorder' }>,
  id: string
) {
  if (change.entryId) {
    return findEntry(draft, change.sectionId, change.entryId)?.bullets.find((b) => b.id === id)
      ?.text;
  }
  const entry = findSection(draft, change.sectionId)?.items.find((item) => item.id === id);
  return entry?.organization?.trim() || entry?.title?.trim();
}

function ReorderBody({ proposal, draft }: SuggestionBodyProps) {
  const { change } = proposal;
  if (change.kind !== 'reorder') return null;
  return (
    <>
      <Caption>Suggested order</Caption>
      <div className="flex flex-col gap-1.5">
        {change.after.map((id, index) => {
          const from = change.before.indexOf(id) + 1;
          const isMoved = from !== index + 1;
          return (
            <div
              key={id}
              className={cn(
                'flex items-center gap-2.5 rounded-sm border border-line bg-pane-raised px-2.5 py-2',
                isMoved && 'border-add-line bg-add-soft'
              )}
            >
              <Text variant="meta" className="text-ink-faint">
                {index + 1}
              </Text>
              <Text variant="body" className="min-w-0 flex-1 truncate">
                {nameReordered(draft, change, id)}
              </Text>
              {isMoved && (
                <Chip tone="add">
                  <Move />
                  {from} → {index + 1}
                </Chip>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function SelectBody({ proposal }: SuggestionBodyProps) {
  const { change } = proposal;
  if (change.kind !== 'select') return null;
  const Icon = change.selected ? Eye : EyeOff;
  return (
    <>
      <Caption>Suggested</Caption>
      <Text
        as="p"
        variant="body"
        className={cn(!change.selected && 'text-ink-muted line-through decoration-del')}
      >
        {change.before}
      </Text>
      <div className="mt-2 flex items-start gap-1.5 text-ink-muted">
        <Icon className="mt-0.75 size-3 shrink-0" />
        <Text variant="secondary" className="text-ink-muted">
          {change.selected
            ? 'Back on the page.'
            : 'Off the page, still in your content. Show it again from the editor any time.'}
        </Text>
      </div>
    </>
  );
}

/** What the bullets an out-of-date suggestion is about say now. */
function readTextNow(draft: ResumeData, change: ProposalChange): string | undefined {
  if (!('entryId' in change) || !change.entryId) return undefined;
  const bullets = findEntry(draft, change.sectionId, change.entryId)?.bullets ?? [];
  const textOf = (id: string) => bullets.find((bullet) => bullet.id === id)?.text;
  if (change.kind === 'merge') {
    const texts = [textOf(change.firstId), textOf(change.secondId)].filter(Boolean);
    return texts.length ? texts.join(' ') : undefined;
  }
  return 'bulletId' in change ? textOf(change.bulletId) : undefined;
}

const SUGGESTED_FOR: Partial<Record<ProposalChangeKind, (change: ProposalChange) => string>> = {
  rewrite: (change) => (change.kind === 'rewrite' ? change.before : ''),
  merge: (change) => (change.kind === 'merge' ? change.before.join(' ') : ''),
  split: (change) => (change.kind === 'split' ? change.before : ''),
  select: (change) => (change.kind === 'select' ? change.before : ''),
};

function StaleBody({ proposal, draft }: SuggestionBodyProps) {
  const { change } = proposal;
  const now = readTextNow(draft, change);
  const suggestedFor = SUGGESTED_FOR[change.kind]?.(change);
  const canUseAnyway = change.kind === 'rewrite' || change.kind === 'merge';
  return (
    <>
      <div className="flex items-start gap-2 rounded-sm border border-line-strong bg-line px-2.5 py-2">
        <Clock className="mt-0.75 size-3.25 shrink-0 text-ink-muted" />
        <Text variant="secondary" className="text-foreground">
          You changed this bullet after it was suggested, so it no longer fits your text.
        </Text>
      </div>
      {now !== undefined && (
        <>
          <Caption>Your bullet now</Caption>
          <Text as="p" variant="body">
            {now}
          </Text>
        </>
      )}
      {suggestedFor !== undefined && (
        <>
          <Caption>It was suggested for</Caption>
          <Text as="p" variant="body" className="text-ink-muted">
            {suggestedFor}
          </Text>
        </>
      )}
      {canUseAnyway && (
        <>
          <Caption>Suggested</Caption>
          <Text as="p" variant="body" className="text-ink-muted line-through">
            {change.after}
          </Text>
          <Text
            as="p"
            variant="secondary"
            className="mt-3 border-t border-line pt-2.5 text-ink-faint"
          >
            Still want it? <b className="font-control text-ink-soft">Use it anyway</b> puts it next
            to your edited bullet so you can see what it would replace, then keep or drop it as
            usual.
          </Text>
        </>
      )}
      <Text as="p" variant="secondary" className="mt-2 text-ink-faint">
        An undo that brings back the old text makes it current again.
      </Text>
    </>
  );
}
