import { EyeOff, List, ListPlus, Move, Plus, Split, Type, type LucideIcon } from 'lucide-react';
import { Chip } from '@/components/ui-kit';
import type { ProposalChange } from '@shared/types/agentProposal';
import { labelSuggestionKind } from '../../proposals/describeSuggestion';

const KIND_ICONS: Record<ProposalChange['kind'], LucideIcon> = {
  rewrite: Type,
  split: Split,
  merge: List,
  reorder: Move,
  select: EyeOff,
  add: ListPlus,
  entry: Plus,
};

/** What kind of change a suggestion is, in the assistant's amber. */
export function SuggestionKindChip({ change }: { change: ProposalChange }) {
  const Icon = KIND_ICONS[change.kind];
  return (
    <Chip tone="amber">
      <Icon />
      {labelSuggestionKind(change)}
    </Chip>
  );
}
