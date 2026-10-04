import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Ellipsis, Plus, Trash2 } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { Text } from '@/components/Text';
import {
  AppMenu,
  AppMenuContent,
  AppMenuItem,
  AppMenuRadioGroup,
  AppMenuRadioItem,
  AppMenuSeparator,
  AppMenuTrigger,
} from '@/components/AppMenu';
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
      data-motion-id={line.id}
      className="border-t border-line pt-1.5 pb-0.5 first:border-t-0"
    >
      <div className="flex items-center gap-1 pt-0.5 pb-[0.1875rem]">
        <Text as="h4" variant="eyebrow" className="flex-1">
          Line {number}
        </Text>

        <AppMenu>
          <AppMenuTrigger asChild>
            <AppButton
              variant="outline"
              size="2xs"
              title="Between items"
              aria-label={`Between items: ${separator.label.toLowerCase()}`}
              className="px-[0.4375rem] font-strong tracking-[0.04em]"
            >
              {separator.label.toLowerCase()}
            </AppButton>
          </AppMenuTrigger>
          <AppMenuContent align="end">
            <AppMenuRadioGroup
              value={line.separator}
              onValueChange={(value) =>
                updateLine(line.id, { separator: value as HeaderSeparator })
              }
            >
              {HEADER_SEPARATORS.map(({ value, label }) => (
                <AppMenuRadioItem key={label} value={value}>
                  {label === 'Space' ? 'Spaces' : `Separated by ${label}`}
                </AppMenuRadioItem>
              ))}
            </AppMenuRadioGroup>
          </AppMenuContent>
        </AppMenu>

        <AppMenu>
          <AppMenuTrigger asChild>
            <AppButton
              variant="outline"
              size="2xs"
              title="Alignment"
              aria-label={`Alignment: ${align.label.toLowerCase()}`}
              className="px-[0.4375rem] font-strong tracking-[0.04em]"
            >
              {align.label.toLowerCase()}
            </AppButton>
          </AppMenuTrigger>
          <AppMenuContent align="end">
            <AppMenuRadioGroup
              value={line.align}
              onValueChange={(value) => updateLine(line.id, { align: value as HeaderAlign })}
            >
              {HEADER_ALIGNS.map(({ value, label }) => (
                <AppMenuRadioItem key={value} value={value}>
                  {label}
                </AppMenuRadioItem>
              ))}
            </AppMenuRadioGroup>
          </AppMenuContent>
        </AppMenu>

        <AppMenu>
          <AppMenuTrigger asChild>
            <AppButton
              variant="ghost"
              size="xs"
              shape="square"
              aria-label={`Line ${number} actions`}
              className={HIDDEN_WHILE_READING}
            >
              <Ellipsis />
            </AppButton>
          </AppMenuTrigger>
          <AppMenuContent align="end">
            <AppMenuItem disabled={index === 0} onSelect={() => moveLine(line.id, -1)}>
              <ArrowUp />
              Move line up
            </AppMenuItem>
            <AppMenuItem
              disabled={index === lines.length - 1}
              onSelect={() => moveLine(line.id, 1)}
            >
              <ArrowDown />
              Move line down
            </AppMenuItem>
            <AppMenuSeparator />
            <AppMenuItem variant="destructive" onSelect={() => removeLine(line.id)}>
              <Trash2 />
              Delete line
            </AppMenuItem>
          </AppMenuContent>
        </AppMenu>
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

      <AppMenu>
        <AppMenuTrigger asChild>
          <AppButton
            variant="quiet"
            size="xs"
            className={cn(
              'mt-0.5 mb-1.5 justify-start pr-[0.5625rem] pl-[0.4375rem] font-regular',
              HIDDEN_WHILE_READING
            )}
          >
            <Plus />
            Add to line {number}
          </AppButton>
        </AppMenuTrigger>
        <AppMenuContent
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
              <AppMenuItem
                key={kind}
                onSelect={() => {
                  pendingKind.current = kind;
                }}
              >
                <Icon />
                {getHeaderKindInfo(kind).label}
              </AppMenuItem>
            );
          })}
        </AppMenuContent>
      </AppMenu>
    </section>
  );
}
