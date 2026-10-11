import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronLeft } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { AppTooltip } from '@/components/AppTooltip';
import { Text } from '@/components/Text';
import { formatPaneWidth, startPaneResize } from '@/features/shell/paneResize';
import { matchesAction } from '@/features/shortcuts/shortcutBindings';
import { isTypingField } from '@/lib/keyboardShortcuts';
import type { ShortcutId } from '@/lib/shortcutCatalog';
import { useAiStore } from '@/stores/aiStore';
import { useOverlayStore } from '@/stores/overlayStore';
import { selectTemplateProposals, useProposalStore } from '@/stores/proposalStore';
import { useResumeStore } from '@/stores/resumeStore';
import { AGENT_PANE_WIDTH, useUiStore } from '@/stores/uiStore';
import type { Proposal } from '@shared/types/agentProposal';
import { acceptProposals, rejectProposals, returnProposals } from '../proposals/proposalActions';
import { ReviewInspector } from './ReviewInspector';
import { ReviewPage } from './ReviewPage';
import { SuggestionSelection } from './suggestionSelection';
import { buildSuggestionPage } from './suggestionPage';

/*
 * The review of the assistant's suggestions: a surface over the whole window but the status
 * bar. The page as Apply would leave it on the left (`ReviewPage`, marks from
 * `suggestionPage.ts`), the inspector on the right at the assistant pane's width
 * (`ReviewInspector`), one selection between them. Opened from the status bar's count.
 */

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
  const isAiOn = useAiStore((s) => s.enabled);
  const closeSurface = useOverlayStore((s) => s.closeSurface);
  const widthPx = useUiStore((s) => s.agentPaneWidthPx);
  const setWidthPx = useUiStore((s) => s.setAgentPaneWidthPx);
  const rootRef = useRef<HTMLDivElement>(null);
  const inspectorRef = useRef<HTMLElement>(null);

  const draft = useMemo(
    () => ({ schemaVersion, contact, sections }),
    [schemaVersion, contact, sections]
  );
  const proposals = useMemo(() => stored.filter((p) => p.status !== 'applied'), [stored]);
  const page = useMemo(() => buildSuggestionPage(draft, proposals), [draft, proposals]);
  const [selectedId, setSelectedId] = useState<string | null>(openOn ?? proposals[0]?.id ?? null);
  const selection = useMemo(() => ({ selectedId, select: setSelectedId }), [selectedId]);
  const close = () => closeSurface('review');

  // Suggestions exist only while AI is on; turned off, there is nothing to review.
  useEffect(() => {
    if (!isAiOn || templateId === null) closeSurface('review');
  }, [isAiOn, templateId, closeSurface]);

  // The keys work from the moment it opens.
  useEffect(() => rootRef.current?.focus(), []);

  const selectedIndex = proposals.findIndex((p) => p.id === selectedId);
  const step = (offset: number) => {
    const next = proposals[Math.max(0, Math.min(proposals.length - 1, selectedIndex + offset))];
    if (next) setSelectedId(next.id);
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
  ];
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || isTypingField(event.target)) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      if (selectedId) setSelectedId(null);
      else close();
      return;
    }
    const key = KEYS.find(({ id }) => matchesAction(event.nativeEvent, id));
    if (!key) return;
    event.preventDefault();
    key.run();
  };

  return (
    <SuggestionSelection value={selection}>
      <div
        ref={rootRef}
        tabIndex={-1}
        role="region"
        aria-label="Suggestion review"
        data-shortcut-place="review"
        onKeyDown={onKeyDown}
        className="absolute inset-0 z-20 flex flex-col bg-pane-sunken outline-none"
      >
        <ReviewBar proposals={proposals} onBack={close} />
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(20rem,1fr)_auto]">
          <ReviewPage page={page} selectedId={selectedId} onBlank={() => setSelectedId(null)} />
          <aside
            ref={inspectorRef}
            aria-label="Suggestions"
            className="relative flex min-h-0 min-w-0 flex-col bg-pane"
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
                className="absolute top-0 bottom-0 left-0 z-10 w-1 cursor-col-resize transition-colors hover:bg-amber active:bg-amber-hover"
              />
            </AppTooltip>
            {proposals.length ? (
              <ReviewInspector
                proposals={proposals}
                draft={draft}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            ) : (
              <NothingWaiting onBack={close} />
            )}
          </aside>
        </div>
      </div>
    </SuggestionSelection>
  );
}

function ReviewBar({ proposals, onBack }: { proposals: Proposal[]; onBack: () => void }) {
  const isEmpty = proposals.length === 0;
  const request = proposals.at(-1)?.requestText.trim();
  const current = proposals.filter((p) => !p.isStale);
  return (
    <header className="flex shrink-0 items-center justify-between gap-3.5 border-b border-line bg-background px-3 py-2.25">
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
            {isEmpty
              ? 'Suggestions'
              : `Reviewing ${proposals.length} ${proposals.length === 1 ? 'suggestion' : 'suggestions'}`}
          </Text>
          <Text as="p" variant="secondary" className="mt-0.5 truncate text-ink-muted">
            {isEmpty
              ? 'Nothing waiting for this template'
              : `${request ? `“${request}” · ` : ''}your draft is unchanged until you apply`}
          </Text>
        </div>
      </div>
      {!isEmpty && (
        <div className="flex shrink-0 items-center gap-1.5">
          <AppButton
            variant="outline"
            size="sm"
            onClick={() => rejectProposals(current.map((p) => p.id))}
          >
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
      )}
    </header>
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
