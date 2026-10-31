import { Fragment } from 'react';
import { AppTooltip } from '@/components/ui-kit';
import type { ContactInfo } from '@shared/types/resume';
import { HEADLESS_LAYOUT as L } from '@/lib/resume/headlessLayout';
import {
  getPrintableHeaderLines,
  LINK_BLUE,
  type PrintedHeaderLine,
} from '@shared/resume/resumeHeader';
import { cn } from '@/lib/utils';
import type { PageDecorations } from './pageDecorations';

interface PreviewHeaderProps {
  contact: ContactInfo;
  decorations?: PageDecorations;
}

/**
 * The name, then the header's lines. First page only, as in the PDF. Sizes are the PDF's
 * point values rendered as pixels, so this block occupies exactly the height it will occupy
 * in the export. A link opens outside the app: main hands it to the system.
 */
export function PreviewHeader({ contact, decorations }: PreviewHeaderProps) {
  const displayName = contact.name?.trim() || 'Your Name';

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
        className={cn('font-bold', decorations && 'relative')}
        style={{
          fontSize: `${L.nameFontSize}px`,
          lineHeight: L.nameLineHeight,
          marginTop: `${L.nameMarginTop}px`,
          marginBottom: `${L.nameMarginBottom}px`,
        }}
      >
        {decorations?.name ? decorations.name(displayName) : displayName}
      </h1>
      {getPrintableHeaderLines(contact.header).map((line) => (
        <p
          key={line.id}
          className={cn(decorations && 'relative')}
          style={{
            fontSize: `${L.contactFontSize}px`,
            lineHeight: L.contactLineHeight,
            textAlign: line.align,
          }}
        >
          {decorations?.headerLine?.(line.items.map((item) => item.id))}
          <HeaderLineItems contact={contact} line={line} decorations={decorations} />
        </p>
      ))}
    </header>
  );
}

function HeaderLineItems({
  contact,
  line,
  decorations,
}: {
  contact: ContactInfo;
  line: PrintedHeaderLine;
  decorations?: PageDecorations;
}) {
  const underline = contact.header.linkStyle === 'underline';
  const isBlue = contact.header.linkColor === 'blue';
  return line.items.map((item, index) => {
    const printed = item.href ? (
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
    );
    return (
      <Fragment key={item.id}>
        {index > 0 && <span className="whitespace-pre">{line.separator}</span>}
        {decorations?.headerItem ? decorations.headerItem(item.id, printed, item.text) : printed}
      </Fragment>
    );
  });
}
