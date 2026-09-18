import { useState } from 'react';
import { ChevronsDownUp, ChevronsUpDown, Ellipsis, Plus, Shapes } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
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
import {
  formatHeaderLineText,
  LINK_STYLES,
  getPrintableHeaderLines,
} from '@shared/resume/resumeHeader';
import { cn } from '@/lib/utils';
import { useResumeStore } from '@/stores/resumeStore';
import { useUiStore } from '@/stores/uiStore';
import type { LinkStyle } from '@shared/types/resume';
import { InlineEditField } from '../InlineEditField';
import { HeaderLineBlock } from './HeaderLineBlock';

/** The top of the resume: the name, and the header's lines of items below it. */
export function ResumeHeaderCard() {
  const contact = useResumeStore((s) => s.contact);
  const setName = useResumeStore((s) => s.setName);
  const setLinkStyle = useResumeStore((s) => s.setLinkStyle);
  const addLine = useResumeStore((s) => s.addHeaderLine);
  const shouldShowIcons = useUiStore((s) => s.shouldShowHeaderIcons);
  const toggleIcons = useUiStore((s) => s.toggleHeaderIcons);
  const [open, setOpen] = useState(true);
  const { header } = contact;
  const printed = getPrintableHeaderLines(header);

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
            <AppButton
              variant="muted"
              size="icon-sm"
              aria-label="Header options"
              className="shrink-0"
            >
              <Ellipsis className="size-4" />
            </AppButton>
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
            <DropdownMenuCheckboxItem checked={shouldShowIcons} onCheckedChange={toggleIcons}>
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
          <AppButton
            variant="muted"
            size="icon-sm"
            aria-label={open ? 'Collapse header' : 'Expand header'}
            className="shrink-0"
          >
            {open ? (
              <ChevronsDownUp className="size-4 stroke-[1.75]" />
            ) : (
              <ChevronsUpDown className="size-4 stroke-[1.75]" />
            )}
          </AppButton>
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
              {formatHeaderLineText(line)}
            </p>
          ))
        )}
      </div>

      <CollapsibleContent>
        <div className="mt-3 space-y-3">
          {header.lines.map((line) => (
            <HeaderLineBlock key={line.id} line={line} lines={header.lines} />
          ))}
          <AppButton
            variant="outline"
            size="xs"
            onClick={() => addLine()}
            className="w-full border-dashed text-muted-foreground"
          >
            <Plus />
            New line
          </AppButton>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
