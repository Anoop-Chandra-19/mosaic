import { describe, expect, it } from 'vitest';
import { checkProposal } from '../checkProposal';
import { addText, makeResume } from '../../__tests__/proposalFixtures';

describe('checkProposal, added text', () => {
  it('reads an added bullet against its entry: its own names are not new', () => {
    const doc = makeResume();
    const flags = (text: string) =>
      checkProposal(doc, addText('bullet', 'b3', text), 'Add my on-call work').map((f) => f.kind);
    expect(flags('Ran on-call for the Harbor Freight Labs payments team')).toEqual([]);
    expect(flags('Moved the billing workers onto Kubernetes')).toEqual(['newNames']);
  });
});
