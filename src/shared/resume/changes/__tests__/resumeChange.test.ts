import { describe, expect, it } from 'vitest';
import { countChangesByTone, getChangeGroup, getChangeTone } from '../resumeChange';
import { createChange } from './changeFixtures';

describe('change tone and group', () => {
  it('reads a short field by what it lost or gained', () => {
    expect(getChangeTone(createChange({ kind: 'subtitle', from: '', to: '2024' }))).toBe('add');
    expect(getChangeTone(createChange({ kind: 'subtitle', from: '2024', to: '' }))).toBe('del');
    expect(getChangeTone(createChange({ kind: 'subtitle', from: '2023', to: '2024' }))).toBe(
      'edit'
    );
  });

  it('reads a toggle by which side has it on the page', () => {
    expect(getChangeTone(createChange({ kind: 'toggle', isOnPage: true }))).toBe('add');
    expect(getChangeTone(createChange({ kind: 'toggle', isOnPage: false }))).toBe('del');
    expect(
      countChangesByTone([
        createChange({ kind: 'add' }),
        createChange({ kind: 'remove' }),
        createChange({ kind: 'reorder' }),
      ])
    ).toEqual({ add: 1, del: 1, edit: 1 });
  });

  it('groups by where, less the bullet or line', () => {
    expect(getChangeGroup(createChange({ where: 'Work History › Analyst › bullet 3' }))).toBe(
      'Work History › Analyst'
    );
    expect(getChangeGroup(createChange({ where: 'Skills › line 2' }))).toBe('Skills');
    expect(getChangeGroup(createChange({ where: '' }))).toBe('Header');
  });
});
