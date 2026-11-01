import { ChevronRight, Clock, Database, Eye, Lock, ScanLine } from 'lucide-react';
import { AppButton, Chip, Text } from '@/components/ui-kit';
import { ReadBoundary } from '@/components/ReadBoundary';
import { showPlace } from '@/features/navigation/showPlace';
import { placeSuggestion } from '@/features/suggestions/proposals/describeSuggestion';
import { discardRunProposals } from '@/features/suggestions/proposals/proposalActions';
import { cn } from '@/lib/utils';
import { versionLabel } from '@/lib/versionLabel';
import { useProposalStore } from '@/stores/proposalStore';
import { useResumeStore } from '@/stores/resumeStore';
import { useRunStore } from '@/stores/runStore';
import { useVersion } from '@/stores/templateStore';
import { attempt } from '@/stores/toastStore';
import type { Proposal } from '@/types/agentProposal';
import {
  findAppliedVersionId,
  findFirstToReview,
  findRunSuggestions,
  isSuggestionOpen,
  listSections,
  readRunCard,
  type StopQuestion,
  type SuggestionHandle,
} from './runCard';

/*
 * The end of a run that staged suggestions: where they are and the way to them. The changes
 * themselves are only ever on the page. A run the user stopped asks first whether to keep
 * them. Suggestions live in memory, so a run from before a restart has no card.
 */

function discardOpen(staged: readonly Proposal[]): void {
  discardRunProposals(staged.filter(isSuggestionOpen).map((proposal) => proposal.id));
}

function StopCard({
  question,
  onKeep,
  onDiscard,
}: {
  question: StopQuestion;
  onKeep: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="rounded-[0.5625rem] border border-info-line bg-info-soft px-2.75 py-2.5">
      <Text as="p" variant="strong">
        {question.title}
      </Text>
      <Text as="p" variant="secondary" className="mt-0.75 text-pretty text-ink-soft">
        {question.body}
      </Text>
      <div className="mt-2.25 flex flex-wrap gap-1.75">
        <AppButton size="sm" variant="accent" onClick={onKeep}>
          {question.keepLabel}
        </AppButton>
        <AppButton size="sm" variant="outline" onClick={onDiscard}>
          Discard the turn
        </AppButton>
      </div>
    </div>
  );
}

function WhereTheyAre({ staged }: { staged: readonly Proposal[] }) {
  const templateId = useResumeStore((s) => s.templateId);
  const schemaVersion = useResumeStore((s) => s.schemaVersion);
  const contact = useResumeStore((s) => s.contact);
  const sections = useResumeStore((s) => s.sections);
  const draft = { schemaVersion, contact, sections };
  const names = listSections(staged, templateId, ({ change }) => placeSuggestion(draft, change));
  if (names.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.25 px-2.75 pt-2.25">
      {names.map((name) => (
        <Chip key={name} size="sm">
          {name}
        </Chip>
      ))}
    </div>
  );
}

function HandleCard({
  handle,
  staged,
  onOpen,
  onDiscard,
}: {
  handle: SuggestionHandle;
  staged: readonly Proposal[];
  onOpen: () => void;
  onDiscard: () => void;
}) {
  const Icon = handle.isAllStale ? Clock : ScanLine;
  return (
    <div
      className={cn(
        'overflow-hidden rounded-[0.5625rem] border bg-pane-raised',
        handle.isAllStale ? 'border-line-strong' : 'border-amber-line'
      )}
    >
      <Text
        as="p"
        variant="strong"
        className={cn(
          'flex items-center gap-2 border-b border-line px-2.75 py-2.25',
          handle.isAllStale ? 'bg-line text-ink-muted' : 'bg-amber-soft'
        )}
      >
        <Icon
          aria-hidden
          className={handle.isAllStale ? 'size-3.25 text-ink-muted' : 'size-3.25 text-amber'}
        />
        {handle.title}
      </Text>
      <WhereTheyAre staged={staged} />
      <Text
        as="p"
        variant="secondary"
        className="mt-2.25 flex items-start gap-2 border-t border-line px-2.75 py-2"
      >
        <Lock aria-hidden className="mt-0.5 size-3.25 shrink-0 text-ink-faint" />
        <span className="min-w-0 flex-1 text-pretty">{handle.note}</span>
      </Text>
      <div className="flex flex-wrap items-center justify-between gap-1.75 border-t border-line px-2.75 py-2.25">
        <AppButton size="sm" variant="accent" onClick={onOpen}>
          <Eye className="size-3.25" />
          Open on the page
        </AppButton>
        <AppButton size="sm" variant="ghost" onClick={onDiscard}>
          Discard
        </AppButton>
      </div>
    </div>
  );
}

const APPLIED_ROW_CLASSES =
  'flex h-auto w-full items-center gap-2 rounded-sm px-2.75 py-2 text-left whitespace-normal text-ink-soft';

function AppliedWords({ words }: { words: string }) {
  return (
    <>
      <Database aria-hidden className="size-3.25 shrink-0 text-add" />
      <span className="min-w-0 flex-1 truncate">{words}</span>
    </>
  );
}

/** Applying can keep no version, when the user has them off: then only the fact shows. */
function AppliedLine({ words }: { words: string }) {
  return (
    <Text as="p" variant="secondary" className="flex items-center gap-2">
      <AppliedWords words={words} />
    </Text>
  );
}

function AppliedVersionRow({
  words,
  versionId,
  templateId,
}: {
  words: string;
  versionId: string;
  templateId: string;
}) {
  const version = useVersion(versionId);
  const open = () =>
    void attempt(
      showPlace({ kind: 'history', templateId, versionId }),
      'Couldn’t open that version'
    );
  return (
    <AppButton variant="kept" className={APPLIED_ROW_CLASSES} onClick={open}>
      <AppliedWords words={words} />
      <Text variant="meta" className="shrink-0 text-add">
        {versionLabel(version)}
      </Text>
      <ChevronRight aria-hidden className="size-3 shrink-0 text-ink-faint" />
    </AppButton>
  );
}

function AppliedRow({ words, staged }: { words: string; staged: readonly Proposal[] }) {
  const idsByAppliedVersion = useProposalStore((s) => s.idsByAppliedVersion);
  const versionId = findAppliedVersionId(idsByAppliedVersion, staged);
  if (versionId === null) return <AppliedLine words={words} />;
  return (
    <ReadBoundary
      key={versionId}
      failure="Could not read the version an apply kept"
      fallback={<AppliedLine words={words} />}
    >
      <AppliedVersionRow words={words} versionId={versionId} templateId={staged[0].templateId} />
    </ReadBoundary>
  );
}

function openOnThePage(staged: readonly Proposal[]): void {
  const first = findFirstToReview(staged);
  if (!first) return;
  void attempt(
    showPlace({ kind: 'review', templateId: first.templateId, proposalId: first.id }),
    'Couldn’t open those suggestions'
  );
}

interface RunCardProps {
  runId: number;
  isCancelled: boolean;
}

export function RunCard({ runId, isCancelled }: RunCardProps) {
  const ids = useRunStore((s) => s.stagedIdsByRun[runId]);
  const isStopDecided = useRunStore((s) => s.decidedStopRunIds.includes(runId));
  const noteStopDecided = useRunStore((s) => s.noteStopDecided);
  const byTemplate = useProposalStore((s) => s.byTemplate);
  if (!ids || ids.length === 0) return null;

  const staged = findRunSuggestions(byTemplate, ids);
  const card = readRunCard({ staged, isCancelled, isStopDecided });
  const discard = () => {
    noteStopDecided(runId);
    discardOpen(staged);
  };
  return (
    <>
      {card.applied && (
        <div className="mt-2.25">
          <AppliedRow words={card.applied} staged={staged} />
        </div>
      )}
      {card.stopQuestion && (
        <div className="mt-2.25">
          <StopCard
            question={card.stopQuestion}
            onKeep={() => noteStopDecided(runId)}
            onDiscard={discard}
          />
        </div>
      )}
      {card.handle && (
        <div className="mt-2.25">
          <HandleCard
            handle={card.handle}
            staged={staged}
            onOpen={() => openOnThePage(staged)}
            onDiscard={discard}
          />
        </div>
      )}
      {card.isDiscarded && (
        <Text as="p" variant="secondary" className="mt-2.25">
          Discarded the turn.
        </Text>
      )}
    </>
  );
}
