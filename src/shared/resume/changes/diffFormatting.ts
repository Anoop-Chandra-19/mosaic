import type { ResumeData } from '../../types/resume';
import { getPrintableHeaderLines } from '../resumeHeader';

export type FormattingSetting = 'linkStyle' | 'linkColor' | 'align' | 'separator';

export interface FormattingChange {
  setting: FormattingSetting;
  /** Alignment and separators belong to one header line; link settings to the whole page. */
  lineId: string | null;
  lineNumber: number | null;
  from: string;
  to: string;
}

/**
 * Only what shows on both pages counts: a thing printed on one side only is a content change,
 * and its look goes with it.
 */
export function diffFormatting(before: ResumeData, after: ResumeData): FormattingChange[] {
  const beforeHeader = before.contact.header;
  const afterHeader = after.contact.header;
  const beforeLines = getPrintableHeaderLines(beforeHeader);
  const afterLines = getPrintableHeaderLines(afterHeader);
  const changes: FormattingChange[] = [];

  const hasLink = (lines: typeof afterLines) =>
    lines.some((line) => line.items.some((item) => item.href));
  if (hasLink(beforeLines) && hasLink(afterLines)) {
    const page = { lineId: null, lineNumber: null };
    if (beforeHeader.linkStyle !== afterHeader.linkStyle) {
      changes.push({
        setting: 'linkStyle',
        ...page,
        from: beforeHeader.linkStyle,
        to: afterHeader.linkStyle,
      });
    }
    const beforeColor = beforeHeader.linkColor ?? 'ink';
    const afterColor = afterHeader.linkColor ?? 'ink';
    if (beforeColor !== afterColor) {
      changes.push({ setting: 'linkColor', ...page, from: beforeColor, to: afterColor });
    }
  }

  afterLines.forEach((line, index) => {
    const was = beforeLines.find((other) => other.id === line.id);
    if (!was) return;
    const onLine = { lineId: line.id, lineNumber: index + 1 };
    if (was.align !== line.align) {
      changes.push({ setting: 'align', ...onLine, from: was.align, to: line.align });
    }
    const hasSeparators = was.items.length > 1 && line.items.length > 1;
    if (hasSeparators && was.separator !== line.separator) {
      changes.push({ setting: 'separator', ...onLine, from: was.separator, to: line.separator });
    }
  });
  return changes;
}
