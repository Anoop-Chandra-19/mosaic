import { useState, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { Collapsible, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { ResumeEntry, ResumeSection } from '@shared/types/resume';
import { formatCount as count } from './formatCount';
import type { SourceLine } from './parsing/importLines';
import type { ParsedResume } from './parsing/parseResume';
import { ReviewCheckbox } from './ReviewCheckbox';
import { ReviewFold, RowCaret } from './ReviewFold';

/** "2 entries, 5 bullets", counting what is kept. */
function describeKept({ layout, items }: ResumeSection, dropped: ReadonlySet<string>): string {
  const kept = items.filter((item) => !dropped.has(item.id));
  if (layout === 'lines') return count(kept.length, 'line');
  const bullets = kept.reduce(
    (n, item) => n + item.bullets.filter((bullet) => !dropped.has(bullet.id)).length,
    0
  );
  const entries = count(kept.length, 'entry', 'entries');
  return bullets > 0 ? `${entries}, ${count(bullets, 'bullet')}` : entries;
}

const idsWithin = (section: ResumeSection) =>
  section.items.flatMap((item) => [item.id, ...item.bullets.map((bullet) => bullet.id)]);

const entryMeta = ({ organization, location, dates }: ResumeEntry) =>
  [organization, location, dates].filter(Boolean).join(' · ');

function SourceLines({ lines }: { lines: SourceLine[] }) {
  return (
    <div className="py-1 font-mono text-[0.6875rem] leading-[1.55] wrap-break-word whitespace-pre-wrap text-ink-muted">
      {lines.map((line, index) =>
        'pageBreak' in line ? (
          <div
            key={index}
            className="my-0.5 flex items-center gap-1.5 font-sans text-[0.65625rem] text-amber-600 before:flex-1 before:border-t before:border-dashed before:border-current after:flex-1 after:border-t after:border-dashed after:border-current dark:text-amber-400"
          >
            page break
          </div>
        ) : (
          <div key={index}>{line.bullet ? `• ${line.text}` : line.text}</div>
        )
      )}
    </div>
  );
}

function Doubt({ children }: { children: ReactNode }) {
  return (
    <em className="mt-0.5 flex items-center gap-1.25 text-[0.71875rem] text-amber-600 not-italic dark:text-amber-400">
      <AlertTriangle className="size-2.75 shrink-0" />
      {children}
    </em>
  );
}

export function ReviewSectionRow({
  section,
  review,
  dropped,
  placedCount,
  isOpen,
  onOpenChange,
  onToggle,
  onKeepAll,
}: {
  section: ResumeSection;
  review: ParsedResume['review'];
  dropped: ReadonlySet<string>;
  placedCount: number;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onToggle: (id: string) => void;
  onKeepAll: (ids: string[]) => void;
}) {
  const [isShowingSource, setShowingSource] = useState(false);
  const isOn = !dropped.has(section.id);
  const within = idsWithin(section);
  const isMixed = isOn && within.some((id) => dropped.has(id));
  const read = review.sections[section.id];
  const hasSource = read !== undefined;
  const withSource = hasSource && isShowingSource;
  const total =
    section.layout === 'lines'
      ? count(section.items.length, 'line')
      : count(section.items.length, 'entry', 'entries');

  const sourceOf = (id: string, fallback: string) =>
    review.items[id]?.source ?? [{ text: fallback }];
  const doubtsOf = (id: string) => review.items[id]?.doubts ?? [];
  const row = (key: string, source: SourceLine[], node: ReactNode) =>
    withSource ? (
      <div
        key={key}
        className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-4 border-b border-dashed border-line last:border-b-0"
      >
        <SourceLines lines={source} />
        {node}
      </div>
    ) : (
      <div key={key}>{node}</div>
    );

  const line = (
    id: string,
    isOff: boolean,
    label: string,
    content: ReactNode,
    options: { isBullet?: boolean; isMixed?: boolean; onClick?: () => void } = {}
  ) => (
    <div
      className={cn(
        'flex items-start gap-2 py-0.75 text-[0.78125rem] leading-normal text-ink-soft',
        options.isBullet && 'pl-4.75'
      )}
    >
      <ReviewCheckbox
        isOn={!dropped.has(id)}
        isMixed={options.isMixed}
        onToggle={options.onClick ?? (() => onToggle(id))}
        label={label}
      />
      <span
        className={cn(
          'min-w-0 text-pretty',
          options.isBullet && "before:mr-1.5 before:text-ink-faint before:content-['—']",
          isOff && 'text-ink-faint line-through decoration-line-heavy'
        )}
      >
        {content}
      </span>
    </div>
  );

  return (
    <Collapsible asChild open={isOpen} onOpenChange={onOpenChange}>
      <li className="group/row">
        <div className="flex min-w-0 items-center gap-2.25 px-2.75 py-1.75">
          <ReviewCheckbox
            className="mt-0"
            isOn={isOn}
            isMixed={isMixed}
            onToggle={() => (isMixed ? onKeepAll(within) : onToggle(section.id))}
            label={isMixed ? `Keep everything in ${section.label}` : `Import ${section.label}`}
          />
          <CollapsibleTrigger asChild>
            <AppButton variant="plain" className="h-5.5 min-w-0 gap-1.5 px-0 text-[0.8125rem]">
              <RowCaret />
              <span className={cn('truncate', !isOn && 'text-ink-faint')}>{section.label}</span>
            </AppButton>
          </CollapsibleTrigger>
          {placedCount > 0 && (
            <span className="rounded-md border border-emerald-300 bg-emerald-50 px-1.5 text-[0.6875rem] leading-4 font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400">
              +{placedCount}
            </span>
          )}
          <span
            className={cn(
              'ml-auto shrink-0 text-right text-xs',
              isOn ? 'text-ink-muted' : 'text-ink-faint'
            )}
          >
            {describeKept(section, dropped)}
            {isMixed && <span className="text-ink-faint"> of {total}</span>}
          </span>
          {isOpen && hasSource && (
            <AppButton
              variant="ghost"
              size="xs"
              aria-pressed={isShowingSource}
              onClick={() => setShowingSource(!isShowingSource)}
              className="-ml-0.5 text-ink-muted aria-pressed:bg-line aria-pressed:text-foreground"
            >
              Source
            </AppButton>
          )}
        </div>
        {read?.doubts.map((doubt) => (
          <p
            key={doubt}
            className="-mt-0.75 flex items-start gap-1.5 pr-2.75 pb-1.75 pl-10.25 text-xs text-pretty text-amber-600 dark:text-amber-400"
          >
            <AlertTriangle className="mt-0.5 size-3 shrink-0" />
            {doubt}
          </p>
        ))}
        {section.kind === 'custom' && (
          <p className="-mt-0.75 pr-2.75 pb-1.75 pl-10.25 text-xs text-ink-muted">
            Comes in as a custom {section.layout === 'lines' ? 'list' : 'section'}.
          </p>
        )}
        <ReviewFold>
          <div className="mt-0.5 border-t border-dashed border-line bg-pane pt-0.5 pr-2.75 pb-2.25 pl-6.5">
            {withSource && (
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-4 border-b border-line pt-1.25 pb-0.75 text-[0.6875rem] text-ink-faint">
                <span>In the file</span>
                <span>In Mosaic</span>
              </div>
            )}
            {section.layout === 'lines'
              ? section.items.map((item) =>
                  row(
                    item.id,
                    sourceOf(item.id, item.text ?? ''),
                    line(
                      item.id,
                      !isOn || dropped.has(item.id),
                      'Keep this line',
                      <>
                        {item.text}
                        {doubtsOf(item.id).map((doubt) => (
                          <Doubt key={doubt}>{doubt}</Doubt>
                        ))}
                      </>
                    )
                  )
                )
              : section.items.map((entry) => {
                  const isEntryOff = !isOn || dropped.has(entry.id);
                  const bulletIds = entry.bullets.map((bullet) => bullet.id);
                  const isEntryMixed =
                    !dropped.has(entry.id) && bulletIds.some((id) => dropped.has(id));
                  const title = entry.title || entry.organization || '';
                  return (
                    <div
                      key={entry.id}
                      className={cn(
                        withSource
                          ? 'not-first:border-t not-first:border-line'
                          : 'not-first:mt-1.25'
                      )}
                    >
                      {row(
                        entry.id,
                        sourceOf(entry.id, title),
                        line(
                          entry.id,
                          isEntryOff,
                          `Keep ${title || 'this entry'}`,
                          <>
                            <b className="font-semibold text-foreground">{title}</b>
                            <span className="ml-2 text-xs text-ink-muted">{entryMeta(entry)}</span>
                            {doubtsOf(entry.id).map((doubt) => (
                              <Doubt key={doubt}>{doubt}</Doubt>
                            ))}
                          </>,
                          {
                            isMixed: isEntryMixed,
                            onClick: () =>
                              isEntryMixed ? onKeepAll(bulletIds) : onToggle(entry.id),
                          }
                        )
                      )}
                      {entry.bullets.map((bullet) =>
                        row(
                          bullet.id,
                          sourceOf(bullet.id, bullet.text),
                          line(
                            bullet.id,
                            isEntryOff || dropped.has(bullet.id),
                            'Keep this bullet',
                            <>
                              {bullet.text}
                              {doubtsOf(bullet.id).map((doubt) => (
                                <Doubt key={doubt}>{doubt}</Doubt>
                              ))}
                            </>,
                            { isBullet: true }
                          )
                        )
                      )}
                    </div>
                  );
                })}
          </div>
        </ReviewFold>
      </li>
    </Collapsible>
  );
}
