import { Fragment } from 'react';
import { AppTooltip } from '@/components/AppTooltip';
import { HeaderLineBar, MarkedItem, MarkedLine } from '@/features/document-diff/PageMarkParts';
import { findMarks, LINE_GUTTER, type PageMarks } from '@/features/document-diff/pageMarks';
import type { ContactInfo } from '@shared/types/resume';
import { HEADLESS_LAYOUT as L } from '@/lib/resume/headlessLayout';
import {
  getPrintableHeaderLines,
  LINK_BLUE,
  type PrintedHeaderLine,
} from '@shared/resume/resumeHeader';
import { cn } from '@/lib/utils';

interface PreviewHeaderProps {
  contact: ContactInfo;
  /** A version being read: its name and items marked like the rest of the page. */
  marks?: PageMarks;
}

/**
 * The name, then the header's lines. First page only, as in the PDF. Sizes are the PDF's
 * point values rendered as pixels, so this block occupies exactly the height it will occupy
 * in the export. A link opens outside the app: main hands it to the system.
 */
export function PreviewHeader({ contact, marks }: PreviewHeaderProps) {
  const displayName = contact.name?.trim() || 'Your Name';
  const nameChanges = findMarks(marks, 'name', '');
  // A name that went prints the placeholder here; the mark strikes the one it had.
  const nameText = nameChanges[0]?.kind === 'remove' ? nameChanges[0].before : displayName;

  return (
    <header
      className="text-center"
      style={{
        fontFamily: L.fontStack,
        color: L.color,
        marginBottom: `${L.headerMarginBottom}px`,
      }}
      data-preview-header
    >
      <h1
        className={cn('font-bold', marks && 'relative')}
        style={{
          fontSize: `${L.nameFontSize}px`,
          lineHeight: L.nameLineHeight,
          marginTop: `${L.nameMarginTop}px`,
          marginBottom: `${L.nameMarginBottom}px`,
        }}
      >
        {marks ? (
          <MarkedLine
            changes={nameChanges}
            text={nameText}
            otherSide={marks.otherSide}
            gutter={LINE_GUTTER}
          />
        ) : (
          displayName
        )}
      </h1>
      {getPrintableHeaderLines(contact.header).map((line) => (
        <p
          key={line.id}
          className={cn(marks && 'relative')}
          style={{
            fontSize: `${L.contactFontSize}px`,
            lineHeight: L.contactLineHeight,
            textAlign: line.align,
          }}
        >
          {marks && (
            <HeaderLineBar
              changes={line.items.flatMap((item) => findMarks(marks, 'item', item.id))}
            />
          )}
          <HeaderLineItems contact={contact} line={line} marks={marks} />
        </p>
      ))}
    </header>
  );
}

function HeaderLineItems({
  contact,
  line,
  marks,
}: {
  contact: ContactInfo;
  line: PrintedHeaderLine;
  marks?: PageMarks;
}) {
  const underline = contact.header.linkStyle === 'underline';
  const isBlue = contact.header.linkColor === 'blue';
  return line.items.map((item, index) => {
    const change = marks && findMarks(marks, 'item', item.id)[0];
    return (
      <Fragment key={item.id}>
        {index > 0 && <span className="whitespace-pre">{line.separator}</span>}
        {change ? (
          // Marked, it says what changed on hover instead of where it links.
          <MarkedItem change={change} text={item.text} otherSide={marks.otherSide} />
        ) : item.href ? (
          <AppTooltip content={item.href}>
            <a
              href={item.href}
              target="_blank"
              rel="noreferrer"
              className={cn('text-inherit', underline ? 'underline' : 'no-underline')}
              style={isBlue ? { color: LINK_BLUE } : undefined}
            >
              {item.text}
            </a>
          </AppTooltip>
        ) : (
          item.text
        )}
      </Fragment>
    );
  });
}
