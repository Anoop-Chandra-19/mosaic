/*
 * The design's control surfaces, each written once for the App wrappers that draw them:
 * a field (input, text area, select), what floats over the window (menus, selects,
 * popovers), and a row in a floating list.
 */

/** A field's box, from the design's `.input`; text fields add their own width and height. */
export const FIELD_CLASSES =
  'h-8 rounded-sm border border-line-strong bg-pane-sunken px-2.5 text-body text-foreground shadow-none outline-none transition-[border-color,box-shadow] duration-120 placeholder:text-ink-faint selection:bg-amber-soft selection:text-foreground focus-visible:border-amber-line focus-visible:ring-3 focus-visible:ring-amber-soft disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-del-line aria-invalid:ring-del-soft dark:bg-pane-sunken dark:aria-invalid:ring-del-soft';

export const FLOATING_SURFACE_CLASSES =
  'rounded-[0.5625rem] border border-line-strong bg-pane-raised text-ink-soft shadow-overlay';

/** One row of a menu or a select's list, from the design's `.menu-item`. */
export const LIST_ROW_CLASSES =
  "min-h-[1.8125rem] gap-[0.5625rem] rounded-sm px-2 py-0 text-body text-ink-soft focus:bg-line focus:text-foreground data-[disabled]:opacity-40 [&_svg:not([class*='size-'])]:size-[0.8125rem] [&_svg:not([class*='text-'])]:text-current";
