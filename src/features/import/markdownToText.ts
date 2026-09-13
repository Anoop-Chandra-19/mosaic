/**
 * A Markdown resume as the plain text `parseResumeText` reads: heading marks, emphasis,
 * rules, and escapes go; a link keeps its text and its address. List markers stay — the
 * parser takes them as bullets.
 */
export function markdownToText(markdown: string): string {
  return markdown
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) =>
      line
        .replace(/^\s{0,3}#{1,6}\s+/, '')
        .replace(/\s+#+\s*$/, '')
        .replace(/^\s{0,3}(?:[-*_]\s*){3,}$/, '')
        .replace(/!?\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, (_, text: string, url: string) =>
          !text || text === url || url.endsWith(text) ? url : `${text} ${url}`
        )
        .replace(/(\*\*|__)(?=\S)(.+?)(?<=\S)\1/g, '$2')
        .replace(/(?<![\w*])\*(?=\S)(.+?)(?<=\S)\*(?![\w*])/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        // Any escaped ASCII punctuation, as CommonMark allows.
        .replace(/\\([!-/:-@[-`{-~])/g, '$1')
    )
    .join('\n');
}
