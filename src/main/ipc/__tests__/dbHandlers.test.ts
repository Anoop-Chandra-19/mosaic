import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultResume } from '@shared/resume/defaultResume';
import type { DbResult, TemplateSummary } from '@shared/types/db';
import { DB_METHODS } from '@shared/ipc/dbMethods';
import { openDatabase, type Database } from '../../db/connection';
import { createDbHandlers, handlerFor, settle, type Handlers } from '../dbHandlers';
import type { MosaicDb } from '@shared/types/db';
import type { MosaicBundle } from '@shared/types/bundle';

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
      ['versions.snapshot', 'id'],
      ['versions.snapshot', 'id', 'quit'],
      ['settings.set', 'ui', { darkMode: true }],
      // `app.` settings are main's own: where keys live, the template to reopen.
      ['settings.set', 'app.apiKeys', '{"location":"session","keychain":[]}'],
      ['settings.remove', 'app.activeTemplateId'],
      ['bundle.export', 'id'],
      ['bundle.export', [7]],
      ['bundle.import', { bundleVersion: 2, templates: [] }, 'as-new-template'],
      ['bundle.import', '{"bundleVersion":2,"templates":[]}', 'as-new-template'],
      ['bundle.import', 'not json', 'restore-all'],
    ];
    for (const [method, ...args] of refusals) {
      expect(call(method, ...args), `${method}(${JSON.stringify(args)})`).toMatchObject({
        ok: false,
        code: 'invalid-argument',
      });
    }
    expect(db.prepare('select count(*) from templates').pluck().get()).toBe(0);
  });

  it('carry a backup out as a bundle and back in from its text', () => {
    const { value: backend } = call('templates.create', 'Backend', createDefaultResume()) as {
      value: TemplateSummary;
    };
    const exported = call('bundle.export', [backend.id]) as { ok: true; value: MosaicBundle };
    expect(exported.value.templates.map((t) => t.template.name)).toEqual(['Backend']);

    const text = JSON.stringify(exported.value);
    expect(call('bundle.import', text, 'as-new-template')).toMatchObject({ ok: true });
    expect(call('bundle.import', text, 'merge')).toMatchObject({
      ok: false,
      code: 'invalid-argument',
    });
    expect(db.prepare('select count(*) from templates').pluck().get()).toBe(2);

    // A restore puts the file's templates back under their own ids, and only those.
    expect(call('bundle.import', text, 'restore-all')).toEqual({
      ok: true,
      value: { templateIds: [backend.id] },
    });
    expect(call('bundle.export', ['missing'])).toMatchObject({ ok: false, code: 'not-found' });
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
