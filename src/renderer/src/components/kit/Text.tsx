import type { ComponentPropsWithoutRef, ElementType } from 'react';
import { cn } from '@/lib/utils';
import { textVariantClasses, type TextVariant } from './textVariants';

/** The text elements `Text` may render; anything else (buttons, links, inputs) has its own component. */
type TextTag =
  | 'span'
  | 'p'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'label'
  | 'strong'
  | 'em'
  | 'kbd';

type TextProps<T extends TextTag> = {
  variant: TextVariant;
  /** The element, for its meaning; a heading's look comes from `variant`, not the tag. */
  as?: T;
} & Omit<ComponentPropsWithoutRef<T>, 'as'>;

/** Interface text in one of the type roles. Colour can be overridden through `className`. */
export function Text<T extends TextTag = 'span'>({
  variant,
  as,
  className,
  ...props
}: TextProps<T>) {
  const Element = (as ?? 'span') as ElementType;
  return <Element className={cn(textVariantClasses(variant), className)} {...props} />;
}
