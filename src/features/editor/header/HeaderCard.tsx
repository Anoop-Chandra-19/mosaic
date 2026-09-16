import { useState } from 'react';
import { ChevronsDownUp, ChevronsUpDown, Ellipsis, Plus, Shapes } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { headerLineText, LINK_STYLES, printedHeaderLines } from '@/lib/resume/resumeHeader';
import { cn } from '@/lib/utils';
import { useResumeStore } from '@/stores/resumeStore';
import { useUIStore } from '@/stores/uiStore';
import type { LinkStyle } from '@/types/resume';
import { InlineEditField } from '../InlineEditField';
import { HeaderLineBlock } from './HeaderLineBlock';

/** The top of the resume: the name, and the header's lines of items below it. */
export function HeaderCard() {
  const contact = useResumeStore((s) => s.contact);
  const setName = useResumeStore((s) => s.setName);
  const setLinkStyle = useResumeStore((s) => s.setLinkStyle);
  const addLine = useResumeStore((s) => s.addHeaderLine);
  const icons = useUIStore((s) => s.headerIcons);
  const toggleIcons = useUIStore((s) => s.toggleHeaderIcons);
  const [open, setOpen] = useState(true);
  const { header } = contact;
  const printed = printedHeaderLines(header);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-md border p-4">
      <div className="flex items-center justify-between gap-1">
        <InlineEditField
          value={contact.name}
          onSave={setName}
          placeholder="Your name"
          className="text-lg leading-tight font-semibold"
          inputClassName="h-8 text-lg leading-tight font-semibold"
          as="h3"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Header options"
              className="shrink-0 text-muted-foreground data-[state=open]:bg-accent"
            >
              <Ellipsis className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="text-xs font-normal text-zinc-500">
              Links on the page
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={header.linkStyle}
              onValueChange={(value) => setLinkStyle(value as LinkStyle)}
            >
              {LINK_STYLES.map(({ value, label }) => (
                <DropdownMenuRadioItem key={value} value={value}>
                  {label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem checked={icons} onCheckedChange={toggleIcons}>
              <Shapes />
              Icons in this list
            </DropdownMenuCheckboxItem>
            <DropdownMenuItem onSelect={() => addLine()}>
              <Plus />
              Add a line
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={open ? 'Collapse header' : 'Expand header'}
            className="shrink-0 text-muted-foreground"
          >
            {open ? (
              <ChevronsDownUp className="size-4 stroke-[1.75]" />
            ) : (
              <ChevronsUpDown className="size-4 stroke-[1.75]" />
            )}
          </Button>
        </CollapsibleTrigger>
      </div>

      {/* The header as it prints, so a collapsed card still says what is on the page. */}
      <div
        className="mt-1.5 space-y-0.5 text-xs leading-5 text-zinc-600 dark:text-zinc-400"
        data-header-printed
      >
        {printed.length === 0 ? (
          <p className="text-zinc-500">Nothing prints under your name yet.</p>
        ) : (
          printed.map((line) => (
            <p
              key={line.id}
              className={cn(
                'whitespace-pre-wrap',
                line.align === 'center' ? 'text-center' : 'text-left'
              )}
            >
              {headerLineText(line)}
            </p>
          ))
        )}
      </div>

      <CollapsibleContent>
        <div className="mt-3 space-y-3">
          {header.lines.map((line) => (
            <HeaderLineBlock key={line.id} line={line} lines={header.lines} />
          ))}
          <Button
            variant="outline"
            size="xs"
            onClick={() => addLine()}
            className="w-full border-dashed text-muted-foreground"
          >
            <Plus />
            New line
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
