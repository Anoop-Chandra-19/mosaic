import { afterEach, describe, expect, it } from 'vitest';
import type { VersionMeta } from '@shared/types/db';
import type { Proposal } from '@/types/agentProposal';
import { useProposalStore } from '@/stores/proposalStore';
import { useResumeStore } from '@/stores/resumeStore';
import { useTemplateStore } from '@/stores/templateStore';
import { collectVersionSuggestions } from '../applyAcceptedProposals';
import { makeProposal, rewrite } from '../../__tests__/proposalFixtures';

const applied = (id: string, bulletId: string): Proposal => ({
  ...makeProposal(rewrite(bulletId, 'Before', 'After'), id),
  status: 'applied',
});

function openWithHead(headId: string) {
  useResumeStore.setState({ templateId: 't1' });
  useTemplateStore.setState({
    templates: [{ id: 't1', head: { id: headId } as VersionMeta }] as never,
  });
}

afterEach(() => {
  useProposalStore.setState({ byTemplate: {}, idsByAppliedVersion: {} });
});

describe('collectVersionSuggestions', () => {
  it('adds to what the assistant’s newest version already held, so its title covers both', () => {
    openWithHead('v2');
    const earlier = [applied('p1', 'b1'), applied('p2', 'b2')];
    useProposalStore.setState({
      byTemplate: { t1: earlier },
      idsByAppliedVersion: { v2: ['p1', 'p2'] },
    });
    const landing = [applied('p3', 'b3')];

    expect(collectVersionSuggestions(true, landing).map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
    expect(collectVersionSuggestions(false, landing).map((p) => p.id)).toEqual(['p3']);
  });

  it('holds only what lands when nothing is known of the version it adds to', () => {
    openWithHead('v7');
    const landing = [applied('p3', 'b3')];
    expect(collectVersionSuggestions(true, landing).map((p) => p.id)).toEqual(['p3']);
  });
});
