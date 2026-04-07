import { useEffect, useId, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface AddBulletInputProps {
  onAdd: (text: string) => void;
}

export function AddBulletInput({ onAdd }: AddBulletInputProps) {
  const [expanded, setExpanded] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const inputId = useId();

  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  const parseBulletLines = (raw: string) =>
    raw
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.replace(/^[-*•]\s+/, '').trim())
      .filter(Boolean);

  const submit = () => {
    const bullets = parseBulletLines(value);
    if (bullets.length === 0) return;
    bullets.forEach((bullet) => onAdd(bullet));
    setValue('');
    setExpanded(true);
    inputRef.current?.focus();
  };

  const close = () => {
    setExpanded(false);
    setValue('');
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (!pasted.includes('\n')) return;

    const bullets = parseBulletLines(pasted);
    if (bullets.length === 0) return;

    e.preventDefault();
    bullets.forEach((bullet) => onAdd(bullet));
    setValue('');
    setExpanded(true);
  };

  const handleBlur = () => {
    window.requestAnimationFrame(() => {
      if (!rootRef.current?.contains(document.activeElement) && !value.trim()) {
        setExpanded(false);
      }
    });
  };

  if (!expanded) {
    return (
      <div className="pt-1.5">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-muted-foreground"
          onClick={() => setExpanded(true)}
        >
          <Plus />
          Add Bullet
        </Button>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className="space-y-1.5 rounded-md border border-border/60 bg-muted/40 p-1.5 transition-[border-color,background-color] focus-within:border-ring/60 focus-within:bg-background"
    >
      <label id={labelId} htmlFor={inputId} className="sr-only">
        Add a bullet point
      </label>
      <div className="flex items-center gap-1.5">
        <Input
          id={inputId}
          ref={inputRef}
          value={value}
          name="bulletText"
          autoComplete="off"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={handleBlur}
          placeholder="e.g. Reduced API latency by 35%…"
          aria-labelledby={labelId}
          className="h-8 min-w-0 flex-1 border-transparent bg-background px-2 text-sm shadow-none"
        />
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={submit}
          disabled={!value.trim()}
          aria-label="Add bullet"
          className="[&_svg]:size-3.5"
        >
          <Plus />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={close}
          aria-label="Cancel adding bullet"
          className="text-muted-foreground [&_svg]:size-3.5"
        >
          <X />
        </Button>
      </div>
      <p className="px-1 text-xs text-muted-foreground">
        Enter adds a bullet. Paste multiple lines to add many.
      </p>
    </div>
  );
}
