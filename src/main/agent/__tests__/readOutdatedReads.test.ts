import { describe, expect, it } from 'vitest';
import type { RunCallRow } from '../../db/conversations/toolCalls';
import { findOutdatedReads } from '../readOutdatedReads';

const run = (runId: number, runRev: number, templateId = 't1'): RunCallRow => ({
  runId,
  templateId,
  runRev,
  callId: null,
  name: null,
  status: null,
  callRev: null,
});

const call = (
  base: RunCallRow,
  callId: string,
  callRev: number,
  name = 'read_document',
  status = 'ok'
): RunCallRow => ({ ...base, callId, name, status, callRev });

const AT_REV_4 = { templateId: 't1', rev: 4 };

describe('findOutdatedReads', () => {
  it('says nothing of a read that still holds', () => {
    const first = run(1, 4);
    expect(findOutdatedReads([call(first, 'c1', 4)], AT_REV_4)).toEqual([]);
  });

  it('says you edited when only the draft as it is now differs', () => {
    const first = run(1, 3);
    expect(findOutdatedReads([call(first, 'c1', 3)], AT_REV_4)).toEqual([
      { runId: 1, callId: 'c1', outcome: 'edited' },
    ]);
  });

  it('says another resume is open, or none is', () => {
    const rows = [call(run(1, 3), 'c1', 3)];
    const outcome = [{ runId: 1, callId: 'c1', outcome: 'otherResume' }];
    expect(findOutdatedReads(rows, { templateId: 't2', rev: 3 })).toEqual(outcome);
    expect(findOutdatedReads(rows, null)).toEqual(outcome);
  });

  it('says the model was asked again when a later call saw the draft elsewhere', () => {
    const first = run(1, 3);
    const rows = [call(first, 'c1', 3), call(first, 'c2', 4, 'propose_rewrite')];
    expect(findOutdatedReads(rows, AT_REV_4)).toEqual([
      { runId: 1, callId: 'c1', outcome: 'askedAgain' },
    ]);
  });

  it('says so too when a later run started elsewhere, with no calls of its own', () => {
    const rows = [call(run(1, 3), 'c1', 3), run(2, 4)];
    expect(findOutdatedReads(rows, AT_REV_4)).toEqual([
      { runId: 1, callId: 'c1', outcome: 'askedAgain' },
    ]);
    const onAnotherResume = [call(run(1, 3), 'c1', 3), run(2, 3, 't2')];
    expect(findOutdatedReads(onAnotherResume, { templateId: 't1', rev: 3 })).toEqual([
      { runId: 1, callId: 'c1', outcome: 'askedAgain' },
    ]);
  });

  it('leaves out the read after the edit, and calls that aren’t answered reads', () => {
    const first = run(1, 3);
    const rows = [
      call(first, 'c1', 3, 'read_document', 'error'),
      call(first, 'c2', 3, 'propose_rewrite'),
      call(first, 'c3', 3),
      call(first, 'c4', 4),
    ];
    expect(findOutdatedReads(rows, AT_REV_4)).toEqual([
      { runId: 1, callId: 'c3', outcome: 'askedAgain' },
    ]);
  });
});
