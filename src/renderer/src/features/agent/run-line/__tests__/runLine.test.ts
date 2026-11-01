import { describe, expect, it } from 'vitest';
import { AGENT_TOOLS } from '@shared/agent-tools/agentTools';
import type { ToolTarget } from '@shared/types/agentConversation';
import type { RunPart } from '@/types/agentRunView';
import {
  describeRunAloud,
  describeRunLine,
  describeRunTotal,
  describeThinking,
  findAutoOpenAt,
  isWaitingForModel,
  listRunTimeline,
  readFoldDelay,
  type RunLineItems,
  type RunState,
} from '../runTimeline';
import { describeStepNote, formatOrdinal, readStepWords } from '../stepWords';

const RUNNING: RunState = { isRunning: true, isStopped: false, isCancelled: false };
const FINISHED: RunState = { isRunning: false, isStopped: false, isCancelled: false };
const STOPPED: RunState = { isRunning: false, isStopped: true, isCancelled: true };
const FAILED: RunState = { isRunning: false, isStopped: true, isCancelled: false };

const step = (
  callId: string,
  status: 'running' | 'waiting' | 'done' | 'refused' | 'notRun'
): RunPart => ({
  type: 'toolCall',
  callId,
  name: 'read_document',
  status,
});
const timed = (callId: string, startedAt: number, durationMs: number): RunPart => ({
  type: 'toolCall',
  callId,
  name: 'read_document',
  status: 'done',
  startedAt,
  durationMs,
});
const text = (words: string): RunPart => ({ type: 'text', text: words });
const think = (durationMs: number | null): RunPart => ({ type: 'reasoning', durationMs });

/** The run's one line, for a test of what a line says. */
function lineOf(parts: RunPart[], state: RunState): RunLineItems {
  const [item] = listRunTimeline(parts, state);
  if (item?.kind !== 'line') throw new Error('not a line');
  return item.line;
}

const shape = (parts: RunPart[], state: RunState) =>
  listRunTimeline(parts, state).map((item) =>
    item.kind === 'text' ? item.text : item.line.rows.map((row) => row.key)
  );

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

describe('the timeline', () => {
  it('reads in the order it happened, each stretch of steps its own line', () => {
    expect(
      shape(
        [
          text('First.'),
          step('c1', 'done'),
          step('c2', 'done'),
          text('Between.'),
          step('c3', 'running'),
        ],
        RUNNING
      )
    ).toEqual(['First.', ['c1', 'c2'], 'Between.', ['c3']]);
  });

  it('keeps thinking in the line around it, and never counts it as a step', () => {
    const parts = [think(1000), step('c1', 'done'), think(500)];
    expect(shape(parts, FINISHED)).toEqual([['think-0', 'c1', 'think-2']]);
    expect(lineOf(parts, FINISHED).steps).toHaveLength(1);
  });

  it('knows which item is the newest', () => {
    const items = listRunTimeline([step('c1', 'done'), text('Words.')], RUNNING);
    expect(items.map((item) => item.isLast)).toEqual([false, true]);
  });

  it('keeps a line’s key as more comes, so an open line stays open', () => {
    const [before] = listRunTimeline([step('c1', 'running')], RUNNING);
    const [after] = listRunTimeline([step('c1', 'done'), step('c2', 'running')], RUNNING);
    expect(after.key).toBe(before.key);
  });
});

describe('a line’s time', () => {
  const duration = (parts: RunPart[]) => lineOf(parts, FINISHED).durationMs;

  it('spans its steps, so calls that overlap count once and the gaps count', () => {
    expect(duration([timed('c1', 1000, 500), timed('c2', 1200, 500)])).toBe(700);
    expect(duration([timed('c1', 1000, 500), timed('c2', 4000, 500)])).toBe(3500);
  });

  it('adds thinking before the first step and after the last, and not between', () => {
    expect(duration([think(300), timed('c1', 1000, 500), think(200)])).toBe(1000);
    expect(duration([timed('c1', 1000, 500), think(9000), timed('c2', 2000, 500)])).toBe(1500);
  });

  it('is left out for steps stored before they were timed', () => {
    expect(duration([step('c1', 'done'), timed('c2', 1000, 500)])).toBeNull();
    expect(duration([step('c1', 'notRun')])).toBeNull();
  });
});

describe('what a line says', () => {
  const said = (parts: RunPart[], state: RunState, isGoing: boolean, isOpen = false) =>
    describeRunLine(lineOf(parts, state), isGoing, isOpen);

  it('names what is going on while it runs', () => {
    const two = (second: RunPart) => [step('c1', 'done'), second];
    expect(said(two(step('c2', 'running')), RUNNING, true).text).toBe('Reading your resume…');
    expect(said(two(step('c2', 'done')), RUNNING, true).text).toBe('Working…');
    expect(said(two(think(null)), RUNNING, true)).toMatchObject({
      text: 'Thinking',
      isThinking: true,
    });
    expect(said(two(step('c2', 'running')), RUNNING, true, true).text).toBe('2 steps so far');
  });

  it('counts its steps once it is over, even with the run still going', () => {
    expect(said([step('c1', 'done'), step('c2', 'done')], RUNNING, false).text).toBe('2 steps');
  });

  it('counts only the steps that finished when it was stopped', () => {
    const cut = [
      step('c1', 'done'),
      step('c2', 'refused'),
      step('c3', 'notRun'),
      step('c4', 'running'),
    ];
    expect(said(cut, STOPPED, false).text).toBe('2 steps');
  });

  it('says how long it thought when thinking is all it did', () => {
    expect(describeThinking(lineOf([think(3400), think(100)], FINISHED))).toBe('Thought for 3.5s');
  });

  it('marks a step the run ended before, and one that was refused', () => {
    const states = (parts: RunPart[], state: RunState) =>
      lineOf(parts, state).rows.map((row) => row.kind === 'step' && row.state);
    expect(states([step('c1', 'running')], RUNNING)).toEqual(['run']);
    expect(states([step('c1', 'waiting')], RUNNING)).toEqual(['wait']);
    expect(states([step('c1', 'running')], STOPPED)).toEqual(['cut']);
    expect(states([step('c1', 'notRun')], STOPPED)).toEqual(['cut']);
    expect(states([step('c1', 'refused')], FINISHED)).toEqual(['fail']);
  });
});

describe('the run as a whole', () => {
  const steps = [step('c1', 'done'), text('Words.'), step('c2', 'done')];
  const total = (parts: RunPart[], state: RunState, elapsedMs = 2300) =>
    describeRunTotal(listRunTimeline(parts, state), state, elapsedMs);
  const aloud = (parts: RunPart[], state: RunState) =>
    describeRunAloud(listRunTimeline(parts, state), state, 2300);

  it('totals every line once it ends, with its time from a second up', () => {
    expect(total(steps, FINISHED)).toBe('2 steps · 2.3s');
    expect(total(steps, FINISHED, 900)).toBe('2 steps');
    expect(total(steps, RUNNING)).toBeNull();
    expect(total([text('Words.')], FINISHED)).toBeNull();
  });

  it('says who stopped it, and counts what finished', () => {
    const cut = [step('c1', 'done'), step('c2', 'running')];
    expect(total(cut, STOPPED)).toBe('Stopped by you after 1 step · 2.3s');
    expect(total(cut, FAILED)).toBe('1 step · 2.3s');
    expect(total([step('c1', 'running')], STOPPED)).toBeNull();
  });

  it('tells a screen reader the start and the end only', () => {
    expect(aloud(steps, RUNNING)).toBe('Working');
    expect(aloud(steps, FINISHED)).toBe('Done. 2 steps, 2.3 seconds');
    expect(aloud([text('Words.')], FINISHED)).toBe('Done');
    expect(aloud([step('c1', 'running')], STOPPED)).toBe('Stopped after 0 steps');
  });

  it('waits on the model before anything, and after a step or a think, not during', () => {
    expect(isWaitingForModel([], RUNNING)).toBe(true);
    expect(isWaitingForModel([step('c1', 'done')], RUNNING)).toBe(true);
    expect(isWaitingForModel([think(500)], RUNNING)).toBe(true);
    expect(isWaitingForModel([step('c1', 'running')], RUNNING)).toBe(false);
    expect(isWaitingForModel([think(null)], RUNNING)).toBe(false);
    expect(isWaitingForModel([text('Words.')], RUNNING)).toBe(false);
    expect(isWaitingForModel([step('c1', 'done')], FINISHED)).toBe(false);
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
