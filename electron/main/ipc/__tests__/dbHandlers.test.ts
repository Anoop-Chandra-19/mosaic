import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultResume } from '@/lib/resume/defaultResume';
import type { DbResult, TemplateSummary } from '@/types/db';
import { DB_METHODS } from '../../../shared/dbMethods';
import { openDatabase, type Database } from '../../db/connection';
import { createDbHandlers, handlerFor, settle, type Handlers } from '../dbHandlers';
import type { MosaicDb } from '@/types/db';

let db: Database;
let handlers: Handlers<MosaicDb>;

beforeEach(() => {
  db = openDatabase(':memory:');
  handlers = createDbHandlers(db);
});

afterEach(() => {
  db.close();
  vi.restoreAllMocks();
});

/** A call as the renderer makes it: arguments straight off IPC, outcome as a DbResult. */
function call(method: (typeof DB_METHODS)[number], ...args: unknown[]): DbResult<unknown> {
  return settle(() => handlerFor(handlers, method)(...args));
}

function methodPaths(node: object, prefix = ''): string[] {
  return Object.entries(node).flatMap(([key, value]) =>
    typeof value === 'function' ? [prefix + key] : methodPaths(value, `${prefix}${key}.`)
  );
}

describe('db handlers', () => {
  it('answer exactly the methods the preload exposes', () => {
    expect(methodPaths(handlers).sort()).toEqual([...DB_METHODS].sort());
  });

  it('return values wrapped as a successful result', () => {
    const created = call('templates.create', 'Backend', createDefaultResume());
    expect(created).toMatchObject({ ok: true, value: { name: 'Backend', versionCount: 1 } });

    const { id } = (created as { value: TemplateSummary }).value;
    expect(call('templates.open', id)).toMatchObject({ ok: true, value: { templateId: id } });
  });

  it('keep the code of a refusal the UI can explain', () => {
    expect(call('templates.open', 'missing')).toMatchObject({ ok: false, code: 'not-found' });

    const { value } = call('templates.create', 'Backend', createDefaultResume()) as {
      value: TemplateSummary;
    };
    expect(call('drafts.save', value.id, createDefaultResume(), 3)).toEqual({
      ok: true,
      value: undefined,
    });
    expect(call('drafts.save', value.id, createDefaultResume(), 2)).toMatchObject({
      ok: false,
      code: 'stale-rev',
    });
  });

  it('check every argument before touching the database', () => {
    const doc = createDefaultResume();
    const refusals: [(typeof DB_METHODS)[number], ...unknown[]][] = [
      ['templates.create', '', doc],
      ['templates.create', '   ', doc],
      ['templates.create', 'x'.repeat(201), doc],
      ['templates.create', 'Backend', { ...doc, sections: 'none' }],
      ['templates.create', 'Backend', doc, 42],
      ['templates.rename', 7, 'Backend'],
      ['drafts.save', 'id', doc, -1],
      ['drafts.save', 'id', doc, 1.5],
      ['drafts.save', 'id', doc, '2'],
      ['settings.set', 'ui', { darkMode: true }],
    ];
    for (const [method, ...args] of refusals) {
      expect(call(method, ...args), `${method}(${JSON.stringify(args)})`).toMatchObject({
        ok: false,
        code: 'invalid-argument',
      });
    }
    expect(db.prepare('select count(*) from templates').pluck().get()).toBe(0);
  });

  it('leave an optional argument out', () => {
    expect(call('templates.create', 'Backend', createDefaultResume(), undefined)).toMatchObject({
      ok: true,
      value: { head: { source: 'create' } },
    });
  });

  it('log an unexpected failure and report it as internal', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    db.close();

    expect(call('templates.list')).toMatchObject({ ok: false, code: 'internal' });
    expect(error).toHaveBeenCalled();
    db = openDatabase(':memory:');
  });
});
