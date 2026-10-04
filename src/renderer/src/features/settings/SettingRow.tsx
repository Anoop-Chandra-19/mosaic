import type { ReactNode } from 'react';
import { Text } from '@/components/Text';

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
    <div className="flex flex-col gap-2.5 border-b border-line py-(--density-pad) last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
      <div className="min-w-0 flex-1">
        <Text as="p" variant="body" className="font-control text-foreground">
          {label}
        </Text>
        {description && (
          <Text as="p" variant="secondary" className="mt-[0.1875rem] max-w-[46ch]">
            {description}
          </Text>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

/** A group of rows within a section, the design's `.setgrp`. */
export function SettingGroupHeading({ children }: { children: ReactNode }) {
  return (
    <Text as="h4" variant="tag" className="pt-3 pb-1 text-ink-faint">
      {children}
    </Text>
  );
}

/** For a setting that cannot be switched off: says so instead of offering a dead switch. */
export function AlwaysOn() {
  return <span className="text-support font-control text-ink-faint">Always on</span>;
}
