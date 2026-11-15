import { describe, expect, it } from 'vitest';
import { parseToolArguments, UNREAD_ARGUMENTS_MAX_CHARS } from '../parseToolArguments';

describe('parseToolArguments', () => {
  it('parses arguments that are JSON', () => {
    expect(parseToolArguments('{"id":"b1","text":"Led billing"}')).toEqual({
      id: 'b1',
      text: 'Led billing',
    });
  });

  it('reads nothing written as a call with no arguments', () => {
    expect(parseToolArguments('')).toEqual({});
  });

  it('keeps parsed arguments whole, however long they are', () => {
    const text = 'Led billing. '.repeat(1000);
    expect(parseToolArguments(JSON.stringify({ id: 'b1', text }))).toEqual({ id: 'b1', text });
  });

  it('keeps short arguments that are not JSON as the model wrote them', () => {
    expect(parseToolArguments('{"id": "b1", "text": ')).toBe('{"id": "b1", "text": ');
  });

  it('keeps only the start of long arguments that are not JSON', () => {
    const written = `{"}${'Rewrite the bullet. '.repeat(4000)}`;
    const kept = parseToolArguments(written);
    expect(kept).toBe(written.slice(0, UNREAD_ARGUMENTS_MAX_CHARS));
  });

  it('keeps only the start of a long JSON string, which is not an object of arguments', () => {
    const text = 'Rewrite the bullet. '.repeat(4000);
    expect(parseToolArguments(JSON.stringify(text))).toBe(
      text.slice(0, UNREAD_ARGUMENTS_MAX_CHARS)
    );
  });
});
