import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDefaultResume } from '@shared/resume/defaultResume';
import { openDatabase, type Database } from '../../connection';
import { createTemplate, removeTemplate } from '../../resumes/templates';
import { createConversation, deleteConversation, readConversationPage } from '../conversations';
import { appendMessage } from '../messages';
import { startRun } from '../runs';

const MODEL = { provider: 'ollama', model: 'qwen3.5:9b' };

let db: Database;

beforeEach(() => {
  db = openDatabase(':memory:');
});

afterEach(() => db.close());

function ask(conversationId: number, text: string, templateId: string | null = null) {
  const run = startRun(db, { conversationId, templateId, ...MODEL });
  appendMessage(db, {
    conversationId,
    runId: run.id,
    body: { type: 'user', text, resume: [], isLimit: false },
  });
  return run.id;
}

function startConversation(text: string, templateId: string | null = null) {
  const conversationId = createConversation(db, MODEL);
  return { conversationId, runId: ask(conversationId, text, templateId) };
}

const setLastActive = (conversationId: number, at: number) =>
  db.prepare('update conversations set updated_at = ? where id = ?').run(at, conversationId);

describe('readConversationPage', () => {
  it('reads most recently active first, in pages that split conversations active together', () => {
    const ids = ['Oldest', 'Tied', 'Tied too', 'Newest'].map(
      (text) => startConversation(text).conversationId
    );
    [100, 200, 200, 300].forEach((at, index) => setLastActive(ids[index], at));

    const first = readConversationPage(db, { limit: 2 });
    const second = readConversationPage(db, {
      limit: 2,
      after: { lastActiveAt: first[1].lastActiveAt, id: first[1].id },
    });

    expect([...first, ...second].map(({ title }) => title)).toEqual([
      'Newest',
      'Tied too',
      'Tied',
      'Oldest',
    ]);
  });

  it('names a conversation by the start of its first ask', () => {
    const { conversationId } = startConversation(`Cut Projects. ${'word '.repeat(200)}`);
    ask(conversationId, 'And the summary.');

    const [{ title }] = readConversationPage(db, { limit: 1 });
    expect(title).toMatch(/^Cut Projects\./);
    expect(title).toHaveLength(300);
  });

  it('lists the resumes still there, last worked on first, each once', () => {
    const template = (name: string) => createTemplate(db, name, createDefaultResume()).id;
    const [base, striped, lantern] = ['Base resume', 'Striped backend', 'Lantern Geo'].map(
      template
    );
    const { conversationId } = startConversation('First.', base);
    ask(conversationId, 'Second.', striped);
    ask(conversationId, 'Third.', base);
    ask(conversationId, 'Fourth.', lantern);
    ask(conversationId, 'With none open.');
    removeTemplate(db, lantern);

    expect(readConversationPage(db, { limit: 1 })[0].resumes).toEqual([
      'Base resume',
      'Striped backend',
    ]);
  });

  it('has no resumes when no run had one', () => {
    startConversation('A general question.');
    expect(readConversationPage(db, { limit: 1 })[0].resumes).toEqual([]);
  });

  it('gives a stop only while it is the last thing in the log', () => {
    const { conversationId, runId } = startConversation('Tighten these.');
    const body = { type: 'runStopped', reason: 'stepLimit' } as const;
    appendMessage(db, { conversationId, runId, body });

    expect(readConversationPage(db, { limit: 1 })[0].stop).toEqual({ body, runModel: MODEL });

    ask(conversationId, 'Carry on.');
    expect(readConversationPage(db, { limit: 1 })[0].stop).toBeNull();
  });
});

describe('deleteConversation', () => {
  it('removes everything under the conversation and leaves the others', () => {
    const { conversationId } = startConversation('Goes.');
    const { conversationId: kept } = startConversation('Stays.');

    deleteConversation(db, conversationId);

    const count = (table: string) =>
      db
        .prepare<[number], number>(`select count(*) from ${table} where conversation_id = ?`)
        .pluck();
    expect(count('runs').get(conversationId)).toBe(0);
    expect(count('messages').get(conversationId)).toBe(0);
    expect(count('messages').get(kept)).toBe(1);
  });

  it('refuses one that isn’t there', () => {
    expect(() => deleteConversation(db, 999)).toThrow('No conversation');
  });

  it('leaves none of its words in the database’s files', () => {
    const folder = mkdtempSync(join(tmpdir(), 'mosaic-delete-'));
    const path = join(folder, 'mosaic.db');
    const fileDb = openDatabase(path);
    const words = 'Rowan Vale asked about the Harbor Freight entry';
    const readFiles = () =>
      ['', '-wal']
        .map((suffix) => {
          try {
            return readFileSync(path + suffix, 'latin1');
          } catch {
            return '';
          }
        })
        .join('');
    try {
      const conversationId = createConversation(fileDb, MODEL);
      const run = startRun(fileDb, { conversationId, templateId: null, ...MODEL });
      appendMessage(fileDb, {
        conversationId,
        runId: run.id,
        body: { type: 'user', text: words, resume: [], isLimit: false },
      });
      expect(readFiles()).toContain(words);

      deleteConversation(fileDb, conversationId);

      expect(readFiles()).not.toContain(words);
    } finally {
      fileDb.close();
      rmSync(folder, { recursive: true, force: true });
    }
  });
});
