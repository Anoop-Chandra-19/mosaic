import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { textVariantClasses } from './textVariants';

/** A narrow column of body text to read, centred in its pane; its lines inherit the role. */
export function ReadingColumn({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn(textVariantClasses('body'), 'mx-auto w-full max-w-105 px-4', className)}>
      {children}
    </div>
  );
}
