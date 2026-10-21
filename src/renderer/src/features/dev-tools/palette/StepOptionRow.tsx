import { Chip, Text } from '@/components/ui-kit';
import { cn } from '@/lib/utils';
import type { StepOption } from '../devTool';

/** One of a step's choices: a version reads its label, then its name or what it holds. */
export function StepOptionRow({ option }: { option: StepOption }) {
  return (
    <>
      <span className="flex min-w-0 flex-1 items-baseline gap-2.5">
        <span className={cn('shrink-0', option.isNamed && 'font-strong text-foreground')}>
          {option.label}
        </span>
        {option.detail && (
          <Text
            variant="secondary"
            className={cn('truncate', option.isNamed && 'font-strong text-foreground')}
          >
            {option.detail}
          </Text>
        )}
      </span>
      {option.hint && <Text variant="secondary">{option.hint}</Text>}
      {option.isDefault && <Chip size="sm">default</Chip>}
    </>
  );
}
