import type { ComponentProps } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ButtonProps = ComponentProps<typeof Button>;

const APP_BUTTON_STYLES = {
  muted:
    'text-muted-foreground hover:bg-accent hover:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground',
  emphasis: 'bg-amber-500 text-zinc-950 hover:bg-amber-600 dark:bg-amber-500',
  'inline-edit':
    'block min-w-0 shrink rounded text-left text-sm leading-6 font-normal whitespace-normal wrap-break-word',
  'link-chip':
    'max-w-full min-w-0 shrink gap-1 rounded border border-zinc-300 px-1 font-mono text-xs leading-5 font-normal text-zinc-600 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-100',
};

type AppVariant = keyof typeof APP_BUTTON_STYLES;
type AppButtonProps = Omit<ButtonProps, 'variant' | 'size'> & {
  variant?: ButtonProps['variant'] | AppVariant;
  size?: ButtonProps['size'] | 'compact' | 'content';
};

function isAppVariant(variant: ButtonProps['variant'] | AppVariant): variant is AppVariant {
  return variant != null && Object.hasOwn(APP_BUTTON_STYLES, variant);
}

/** Mosaic treatments over the upstream primitive; standard variants and sizes still work. */
export function AppButton({
  variant = 'default',
  size = variant === 'inline-edit' || variant === 'link-chip' ? 'content' : 'default',
  className,
  asChild,
  type,
  ...props
}: AppButtonProps) {
  const isCustomVariant = isAppVariant(variant);
  const isCustomSize = size === 'compact' || size === 'content';

  return (
    <Button
      variant={isCustomVariant ? null : variant}
      size={isCustomSize ? null : size}
      asChild={asChild}
      type={type ?? (asChild ? undefined : 'button')}
      data-variant={variant}
      data-size={size}
      className={cn(
        size === 'compact' && 'h-7 gap-1.5 px-2 py-0 text-xs',
        size === 'content' && 'h-auto p-0',
        isCustomVariant && APP_BUTTON_STYLES[variant],
        className
      )}
      {...props}
    />
  );
}
