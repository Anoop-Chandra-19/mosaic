import { useEffect, useRef } from 'react';
import { AppButton, Text } from '@/components/ui-kit';
import { cn } from '@/lib/utils';
import type { Proposal } from '@/types/agentProposal';
import type { ResumeData } from '@shared/types/resume';
import { placeSuggestion } from '../../proposals/describeSuggestion';
import { KeyHint } from '../ReviewInspector';
import { SuggestionActions } from '../../card/SuggestionActions';
import { SuggestionBody } from '../../card/SuggestionBody';
import { SuggestionRow } from '../SuggestionRow';
import type { PreviewNote } from './suggestionPreview';

interface PreviewListProps {
  proposals: Proposal[];
  draft: ResumeData;
  notes: Map<string, PreviewNote>;
  openId: string | null;
  onOpen: (id: string | null) => void;
  onHover: (id: string | null) => void;
  editingId: string | null;
  onEditingChange: (id: string | null) => void;
  /** Back to On the page, with this one selected. */
  onShowOnPage: (id: string) => void;
}

/**
 * The inspector in Preview: the list only, each row saying why it is or isn't on the page.
 * A row opens in place, one at a time, into a compact card to change it here; the page
 * follows.
 */
export function PreviewList({
  proposals,
  draft,
  notes,
  openId,
  onOpen,
  onHover,
  editingId,
  onEditingChange,
  onShowOnPage,
}: PreviewListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const notShown = proposals.filter((proposal) => notes.get(proposal.id)?.isOnPage === false);

  // The open row comes into view at the top, opened from a key or from the bar.
  useEffect(() => {
    if (!openId) return;
    listRef.current
      ?.querySelector(`[data-preview-row="${CSS.escape(openId)}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [openId]);

  return (
    <>
      <div className="border-b border-line px-4 pt-4.5 pb-3.5 text-center @max-[62.5rem]/review:hidden">
        <Text as="p" variant="strong" className="mb-0.75">
          {proposals.length} {proposals.length === 1 ? 'suggestion' : 'suggestions'}
          {notShown.length > 0 && ` · ${notShown.length} not shown`}
        </Text>
        <Text as="p" variant="secondary" className="text-pretty text-ink-muted">
          Open one to change it here. The page follows.
        </Text>
      </div>
      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {proposals.map((proposal, index) => {
          const isOpen = proposal.id === openId;
          const isEditing = editingId === proposal.id;
          const setEditing = (isOn: boolean) => onEditingChange(isOn ? proposal.id : null);
          return (
            <div
              key={proposal.id}
              data-preview-row={proposal.id}
              onPointerEnter={() => onHover(proposal.id)}
              onPointerLeave={() => onHover(null)}
              className={cn(
                'relative scroll-mt-1 border-y border-transparent',
                isOpen &&
                  'border-line bg-pane-raised before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-amber'
              )}
            >
              <SuggestionRow
                proposal={proposal}
                number={index + 1}
                place={placeSuggestion(draft, proposal.change)}
                onClick={() => onOpen(isOpen ? null : proposal.id)}
              >
                <NoteTag note={notes.get(proposal.id)} />
              </SuggestionRow>
              {isOpen && (
                <>
                  <div
                    data-compact
                    className="group/card flex flex-col gap-1.5 pt-0.5 pr-3.5 pb-2 pl-8.5"
                  >
                    <SuggestionBody
                      proposal={proposal}
                      draft={draft}
                      isEditing={isEditing}
                      onEditingChange={setEditing}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pr-3.5 pb-2.5 pl-8.5">
                    <SuggestionActions
                      proposal={proposal}
                      isEditing={isEditing}
                      onEditingChange={setEditing}
                    />
                    <span className="flex-1" />
                    <AppButton variant="quiet" size="xs" onClick={() => onShowOnPage(proposal.id)}>
                      Show on the page
                    </AppButton>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
      <Text
        as="p"
        variant="meta"
        className="flex shrink-0 flex-wrap items-center gap-1 border-t border-line px-3 py-2 text-ink-muted"
      >
        <KeyHint id="nextSuggestion" />/<KeyHint id="previousSuggestion" /> open next ·{' '}
        <KeyHint id="keepSuggestion" /> keep · <KeyHint id="dropSuggestion" /> drop ·{' '}
        <KeyHint id="editSuggestion" /> edit · <KeyHint id="previewSuggestions" /> back
      </Text>
    </>
  );
}

/** Whether it is on the page, and why not, or how it is shown there. */
function NoteTag({ note }: { note: PreviewNote | undefined }) {
  if (!note) return null;
  const label = note.isOnPage ? 'in preview' : 'not in this preview';
  return (
    <span
      title={note.isOnPage ? `In this preview, ${note.text}` : `Not in this preview: ${note.text}`}
      className="mt-0.75 flex min-w-0 items-baseline gap-1.25"
    >
      <span
        className={cn(
          'size-1.5 shrink-0 self-center rounded-full border-[1.5px]',
          note.isOnPage ? 'border-ink-faint' : 'border-dashed border-ink-muted'
        )}
      />
      <Text variant="tag" className="shrink-0 whitespace-nowrap text-ink-muted">
        {label}
      </Text>
      <Text variant="secondary" className="min-w-0 truncate text-ink-soft">
        {note.text}
      </Text>
    </span>
  );
}
