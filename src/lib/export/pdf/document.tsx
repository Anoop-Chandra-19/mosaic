import { Document, Font, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { PaperSize } from '@/types/ui';
import {
  getContactPrimaryLine,
  getContactSecondaryLine,
  type NormalizedResumeExport,
} from '@/lib/export/normalizeResumeExport';

interface PDFResumeDocumentProps {
  data: NormalizedResumeExport;
  paperSize: PaperSize;
}

interface PdfLayoutProfile {
  pagePaddingTopMm: number;
  pagePaddingBottomMm: number;
  pagePaddingHorizontalMm: number;
  bodyFontSize: number;
  headerMarginBottom: number;
  headerNameRowMarginBottom: number;
  headerContactRowMarginTop: number;
  nameFontSize: number;
  nameLineHeight: number;
  contactFontSize: number;
  contactLineHeight: number;
  sectionTop: number;
  firstSectionTop: number;
  sectionTitleFontSize: number;
  sectionTitleLineHeight: number;
  sectionTitlePaddingBottom: number;
  sectionBodyTop: number;
  textOnlySectionBodyTop: number;
  entryMarginBottom: number;
  entryHeadingGap: number;
  entryTitleFontSize: number;
  entryTitleLineHeight: number;
  entrySubtitleFontSize: number;
  entrySubtitleLineHeight: number;
  bulletMarginBottom: number;
  bulletMarkerWidth: number;
  bulletPaddingRight: number;
  bulletLineHeight: number;
}

const A4_PROFILE: PdfLayoutProfile = {
  pagePaddingTopMm: 12,
  pagePaddingBottomMm: 12,
  pagePaddingHorizontalMm: 12,
  bodyFontSize: 10,
  headerMarginBottom: 10,
  headerNameRowMarginBottom: 4,
  headerContactRowMarginTop: 1,
  nameFontSize: 24,
  nameLineHeight: 1.1,
  contactFontSize: 9.5,
  contactLineHeight: 1.3,
  sectionTop: 9,
  firstSectionTop: 6,
  sectionTitleFontSize: 9.5,
  sectionTitleLineHeight: 1.2,
  sectionTitlePaddingBottom: 2,
  sectionBodyTop: 5,
  textOnlySectionBodyTop: 3,
  entryMarginBottom: 6,
  entryHeadingGap: 2,
  entryTitleFontSize: 10.2,
  entryTitleLineHeight: 1.25,
  entrySubtitleFontSize: 9,
  entrySubtitleLineHeight: 1.2,
  bulletMarginBottom: 2,
  bulletMarkerWidth: 9,
  bulletPaddingRight: 3,
  bulletLineHeight: 1.35,
};

const LETTER_PROFILE: PdfLayoutProfile = {
  pagePaddingTopMm: 12,
  pagePaddingBottomMm: 12,
  pagePaddingHorizontalMm: 12,
  bodyFontSize: 10,
  headerMarginBottom: 10,
  headerNameRowMarginBottom: 4,
  headerContactRowMarginTop: 1,
  nameFontSize: 24,
  nameLineHeight: 1.1,
  contactFontSize: 9.5,
  contactLineHeight: 1.3,
  sectionTop: 9,
  firstSectionTop: 6,
  sectionTitleFontSize: 9.5,
  sectionTitleLineHeight: 1.2,
  sectionTitlePaddingBottom: 2,
  sectionBodyTop: 5,
  textOnlySectionBodyTop: 3,
  entryMarginBottom: 6,
  entryHeadingGap: 2,
  entryTitleFontSize: 10.2,
  entryTitleLineHeight: 1.25,
  entrySubtitleFontSize: 9,
  entrySubtitleLineHeight: 1.2,
  bulletMarginBottom: 2,
  bulletMarkerWidth: 9,
  bulletPaddingRight: 3,
  bulletLineHeight: 1.35,
};

let isSourceSerifRegistered = false;

function ensureSourceSerifFonts() {
  if (isSourceSerifRegistered) {
    return;
  }

  Font.register({
    family: 'SourceSerif4',
    fonts: [
      { src: '/fonts/source-serif-4/SourceSerif4-Regular.ttf', fontWeight: 400 },
      { src: '/fonts/source-serif-4/SourceSerif4-Bold.ttf', fontWeight: 700 },
    ],
  });

  isSourceSerifRegistered = true;
}

function mmToPt(mm: number) {
  return mm * 2.83464567;
}

function createStyles(profile: PdfLayoutProfile) {
  return StyleSheet.create({
    page: {
      paddingTop: mmToPt(profile.pagePaddingTopMm),
      paddingBottom: mmToPt(profile.pagePaddingBottomMm),
      paddingHorizontal: mmToPt(profile.pagePaddingHorizontalMm),
      fontFamily: 'SourceSerif4',
      color: '#18181b',
      fontSize: profile.bodyFontSize,
    },
    header: {
      marginBottom: profile.headerMarginBottom,
      textAlign: 'center',
    },
    headerNameRow: {
      marginBottom: profile.headerNameRowMarginBottom,
    },
    headerContactRow: {
      marginTop: profile.headerContactRowMarginTop,
    },
    name: {
      fontSize: profile.nameFontSize,
      lineHeight: profile.nameLineHeight,
      fontFamily: 'SourceSerif4',
      fontWeight: 700,
    },
    contactLine: {
      fontSize: profile.contactFontSize,
      lineHeight: profile.contactLineHeight,
      color: '#3f3f46',
    },
    section: {
      marginTop: profile.sectionTop,
    },
    firstSection: {
      marginTop: profile.firstSectionTop,
    },
    sectionTitle: {
      fontFamily: 'SourceSerif4',
      fontWeight: 700,
      fontSize: profile.sectionTitleFontSize,
      lineHeight: profile.sectionTitleLineHeight,
      textTransform: 'uppercase',
      letterSpacing: 0.9,
      paddingBottom: profile.sectionTitlePaddingBottom,
      borderBottomWidth: 1,
      borderBottomColor: '#d4d4d8',
    },
    sectionBody: {
      marginTop: profile.sectionBodyTop,
    },
    textOnlySectionBody: {
      marginTop: profile.textOnlySectionBodyTop,
    },
    textOnlyEntry: {
      marginBottom: profile.bulletMarginBottom,
      fontSize: profile.bodyFontSize,
      lineHeight: profile.bulletLineHeight,
    },
    lastTextOnlyEntry: {
      marginBottom: 0,
    },
    entry: {
      marginBottom: profile.entryMarginBottom,
    },
    entryHeading: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 8,
      marginBottom: profile.entryHeadingGap,
    },
    entryTitle: {
      fontFamily: 'SourceSerif4',
      fontWeight: 700,
      fontSize: profile.entryTitleFontSize,
      lineHeight: profile.entryTitleLineHeight,
    },
    entrySubtitle: {
      fontSize: profile.entrySubtitleFontSize,
      lineHeight: profile.entrySubtitleLineHeight,
      color: '#52525b',
      textAlign: 'right',
    },
    bulletRow: {
      marginBottom: profile.bulletMarginBottom,
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingRight: profile.bulletPaddingRight,
    },
    bulletMarker: {
      width: profile.bulletMarkerWidth,
      fontSize: profile.bodyFontSize,
      lineHeight: profile.bulletLineHeight,
    },
    bulletText: {
      flexGrow: 1,
      flexShrink: 1,
      fontSize: profile.bodyFontSize,
      lineHeight: profile.bulletLineHeight,
    },
  });
}

const stylesByPaper = {
  a4: createStyles(A4_PROFILE),
  letter: createStyles(LETTER_PROFILE),
} as const;

export function PDFResumeDocument({ data, paperSize }: PDFResumeDocumentProps) {
  ensureSourceSerifFonts();
  const size = paperSize === 'a4' ? 'A4' : 'LETTER';
  const styles = stylesByPaper[paperSize];
  const name = data.contact.name || 'Mosaic Resume';
  const primaryLine = getContactPrimaryLine(data.contact);
  const secondaryLine = getContactSecondaryLine(data.contact);

  return (
    <Document title={name}>
      <Page size={size} style={styles.page} wrap>
        <View style={styles.header}>
          <View style={styles.headerNameRow}>
            <Text style={styles.name}>{name}</Text>
          </View>
          {primaryLine ? (
            <View style={styles.headerContactRow}>
              <Text style={styles.contactLine}>{primaryLine}</Text>
            </View>
          ) : null}
          {secondaryLine ? (
            <View style={styles.headerContactRow}>
              <Text style={styles.contactLine}>{secondaryLine}</Text>
            </View>
          ) : null}
        </View>

        {data.sections.map((section, sectionIndex) => {
          const isTextOnly = section.type === 'summary' || section.type === 'skills';

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
                      {entry.title || entry.subtitle ? (
                        <View style={styles.entryHeading}>
                          <Text style={styles.entryTitle}>{entry.title}</Text>
                          <Text style={styles.entrySubtitle}>{entry.subtitle}</Text>
                        </View>
                      ) : null}

                      {entry.bullets.map((bullet, index) => (
                        <View key={`${entry.id}-${index}`} style={styles.bulletRow}>
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
