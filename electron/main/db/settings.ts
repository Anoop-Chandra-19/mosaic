import type { Database } from 'better-sqlite3';

/** The template the editor last had open. */
export const ACTIVE_TEMPLATE_KEY = 'app.activeTemplateId';

interface SettingRow {
  key: string;
  value: string;
}

export function getSetting(db: Database, key: string): string | null {
  const row = db
    .prepare<[string], SettingRow>('select key, value from settings where key = ?')
    .get(key);
  return row?.value ?? null;
}

export function setSetting(db: Database, key: string, value: string): void {
  db.prepare(
    'insert into settings (key, value) values (?, ?) on conflict (key) do update set value = excluded.value'
  ).run(key, value);
}

export function removeSetting(db: Database, key: string): void {
  db.prepare('delete from settings where key = ?').run(key);
}

export function allSettings(db: Database): Record<string, string> {
  const rows = db.prepare<[], SettingRow>('select key, value from settings').all();
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}
