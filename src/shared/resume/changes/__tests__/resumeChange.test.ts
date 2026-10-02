import { describe, expect, it } from 'vitest';
import { countChangesByTone, getChangeGroup, getChangeTone } from '../resumeChange';
import { createChange } from './changeFixtures';

describe('change tone and group', () => {
  it('reads a short field by what it lost or gained', () => {
    expect(getChangeTone(createChange({ before: '', after: '2024' }))).toBe('add');
    expect(getChangeTone(createChange({ before: '2024', after: '' }))).toBe('del');
    expect(getChangeTone(createChange({ before: '2023', after: '2024' }))).toBe('edit');
  });

  it('reads a long text edit as an edit, whatever it lost or gained', () => {
    const phrases = [{ k: 'edit' as const, id: 'w0', del: '', ins: 'New' }];
    expect(getChangeTone(createChange({ before: '', after: 'New', phrases }))).toBe('edit');
  });

  it('reads showing and hiding by which side has it on the page', () => {
    expect(getChangeTone(createChange({ kind: 'show' }))).toBe('add');
    expect(getChangeTone(createChange({ kind: 'hide' }))).toBe('del');
    expect(
      countChangesByTone([
        createChange({ kind: 'add' }),
        createChange({ kind: 'remove' }),
        createChange({ kind: 'move' }),
      ])
    ).toEqual({ add: 1, del: 1, edit: 1 });
  });

  it('groups by path, less the bullet or line', () => {
    expect(getChangeGroup(createChange({ path: 'Work History › Analyst › bullet 3' }))).toBe(
      'Work History › Analyst'
    );
    expect(getChangeGroup(createChange({ path: 'Skills › line 2' }))).toBe('Skills');
    expect(getChangeGroup(createChange({ path: '' }))).toBe('Header');
  });
});
