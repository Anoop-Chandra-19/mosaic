import type { Database } from 'better-sqlite3';
import type { BootState } from '@shared/types/db';
import { ACTIVE_TEMPLATE_KEY, allSettings, getSetting, removeSetting } from './settings';
import { listTemplates, openTemplate } from './templates';

/**
 * Everything the renderer needs before its first paint. With no templates — a new
 * install, or every template deleted — there is no draft, and the editor shows its
 * empty state (start blank, from the example, or from an import).
 */
export function readBootState(db: Database): BootState {
  return db.transaction(() => {
    const templates = listTemplates(db);
    if (templates.length === 0) {
      removeSetting(db, ACTIVE_TEMPLATE_KEY);
      return { settings: allSettings(db), templates, draft: null };
    }

    // The template open at last quit, unless it is gone — then the most recently edited.
    const active = getSetting(db, ACTIVE_TEMPLATE_KEY);
    const templateId = templates.some((t) => t.id === active)
      ? active!
      : templates.reduce((latest, t) => (t.updatedAt > latest.updatedAt ? t : latest)).id;

    const draft = openTemplate(db, templateId);
    return { settings: allSettings(db), templates, draft };
  })();
}
