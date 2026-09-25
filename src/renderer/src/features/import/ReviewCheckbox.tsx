import { Check } from 'lucide-react';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

/** Keep or drop, in the review. Mixed: some of what it holds is dropped. */
export function ReviewCheckbox({
  isOn,
  isMixed = false,
  onToggle,
  label,
  className,
}: {
  isOn: boolean;
  isMixed?: boolean;
  onToggle: () => void;
  label: string;
  className?: string;
}) {
  return (
    <CheckboxPrimitive.Root
      checked={isMixed ? 'indeterminate' : isOn}
      onCheckedChange={onToggle}
      aria-label={label}
      className={cn(
        'mt-0.5 grid size-[0.9375rem] shrink-0 place-items-center rounded-[0.25rem] border-[1.5px] border-line-heavy text-background transition-colors outline-none hover:border-ink-muted focus-visible:ring-[3px] focus-visible:ring-ring',
        'data-[state=checked]:border-foreground data-[state=checked]:bg-foreground',
        'data-[state=indeterminate]:border-ink-faint data-[state=indeterminate]:bg-line-strong',
        className
      )}
    >
      <CheckboxPrimitive.Indicator className="grid place-items-center">
        {isMixed ? (
          <i className="h-[0.09375rem] w-[0.4375rem] bg-ink-soft" />
        ) : (
          <Check className="size-[0.5625rem]" strokeWidth={3.2} />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
