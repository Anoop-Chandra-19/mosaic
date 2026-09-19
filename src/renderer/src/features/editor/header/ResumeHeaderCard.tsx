import { Fragment } from 'react';
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
import { LINK_STYLES, getPrintableHeaderLines } from '@shared/resume/resumeHeader';
import { cn } from '@/lib/utils';
import { HEADER_OUTLINE_ID, useOutlineStore } from '@/stores/outlineStore';
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
  const open = useOutlineStore((s) => !s.collapsedIds.includes(HEADER_OUTLINE_ID));
  const setOpen = useOutlineStore((s) => s.setOpen);
  const { header } = contact;
  const printed = getPrintableHeaderLines(header);

  return (
    <Collapsible
      open={open}
      onOpenChange={(next) => setOpen(HEADER_OUTLINE_ID, next)}
      className="mx-0.5 mb-3 rounded-[0.5625rem] border border-line bg-pane-raised p-3"
    >
      <div className="flex items-center justify-between gap-1.5">
        <InlineEditField
          value={contact.name}
          onSave={setName}
          placeholder="Your name"
          className="text-base font-semibold tracking-[-0.012em] text-foreground"
          inputClassName="text-base font-semibold tracking-[-0.012em] md:text-base"
          as="h3"
        />
        <div className="flex shrink-0 items-center gap-0.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <AppButton variant="ghost" size="xs" shape="square" aria-label="Header options">
                <Ellipsis />
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
              variant="ghost"
              size="xs"
              shape="square"
              aria-label={open ? 'Collapse header' : 'Expand header'}
              title={open ? 'Collapse' : 'Expand'}
            >
              {open ? <ChevronsDownUp /> : <ChevronsUpDown />}
            </AppButton>
          </CollapsibleTrigger>
        </div>
      </div>

      {/* The header as it prints, so a collapsed card still says what is on the page. */}
      <div
        className={cn(
          'mt-2.5 rounded-md border border-line bg-pane-sunken px-[0.6875rem] py-2.5 text-center text-[0.775rem] leading-[1.65] wrap-break-word text-ink-soft',
          header.linkStyle === 'underline' &&
            '[&_a]:underline [&_a]:decoration-line-heavy [&_a]:underline-offset-2'
        )}
        title="Exactly how the header is written on the page"
        data-header-printed
      >
        {printed.length === 0 ? (
          <p className="text-ink-faint">nothing in the header yet</p>
        ) : (
          printed.map((line) => (
            <p key={line.id} className={line.align === 'center' ? 'text-center' : 'text-left'}>
              {line.items.map((item, index) => (
                <Fragment key={item.id}>
                  {index > 0 && <span className="whitespace-pre">{line.separator}</span>}
                  {item.href ? <a>{item.text}</a> : item.text}
                </Fragment>
              ))}
            </p>
          ))
        )}
      </div>

      <CollapsibleContent>
        <div className="mt-2.5">
          {header.lines.map((line) => (
            <HeaderLineBlock key={line.id} line={line} lines={header.lines} />
          ))}
          <AppButton
            variant="dashed"
            size="sm"
            onClick={() => addLine()}
            className="mt-2.5 w-full text-[0.7875rem] font-semibold tracking-[0.01em]"
          >
            <Plus />
            New header line
          </AppButton>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
