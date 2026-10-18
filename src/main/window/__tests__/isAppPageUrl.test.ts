import { describe, expect, it } from 'vitest';
import { isAppPageUrl } from '../isAppPageUrl';

const DEV_SERVER = 'http://localhost:5173';

describe('isAppPageUrl', () => {
  it('accepts the built page', () => {
    expect(isAppPageUrl('file:///opt/Mosaic/out/renderer/index.html', undefined)).toBe(true);
  });

  it('accepts the dev server only during dev', () => {
    expect(isAppPageUrl('http://localhost:5173/', DEV_SERVER)).toBe(true);
    expect(isAppPageUrl('http://localhost:5173/', undefined)).toBe(false);
  });

  it('refuses a blob: page, though it shares the dev server origin', () => {
    expect(isAppPageUrl('blob:http://localhost:5173/9b2f', DEV_SERVER)).toBe(false);
    expect(isAppPageUrl('blob:file:///9b2f', undefined)).toBe(false);
  });

  it('refuses other sites', () => {
    expect(isAppPageUrl('https://example.com/', DEV_SERVER)).toBe(false);
    expect(isAppPageUrl('http://localhost:5174/', DEV_SERVER)).toBe(false);
  });
});
