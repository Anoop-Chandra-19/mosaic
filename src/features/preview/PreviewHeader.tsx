import type { ContactInfo } from '@/types/resume';
import { HEADLESS_LAYOUT as L } from '@/lib/resume/headlessLayout';
import { getContactLines } from '@/lib/export/normalizeResumeExport';

interface PreviewHeaderProps {
  contact: ContactInfo;
  variant?: 'full' | 'compact';
  pageNumber?: number;
}

/**
 * Three centered lines: name, contact, then citizenship status and location.
 * Sizes are the PDF's point values rendered as pixels, so this block occupies
 * exactly the height it will occupy in the export.
 */
export function PreviewHeader({ contact, variant = 'full', pageNumber = 1 }: PreviewHeaderProps) {
  const displayName = contact.name?.trim() || 'Your Name';
  const { primary: primaryLine, secondary: secondaryLine } = getContactLines(contact);

  if (variant === 'compact') {
    const compactLine = primaryLine;

    return (
      <header
        style={{
          fontFamily: L.fontStack,
          color: L.color,
          marginBottom: `${L.bodyLeading}px`,
        }}
        data-preview-header
        data-preview-header-variant="compact"
      >
        <div
          className="flex items-baseline justify-between gap-3"
          style={{
            fontSize: `${L.bodyFontSize}px`,
            lineHeight: `${L.bodyLeading}px`,
          }}
        >
          <span className="truncate font-bold">{displayName}</span>
          <span>Page {pageNumber}</span>
        </div>
        {compactLine && (
          <p style={{ fontSize: `${L.bodyFontSize}px`, lineHeight: `${L.bodyLeading}px` }}>
            {compactLine}
          </p>
        )}
      </header>
    );
  }

  return (
    <header
      className="text-center"
      style={{
        fontFamily: L.fontStack,
        color: L.color,
        marginBottom: `${L.headerMarginBottom}px`,
      }}
      data-preview-header
      data-preview-header-variant="full"
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
      {primaryLine && (
        <p style={{ fontSize: `${L.contactFontSize}px`, lineHeight: L.contactLineHeight }}>
          {primaryLine}
        </p>
      )}
      {secondaryLine && (
        <p style={{ fontSize: `${L.contactFontSize}px`, lineHeight: L.contactLineHeight }}>
          {secondaryLine}
        </p>
      )}
    </header>
  );
}
