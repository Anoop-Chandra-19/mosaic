import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MobileViewTabsProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}

export function MobileViewTabs<T extends string>({
  value,
  onChange,
  options,
}: MobileViewTabsProps<T>) {
  return (
    <div className="mr-1 flex items-center rounded-md border border-border p-0.5">
      {options.map((option) => (
        <Button
          key={option.value}
          variant="ghost"
          size="xs"
          onClick={() => onChange(option.value)}
          className={cn('h-7 px-2 text-xs', value === option.value && 'bg-muted text-foreground')}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
