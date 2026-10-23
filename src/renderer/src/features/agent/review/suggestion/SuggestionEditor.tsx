import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { AppButton, AppTextarea, Text } from '@/components/ui-kit';
import { ShortcutKeys } from '@/features/shortcuts/ShortcutKeys';
import type { Proposal, ProposalChange } from '@shared/types/agentProposal';
import { GAP_MARK } from '../../proposals/checks/unfilledGap';
import { checkProposalEdit, editProposal } from '../../proposals/proposalActions';
import { resolveChange } from '../../proposals/reviewedChange';
import { SuggestionFlags } from './SuggestionFlags';

/** How the gap reads while typing, so it can be kept, filled or written around. */
const TYPED_GAP = '[?]';

function readEditableText(proposal: Proposal): string {
  return readWrittenText(resolveChange(proposal)).replaceAll(GAP_MARK, TYPED_GAP);
}

/** What a suggestion writes in words: a rewrite's or merge's new text, or added text. */
function readWrittenText(change: ProposalChange): string {
  switch (change.kind) {
    case 'rewrite':
    case 'merge':
      return change.after;
    case 'add':
      return change.text;
    default:
      return '';
  }
}

/** A suggestion in the user's words, checked as they type. Saving keeps it. */
export function SuggestionEditor({ proposal, onDone }: { proposal: Proposal; onDone: () => void }) {
  const [text, setText] = useState(() => readEditableText(proposal));
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const written = text.trim().replaceAll(TYPED_GAP, GAP_MARK);
  const flags = checkProposalEdit(proposal, written);

  useEffect(() => {
    const field = fieldRef.current;
    field?.focus();
    field?.setSelectionRange(field.value.length, field.value.length);
  }, []);

  const save = () => {
    if (!written) return;
    editProposal(proposal.id, written);
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
