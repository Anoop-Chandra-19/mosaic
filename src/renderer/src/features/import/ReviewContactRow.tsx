import { Fragment, useState } from 'react';
import { AppButton } from '@/components/AppButton';
import { Collapsible, CollapsibleTrigger } from '@/components/ui/collapsible';
import { getPrintableHeaderLines } from '@shared/resume/resumeHeader';
import type { ContactInfo } from '@shared/types/resume';
import { formatCount } from './formatCount';
import { ReviewFold, RowCaret } from './ReviewFold';

/** The name, then each header line as it will print: a header is lines, not fields. */
function contactRows({ name, header }: ContactInfo): [string, string][] {
  const lines = getPrintableHeaderLines(header).map((line, index): [string, string] => [
    `Line ${index + 1}`,
    line.items.map((item) => item.text || item.href).join(line.separator),
  ]);
  return name ? [['Name', name], ...lines] : lines;
}

export function ReviewContactRow({
  contact,
  linkNote,
  isHeaderKept,
}: {
  contact: ContactInfo;
  linkNote: string | null;
  isHeaderKept: boolean;
}) {
  const [isOpen, setOpen] = useState(false);
  const fields = contactRows(contact);
  const lineCount = fields.length - (contact.name ? 1 : 0);
  const labels = [
    ...(contact.name ? ['Name'] : []),
    ...(lineCount > 0 ? [formatCount(lineCount, 'line')] : []),
  ];

  return (
    <Collapsible asChild open={isOpen} onOpenChange={setOpen}>
      <li className="group/row">
        <div className="flex min-w-0 items-center gap-2.25 px-2.75 py-1.75">
          <span className="w-[0.9375rem] shrink-0" />
          <CollapsibleTrigger asChild>
            <AppButton variant="plain" className="h-5.5 gap-1.5 px-0 text-[0.8125rem]">
              <RowCaret />
              Contact
            </AppButton>
          </CollapsibleTrigger>
          <span
            className={
              labels.length
                ? 'ml-auto min-w-0 text-right text-xs text-ink-muted'
                : 'ml-auto text-xs text-amber-600 dark:text-amber-400'
            }
          >
            {labels.length ? labels.join(', ') : 'Nothing found'}
          </span>
        </div>
        {isHeaderKept && (
          <p className="-mt-0.75 pr-2.75 pb-1.75 pl-10.25 text-xs text-ink-muted">
            Your header stays as it is.
          </p>
        )}
        <ReviewFold>
          <div className="mt-0.5 border-t border-dashed border-line bg-pane pt-0.5 pr-2.75 pb-2.25 pl-6.5">
            <div className="grid grid-cols-[5.25rem_minmax(0,1fr)] gap-x-3 gap-y-0.75 py-1.5 pl-4.75 text-[0.78125rem]">
              {fields.map(([label, value], index) => (
                <Fragment key={index}>
                  <span className="text-ink-muted">{label}</span>
                  <span className="wrap-break-word text-foreground">{value}</span>
                </Fragment>
              ))}
            </div>
            {linkNote && <p className="pt-0.5 pl-4.75 text-xs text-ink-muted">{linkNote}</p>}
          </div>
        </ReviewFold>
      </li>
    </Collapsible>
  );
}
