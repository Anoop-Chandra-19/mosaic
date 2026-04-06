import { useState, type KeyboardEvent } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface AddBulletInputProps {
  onAdd: (text: string) => void;
}

export function AddBulletInput({ onAdd }: AddBulletInputProps) {
  const [value, setValue] = useState('');

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setValue('');
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="flex items-center gap-1.5 pt-1.5">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add bullet..."
        className="h-8 min-w-0 flex-1 px-2 text-sm"
      />
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={submit}
        disabled={!value.trim()}
        className="[&_svg]:size-3.5"
      >
        <Plus />
      </Button>
    </div>
  );
}
