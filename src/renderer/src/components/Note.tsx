import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/*
 * The design's `.note`: a plain statement beside the controls, how something works or what
 * to know before going on. Its tone colours the box and the icon; the words stay in ink.
 * `sm` sits inside a dialog's body, among smaller text.
 */

const TONE_CLASSES = {
  neutral: { box: 'border-line-strong bg-pane', icon: 'text-ink-muted' },
  safe: { box: 'border-line-strong bg-pane', icon: 'text-add' },
  amber: { box: 'border-amber-line bg-amber-soft', icon: 'text-amber' },
  warn: { box: 'border-warn-line bg-warn-soft', icon: 'text-warn' },
  error: { box: 'border-del-line bg-del-soft', icon: 'text-del' },
} as const;

const SIZE_CLASSES = {
  md: 'gap-2.5 px-3 py-2.75 text-body',
  sm: 'gap-2 px-2.5 py-2.25 text-support',
} as const;

interface NoteProps {
  icon: LucideIcon;
  tone?: keyof typeof TONE_CLASSES;
  size?: keyof typeof SIZE_CLASSES;
  /** Read out as it appears, for a failure the person is waiting on. */
  role?: 'alert' | 'status';
  className?: string;
  children: ReactNode;
}

export function Note({
  icon: Icon,
  tone = 'neutral',
  size = 'md',
  role,
  className,
  children,
}: NoteProps) {
  const toneClasses = TONE_CLASSES[tone];
  return (
    <div
      role={role}
      className={cn(
        'flex rounded-[0.5625rem] border text-ink-soft',
        toneClasses.box,
        SIZE_CLASSES[size],
        className
      )}
    >
      <Icon className={cn('mt-0.75 size-3.5 shrink-0', toneClasses.icon)} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
