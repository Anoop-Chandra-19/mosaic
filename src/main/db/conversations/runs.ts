import type { Database } from 'better-sqlite3';
import { StorageError } from '../storageError';

export interface NewRun {
  conversationId: number;
  /** The template open when it was sent; null with none open. */
  templateId: string | null;
  provider: string;
  model: string;
}

/** A run and the conversation whose log it writes to. */
export interface ConversationRun {
  conversationId: number;
  runId: number;
}

export interface StartedRun {
  id: number;
  /** Its number in the conversation, from 1. */
  seq: number;
}

/** Undefined once the template is gone. */
export function findTemplateRev(db: Database, templateId: string): number | undefined {
  return db
    .prepare<[string], number>('select rev from templates where id = ?')
    .pluck()
    .get(templateId);
}

function readTemplateRev(db: Database, templateId: string): number {
  const rev = findTemplateRev(db, templateId);
  if (rev === undefined) throw new StorageError('not-found', `No template with id ${templateId}`);
  return rev;
}

/** The conversation remembers the provider and model it was last used with. */
function useConversation(db: Database, run: NewRun, now: number): void {
  const { changes } = db
    .prepare('update conversations set provider = ?, model = ?, updated_at = ? where id = ?')
    .run(run.provider, run.model, now, run.conversationId);
  if (changes === 0) {
    throw new StorageError('not-found', `No conversation with id ${run.conversationId}`);
  }
}

/** A run starts against the template's rev at that moment; its reads go stale from it. */
export function startRun(db: Database, run: NewRun): StartedRun {
  return db.transaction(() => {
    const now = Date.now();
    useConversation(db, run, now);
    const rev = run.templateId === null ? null : readTemplateRev(db, run.templateId);
    return db
      .prepare<[Record<string, unknown>], StartedRun>(
        `insert into runs (conversation_id, seq, status, template_id, rev, provider, model, started_at)
         values (@conversationId,
                 (select coalesce(max(seq), 0) + 1 from runs where conversation_id = @conversationId),
                 'running', @templateId, @rev, @provider, @model, @now)
         returning id, seq`
      )
      .get({ ...run, rev, now })!;
  })();
}

/** The conversation's newest run, if it has one: the template it worked on, null for none. */
export function readLastRun(
  db: Database,
  conversationId: number
): { templateId: string | null } | undefined {
  return db
    .prepare<[number], { templateId: string | null }>(
      'select template_id as templateId from runs where conversation_id = ? order by seq desc limit 1'
    )
    .get(conversationId);
}

/** Each provider and model a run has used, the most recently used first. */
export function listUsedModels(db: Database): { provider: string; model: string }[] {
  return db
    .prepare<[], { provider: string; model: string }>(
      `select provider, model from runs
        group by provider, model
        order by max(started_at) desc, max(id) desc`
    )
    .all();
}

export interface RunEnd {
  status: 'done' | 'step_limit' | 'failed' | 'cancelled';
  error?: string;
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
}

/** Only a running run can end, so a run is never ended twice. */
export function finishRun(db: Database, runId: number, end: RunEnd): void {
  const { changes } = db
    .prepare(
      `update runs
          set status = ?, error = ?, input_tokens = ?, cached_input_tokens = ?,
              output_tokens = ?, finished_at = ?
        where id = ? and status = 'running'`
    )
    .run(
      end.status,
      end.error ?? null,
      end.inputTokens ?? null,
      end.cachedInputTokens ?? null,
      end.outputTokens ?? null,
      Date.now(),
      runId
    );
  if (changes === 0) throw new StorageError('not-found', `No running run with id ${runId}`);
}
