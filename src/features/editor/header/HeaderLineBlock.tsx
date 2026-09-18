import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Ellipsis, Plus, Trash2 } from 'lucide-react';
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
} from '@/lib/resume/resumeHeader';
import { useResumeStore } from '@/stores/resumeStore';
import type { HeaderAlign, HeaderItemKind, HeaderLine, HeaderSeparator } from '@/types/resume';
import { HEADER_ICONS } from './headerIcons';
import { HeaderItemRow } from './HeaderItemRow';

interface HeaderLineBlockProps {
  line: HeaderLine;
  lines: HeaderLine[];
}

const ADDABLE: HeaderItemKind[] = [...BUILT_IN_HEADER_KINDS, 'custom'];

const chip =
  'h-6 gap-1 px-1.5 text-xs font-normal text-zinc-600 dark:text-zinc-400 data-[state=open]:bg-accent';

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
    <section aria-label={`Line ${number}`} className="space-y-0.5">
      <div className="flex items-center gap-1 pl-1.5">
        <h4 className="flex-1 text-xs font-medium text-zinc-500">Line {number}</h4>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <AppButton variant="ghost" size="xs" className={chip} title="Between items">
              <span className="min-w-3 font-mono">{separator.label}</span>
              <ChevronDown className="size-3" />
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
            <AppButton variant="ghost" size="xs" className={chip} title="Alignment">
              {align.label}
              <ChevronDown className="size-3" />
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
            <AppButton variant="muted" size="icon-xs" aria-label={`Line ${number} actions`}>
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
          <AppButton variant="muted" size="xs">
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
