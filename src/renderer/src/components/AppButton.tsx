import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { AppTooltip } from '@/components/AppTooltip';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/*
 * Every button in Mosaic, on three independent axes (the Claude Design's buttons):
 * - variant: tone and fill;
 * - size: scale only — height, padding, type role, and icon size;
 * - shape: the box's outline.
 * Typography beyond the size's role, colour tweaks, and layout (full width, alignment,
 * margins) go in `className`: they belong to where a button sits, not to what it is.
 */
const appButtonVariants = cva(
  'inline-flex shrink-0 items-center justify-center font-control whitespace-nowrap select-none transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        solid: 'bg-foreground font-strong text-background hover:bg-solid-hover',
        accent: 'bg-amber font-strong text-background hover:bg-amber-hover',
        // "Open" means a menu this button opened is showing. A collapsible's trigger is open
        // too, but only a menu's trigger (`aria-haspopup="menu"`) is drawn pressed.
        outline:
          'border border-line-strong text-ink-soft hover:border-line-heavy hover:bg-line hover:text-foreground aria-[haspopup=menu]:data-[state=open]:border-line-heavy aria-[haspopup=menu]:data-[state=open]:bg-line aria-[haspopup=menu]:data-[state=open]:text-foreground',
        dashed:
          'border border-dashed border-line-heavy text-ink-muted hover:border-ink-faint hover:bg-line hover:text-foreground aria-[haspopup=menu]:data-[state=open]:bg-line aria-[haspopup=menu]:data-[state=open]:text-foreground',
        ghost:
          'text-ink-soft hover:bg-line hover:text-foreground aria-[haspopup=menu]:data-[state=open]:bg-line-strong aria-[haspopup=menu]:data-[state=open]:text-foreground',
        quiet:
          'text-ink-faint hover:bg-line hover:text-ink-soft aria-[haspopup=menu]:data-[state=open]:bg-line aria-[haspopup=menu]:data-[state=open]:text-ink-soft',
        // A row's name that opens it: no fill, even on hover.
        plain: 'text-foreground',
        destructive: 'border border-del-line bg-del-soft font-strong text-del hover:bg-del-line',
        // The last step of asking: the answer that removes.
        danger: 'bg-del font-strong text-del-ink hover:bg-del-hover',
        link: 'text-foreground underline-offset-4 hover:underline',
        // One of a few ways forward, laid out as a card: the focused one is edged amber, and
        // the pointer moves focus, so the edge is the only highlight.
        option:
          'border border-line-strong bg-pane-raised text-foreground focus:border-amber focus:bg-line focus-visible:border-amber focus-visible:ring-0',
        // One step of a sequence; the current one (`aria-current="step"`) stretches, amber.
        dot: 'bg-line-heavy transition-[background-color,width] duration-120 hover:bg-ink-faint aria-[current=step]:w-4 aria-[current=step]:rounded-[0.1875rem] aria-[current=step]:bg-amber motion-reduce:transition-none',
      },
      size: {
        '2xs': "h-[1.375rem] gap-1 px-1.5 text-meta [&_svg:not([class*='size-'])]:size-2.5",
        xs: "h-[1.625rem] gap-[0.3125rem] px-[0.5625rem] text-support [&_svg:not([class*='size-'])]:size-3",
        // A setting's current value, shown in place and opening its choices (the design's
        // `.hchip`): set strong and spaced, so a single character still reads as a control.
        chip: 'h-[1.375rem] gap-1 px-[0.4375rem] text-meta font-strong tracking-[0.04em]',
        sm: "h-8 gap-1.5 px-3 text-body [&_svg:not([class*='size-'])]:size-3.5",
        md: "h-9 gap-2 px-4 text-body [&_svg:not([class*='size-'])]:size-4",
        lg: "h-10 gap-2 px-6 text-body [&_svg:not([class*='size-'])]:size-4",
        dot: 'size-1.5 px-0',
      },
      shape: {
        rect: 'rounded-md',
        pill: 'rounded-full',
        // As wide as it is tall: an icon on its own.
        square: 'aspect-square rounded-md px-0',
        // Words that open an editor: no fixed height, wrapping like the prose they are.
        text: 'block h-auto min-w-0 rounded-[0.3125rem] px-1.5 py-1 text-left font-regular text-pretty wrap-break-word whitespace-normal',
        // A box of content that is pressed as a whole: its own padding, wrapping text.
        card: 'h-auto justify-start rounded-[0.5625rem] p-3 text-left font-regular whitespace-normal',
      },
    },
    compoundVariants: [
      // An icon on its own reads a step larger than one beside a label.
      { shape: 'square', size: '2xs', className: "[&_svg:not([class*='size-'])]:size-3" },
      {
        shape: 'square',
        size: 'xs',
        className: "[&_svg:not([class*='size-'])]:size-[0.8125rem]",
      },
      { shape: 'square', size: 'sm', className: "[&_svg:not([class*='size-'])]:size-4" },
    ],
    defaultVariants: { variant: 'solid', size: 'md', shape: 'rect' },
  }
);

type AppButtonProps = Omit<ComponentProps<typeof Button>, 'variant' | 'size'> &
  VariantProps<typeof appButtonVariants>;

/**
 * Mosaic's button: the upstream primitive (focus, `asChild`), styled on Mosaic's axes. Its
 * `title` shows as an `AppTooltip` rather than the native box, and a square (icon-only)
 * button without one shows its `aria-label` instead. Every icon-only button has an
 * `aria-label`, so no button's name ever came from its title.
 */
export function AppButton({
  variant,
  size,
  shape,
  className,
  asChild,
  type,
  title,
  disabled,
  ...props
}: AppButtonProps) {
  // An icon on its own says what it is on hover, as every icon button and ⋯ menu in the
  // design does. A button with words already says it.
  const hint = title ?? (shape === 'square' ? props['aria-label'] : undefined);
  return (
    <AppTooltip content={hint} disabled={disabled}>
      <Button
        variant={null}
        size={null}
        asChild={asChild}
        disabled={disabled}
        type={type ?? (asChild ? undefined : 'button')}
        data-variant={variant ?? 'solid'}
        data-size={size ?? 'md'}
        data-shape={shape ?? 'rect'}
        className={cn(appButtonVariants({ variant, size, shape }), className)}
        {...props}
      />
    </AppTooltip>
  );
}
