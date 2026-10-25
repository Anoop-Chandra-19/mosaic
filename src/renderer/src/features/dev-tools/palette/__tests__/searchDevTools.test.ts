import { describe, expect, it } from 'vitest';
import type { DevTool } from '../../tools/devTool';
import { searchDevTools } from '../searchDevTools';

const tool = (id: string, label: string, description: string): DevTool => ({
  id,
  group: 'Data',
  label,
  description,
  run: async () => '',
});

const TOOLS = [
  tool('clear', 'Clear staged suggestions', 'Drops what is waiting for review.'),
  tool('stage', 'Stage one of each suggestion', 'Every kind of suggestion, on the example resume.'),
  tool('example', 'Open the example resume', 'A fictional resume, Rowan Vale.'),
];

const ids = (query: string) => searchDevTools(TOOLS, query).map((match) => match.tool.id);

describe('searchDevTools', () => {
  it('matches every word in the name, group or description, in any case', () => {
    expect(ids('ROWAN')).toEqual(['example']);
    expect(ids('data vale')).toEqual(['example']);
    expect(ids('suggestion zzz')).toEqual([]);
  });

  it('puts a name that starts with the first word first, then one holding every word', () => {
    expect(ids('stage')).toEqual(['stage', 'clear']);
    expect(ids('example')).toEqual(['example', 'stage']);
  });

  it('marks each word found in the name', () => {
    const [match] = searchDevTools(TOOLS, 'resume open');
    expect(match.ranges).toEqual([
      [0, 4],
      [17, 23],
    ]);
  });

  it('matches nothing for an empty query', () => {
    expect(ids('   ')).toEqual([]);
  });
});
