import {
  EyeOff,
  Heading,
  LayoutList,
  List,
  ListPlus,
  Move,
  Plus,
  Split,
  Type,
  type LucideIcon,
} from 'lucide-react';
import { Chip } from '@/components/ui-kit';
import type { ProposalChange } from '@/types/agentProposal';
import { labelSuggestionKind } from '../proposals/describeSuggestion';

const KIND_ICONS: Record<ProposalChange['kind'], LucideIcon> = {
  rewrite: Type,
  split: Split,
  merge: List,
  reorder: Move,
  select: EyeOff,
  add: ListPlus,
  entry: Plus,
  section: LayoutList,
  rename: Heading,
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
