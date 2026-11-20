import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { AppButton, AppTooltip, Text } from '@/components/ui-kit';
import { formatPaneWidth, startPaneResize } from '@/lib/paneResize';
import { matchesAction } from '@/stores/shortcutBindings';
import { changeInViewTransition } from '@/features/view-transitions/changeInViewTransition';
import { transitionClasses, TRANSITION_TYPE } from '@/features/view-transitions/transitionClasses';
import { isTypingField, isUndoKey } from '@/lib/keyboardShortcuts';
import type { ShortcutId } from '@/lib/shortcutCatalog';
import { cn } from '@/lib/utils';
import { isEmptyNewSection } from '@/lib/resume/proposalAnchor';
import { useAgentSettingsStore } from '@/stores/agentSettingsStore';
import { useOverlayStore } from '@/stores/overlayStore';
import { selectTemplateProposals, useProposalStore } from '@/stores/proposalStore';
import { useResumeStore } from '@/stores/resumeStore';
import { AGENT_PANE_WIDTH, useUiStore } from '@/stores/uiStore';
import { useViewPlaceStore } from '@/stores/viewPlaceStore';
import type { ResumePreviewMeta } from '@/types/preview';
import type { Proposal } from '@/types/agentProposal';
import { acceptProposals, rejectProposals, returnProposals } from '../proposals/proposalActions';
import { readActiveVersion } from '../proposals/proposalVersions';
import { ApplyBar } from './apply/ApplyBar';
import { ApplyResult } from './apply/ApplyResult';
import { useApplySuggestions } from './apply/useApplySuggestions';
import { ReviewPage } from './page/ReviewPage';
import { buildSuggestionPage } from './page/suggestionPage';
import { PreviewList } from './preview/PreviewList';
import { buildSuggestionPreview, type PreviewLook } from './preview/suggestionPreview';
import { SuggestionPreviewPage } from './preview/SuggestionPreviewPage';
import { ReviewBar } from './ReviewBar';
import { ReviewInspector, type ReviewMode } from './ReviewInspector';
import { DropReasons } from '../card/DropReasons';
import {
  groupSuggestionsByPlace,
  isPlaceFolded,
  orderSuggestionsByPlace,
  type SuggestionPlace,
} from './place/placeSuggestions';
import type { PlaceViewProps } from './place/PlaceSuggestion';
import { SuggestionDocument } from './place/SuggestionDocument';
import { SuggestionSelection } from '../suggestionSelection';
import { canEditSuggestion } from '../suggestionState';

/*
 * The review of the assistant's suggestions: a surface over the whole window except the
 * status bar. It opens from the status bar's count.
 *
 * The suggestions are grouped by their place on the page (`place/placeSuggestions.ts`): an
 * entry, a section, the order of the sections, or a new entry or section.
 *
 * On the left is one of three views:
 * - the page as Apply would leave it (`page/`: `ReviewPage`, with marks from
 *   `suggestionPage.ts`);
 * - "Compare all", every suggestion open and read as a document, place by place
 *   (`place/SuggestionDocument`);
 * - Preview (`preview/`), the page as it would print, with all suggestions or only the kept
 *   ones. Its inspector is a list saying why each one is or isn't on the page (`PreviewList`).
 *
 * On the right is the inspector, as wide as the assistant pane (`ReviewInspector`): a card
 * for each place, with the selected suggestion open inside it. The left and right sides
 * share one selection. `ReviewBar` sits on top. Every view draws a suggestion from the same
 * parts (`../card/`: its body for each kind, its actions, its drop reasons).
 */

/** Long enough for the page to land and its marks to wash in (see `animate-mark-in`). */
const LANDING_MS = 600;

/** A keep or drop pressed again takes it back. */
function toggleDecision(proposal: Proposal, status: 'accepted' | 'rejected') {
  if (proposal.status === status) returnProposals([proposal.id]);
  else if (status === 'accepted') acceptProposals([proposal.id]);
  else rejectProposals([proposal.id]);
}

export function SuggestionReview({ openOn }: { openOn?: string }) {
  const templateId = useResumeStore((s) => s.templateId);
  const schemaVersion = useResumeStore((s) => s.schemaVersion);
  const contact = useResumeStore((s) => s.contact);
  const sections = useResumeStore((s) => s.sections);
  const stored = useProposalStore((s) => selectTemplateProposals(s, templateId));
  const isAgentEnabled = useAgentSettingsStore((s) => s.enabled);
  const closeSurface = useOverlayStore((s) => s.closeSurface);
  const widthPx = useUiStore((s) => s.agentPaneWidthPx);
  const setWidthPx = useUiStore((s) => s.setAgentPaneWidthPx);
  const rootRef = useRef<HTMLDivElement>(null);
  const inspectorRef = useRef<HTMLElement>(null);

  const draft = useMemo(
    () => ({ schemaVersion, contact, sections }),
    [schemaVersion, contact, sections]
  );
  // A new section stays out of review until the assistant has put something in it.
  const proposals = useMemo(
    () =>
      stored.filter(
        (proposal) =>
          proposal.status !== 'applied' && !isEmptyNewSection(readActiveVersion(proposal).change)
      ),
    [stored]
  );
  const applying = useApplySuggestions(proposals, draft);
  const { result } = applying;
  // Once applied, the page is the draft: no marks until reviewing goes on.
  const page = useMemo(
    () => buildSuggestionPage(draft, result ? [] : proposals),
    [draft, proposals, result]
  );
  const places = useMemo(
    () => groupSuggestionsByPlace(draft, page.doc, proposals),
    [draft, page, proposals]
  );
  // The order the keys move in: place by place, down the page.
  const proposalsByPlace = orderSuggestionsByPlace(places);
  // Rows are numbered in the order the assistant made the suggestions, as the view's address counts them.
  const numbers = new Map(proposals.map((proposal, index) => [proposal.id, index + 1]));
  const [selectedId, setSelectedId] = useState<string | null>(
    openOn ?? proposalsByPlace[0]?.id ?? null
  );
  // The places the user folded (true) or opened (false) themselves, by place key.
  const [foldedByUser, setFoldedByUser] = useState<Record<string, boolean>>({});
  const readPlaceFolded = (place: SuggestionPlace) =>
    isPlaceFolded(place, selectedId, foldedByUser[place.key]);
  const changePlaceFolded = (key: string, isFolded: boolean) =>
    setFoldedByUser((folded) => ({ ...folded, [key]: isFolded }));
  // The row of drop reasons is offered once for each drop. Once closed, it stays closed for that suggestion.
  const [dismissedReasonIds, setDismissedReasonIds] = useState<string[]>([]);
  const [openEntryIds, setOpenEntryIds] = useState<Record<string, string | null>>({});
  const openEntry = (proposalId: string, entryId: string | null) =>
    setOpenEntryIds((opened) => ({ ...opened, [proposalId]: entryId }));
  const close = () => closeSurface('review');

  // Suggestions exist only while AI is on; turned off, there is nothing to review.
  useEffect(() => {
    if (!isAgentEnabled || templateId === null) closeSurface('review');
  }, [isAgentEnabled, templateId, closeSurface]);

  // The keys work from the moment it opens.
  useEffect(() => rootRef.current?.focus(), []);

  // The marks wash in as the page lands; after that, a mark that comes or changes just shows.
  const [isLanding, setIsLanding] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setIsLanding(false), LANDING_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const [mode, setMode] = useState<ReviewMode>('page');
  // Preview goes back to the view it was opened from.
  const [modeBeforePreview, setModeBeforePreview] = useState<ReviewMode>('page');
  const changeMode = (next: ReviewMode) => {
    if (next === mode) return;
    // Preview is a switch of view only, with no motion.
    if (next === 'preview' || mode === 'preview') {
      if (next === 'preview') setModeBeforePreview(mode);
      setMode(next);
      return;
    }
    changeInViewTransition(
      () => setMode(next),
      next === 'cards' ? TRANSITION_TYPE.stepForward : TRANSITION_TYPE.stepBack
    );
  };
  const togglePreview = () => changeMode(mode === 'preview' ? modeBeforePreview : 'preview');
  const [previewLook, setPreviewLook] = useState<PreviewLook>('all');
  const [previewMeta, setPreviewMeta] = useState<ResumePreviewMeta>({
    totalPages: 1,
    hasMorePages: false,
  });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  // Once applied, or with nothing waiting, the page is all there is to show.
  const shownView: ReviewMode = proposals.length > 0 && !result ? mode : 'page';
  const preview = useMemo(
    () => (shownView === 'preview' ? buildSuggestionPreview(draft, proposals, previewLook) : null),
    [shownView, draft, proposals, previewLook]
  );
  const notShown = proposals.filter((p) => preview?.notes.get(p.id)?.isOnPage === false);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Drop all offers one reason for everything it dropped, until dismissed.
  const [droppedAllIds, setDroppedAllIds] = useState<string[] | null>(null);
  const droppedAll = proposals.filter((p) => droppedAllIds?.includes(p.id));

  const selectedIndex = proposals.findIndex((p) => p.id === selectedId);
  // Where the reader is, for the view's address.
  useEffect(() => {
    useViewPlaceStore.setState({ reviewSuggestion: selectedIndex >= 0 ? selectedIndex + 1 : null });
  }, [selectedIndex]);
  useEffect(() => () => useViewPlaceStore.setState({ reviewSuggestion: null }), []);
  const select = (id: string | null, entryId?: string) => {
    setSelectedId(id);
    setEditingId(null);
    if (id && entryId) openEntry(id, entryId);
  };
  const selection = { selectedId, select, openEntryIds, openEntry };
  const placeView: PlaceViewProps = {
    draft,
    selectedId,
    onSelect: select,
    editingId,
    onEditingChange: setEditingId,
    numbers,
    dismissedReasonIds,
    onDismissReasons: (id) => setDismissedReasonIds((ids) => [...ids, id]),
  };
  const step = (offset: number) => {
    const positionByPlace = proposalsByPlace.findIndex((proposal) => proposal.id === selectedId);
    const lastPosition = proposalsByPlace.length - 1;
    const nextPosition = Math.max(0, Math.min(lastPosition, positionByPlace + offset));
    const next = proposalsByPlace[nextPosition];
    if (next) select(next.id);
  };
  const selected = proposals[selectedIndex];
  const KEYS: { id: ShortcutId; run: () => void }[] = [
    { id: 'nextSuggestion', run: () => step(1) },
    { id: 'previousSuggestion', run: () => step(-1) },
    {
      id: 'keepSuggestion',
      run: () => {
        if (!selected) return;
        toggleDecision(selected, 'accepted');
        step(1);
      },
    },
    { id: 'dropSuggestion', run: () => selected && toggleDecision(selected, 'rejected') },
    {
      id: 'editSuggestion',
      run: () => selected && canEditSuggestion(selected) && setEditingId(selected.id),
    },
    { id: 'previewSuggestions', run: togglePreview },
    { id: 'previewAllSuggested', run: () => mode === 'preview' && setPreviewLook('all') },
    { id: 'previewWhatYouKept', run: () => mode === 'preview' && setPreviewLook('kept') },
  ];
  /** After Apply only two keys mean anything: undo takes it back, Esc leaves. */
  const handleResultKey = (event: KeyboardEvent) => {
    if (isUndoKey(event)) {
      event.preventDefault();
      applying.undo();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  };
  const handleKey = (event: KeyboardEvent) => {
    // Apply works from a field too, as sending does.
    if (!event.defaultPrevented && matchesAction(event, 'applySuggestions')) {
      event.preventDefault();
      if (!result) applying.apply();
      return;
    }
    if (event.defaultPrevented || isTypingField(event.target)) return;
    if (result) {
      handleResultKey(event);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      if (editingId) setEditingId(null);
      else if (selectedId) select(null);
      else if (mode === 'preview') changeMode(modeBeforePreview);
      else close();
      return;
    }
    const key = KEYS.find(({ id }) => matchesAction(event, id));
    if (!key) return;
    event.preventDefault();
    key.run();
  };

  // A button that removes itself when pressed (a list row, "Back to the assistant's
  // wording") leaves focus on nothing, with no blur to catch: the keys still answer.
  const handleKeyAfterFocusLost = useEffectEvent((event: KeyboardEvent) => {
    if (event.target === document.body) handleKey(event);
  });
  useEffect(() => {
    window.addEventListener('keydown', handleKeyAfterFocusLost);
    return () => window.removeEventListener('keydown', handleKeyAfterFocusLost);
  }, []);

  return (
    <SuggestionSelection value={selection}>
      <div
        ref={rootRef}
        tabIndex={-1}
        role="region"
        aria-label="Suggestion review"
        data-shortcut-place="review"
        data-landing={isLanding || undefined}
        onKeyDown={(event) => handleKey(event.nativeEvent)}
        className="group/review @container/review absolute inset-0 z-20 flex flex-col bg-pane-sunken outline-none"
      >
        <ReviewBar
          proposals={proposals}
          applied={result && { landed: result.plan.landed.length, total: result.total }}
          mode={mode}
          onModeChange={changeMode}
          onBack={close}
          onDroppedAll={setDroppedAllIds}
          preview={
            preview && {
              look: previewLook,
              onLookChange: setPreviewLook,
              meta: previewMeta,
              notShownCount: notShown.length,
              onShowNotShown: () => notShown[0] && select(notShown[0].id),
            }
          }
        />
        {/* Narrow, the inspector docks under the page. */}
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(20rem,1fr)_auto] @max-[62.5rem]/review:grid-cols-1 @max-[62.5rem]/review:grid-rows-[minmax(10rem,1fr)_minmax(0,46%)]">
          <div className="relative grid min-h-0 min-w-0">
            {preview && (
              <SuggestionPreviewPage
                preview={preview}
                look={previewLook}
                hoveredId={hoveredId}
                openId={selectedId}
                onMetaChange={setPreviewMeta}
              />
            )}
            {shownView === 'cards' && (
              <SuggestionDocument
                places={places}
                isPlaceFolded={readPlaceFolded}
                onFoldedChange={changePlaceFolded}
                view={placeView}
              />
            )}
            {shownView === 'page' && (
              <ReviewPage page={page} selectedId={selectedId} onBlank={() => select(null)} />
            )}
            {droppedAll.length > 0 && !result && (
              <DropReasons
                proposals={droppedAll}
                look="batch"
                onDismiss={() => setDroppedAllIds(null)}
                // Stacked over the apply bar, which floats at the page's foot.
                className="absolute inset-x-0 bottom-17.75 z-6 @max-[62.5rem]/review:bottom-0"
              />
            )}
          </div>
          <aside
            ref={inspectorRef}
            aria-label="Suggestions"
            // Takes the assistant pane's column as it opens, and gives it back.
            className={cn(
              'relative flex min-h-0 min-w-0 flex-col bg-pane @max-[62.5rem]/review:w-auto! @max-[62.5rem]/review:border-t @max-[62.5rem]/review:border-line-strong',
              transitionClasses({ name: 'assist', motion: 'handover-lower' })
            )}
            style={{ width: formatPaneWidth(widthPx, AGENT_PANE_WIDTH) }}
          >
            {/* One width for the right-hand column: resizing here resizes the assistant too. */}
            <AppTooltip
              side="left"
              content="Drag to resize · double-click to reset"
              shouldFollowPointer
            >
              <div
                onPointerDown={(event) =>
                  startPaneResize(event, {
                    pane: inspectorRef.current,
                    anchor: 'right',
                    limits: AGENT_PANE_WIDTH,
                    onDone: setWidthPx,
                  })
                }
                onDoubleClick={() => setWidthPx(AGENT_PANE_WIDTH.defaultPx)}
                className="absolute top-0 bottom-0 left-0 z-10 w-1 cursor-col-resize transition-colors hover:bg-amber active:bg-amber-hover @max-[62.5rem]/review:hidden"
              />
            </AppTooltip>
            {result && (
              <ApplyResult
                result={result}
                onUndo={applying.undo}
                onReviewAgain={(id) =>
                  applying.reviewAgain(() => {
                    setMode('page');
                    select(id ?? proposals[0]?.id ?? null);
                  })
                }
                onDone={close}
              />
            )}
            {preview && (
              <PreviewList
                proposals={proposals}
                draft={draft}
                notes={preview.notes}
                openId={selectedId}
                onOpen={select}
                onHover={setHoveredId}
                editingId={editingId}
                onEditingChange={setEditingId}
                onShowOnPage={(id) => {
                  changeMode('page');
                  select(id);
                }}
              />
            )}
            {!preview && !result && proposals.length > 0 && (
              <ReviewInspector
                places={places}
                mode={mode}
                isPlaceFolded={readPlaceFolded}
                onFoldedChange={changePlaceFolded}
                view={placeView}
              />
            )}
            {!result && proposals.length === 0 && <NothingWaiting onBack={close} />}
          </aside>
        </div>
        {!result && proposals.length > 0 && (
          // Floats over the page's foot; narrow, a strip under everything.
          <div
            className="pointer-events-none absolute bottom-4 left-0 z-5 flex justify-center @max-[62.5rem]/review:static @max-[62.5rem]/review:block"
            style={{ right: formatPaneWidth(widthPx, AGENT_PANE_WIDTH) }}
          >
            <ApplyBar
              plan={applying.plan}
              choice={applying.choice}
              onChoiceChange={applying.setChoice}
              offer={applying.offer}
              rows={applying.rows}
              isMenuOpen={applying.isMenuOpen}
              onMenuOpenChange={applying.setIsMenuOpen}
              isRefused={applying.isRefused}
              onApply={applying.apply}
              onLater={close}
              name={applying.name}
            />
          </div>
        )}
      </div>
    </SuggestionSelection>
  );
}

function NothingWaiting({ onBack }: { onBack: () => void }) {
  return (
    <div className="m-auto flex max-w-75 flex-col items-center gap-2 p-6 text-center">
      <span className="grid size-9 place-items-center rounded-[0.625rem] bg-line text-ink-muted">
        <Check className="size-4.5" />
      </span>
      <Text as="p" variant="title">
        Nothing waiting
      </Text>
      <Text as="p" variant="secondary" className="mb-1.5 text-pretty text-ink-muted">
        When the assistant suggests changes, they wait here, over your draft, until you apply or
        drop them. Each template keeps its own.
      </Text>
      <AppButton variant="outline" size="sm" onClick={onBack}>
        Back to draft
      </AppButton>
    </div>
  );
}
