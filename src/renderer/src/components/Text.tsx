import type { ComponentPropsWithoutRef, ElementType } from 'react';
import { cn } from '@/lib/utils';
import { textVariantClasses, type TextVariant } from './textVariants';

type TextProps<T extends ElementType> = {
  variant: TextVariant;
  /** The element, for its meaning; a heading's look comes from `variant`, not the tag. */
  as?: T;
} & Omit<ComponentPropsWithoutRef<T>, 'as'>;

/** Interface text in one of the type roles. Colour can be overridden through `className`. */
export function Text<T extends ElementType = 'span'>({
  variant,
  as,
  className,
  ...props
}: TextProps<T>) {
  const Element: ElementType = as ?? 'span';
  return <Element className={cn(textVariantClasses(variant), className)} {...props} />;
}
