import type { ContactInfo } from '@/types/resume';
import { HEADLESS_LAYOUT as L } from '@/lib/resume/headlessLayout';
import { getContactLines } from '@/lib/resume/contactFormatting';

interface PreviewHeaderProps {
  contact: ContactInfo;
}

/**
 * Three centered lines: name, contact, then citizenship status and location. First page
 * only, as in the PDF. Sizes are the PDF's point values rendered as pixels, so this block
 * occupies exactly the height it will occupy in the export.
 */
export function PreviewHeader({ contact }: PreviewHeaderProps) {
  const displayName = contact.name?.trim() || 'Your Name';
  const { primary: primaryLine, secondary: secondaryLine } = getContactLines(contact);

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
