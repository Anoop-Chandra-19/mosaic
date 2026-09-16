import { Fragment } from 'react';
import type { ContactInfo } from '@/types/resume';
import { HEADLESS_LAYOUT as L } from '@/lib/resume/headlessLayout';
import { printedHeaderLines } from '@/lib/resume/resumeHeader';
import { cn } from '@/lib/utils';

interface PreviewHeaderProps {
  contact: ContactInfo;
}

/**
 * The name, then the header's lines. First page only, as in the PDF. Sizes are the PDF's
 * point values rendered as pixels, so this block occupies exactly the height it will occupy
 * in the export. A link opens outside the app: main hands it to the system.
 */
export function PreviewHeader({ contact }: PreviewHeaderProps) {
  const displayName = contact.name?.trim() || 'Your Name';
  const underline = contact.header.linkStyle === 'underline';

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
        className="font-bold"
        style={{
          fontSize: `${L.nameFontSize}px`,
          lineHeight: L.nameLineHeight,
          marginTop: `${L.nameMarginTop}px`,
          marginBottom: `${L.nameMarginBottom}px`,
        }}
      >
        {displayName}
      </h1>
      {printedHeaderLines(contact.header).map((line) => (
        <p
          key={line.id}
          style={{
            fontSize: `${L.contactFontSize}px`,
            lineHeight: L.contactLineHeight,
            textAlign: line.align,
          }}
        >
          {line.items.map((item, index) => (
            <Fragment key={item.id}>
              {index > 0 && <span className="whitespace-pre">{line.separator}</span>}
              {item.href ? (
                <a
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  title={item.href}
                  className={cn('text-inherit', underline ? 'underline' : 'no-underline')}
                >
                  {item.text}
                </a>
              ) : (
                item.text
              )}
            </Fragment>
          ))}
        </p>
      ))}
    </header>
  );
}
