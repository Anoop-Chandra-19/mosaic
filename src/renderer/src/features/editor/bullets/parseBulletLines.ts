/** Lines of pasted text as bullets: blank lines and leading list marks dropped. */
export function parseBulletLines(raw: string): string[] {
  return raw
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) =>
      line
        .trim()
        .replace(/^[-*•]\s+/, '')
        .trim()
    )
    .filter(Boolean);
}
