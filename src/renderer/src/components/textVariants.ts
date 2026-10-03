/** The interface's type roles, as the design names them. The resume page has its own type. */
export type TextVariant =
  | 'heading'
  | 'editor'
  | 'title'
  | 'body'
  | 'strong'
  | 'secondary'
  | 'meta'
  | 'eyebrow'
  | 'tag'
  | 'key';

/** Size, line height, tracking and weight come from the `text-*` token; the rest is here. */
const VARIANT_CLASSES: Record<TextVariant, string> = {
  heading: 'text-heading text-foreground',
  editor: 'text-editor text-foreground',
  title: 'text-title text-foreground',
  body: 'text-body text-ink-soft',
  strong: 'text-strong text-foreground',
  secondary: 'text-support text-ink-muted',
  meta: 'text-meta font-mono tabular-nums text-ink-faint',
  eyebrow: 'text-eyebrow uppercase text-ink-faint',
  // A status tag takes its status colour through `className`.
  tag: 'text-tag uppercase text-ink-muted',
  key: 'text-key font-mono text-ink-soft',
};

/** The classes for a role: for `Text`, and for elements that can't be one, such as a Radix part. */
export function textVariantClasses(variant: TextVariant): string {
  return VARIANT_CLASSES[variant];
}
