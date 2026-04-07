import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { InlineEditField } from './InlineEditField';
import type { Bullet } from '@/types/resume';

interface BulletItemProps {
  bullet: Bullet;
  onToggle: () => void;
  onUpdate: (text: string) => void;
  onRemove: () => void;
}

export function BulletItem({ bullet, onToggle, onUpdate, onRemove }: BulletItemProps) {
  return (
    <div className="group flex items-start gap-2 py-1">
      <Checkbox
        checked={bullet.selected}
        onCheckedChange={onToggle}
        className="mt-1 shrink-0"
        aria-label="Toggle bullet visibility"
      />
      <InlineEditField
        value={bullet.text}
        onSave={onUpdate}
        className={cn('text-sm leading-6 wrap-break-word', !bullet.selected && 'opacity-50')}
        inputClassName="h-8 text-sm leading-6"
      />
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={onRemove}
        aria-label="Delete bullet"
        className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 hover:text-destructive [&_svg]:size-3.5"
      >
        <Trash2 />
      </Button>
    </div>
  );
}
