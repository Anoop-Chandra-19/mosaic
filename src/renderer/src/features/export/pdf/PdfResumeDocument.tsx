import { Fragment } from 'react';
import { Document, Font, Link, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { PaperSize } from '@/types/paper';
import type { NormalizedResumeExport } from '../normalizeResumeExport';
import { HEADLESS_LAYOUT, getPageContentSizePt } from '@/lib/resume/headlessLayout';
import { breakLinesLikeWord, breakRunsLikeWord, type MeasureTextWidth } from './breakLinesLikeWord';
import { LINK_BLUE } from '@shared/resume/resumeHeader';
import { getEntryHeadingWidthPt } from './entryHeadingWidth';

/** Text widths at the body's and the header lines' sizes. */
export interface PdfTextMeasurers {
  body: MeasureTextWidth;
  contact: MeasureTextWidth;
}

interface PdfResumeDocumentProps {
  data: NormalizedResumeExport;
  paperSize: PaperSize;
  /** Breaks text into lines as Word does; without them, react-pdf breaks lines itself. */
  measurers?: PdfTextMeasurers | null;
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
 * - a section title or an entry's italic line never ends a page on its own: it sits in one
 *   unbreakable block with the first bullet. `minPresenceAhead` can't do this, since it is
 *   satisfied by room for part of a bullet that then can't split;
 * - a paragraph section's title needs its first paragraph's opening lines below it, two at
 *   most, since a paragraph splits by line keeping two on each side as Word does
 *   (`minPresenceAhead` works there).
 */
const BULLET_SPLITS_ACROSS_PAGES = false;
const MIN_LINES_AT_BREAK = 2;

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
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    fontFamily: FONT_ITALIC,
    fontSize: LYT.bodyFontSize,
    lineHeight: LYT.bodyLineHeight,
  },
  entryDates: {
    flexShrink: 0,
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

export function PdfResumeDocument({ data, paperSize, measurers }: PdfResumeDocumentProps) {
  const size = paperSize === 'a4' ? 'A4' : 'LETTER';
  const textWidth = getPageContentSizePt(paperSize).width;
  const bulletWidth = textWidth - LYT.bulletTextIndent;
  const breakLines = (text: string, width: number) =>
    measurers ? breakLinesLikeWord(text, width, measurers.body) : text;
  const breakHeaderLine = (line: NormalizedResumeExport['contact']['lines'][number]) => {
    const runs = line.items.flatMap((item, index) => [
      ...(index > 0
        ? [{ text: line.separator, href: undefined, key: `${item.id}-before`, isSeparator: true }]
        : []),
      { text: item.text, href: item.href, key: item.id, isSeparator: false },
    ]);
    return measurers
      ? breakRunsLikeWord(runs, textWidth, measurers.contact)
      : runs.map((run) => ({ ...run, startsLine: false }));
  };
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
              {breakHeaderLine(line).map((run, index) => (
                <Fragment key={`${run.key}-${index}`}>
                  {run.startsLine && '\n'}
                  {/* The printed text carries the link; it looks like the text around it
                      unless the header asks for underlined or blue links. */}
                  {run.href ? (
                    <Link src={run.href} style={linkStyle}>
                      {run.text}
                    </Link>
                  ) : run.isSeparator ? (
                    preserveSpaceRuns(run.text)
                  ) : (
                    run.text
                  )}
                </Fragment>
              ))}
            </Text>
          ))}
        </View>

        {data.sections.map((section, sectionIndex) => {
          const sectionStyle =
            sectionIndex === 0 ? [styles.section, styles.firstSection] : styles.section;
          const title = <Text style={styles.sectionTitle}>{section.label}</Text>;
          // Always stays behind, so a section that starts a page is split rather than moved
          // whole, and the split drops its blank line there, as Word does.
          const staysBehind = <View />;

          if (section.layout === 'lines') {
            const firstParagraphLines = section.entries[0]
              ? breakLines(section.entries[0].text, textWidth).split('\n').length
              : 0;
            // Without measurements a paragraph's length is unknown, so it asks for the most.
            const linesUnderTitle = measurers
              ? Math.min(MIN_LINES_AT_BREAK, firstParagraphLines)
              : MIN_LINES_AT_BREAK;
            return (
              <View key={section.id} style={sectionStyle}>
                {staysBehind}
                <Text
                  style={styles.sectionTitle}
                  minPresenceAhead={LYT.bodyLeading * linesUnderTitle}
                >
                  {section.label}
                </Text>
                <View style={styles.textOnlySectionBody}>
                  {section.entries.map((entry, entryIndex) => (
                    <Text
                      key={entry.id}
                      style={
                        entryIndex === section.entries.length - 1
                          ? [styles.textOnlyEntry, styles.lastTextOnlyEntry]
                          : styles.textOnlyEntry
                      }
                    >
                      {breakLines(entry.text, textWidth)}
                    </Text>
                  ))}
                </View>
              </View>
            );
          }

          // One flat list, with no wrapper per entry: nested in wrappers, an unbreakable block
          // that doesn't fit stays at the page foot, drawn over itself.
          return (
            <View key={section.id} style={sectionStyle}>
              {staysBehind}
              {section.entries.length === 0 && title}
              {section.entries.flatMap((entry, entryIndex) => {
                const bulletRows = entry.bullets.map((bullet, index) => (
                  <View
                    key={`${entry.id}-${index}`}
                    wrap={BULLET_SPLITS_ACROSS_PAGES}
                    style={styles.bulletRow}
                  >
                    <Text style={styles.bulletMarker}>{'\u2022'}</Text>
                    <Text style={styles.bulletText}>{breakLines(bullet, bulletWidth)}</Text>
                  </View>
                ));
                return [
                  <View key={entry.id} wrap={false}>
                    {entryIndex === 0 && title}
                    {entry.heading || entry.dates ? (
                      <View
                        style={
                          entry.bullets.length > 0
                            ? [styles.entryHeading, styles.entryHeadingWithBullets]
                            : styles.entryHeading
                        }
                      >
                        <Text style={styles.entryTitle}>
                          {measurers
                            ? breakLinesLikeWord(
                                entry.heading,
                                getEntryHeadingWidthPt(paperSize, entry.dates, measurers.body),
                                measurers.body
                              )
                            : entry.heading}
                        </Text>
                        <Text style={styles.entryDates}>{entry.dates}</Text>
                      </View>
                    ) : null}
                    {bulletRows[0]}
                  </View>,
                  ...bulletRows.slice(1),
                ];
              })}
            </View>
          );
        })}
      </Page>
    </Document>
  );
}
