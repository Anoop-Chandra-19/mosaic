import type { ReactNode } from 'react';
import type { ProposalChangeKind } from '@shared/types/agentProposal';
import { AddedTextBody } from './bodies/AddedTextBody';
import { EntryFacts } from './bodies/EntryFacts';
import { NewSectionBody } from './bodies/NewSectionBody';
import { RenameBody } from './bodies/RenameBody';
import { ReorderBody } from './bodies/ReorderBody';
import { RewriteBody } from './bodies/RewriteBody';
import { SelectBody } from './bodies/SelectBody';
import { SplitBody } from './bodies/SplitBody';
import { StaleBody } from './bodies/StaleBody';
import type { SuggestionBodyProps } from './bodies/suggestionBodyProps';

/*
 * One suggestion, read beside the user's words: shared by the inspector and the Compare all
 * cards. A body per kind; an out-of-date one shows what changed under it instead.
 */

export function SuggestionBody(props: SuggestionBodyProps) {
  if (props.proposal.isStale) return <StaleBody {...props} />;
  const Body = KIND_BODIES[props.proposal.change.kind];
  return <Body {...props} />;
}

const KIND_BODIES: Record<ProposalChangeKind, (props: SuggestionBodyProps) => ReactNode> = {
  rewrite: RewriteBody,
  merge: RewriteBody,
  split: SplitBody,
  reorder: ReorderBody,
  select: SelectBody,
  add: AddedTextBody,
  entry: ({ proposal }) => <EntryFacts proposal={proposal} />,
  section: NewSectionBody,
  rename: RenameBody,
};
