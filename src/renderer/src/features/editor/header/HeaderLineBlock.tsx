import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Ellipsis, Plus, Trash2 } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  BUILT_IN_HEADER_KINDS,
  HEADER_ALIGNS,
  HEADER_SEPARATORS,
  getHeaderKindInfo,
} from '@shared/resume/resumeHeader';
import { cn } from '@/lib/utils';
import { useResumeStore } from '@/stores/resumeStore';
import type {
  HeaderAlign,
  HeaderItemKind,
  HeaderLine,
  HeaderSeparator,
} from '@shared/types/resume';
import { HIDDEN_WHILE_READING } from '../editorClasses';
import { HEADER_ICONS } from './headerIcons';
import { HeaderItemRow } from './HeaderItemRow';

interface HeaderLineBlockProps {
  line: HeaderLine;
  lines: HeaderLine[];
}

const ADDABLE: HeaderItemKind[] = [...BUILT_IN_HEADER_KINDS, 'custom'];

/** One header line: how its items are separated and aligned, its items, and adding one. */
export function HeaderLineBlock({ line, lines }: HeaderLineBlockProps) {
  const updateLine = useResumeStore((s) => s.updateHeaderLine);
  const moveLine = useResumeStore((s) => s.moveHeaderLine);
  const removeLine = useResumeStore((s) => s.removeHeaderLine);
  const addItem = useResumeStore((s) => s.addHeaderItem);
  // The kind chosen in the Add menu, added once the menu has closed so the new item's text
  // field keeps focus; and that item, which opens for editing.
  const pendingKind = useRef<HeaderItemKind | null>(null);
  const [addedId, setAddedId] = useState<string | null>(null);

  const index = lines.indexOf(line);
  const number = index + 1;
  const separator = HEADER_SEPARATORS.find((s) => s.value === line.separator)!;
  const align = HEADER_ALIGNS.find((a) => a.value === line.align)!;

  return (
    <section
      aria-label={`Line ${number}`}
      className="border-t border-line pt-1.5 pb-0.5 first:border-t-0"
    >
      <div className="flex items-center gap-1 pt-0.5 pb-[0.1875rem]">
        <h4 className="flex-1 text-[0.6875rem] font-bold tracking-[0.08em] text-ink-faint uppercase">
          Line {number}
        </h4>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <AppButton
              variant="outline"
              size="2xs"
              title="Between items"
              aria-label={`Between items: ${separator.label.toLowerCase()}`}
              className="px-[0.4375rem] text-[0.65625rem] font-semibold tracking-[0.04em]"
            >
              {separator.label.toLowerCase()}
            </AppButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup
              value={line.separator}
              onValueChange={(value) =>
                updateLine(line.id, { separator: value as HeaderSeparator })
              }
            >
              {HEADER_SEPARATORS.map(({ value, label }) => (
                <DropdownMenuRadioItem key={label} value={value}>
                  {label === 'Space' ? 'Spaces' : `Separated by ${label}`}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <AppButton
              variant="outline"
              size="2xs"
              title="Alignment"
              aria-label={`Alignment: ${align.label.toLowerCase()}`}
              className="px-[0.4375rem] text-[0.65625rem] font-semibold tracking-[0.04em]"
            >
              {align.label.toLowerCase()}
            </AppButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup
              value={line.align}
              onValueChange={(value) => updateLine(line.id, { align: value as HeaderAlign })}
            >
              {HEADER_ALIGNS.map(({ value, label }) => (
                <DropdownMenuRadioItem key={value} value={value}>
                  {label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <AppButton
              variant="ghost"
              size="xs"
              shape="square"
              aria-label={`Line ${number} actions`}
              className={HIDDEN_WHILE_READING}
            >
              <Ellipsis />
            </AppButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={index === 0} onSelect={() => moveLine(line.id, -1)}>
              <ArrowUp />
              Move line up
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={index === lines.length - 1}
              onSelect={() => moveLine(line.id, 1)}
            >
              <ArrowDown />
              Move line down
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => removeLine(line.id)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 />
              Delete line
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {line.items.map((item) => (
        <HeaderItemRow
          key={item.id}
          item={item}
          line={line}
          lines={lines}
          shouldStartEditing={item.id === addedId}
        />
      ))}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <AppButton
            variant="quiet"
            size="xs"
            className={cn(
              'mt-0.5 mb-1.5 justify-start pr-[0.5625rem] pl-[0.4375rem] text-[0.775rem] font-normal',
              HIDDEN_WHILE_READING
            )}
          >
            <Plus />
            Add to line {number}
          </AppButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          onCloseAutoFocus={(event) => {
            const kind = pendingKind.current;
            if (!kind) return;
            pendingKind.current = null;
            event.preventDefault();
            setAddedId(addItem(line.id, kind));
          }}
        >
          {ADDABLE.map((kind) => {
            const Icon = HEADER_ICONS[kind];
            return (
              <DropdownMenuItem
                key={kind}
                onSelect={() => {
                  pendingKind.current = kind;
                }}
              >
                <Icon />
                {getHeaderKindInfo(kind).label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </section>
  );
}
