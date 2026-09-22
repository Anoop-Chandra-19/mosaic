import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** One setting: what it is on the left, its control on the right. */
export function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5 border-b border-zinc-200 py-(--density-pad) last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-5 dark:border-zinc-800">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{label}</p>
        {description && (
          <p className="mt-0.5 max-w-[46ch] text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
            {description}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

/** A plain statement about a section — how something works, not a control. */
export function SettingsNote({
  icon: Icon,
  tone = 'neutral',
  className,
  children,
}: {
  icon: LucideIcon;
  tone?: 'neutral' | 'safe';
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex gap-2.5 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300',
        className
      )}
    >
      <Icon
        className={cn(
          'mt-px size-3.5 shrink-0',
          tone === 'safe' ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500'
        )}
      />
      <div>{children}</div>
    </div>
  );
}

/** For a setting that cannot be switched off: says so instead of offering a dead switch. */
export function AlwaysOn() {
  return <span className="text-xs font-medium text-zinc-500">Always on</span>;
}
