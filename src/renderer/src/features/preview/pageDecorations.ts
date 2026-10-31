import type { ReactNode } from 'react';
import type { EntryHeadingFields } from '@/lib/resume/entryHeading';

/**
 * What a surface draws in place of the page's text, as the history and the suggestion review
 * mark it. Each slot gets what would print and returns what to draw. A surface passing these
 * may also position things in the margin: the boxes around the text are positioned for it.
 * Exports never pass these.
 */
export interface PageDecorations {
  name?: (name: string) => ReactNode;
  /** Drawn at the start of a header line, by the items it prints. */
  headerLine?: (itemIds: string[]) => ReactNode;
  /** `printed` is the item as it would print, a link if it has one; `text` is its words. */
  headerItem?: (itemId: string, printed: ReactNode, text: string) => ReactNode;
  sectionLabel?: (sectionId: string, label: string) => ReactNode;
  /** A line of a lines section, by its item's id. */
  line?: (lineId: string, text: string) => ReactNode;
  entryHeading?: (entryId: string, heading: string, fields?: EntryHeadingFields) => ReactNode;
  entryDates?: (entryId: string, dates: string) => ReactNode;
  bullet?: (bulletId: string, text: string) => ReactNode;
  /** A class for a whole entry or section, by its id. It must not change the layout. */
  blockClassName?: (id: string) => string | undefined;
}
