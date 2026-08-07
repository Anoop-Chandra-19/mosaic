/**
 * Page metrics for the "Headless Headhunter" resume format.
 *
 * Every number here was measured off the official Word template rather than
 * eyeballed, so the export lands on the same grid the format expects:
 *
 *   margins        0.5in top / 1in sides / 0.94in bottom  (the docx pgMar)
 *   body           10.5pt at 18.0pt leading               (Word "1.5 lines")
 *   bullets        18pt hanging indent, marker at 18pt from the margin
 *   sections       one blank body line above each header
 *
 * Word's "1.5 lines" multiplies the font's natural line height (~1.15x for
 * Arial), so 10.5pt renders at 18.0pt, not 15.75pt. That is why the multiplier
 * below is 1.714 and not 1.5 -- using 1.5 is what makes a rendering look
 * cramped next to the template.
 *
 * Shared by the PDF export and the on-screen preview so the two cannot drift.
 *
 * The preview renders these point values as CSS pixels at 1:1 and scales the
 * whole page visually, the way Chrome's PDF viewer does. Because the preview's
 * font stack (Arial / Liberation Sans / Helvetica) is metrically identical to
 * the PDF's Helvetica, the browser breaks lines at the same words the PDF does.
 * Reflowing the preview instead of scaling it is what breaks that guarantee.
 */

const BODY_FONT_SIZE = 10.5;
const BODY_LEADING = 18;

export const HEADLESS_LAYOUT = {
  // Page margins, in points, straight from the template's <w:pgMar>.
  marginTop: 36,
  marginSide: 72,
  marginBottom: 67.95,

  // Body text. lineHeight is a multiplier of fontSize in @react-pdf.
  bodyFontSize: BODY_FONT_SIZE,
  bodyLeading: BODY_LEADING,
  bodyLineHeight: BODY_LEADING / BODY_FONT_SIZE,

  // Header block runs tighter than the body (Word "1.15 lines"). The three
  // offsets below are measured off the template, which sits the name a line
  // below the top margin rather than flush against it.
  nameFontSize: 14,
  nameLineHeight: 1.15,
  nameMarginTop: 15,
  nameMarginBottom: 8,
  contactFontSize: 12,
  contactLineHeight: 16 / 12,
  headerMarginBottom: 18,

  // Entry (job / project) lines: italic, title left, dates right.
  entryHeadingGap: 14,
  entryHeadingMarginBottom: 4,
  entryMarginBottom: 5,

  // Bullet indents, measured from the text margin.
  bulletMarkerIndent: 18,
  bulletTextIndent: 36,

  // Black only. The format allows blue for links and nothing else.
  color: '#000000',

  // Metrically identical to the PDF's Helvetica. Arial first so viewers that
  // have it (Windows, macOS) see the font the format actually asks for.
  fontStack: 'Arial, "Liberation Sans", Helvetica, sans-serif',
} as const;

export type HeadlessLayout = typeof HEADLESS_LAYOUT;

/** Page sizes in points, matching @react-pdf's 'LETTER' and 'A4'. */
export const PAPER_SIZE_PT = {
  letter: { width: 612, height: 792 },
  a4: { width: 595.28, height: 841.89 },
} as const;

/** Usable area inside the margins, in points. */
export function getPageContentSizePt(paper: keyof typeof PAPER_SIZE_PT) {
  const { width, height } = PAPER_SIZE_PT[paper];
  return {
    width: width - HEADLESS_LAYOUT.marginSide * 2,
    height: height - HEADLESS_LAYOUT.marginTop - HEADLESS_LAYOUT.marginBottom,
  };
}
