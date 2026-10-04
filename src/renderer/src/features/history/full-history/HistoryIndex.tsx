import { Save } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { Text } from '@/components/Text';
import { textVariantClasses } from '@/components/textVariants';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/stores/uiStore';
import type { VersionMeta } from '@shared/types/db';
import {
  countFoldedByMonth,
  findFoldCutoff,
  formatHistoryDay,
  groupVersionHistory,
  listHistoryMonths,
} from '../groupVersionHistory';
import { versionLabel } from '../useTemplateVersions';

interface HistoryIndexProps {
  /** Newest first. */
  versions: VersionMeta[];
  selectedId: string | null;
  /** Asks the list to bring a version into view: never a scroll position. */
  onGoTo: (version: VersionMeta) => void;
  shouldShowMonths: boolean;
}

/**
 * The full view's table of contents: the named versions, then the months. A month counts
 * every version, folded ones included, so its number doesn't change with folding.
 */
export function HistoryIndex({
  versions,
  selectedId,
  onGoTo,
  shouldShowMonths,
}: HistoryIndexProps) {
  const named = versions.filter((version) => version.kind === 'named');
  const foldDays = useUiStore((s) => s.foldSnapshotsAfterDays);
  const folded = shouldShowMonths
    ? countFoldedByMonth(groupVersionHistory(versions, { foldBefore: findFoldCutoff(foldDays) }))
    : new Map<string, number>();
  return (
    <nav
      aria-label="History index"
      className="w-51 shrink-0 overflow-auto border-r border-line bg-pane px-2.5 pt-2.5 pb-4.5"
    >
      <Text as="h3" variant="eyebrow" className={EYEBROW}>
        Named versions
      </Text>
      {named.length === 0 && (
        <Text as="p" variant="secondary" className="mx-0.5 mb-1 text-ink-faint">
          None yet. Name a version to find it here.
        </Text>
      )}
      {named.map((version) => (
        <AppButton
          key={version.id}
          variant="ghost"
          shape="text"
          aria-current={selectedId === version.id || undefined}
          onClick={() => onGoTo(version)}
          className={cn(
            'flex w-full items-start gap-2 px-1.75 py-1.5 text-support text-ink-soft',
            selectedId === version.id &&
              'bg-amber-soft text-foreground shadow-[inset_0_0_0_1px_var(--amber-line)] hover:bg-amber-soft'
          )}
        >
          <Save className="mt-0.5 size-2.75 shrink-0 text-amber" />
          <span className="min-w-0 flex-1">
            {version.summary}
            <Text variant="meta" className="mt-0.5 block">
              {versionLabel(version)} · {formatHistoryDay(version.createdAt)}
            </Text>
          </span>
        </AppButton>
      ))}
      {shouldShowMonths && (
        <>
          <Text as="h3" variant="eyebrow" className={cn(EYEBROW, 'mt-3.5')}>
            Months
          </Text>
          {listHistoryMonths(versions).map((month) => (
            <AppButton
              key={month.label}
              variant="ghost"
              shape="text"
              onClick={() => onGoTo(month.newest)}
              className={cn(
                textVariantClasses('meta'),
                'flex w-full items-start justify-between px-1.75 py-1.5 text-ink-muted'
              )}
            >
              <span>
                {month.label}
                {folded.has(month.label) && (
                  <span className="mt-px block text-tag text-ink-faint">
                    {folded.get(month.label)} folded
                  </span>
                )}
              </span>
              <span className="text-ink-faint">{month.count.toLocaleString()}</span>
            </AppButton>
          ))}
        </>
      )}
    </nav>
  );
}

const EYEBROW = 'mx-0.5 mt-1 mb-1.5';
