import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { AppButton, AppTextarea, Text } from '@/components/ui-kit';
import { ShortcutKeys } from '@/components/ShortcutKeys';
import type { Proposal, ProposalChange, ProposalVersion } from '@/types/agentProposal';
import { GAP_MARK } from '../../proposals/checks/unfilledGap';
import { checkProposalEdit, editProposal } from '../../proposals/proposalActions';
import { resolveChange } from '../../proposals/reviewedChange';
import { SuggestionFlags } from './SuggestionFlags';

/** How the gap reads while typing, so it can be kept, filled or written around. */
const TYPED_GAP = '[?]';

/**
 * Return the wording without a number when the text still has a number to fill, so the
 * user has nothing to type over. Returns null when the assistant gave no such wording.
 */
function readTextWithoutNumber(change: ProposalChange): string | null {
  const hasGap = change.kind === 'rewrite' || change.kind === 'add';
  if (!hasGap || !change.gap) return null;
  return readWrittenText(change).includes(GAP_MARK) ? change.gap.withoutNumber : null;
}

function readEditableText(change: ProposalChange): string {
  const withoutNumber = readTextWithoutNumber(change);
  return withoutNumber ?? readWrittenText(change).replaceAll(GAP_MARK, TYPED_GAP);
}

/** What a suggestion writes in words: a rewrite's, merge's or heading's new text, or added text. */
function readWrittenText(change: ProposalChange): string {
  switch (change.kind) {
    case 'rewrite':
    case 'merge':
    case 'rename':
      return change.after;
    case 'add':
      return change.text;
    default:
      return '';
  }
}

interface SuggestionEditorProps {
  proposal: Proposal;
  /** The version of the suggestion being edited. */
  version: ProposalVersion;
  onDone: () => void;
}

/** A suggestion in the user's words, checked as they type. Saving also keeps the version they edited. */
export function SuggestionEditor({ proposal, version, onDone }: SuggestionEditorProps) {
  const [text, setText] = useState(() => readEditableText(resolveChange(version)));
  const [isOnTextWithoutNumber] = useState(
    () => readTextWithoutNumber(resolveChange(version)) !== null
  );
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const written = text.trim().replaceAll(TYPED_GAP, GAP_MARK);
  const flags = checkProposalEdit(proposal, version, written);

  useEffect(() => {
    const field = fieldRef.current;
    field?.focus();
    field?.setSelectionRange(field.value.length, field.value.length);
  }, []);

  const save = () => {
    if (!written) return;
    editProposal(proposal.id, written, version.id);
    onDone();
  };

  return (
    <div>
      <AppTextarea
        ref={fieldRef}
        aria-label="The suggestion in your words"
        rows={3}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            save();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            onDone();
          }
        }}
        className="border-add-line shadow-[0_0_0_3px_var(--add-soft)] focus-visible:border-add-line"
      />
      <SuggestionFlags flags={flags} isCompact />
      {isOnTextWithoutNumber && (
        <Text as="p" variant="secondary" className="mt-1.5 text-ink-muted">
          This is the wording without a number. If you know the number, type it in. To keep the
          assistant’s wording instead, cancel and fill in the ? on the card.
        </Text>
      )}
      <div className="mt-2 flex items-center gap-1.5">
        <Text variant="caption" className="flex flex-wrap items-center gap-1">
          <ShortcutKeys combos={['enter']} /> saves and keeps it · <ShortcutKeys combos={['esc']} />{' '}
          cancels
        </Text>
        <span className="flex-1" />
        <AppButton variant="ghost" size="xs" onClick={onDone}>
          Cancel
        </AppButton>
        <AppButton variant="kept" size="xs" disabled={!written} onClick={save}>
          <Check />
          Save
        </AppButton>
      </div>
    </div>
  );
}
