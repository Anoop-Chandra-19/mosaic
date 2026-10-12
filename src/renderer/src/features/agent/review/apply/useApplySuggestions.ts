import { useMemo, useState } from 'react';
import { changeInViewTransition } from '@/features/view-transitions/changeInViewTransition';
import { TRANSITION_TYPE } from '@/features/view-transitions/transitionClasses';
import { attempt } from '@/stores/toastStore';
import { useResumeStore } from '@/stores/resumeStore';
import { useTemplateStore } from '@/stores/templateStore';
import { useUiStore } from '@/stores/uiStore';
import type { Proposal } from '@shared/types/agentProposal';
import type { ResumeData } from '@shared/types/resume';
import {
  applyAcceptedProposals,
  collectVersionSuggestions,
  undoAppliedProposals,
} from '../../proposals/applyAcceptedProposals';
import {
  describeLandedSuggestions,
  labelSuggestionKind,
  placeSuggestion,
} from '../../proposals/describeSuggestion';
import { planApply } from '../../proposals/planApply';
import type { AppliedResult } from './ApplyResult';
import {
  chooseDefaultHistory,
  isMissingName,
  readAddToOffer,
  toAppliedHistory,
  type HistoryChoice,
} from './historyChoice';
import { planHistoryRows } from './planHistoryRows';
import type { NameSuggestion } from './SuggestionLines';

/** Names read from a draft: the kind, then where below the section. */
function nameSuggestionsIn(draft: ResumeData): NameSuggestion {
  return ({ change }: Proposal) => {
    const place = placeSuggestion(draft, change);
    return { kind: labelSuggestionKind(change), where: place.slice(1).join(' › ') || place[0] };
  };
}

/**
 * Apply, from the review: the plan the bar and the peek show, how it goes into history, and
 * once it has landed, the result. Landing, and the result replacing the inspector, are one
 * view transition, so the page and the inspector cross-fade together.
 */
export function useApplySuggestions(proposals: Proposal[], draft: ResumeData) {
  const templateId = useResumeStore((s) => s.templateId);
  const rev = useResumeStore((s) => s.rev);
  const head = useTemplateStore((s) => s.templates.find((t) => t.id === templateId)?.head);
  const isKeepingAfterAi = useUiStore((s) => s.snapshotTriggers.afterAiEdits);

  const plan = useMemo(() => planApply(draft, proposals), [draft, proposals]);
  const offer = readAddToOffer(head, rev);
  const [choice, setChoice] = useState<HistoryChoice>(() => chooseDefaultHistory(offer));
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRefused, setIsRefused] = useState(false);
  const [result, setResult] = useState<AppliedResult | null>(null);
  // Whether the version before joins an editing session still open: as of opening is near
  // enough, since a review takes minutes and a session lasts 45.
  const [openedAt] = useState(() => Date.now());
  const name = nameSuggestionsIn(draft);
  const rows = planHistoryRows({
    head,
    draftRev: rev,
    choice,
    versionTitle: describeLandedSuggestions(
      draft,
      collectVersionSuggestions(choice.mode === 'add', plan.landed)
    ),
    keepsVersions: isKeepingAfterAi || choice.mode === 'named',
    now: openedAt,
  });

  /** Add to was chosen, but the version can't be added to: say so, and offer its own. */
  const refuseAddTo = () => {
    setChoice({ ...choice, mode: 'new' });
    setIsRefused(true);
    setIsMenuOpen(true);
  };

  const apply = () => {
    if (!plan.landed.length || isMissingName(choice)) return;
    if (choice.mode === 'add' && offer?.refusal) {
      refuseAddTo();
      return;
    }
    const landing: AppliedResult = { plan, rows, total: proposals.length, name };
    setIsMenuOpen(false);
    setIsRefused(false);
    const applying = applyAcceptedProposals(toAppliedHistory(choice), (land, landedPlan) =>
      changeInViewTransition(() => {
        land();
        setResult({ ...landing, plan: landedPlan });
      }, TRANSITION_TYPE.crossfade)
    ).then((outcome) => {
      // Add to is checked again as it applies: the draft may have moved since it was offered.
      if (outcome.kind === 'cannotAdd') refuseAddTo();
    });
    void attempt(applying, 'Couldn’t apply the suggestions.');
  };

  /**
   * Back to reviewing what's left, after Apply, with `andThen` (what to select) in the same
   * cross-fade. The next apply starts from a fresh choice.
   */
  const reviewAgain = (andThen: () => void) => {
    void changeInViewTransition(() => {
      setResult(null);
      setChoice(chooseDefaultHistory(readAddToOffer(head, rev)));
      andThen();
    }, TRANSITION_TYPE.crossfade);
  };

  const undo = () => {
    if (!result) return;
    void changeInViewTransition(() => {
      undoAppliedProposals(result.plan);
      setResult(null);
    }, TRANSITION_TYPE.crossfade);
  };

  return {
    plan,
    offer,
    choice,
    setChoice,
    rows,
    isMenuOpen,
    setIsMenuOpen: (isOpen: boolean) => {
      setIsMenuOpen(isOpen);
      if (!isOpen) setIsRefused(false);
    },
    isRefused,
    result,
    name,
    apply,
    undo,
    reviewAgain,
  };
}
