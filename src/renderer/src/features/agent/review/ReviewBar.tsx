import { ChevronLeft } from 'lucide-react';
import { AppButton, AppToggleGroup, AppToggleGroupItem, Text } from '@/components/ui-kit';
import { transitionClasses } from '@/features/view-transitions/transitionClasses';
import { cn } from '@/lib/utils';
import type { Proposal } from '@shared/types/agentProposal';
import { acceptProposals, rejectProposals } from '../proposals/proposalActions';
import type { ReviewMode } from './ReviewInspector';
import { readSuggestionState, type SuggestionState } from './suggestionState';

/** The toggle's words, shortened when the window is narrow. */
const MODE_LABELS: Record<ReviewMode, { wide: string; narrow: string }> = {
  page: { wide: 'On the page', narrow: 'Page' },
  cards: { wide: 'Compare all', narrow: 'All' },
};

const REVIEW_MODES = Object.keys(MODE_LABELS) as ReviewMode[];

interface ReviewBarProps {
  proposals: Proposal[];
  mode: ReviewMode;
  onModeChange: (mode: ReviewMode) => void;
  onBack: () => void;
  /** Drop all happened: the ids it dropped, for the one reason that covers them. */
  onDroppedAll: (ids: string[]) => void;
  /** Apply just landed these, of all there were: the bar says so, and offers nothing else. */
  applied: { landed: number; total: number } | null;
}

const countSuggestions = (count: number) =>
  `${count} ${count === 1 ? 'suggestion' : 'suggestions'}`;

/** The bar's two lines: after Apply, with nothing waiting, or while reviewing. */
function describeReview(proposals: Proposal[], applied: ReviewBarProps['applied']) {
  if (applied) {
    return {
      title: `Applied ${applied.landed} of ${countSuggestions(applied.total)}`,
      sub: 'Your page now. Undo puts it back in one step.',
    };
  }
  if (!proposals.length) {
    return { title: 'Suggestions', sub: 'Nothing waiting for this template' };
  }
  const request = proposals.at(-1)?.requestText.trim();
  return {
    title: `Reviewing ${countSuggestions(proposals.length)}`,
    sub: `${request ? `“${request}” · ` : ''}your draft is unchanged until you apply`,
  };
}

/** Back, what's being reviewed, how it's shown, the tally, and Keep all / Drop all. */
export function ReviewBar({
  proposals,
  mode,
  onModeChange,
  onBack,
  onDroppedAll,
  applied,
}: ReviewBarProps) {
  const hasControls = proposals.length > 0 && !applied;
  const { title, sub } = describeReview(proposals, applied);
  const current = proposals.filter((p) => !p.isStale);
  const dropAll = () => {
    const ids = current.map((p) => p.id);
    rejectProposals(ids);
    onDroppedAll(ids);
  };
  return (
    <header
      className={cn(
        'flex shrink-0 items-center justify-between gap-3.5 border-b border-line bg-background px-3 py-2.25',
        transitionClasses({ name: 'bar', motion: 'lockstep' })
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <AppButton
          variant="ghost"
          size="sm"
          shape="square"
          aria-label="Back to draft"
          title="Back to draft  Esc"
          onClick={onBack}
        >
          <ChevronLeft />
        </AppButton>
        <div className="min-w-0">
          <Text as="h2" variant="title" className="whitespace-nowrap">
            {title}
          </Text>
          <Text
            as="p"
            variant="secondary"
            className="mt-0.5 truncate text-ink-muted @max-[62.5rem]/review:hidden"
          >
            {sub}
          </Text>
        </div>
      </div>
      {hasControls && (
        <div className="flex shrink-0 items-center gap-3">
          <AppToggleGroup
            type="single"
            aria-label="Show the suggestions"
            value={mode}
            onValueChange={(value) => value && onModeChange(value as ReviewMode)}
          >
            {REVIEW_MODES.map((each) => (
              <AppToggleGroupItem key={each} value={each}>
                <span className="@max-[62.5rem]/review:hidden">{MODE_LABELS[each].wide}</span>
                <span className="hidden @max-[62.5rem]/review:inline">
                  {MODE_LABELS[each].narrow}
                </span>
              </AppToggleGroupItem>
            ))}
          </AppToggleGroup>
          <Tally proposals={proposals} />
          <div className="flex items-center gap-1.5">
            <AppButton variant="outline" size="sm" onClick={dropAll}>
              Drop all
            </AppButton>
            <AppButton
              variant="outline"
              size="sm"
              onClick={() => acceptProposals(current.map((p) => p.id))}
            >
              Keep all
            </AppButton>
          </div>
        </div>
      )}
    </header>
  );
}

/** How the batch stands: a bar of kept and dropped, and the counts. Folds away when narrow. */
function Tally({ proposals }: { proposals: Proposal[] }) {
  const counts: Record<SuggestionState, number> = {
    waiting: 0,
    kept: 0,
    held: 0,
    dropped: 0,
    stale: 0,
  };
  for (const proposal of proposals) counts[readSuggestionState(proposal)]++;
  const kept = counts.kept + counts.held;
  const share = (count: number) => `${(count / proposals.length) * 100}%`;
  return (
    <div className="flex items-center gap-1 whitespace-nowrap @max-[77.5rem]/review:hidden">
      <div className="flex h-1.5 w-22 overflow-hidden rounded-full bg-line-strong">
        <span className="bg-add" style={{ width: share(kept) }} />
        <span className="bg-ink-faint" style={{ width: share(counts.dropped) }} />
      </div>
      <Text variant="meta" className="ml-1.5 text-ink-muted">
        {kept} kept · {counts.dropped} dropped · {counts.waiting} waiting
        {counts.stale > 0 && ` · ${counts.stale} out of date`}
      </Text>
    </div>
  );
}
