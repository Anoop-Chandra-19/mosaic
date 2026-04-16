import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useSaveOnBlur } from '@/lib/hooks/useSaveOnBlur';

interface EditableBulletProps {
  text: string;
  selected: boolean;
  onToggle: () => void;
  onUpdate: (text: string) => void;
  onRemove: () => void;
}

export function EditableBullet({
  text,
  selected,
  onToggle,
  onUpdate,
  onRemove,
}: EditableBulletProps) {
  const { onBlur } = useSaveOnBlur(text, onUpdate);

  return (
    <div className="flex items-start gap-1.5">
      <Checkbox
        checked={selected}
        onCheckedChange={onToggle}
        className="mt-2 shrink-0"
        aria-label="Toggle bullet visibility"
      />
      <Input
        defaultValue={text}
        autoComplete="off"
        onBlur={onBlur}
        placeholder="Add achievement detail…"
        className="min-w-0 flex-1"
      />
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={onRemove}
        aria-label="Delete bullet"
        className="mt-1 shrink-0 text-muted-foreground hover:text-destructive"
      >
        <Trash2 />
      </Button>
    </div>
  );
}
