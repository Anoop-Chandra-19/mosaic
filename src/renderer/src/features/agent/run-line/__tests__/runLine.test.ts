import { describe, expect, it } from 'vitest';
import { AGENT_TOOLS } from '@shared/agent-tools/agentTools';
import type { ToolTarget } from '@shared/types/agentConversation';
import type { RunPart } from '@/types/agentRunView';
import {
  describeRunLine,
  findAutoOpenAt,
  listRunLineItems,
  readFoldDelay,
  type RunState,
} from '../runLineItems';
import { describeStepNote, formatOrdinal, readStepWords } from '../stepWords';

const RUNNING: RunState = { isRunning: true, isStopped: false };
const FINISHED: RunState = { isRunning: false, isStopped: false };
const STOPPED: RunState = { isRunning: false, isStopped: true };

const step = (callId: string, status: 'running' | 'done' | 'refused' | 'notRun'): RunPart => ({
  type: 'toolCall',
  callId,
  name: 'read_document',
  status,
});
const text = (words: string): RunPart => ({ type: 'text', text: words });
const think = (durationMs: number | null): RunPart => ({ type: 'reasoning', durationMs });

const label = (parts: RunPart[], state: RunState, isOpen = false, elapsedMs = 0) =>
  describeRunLine(listRunLineItems(parts, state), state, isOpen, elapsedMs);

describe('what a step is called', () => {
  it.each(Object.keys(AGENT_TOOLS))('%s has words for running, done and refused', (name) => {
    const words = readStepWords(name);
    expect(words.running).not.toBe('');
    expect(words.done(undefined)).not.toBe('');
    expect(words.refused(undefined)).not.toBe('');
    expect(`${words.running}${words.done(undefined)}${words.refused(undefined)}`).not.toMatch(/—/);
  });

  it('says what a rewrite or a select found, once it knows', () => {
    const line: ToolTarget = { kind: 'place', section: 'Skills', line: 2 };
    expect(readStepWords('propose_rewrite').done(line)).toBe('Rewrote a line');
    expect(readStepWords('propose_rewrite').refused(undefined)).toBe('Couldn’t rewrite that');
    expect(
      readStepWords('propose_select').done({ kind: 'place', section: 'A', bullet: 1, show: true })
    ).toBe('Put a bullet back on the page');
    expect(
      readStepWords('propose_select').done({ kind: 'place', section: 'A', entry: 'B', show: false })
    ).toBe('Left an entry off the page');
  });

  it('names a replace’s terms and a reorder’s list', () => {
    const term: ToolTarget = { kind: 'term', find: 'Postgres', replace: 'PostgreSQL', count: 2 };
    expect(readStepWords('propose_replace_everywhere').done(term)).toBe(
      'Replaced “Postgres” with “PostgreSQL”'
    );
    expect(readStepWords('propose_reorder').done({ kind: 'list', of: 'section' })).toBe(
      'Reordered the sections'
    );
    expect(
      readStepWords('propose_reorder').done({ kind: 'list', of: 'entry', section: 'Experience' })
    ).toBe('Reordered Experience');
  });

  it('still names a tool the model made up', () => {
    expect(readStepWords('toString').done(undefined)).toBe('Used toString');
    expect(readStepWords('read_everything').refused(undefined)).toBe(
      'Tried read_everything, which Mosaic doesn’t have'
    );
  });

  it.each<[number, string]>([
    [1, '1st'],
    [2, '2nd'],
    [3, '3rd'],
    [4, '4th'],
    [11, '11th'],
    [13, '13th'],
    [21, '21st'],
  ])('%i is %s', (position, ordinal) => {
    expect(formatOrdinal(position)).toBe(ordinal);
  });
});

describe('the note under a step', () => {
  it.each<[string, ToolTarget | undefined, string | null]>([
    ['nothing found', undefined, null],
    ['three sections', { kind: 'resume', sections: ['A', 'B', 'C'] }, 'A, B, C'],
    [
      'more sections, as a count',
      { kind: 'resume', sections: ['A', 'B', 'C', 'D', 'E'] },
      'A, B, C +2 more',
    ],
    ['a version', { kind: 'version', version: 'v3.1' }, 'v3.1'],
    ['a section', { kind: 'place', section: 'Experience' }, 'Experience'],
    ['an entry', { kind: 'place', section: 'Experience', entry: 'Acme' }, 'Experience · Acme'],
    [
      'a bullet',
      { kind: 'place', section: 'Experience', entry: 'Acme', bullet: 3 },
      'Acme · 3rd bullet',
    ],
    [
      'a merge',
      { kind: 'place', section: 'Experience', entry: 'Acme', bullet: 1, lastBullet: 2 },
      'Acme · 1st and 2nd bullets',
    ],
    ['a line', { kind: 'place', section: 'Skills', line: 2 }, 'Skills · 2nd line'],
    ['an entry’s bullets', { kind: 'list', of: 'bullet', section: 'E', entry: 'Acme' }, 'Acme'],
    ['the sections', { kind: 'list', of: 'section' }, null],
    ['a term', { kind: 'term', find: 'a', replace: 'b', count: 2 }, '2 places'],
    ['a term once', { kind: 'term', find: 'a', replace: 'b', count: 1 }, '1 place'],
    ['a term nowhere', { kind: 'term', find: 'a', replace: 'b', count: 0 }, null],
  ])('%s', (_, target, note) => {
    expect(describeStepNote(target)).toBe(note);
  });
});

describe('the line', () => {
  it('has no rows with no steps or thinking', () => {
    expect(listRunLineItems([text('Hello.')], RUNNING).rows).toEqual([]);
  });

  it('puts only text written between rows among them', () => {
    const items = listRunLineItems(
      [text('First.'), step('c1', 'done'), text('Between.'), step('c2', 'done'), text('Last.')],
      FINISHED
    );
    expect(items.rows.map((row) => row.kind)).toEqual(['step', 'text', 'step']);
    expect(items.textOutside.map((part) => part.text)).toEqual(['First.', 'Last.']);
    expect(items.textAll).toHaveLength(3);
  });

  it('never counts thinking as a step', () => {
    const items = listRunLineItems([think(1000), step('c1', 'done'), think(500)], FINISHED);
    expect(items.stepCount).toBe(1);
  });

  it('names what is going on while it runs', () => {
    expect(label([step('c1', 'running')], RUNNING).text).toBe('Reading your resume…');
    expect(label([step('c1', 'done')], RUNNING).text).toBe('Working…');
    expect(label([think(null)], RUNNING)).toMatchObject({ text: 'Thinking', isThinking: true });
    expect(label([step('c1', 'done'), step('c2', 'running')], RUNNING, true).text).toBe(
      '2 steps so far'
    );
  });

  it('counts the steps once it ends, and only those that finished when stopped', () => {
    expect(label([step('c1', 'done')], FINISHED, false, 900)).toMatchObject({
      text: '1 step',
      spoken: '1 step, 0.9 seconds',
    });
    const cut = [
      step('c1', 'done'),
      step('c2', 'refused'),
      step('c3', 'notRun'),
      step('c4', 'running'),
    ];
    expect(label(cut, STOPPED)).toMatchObject({
      text: '2 steps',
      spoken: 'Stopped after 2 steps',
    });
  });

  it('says how long it thought when thinking is all it did', () => {
    expect(label([think(3400), text('Done.')], FINISHED)).toMatchObject({
      text: 'Thought for 3.4s',
      showsTime: false,
      spoken: 'Thought for 3.4 seconds',
    });
  });

  it('marks a step the run ended before, and one that was refused', () => {
    const states = (parts: RunPart[], state: RunState) =>
      listRunLineItems(parts, state).rows.map((row) => row.kind === 'step' && row.state);
    expect(states([step('c1', 'running')], RUNNING)).toEqual(['run']);
    expect(states([step('c1', 'running')], STOPPED)).toEqual(['cut']);
    expect(states([step('c1', 'notRun')], STOPPED)).toEqual(['cut']);
    expect(states([step('c1', 'refused')], FINISHED)).toEqual(['fail']);
  });
});

describe('when an open line folds', () => {
  it('waits out its hold, and for words to keep coming, but not after a stop', () => {
    expect(readFoldDelay(FINISHED, 200)).toBe(800);
    expect(readFoldDelay(FINISHED, 5000)).toBe(0);
    expect(readFoldDelay(RUNNING, 5000)).toBe(1000);
    expect(readFoldDelay(STOPPED, 200)).toBe(0);
  });
});

describe('when the line opens on its own', () => {
  it('is two seconds into the steps, or as the third starts', () => {
    expect(findAutoOpenAt([])).toBeNull();
    expect(findAutoOpenAt([1000])).toBe(3000);
    expect(findAutoOpenAt([1000, 1100])).toBe(3000);
    expect(findAutoOpenAt([1000, 1100, 1200])).toBe(1200);
    expect(findAutoOpenAt([1000, 2500, 3500])).toBe(3000);
  });
});
