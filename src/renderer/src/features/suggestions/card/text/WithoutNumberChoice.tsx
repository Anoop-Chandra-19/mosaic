import { AppButton, Text } from '@/components/ui-kit';
import type { Proposal } from '@/types/agentProposal';
import { chooseVersionWithoutNumber } from '../../proposals/proposalActions';
import { BackLink, Caption } from '../bodies/BodyParts';

/**
 * Show the assistant's alternative text that needs no number, with a button to use it.
 * After the user chooses it, show a link that returns to the text with the number.
 * Render nothing if the assistant gave no alternative or the user wrote their own text.
 */
export function WithoutNumberChoice({ proposal }: { proposal: Proposal }) {
  const { change, review } = proposal;
  const hasGap = change.kind === 'rewrite' || change.kind === 'add';
  const withoutNumber = hasGap && review.userText === undefined ? change.gap?.withoutNumber : null;
  if (!withoutNumber) return null;
  if (review.isWithoutNumber) {
    return (
      <BackLink onClick={() => chooseVersionWithoutNumber(proposal.id, false)}>
        Back to the version with a number
      </BackLink>
    );
  }
  return (
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
  );
}
