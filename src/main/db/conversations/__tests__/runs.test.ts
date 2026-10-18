import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDefaultResume } from '@shared/resume/defaultResume';
import { openDatabase, type Database } from '../../connection';
import { createTemplate, removeTemplate } from '../../resumes/templates';
import { createConversation } from '../conversations';
import { appendMessage, readMessagePage } from '../messages';
import { finishRun, startRun } from '../runs';

let db: Database;
let conversationId: number;

beforeEach(() => {
  db = openDatabase(':memory:');
  conversationId = createConversation(db, { provider: 'ollama', model: 'qwen3.5:9b' });
});

afterEach(() => db.close());

const readRun = (id: number) =>
  db.prepare('select status, template_id, rev from runs where id = ?').get(id);

describe('startRun', () => {
  it('numbers the conversation’s runs and records the template’s rev', () => {
    const template = createTemplate(db, 'Platform, general', createDefaultResume());
    const first = startRun(db, {
      conversationId,
      templateId: template.id,
      provider: 'ollama',
      model: 'gpt-oss:20b',
    });
    finishRun(db, first.id, { status: 'done' });
    const second = startRun(db, {
      conversationId,
      templateId: null,
      provider: 'ollama',
      model: 'gpt-oss:20b',
    });

    expect([first.seq, second.seq]).toEqual([1, 2]);
    expect(readRun(first.id)).toEqual({
      status: 'done',
      template_id: template.id,
      rev: template.rev,
    });
    expect(readRun(second.id)).toEqual({ status: 'running', template_id: null, rev: null });
    expect(db.prepare('select model from conversations').pluck().get()).toBe('gpt-oss:20b');
  });

  it('refuses a template that isn’t there', () => {
    expect(() =>
      startRun(db, { conversationId, templateId: 'gone', provider: 'ollama', model: 'm' })
    ).toThrow(expect.objectContaining({ code: 'not-found' }));
    expect(db.prepare('select count(*) from runs').pluck().get()).toBe(0);
  });
});

describe('finishRun', () => {
  it('ends a run once', () => {
    const run = startRun(db, { conversationId, templateId: null, provider: 'ollama', model: 'm' });
    finishRun(db, run.id, { status: 'cancelled' });
    expect(() => finishRun(db, run.id, { status: 'done' })).toThrow(
      expect.objectContaining({ code: 'not-found' })
    );
  });
});

describe('deleting a template', () => {
  it('keeps the conversation that worked on it', () => {
    const template = createTemplate(db, 'Platform, general', createDefaultResume());
    const run = startRun(db, {
      conversationId,
      templateId: template.id,
      provider: 'ollama',
      model: 'm',
    });
    appendMessage(db, {
      conversationId,
      runId: run.id,
      body: { type: 'user', text: 'Tighten these.', resume: [], isLimit: false },
    });

    removeTemplate(db, template.id);

    expect(readRun(run.id)).toMatchObject({ template_id: null });
    expect(readMessagePage(db, conversationId, { limit: 10 })).toHaveLength(1);
  });
});
