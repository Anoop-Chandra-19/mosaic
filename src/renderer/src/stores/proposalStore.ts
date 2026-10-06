import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Proposal, ProposalStatus } from '@shared/types/agentProposal';

/*
 * The staging layer: the assistant's suggestions, waiting over each template's draft and
 * never inside it. State only. Staging, checking and applying are
 * `features/agent/proposals/`, which are the only writers. In memory until the agent's
 * tables keep them.
 */

interface ProposalState {
  /** By template, so switching away and back finds them waiting. */
  byTemplate: Record<string, Proposal[]>;
  addProposals: (templateId: string, proposals: Proposal[]) => void;
  /** Puts back proposals by id, as their writer rebuilt them. */
  replaceProposals: (templateId: string, proposals: Proposal[]) => void;
  setStatus: (templateId: string, ids: readonly string[], status: ProposalStatus) => void;
  /** All of a template's, or only these. */
  removeProposals: (templateId: string, ids?: readonly string[]) => void;
}

export const useProposalStore = create<ProposalState>()(
  immer((set) => ({
    byTemplate: {},

    addProposals: (templateId, proposals) =>
      set((state) => {
        (state.byTemplate[templateId] ??= []).push(...proposals);
      }),

    replaceProposals: (templateId, proposals) =>
      set((state) => {
        const list = state.byTemplate[templateId] ?? [];
        for (const proposal of proposals) {
          const index = list.findIndex((p) => p.id === proposal.id);
          if (index >= 0) list[index] = proposal;
        }
      }),

    setStatus: (templateId, ids, status) =>
      set((state) => {
        for (const proposal of state.byTemplate[templateId] ?? []) {
          if (ids.includes(proposal.id)) proposal.status = status;
        }
      }),

    removeProposals: (templateId, ids) =>
      set((state) => {
        if (!ids) delete state.byTemplate[templateId];
        else {
          state.byTemplate[templateId] = (state.byTemplate[templateId] ?? []).filter(
            (proposal) => !ids.includes(proposal.id)
          );
        }
      }),
  }))
);

const NO_PROPOSALS: Proposal[] = [];

export function selectTemplateProposals(state: ProposalState, templateId: string | null) {
  return (templateId && state.byTemplate[templateId]) || NO_PROPOSALS;
}

/** Suggestions still waiting on the user: neither applied nor turned down. */
export function selectWaitingCount(state: ProposalState, templateId: string | null): number {
  return selectTemplateProposals(state, templateId).filter(
    (proposal) => proposal.status === 'pending' || proposal.status === 'accepted'
  ).length;
}
