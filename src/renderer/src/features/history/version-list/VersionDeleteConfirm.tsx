import { useEffect, useRef } from 'react';
import { AppButton } from '@/components/AppButton';
import { Text } from '@/components/Text';
import type { VersionMeta } from '@shared/types/db';

interface VersionDeleteConfirmProps {
  version: VersionMeta;
  label: string;
  onDelete: () => void;
  onKeep: () => void;
}

/**
 * Deleting a named version asks in its row. Keep it has focus first, and Escape, tabbing
 * away or clicking anywhere else all mean Keep it.
 */
export function VersionDeleteConfirm({
  version,
  label,
  onDelete,
  onKeep,
}: VersionDeleteConfirmProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  useEffect(() => keepRef.current?.focus(), []);

  return (
    <div
      ref={boxRef}
      role="alertdialog"
      aria-label={`Delete “${version.summary}”?`}
      tabIndex={-1}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Escape') {
          event.preventDefault();
          onKeep();
        }
      }}
      onBlur={(event) => {
        if (document.hasFocus() && !boxRef.current?.contains(event.relatedTarget)) onKeep();
      }}
      className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1.5 outline-none"
    >
      <div className="min-w-0 flex-[1_1_10.625rem]">
        <Text as="p" variant="strong">
          Delete “{version.summary}”?
        </Text>
        <Text as="p" variant="secondary" className="mt-0.5 text-pretty">
          Only {label} is removed. Automatic snapshots around it stay.
        </Text>
      </div>
      <span className="ml-auto flex gap-1.25">
        <AppButton ref={keepRef} variant="outline" size="xs" className="h-6" onClick={onKeep}>
          Keep it
        </AppButton>
        <AppButton variant="danger" size="xs" className="h-6" onClick={onDelete}>
          Delete
        </AppButton>
      </span>
    </div>
  );
}
