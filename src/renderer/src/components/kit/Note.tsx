import type { ReactNode, Ref } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fade } from '@/lib/motion/presenceMotions';
import { usePresenceMotion } from '@/lib/motion/usePresenceMotion';

/*
 * The design's `.note`: a plain statement beside the controls, how something works or what
 * to know before going on. Its tone colours the box and the icon; the words stay in ink.
 * `sm` sits inside a dialog's body, among smaller text. Consumers use Note; optional
 * `isShown` delegates enter/exit to lib/motion, retaining the last content through exit.
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
  /** Opt into fading visibility; keep the Note mounted so it can finish its exit. */
  isShown?: boolean;
  className?: string;
  children: ReactNode;
}

export function Note(props: NoteProps) {
  return props.isShown === undefined ? (
    <NoteFrame {...props} />
  ) : (
    <NotePresence {...props} isShown={props.isShown} />
  );
}

function NotePresence(props: NoteProps & { isShown: boolean }) {
  const { shown, isLeaving, ref } = usePresenceMotion(props.isShown ? props : null, 'note', fade);
  return shown && <NoteFrame {...shown} ref={ref} isLeaving={isLeaving} />;
}

function NoteFrame({
  icon: Icon,
  tone = 'neutral',
  size = 'md',
  role,
  className,
  children,
  ref,
  isLeaving,
}: Omit<NoteProps, 'isShown'> & { ref?: Ref<HTMLDivElement>; isLeaving?: boolean }) {
  const toneClasses = TONE_CLASSES[tone];
  const presenceState = isLeaving ? 'closed' : 'open';
  return (
    <div
      ref={ref}
      role={role}
      data-state={isLeaving === undefined ? undefined : presenceState}
      inert={isLeaving}
      aria-hidden={isLeaving || undefined}
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
