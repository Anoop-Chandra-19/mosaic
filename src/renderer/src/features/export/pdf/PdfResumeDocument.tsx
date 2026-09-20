import { Fragment } from 'react';
import { Document, Font, Link, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { PaperSize } from '@/types/paper';
import type { NormalizedResumeExport } from '../normalizeResumeExport';
import { HEADLESS_LAYOUT } from '@/lib/resume/headlessLayout';
import { LINK_BLUE } from '@shared/resume/resumeHeader';

interface PdfResumeDocumentProps {
  data: NormalizedResumeExport;
  paperSize: PaperSize;
}

const LYT = HEADLESS_LAYOUT;

// Helvetica is one of the 14 fonts built into every PDF reader and is metrically
// identical to Arial, so lines wrap at the same points without shipping a font file.
const FONT = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';
const FONT_ITALIC = 'Helvetica-Oblique';

// Words are never split across lines. Left to itself react-pdf hyphenates ("cus-" /
// "tomers"): an ATS then reads a word that isn't there, and the preview, which doesn't
// hyphenate, breaks lines at different words than the PDF.
Font.registerHyphenationCallback((word) => [word]);

const NO_BREAK_SPACE = String.fromCharCode(0xa0);

/**
 * Where pages break. Left to itself react-pdf splits a bullet's text across pages and leaves
 * the marker behind on the first one. Two rules stop that, and they are the preview's rules
 * (`pagination.ts`), which is what makes the two agree — and Word's, so a resume breaks the
 * same wherever it is opened:
 * - a bullet moves to the next page whole (`wrap={false}` on its row);
 * - an entry's italic line never ends a page on its own: it needs a line of its bullets
 *   under it (`minPresenceAhead`) or the whole entry moves.
 */
const BULLET_SPLITS_ACROSS_PAGES = false;
const LINE_NEEDED_UNDER_ENTRY_HEADING = LYT.bodyLeading;

/**
 * A run of spaces as it is typed: react-pdf collapses ordinary ones into one, so they go in
 * as no-break spaces, which Helvetica sets the same width.
 */
const preserveSpaceRuns = (text: string) =>
  text.replace(/ {2,}/g, (spaces) => NO_BREAK_SPACE.repeat(spaces.length));

const styles = StyleSheet.create({
  page: {
    paddingTop: LYT.marginTop,
    paddingBottom: LYT.marginBottom,
    paddingHorizontal: LYT.marginSide,
    fontFamily: FONT,
    color: LYT.color,
    fontSize: LYT.bodyFontSize,
  },
  header: {
    marginBottom: LYT.headerMarginBottom,
    textAlign: 'center',
  },
  name: {
    fontFamily: FONT_BOLD,
    fontSize: LYT.nameFontSize,
    lineHeight: LYT.nameLineHeight,
    marginTop: LYT.nameMarginTop,
    marginBottom: LYT.nameMarginBottom,
  },
  contactLine: {
    fontSize: LYT.contactFontSize,
    lineHeight: LYT.contactLineHeight,
    color: LYT.color,
  },
  // One blank body line above each section header, none above the first.
  section: {
    marginTop: LYT.bodyLeading,
  },
  firstSection: {
    marginTop: 0,
  },
  // Section headers are the only bold text below the name. No uppercase and no
  // letter-spacing: both mangle text extraction for ATS parsers.
  sectionTitle: {
    fontFamily: FONT_BOLD,
    fontSize: LYT.bodyFontSize,
    lineHeight: LYT.bodyLineHeight,
  },
  sectionBody: {
    marginTop: 0,
  },
  textOnlySectionBody: {
    marginTop: 0,
  },
  textOnlyEntry: {
    fontSize: LYT.bodyFontSize,
    lineHeight: LYT.bodyLineHeight,
  },
  lastTextOnlyEntry: {
    marginBottom: 0,
  },
  // No margin between entries: the blank line the format wants comes from the
  // 18pt grid, and anything extra accumulates into visible drift.
  entry: {
    marginBottom: 0,
  },
  // Job and project lines are italic, never bold.
  entryHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: LYT.entryHeadingGap,
  },
  // Only an entry that actually has bullets needs the gap under its title line.
  // Education rows have none, and the gap there pushes the next section off grid.
  // The page-break rules above say why the one with bullets reserves a line below it.
  entryHeadingWithBullets: {
    marginBottom: LYT.entryHeadingMarginBottom,
  },
  entryTitle: {
    fontFamily: FONT_ITALIC,
    fontSize: LYT.bodyFontSize,
    lineHeight: LYT.bodyLineHeight,
  },
  entryDates: {
    fontFamily: FONT_ITALIC,
    fontSize: LYT.bodyFontSize,
    lineHeight: LYT.bodyLineHeight,
    color: LYT.color,
    textAlign: 'right',
  },
  // Bullet spacing comes entirely from the 1.5-line leading. Adding margin here
  // is what makes a rendering drift away from the Word template.
  // marginLeft, not paddingLeft: padding leaves the row at full content width in
  // @react-pdf's flex, so the text runs past the right margin.
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginLeft: LYT.bulletMarkerIndent,
  },
  bulletMarker: {
    width: LYT.bulletTextIndent - LYT.bulletMarkerIndent,
    fontSize: LYT.bodyFontSize,
    lineHeight: LYT.bodyLineHeight,
  },
  // flexBasis 0 makes the text size from the row's free space. Left on `auto` it
  // sizes from its own unwrapped content and spills past the right margin.
  bulletText: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    fontSize: LYT.bodyFontSize,
    lineHeight: LYT.bodyLineHeight,
  },
});

export function PdfResumeDocument({ data, paperSize }: PdfResumeDocumentProps) {
  const size = paperSize === 'a4' ? 'A4' : 'LETTER';
  const name = data.contact.name || 'Mosaic Resume';
  const linkStyle = {
    color: data.contact.linkColor === 'blue' ? LINK_BLUE : LYT.color,
    textDecoration: data.contact.linkStyle === 'underline' ? 'underline' : 'none',
  } as const;

  return (
    <Document title={name}>
      <Page size={size} style={styles.page} wrap>
        {/* The name, then the header's lines. */}
        <View style={styles.header}>
          <Text style={styles.name}>{name}</Text>
          {data.contact.lines.map((line) => (
            <Text key={line.id} style={[styles.contactLine, { textAlign: line.align }]}>
              {line.items.map((item, index) => (
                <Fragment key={item.id}>
                  {index > 0 && preserveSpaceRuns(line.separator)}
                  {/* The printed text carries the link; it looks like the text around it
                      unless the header asks for underlined or blue links. */}
                  {item.href ? (
                    <Link src={item.href} style={linkStyle}>
                      {item.text}
                    </Link>
                  ) : (
                    item.text
                  )}
                </Fragment>
              ))}
            </Text>
          ))}
        </View>

        {data.sections.map((section, sectionIndex) => {
          const isTextOnly = section.layout === 'lines';

          return (
            <View
              key={section.id}
              style={sectionIndex === 0 ? [styles.section, styles.firstSection] : styles.section}
            >
              <Text style={styles.sectionTitle}>{section.label}</Text>
              <View style={isTextOnly ? styles.textOnlySectionBody : styles.sectionBody}>
                {section.entries.map((entry, entryIndex) => {
                  if (isTextOnly) {
                    const isLastTextEntry = entryIndex === section.entries.length - 1;
                    return (
                      <Text
                        key={entry.id}
                        style={
                          isLastTextEntry
                            ? [styles.textOnlyEntry, styles.lastTextOnlyEntry]
                            : styles.textOnlyEntry
                        }
                      >
                        {entry.text}
                      </Text>
                    );
                  }

                  return (
                    <View key={entry.id} style={styles.entry}>
                      {entry.heading || entry.dates ? (
                        <View
                          minPresenceAhead={
                            entry.bullets.length > 0 ? LINE_NEEDED_UNDER_ENTRY_HEADING : 0
                          }
                          style={
                            entry.bullets.length > 0
                              ? [styles.entryHeading, styles.entryHeadingWithBullets]
                              : styles.entryHeading
                          }
                        >
                          <Text style={styles.entryTitle}>{entry.heading}</Text>
                          <Text style={styles.entryDates}>{entry.dates}</Text>
                        </View>
                      ) : null}

                      {entry.bullets.map((bullet, index) => (
                        <View
                          key={`${entry.id}-${index}`}
                          wrap={BULLET_SPLITS_ACROSS_PAGES}
                          style={styles.bulletRow}
                        >
                          <Text style={styles.bulletMarker}>{'\u2022'}</Text>
                          <Text style={styles.bulletText}>{bullet}</Text>
                        </View>
                      ))}
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}
      </Page>
    </Document>
  );
}
