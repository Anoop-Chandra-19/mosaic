import type { ReactNode } from 'react';

/** One row of the palette's list: what choosing it does, and how it reads. */
export interface PaletteRow {
  /** Unique in the list; the palette keeps the chosen row by it. */
  value: string;
  onSelect: () => void;
  content: ReactNode;
  isDisabled?: boolean;
}

/** A group of rows under its heading, with a line after them when there is more to say. */
export interface PaletteSection {
  heading?: ReactNode;
  rows: PaletteRow[];
  note?: string;
}
