import { useState } from 'react';
import { Check, ChevronDown, Copy } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { Collapsible, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { copyText } from '@/features/export/exportResume';
import type { SectionLayout } from '@shared/types/resume';
import { newSectionNameFor, type PlaceTarget } from './applyImportChoices';
import type { LeftOutLine, LeftOutReason } from './parsing/importLines';
import { formatCount as count } from './formatCount';
import { ReviewFold, RowCaret } from './ReviewFold';

const COPY_LABELS = { idle: 'Copy', copied: 'Copied', failed: 'Couldn’t copy' } as const;

const REASONS: Record<LeftOutReason, string> = {
  'empty-heading': 'Heading with nothing under it',
  repeated: 'Repeated on every page',
  'page-number': 'Page number',
  sideways: 'Turned on its side',
  'not-held': 'No field for it in Mosaic',
  'no-heading': 'Under no heading',
  'rating-marks': 'Rating marks, no place on the page',
};

export interface PlaceTargetSection {
  id: string;
  label: string;
  layout: SectionLayout;
}

const asWhat = ({ label, layout }: PlaceTargetSection) =>
  `${label}, as ${layout === 'entries' ? 'an entry' : 'a line'}`;

function PlaceLineMenu({
  sections,
  newSectionName,
  onPlace,
}: {
  sections: PlaceTargetSection[];
  newSectionName: string;
  onPlace: (target: PlaceTarget) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <AppButton variant="ghost" size="xs" className="shrink-0">
          Add to
          <ChevronDown className="size-2.75" />
        </AppButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {sections.map((section) => (
          <DropdownMenuItem key={section.id} onSelect={() => onPlace({ sectionId: section.id })}>
            {asWhat(section)}
          </DropdownMenuItem>
        ))}
        {sections.length > 0 && <DropdownMenuSeparator />}
        <DropdownMenuItem onSelect={() => onPlace('new')}>
          New section “{newSectionName}”
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Open at first when something in it could go on the page. */
export function LeftOutLines({
  lines,
  placed,
  sections,
  onPlace,
  onUnplace,
}: {
  lines: LeftOutLine[];
  placed: ReadonlyMap<number, PlaceTarget>;
  sections: PlaceTargetSection[];
  onPlace: (index: number, target: PlaceTarget) => void;
  onUnplace: (index: number) => void;
}) {
  const [copyState, setCopyState] = useState<keyof typeof COPY_LABELS>('idle');
  const indexed = lines.map((line, index) => ({ line, index }));
  const unplaced = indexed.filter(({ index }) => !placed.has(index));
  const placeable = indexed.filter(({ line }) => line.canPlace);
  const dropped = indexed.filter(({ line }) => !line.canPlace);

  const copy = async () => {
    try {
      await copyText(unplaced.map(({ line }) => line.text).join('\n'));
      setCopyState('copied');
    } catch (error) {
      console.error(error);
      setCopyState('failed');
    }
  };

  const placedLabel = (line: LeftOutLine, target: PlaceTarget) => {
    if (target === 'new') return `${newSectionNameFor(line)}, a new section`;
    const section = sections.find(({ id }) => id === target.sectionId);
    return section ? asWhat(section) : '';
  };

  const row = ({ line, index }: { line: LeftOutLine; index: number }) => {
    const target = placed.get(index);
    return (
      <div
        key={index}
        className="flex min-h-7 items-center gap-2.5 border-b border-line py-0.5 last:border-b-0"
      >
        <span
          className={
            target || !line.canPlace
              ? 'min-w-0 flex-1 truncate font-mono text-[0.71875rem] text-ink-muted'
              : 'min-w-0 flex-1 truncate font-mono text-[0.71875rem] text-foreground'
          }
        >
          {line.text}
        </span>
        {target ? (
          <>
            <span className="shrink-0 text-[0.71875rem] text-emerald-700 dark:text-emerald-400">
              → {placedLabel(line, target)}
            </span>
            <AppButton variant="ghost" size="xs" onClick={() => onUnplace(index)}>
              Undo
            </AppButton>
          </>
        ) : (
          <>
            <span className="shrink-0 text-[0.71875rem] text-ink-faint">
              {REASONS[line.reason]}
            </span>
            {line.canPlace && (
              <PlaceLineMenu
                sections={sections}
                newSectionName={newSectionNameFor(line)}
                onPlace={(to) => onPlace(index, to)}
              />
            )}
          </>
        )}
      </div>
    );
  };

  const group = (title: string, rows: typeof indexed) =>
    rows.length > 0 && (
      <div className="not-first:mt-2.5">
        <p className="border-b border-line pb-0.75 text-[0.71875rem] text-ink-muted">{title}</p>
        {rows.map(row)}
      </div>
    );

  return (
    <Collapsible
      defaultOpen={placeable.length > 0}
      className="group/row mt-2.5 rounded-[0.5625rem] border border-line"
    >
      <div className="flex items-center justify-between gap-2 py-1.25 pr-1.75 pl-2.25">
        <CollapsibleTrigger asChild>
          <AppButton variant="plain" className="h-5.5 gap-1.5 px-0 text-[0.8125rem]">
            <RowCaret />
            Left out
            <span className="text-xs font-normal text-ink-muted">
              {count(unplaced.length, 'line')}
              {placed.size > 0 && ` · ${placed.size} placed`}
            </span>
          </AppButton>
        </CollapsibleTrigger>
        <AppButton variant="ghost" size="xs" onClick={() => void copy()}>
          {copyState === 'copied' ? <Check /> : <Copy />}
          {COPY_LABELS[copyState]}
        </AppButton>
      </div>
      <ReviewFold>
        <div className="border-t border-line px-2.75 pt-2 pb-2.25">
          {group('Could go on the page', placeable)}
          {group('Dropped on purpose', dropped)}
        </div>
      </ReviewFold>
    </Collapsible>
  );
}
