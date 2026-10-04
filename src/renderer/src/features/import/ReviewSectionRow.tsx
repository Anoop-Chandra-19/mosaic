import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { AppCollapsible, AppCollapsibleTrigger } from '@/components/AppCollapsible';
import { Text } from '@/components/Text';
import { textVariantClasses } from '@/components/textVariants';
import { recordPlaces, slideFromRecordedPlaces } from '@/lib/motion/slideToNewPlaces';
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

/** Marks each line with its item's id, so a layout switch can slide it to its new place. */
const PLACE_KEY = 'data-review-item';
/** The file's own lines arrive as the reading slides over to make room. */
const ARRIVES = 'animate-in fade-in-0 duration-220 motion-reduce:animate-none';

function SourceLines({ lines }: { lines: SourceLine[] }) {
  return (
    <div
      className={cn(
        textVariantClasses('meta'),
        'py-1 wrap-break-word whitespace-pre-wrap text-ink-muted',
        ARRIVES
      )}
    >
      {lines.map((line, index) =>
        'pageBreak' in line ? (
          <div
            key={index}
            className={cn(
              textVariantClasses('caption'),
              'my-0.5 flex items-center gap-1.5 text-amber before:flex-1 before:border-t before:border-dashed before:border-current after:flex-1 after:border-t after:border-dashed after:border-current'
            )}
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
    <Text
      as="em"
      variant="secondary"
      className="mt-0.5 flex items-center gap-1.25 text-amber not-italic"
    >
      <AlertTriangle className="size-2.75 shrink-0" />
      {children}
    </Text>
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
  const rowRef = useRef<HTMLLIElement>(null);
  const placesBeforeSource = useRef<Map<string, DOMRect> | null>(null);
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

  // Turning Source on or off moves every line to the other column; they slide there.
  const toggleSource = () => {
    if (rowRef.current) placesBeforeSource.current = recordPlaces(rowRef.current, PLACE_KEY);
    setShowingSource(!isShowingSource);
  };
  useLayoutEffect(() => {
    const places = placesBeforeSource.current;
    placesBeforeSource.current = null;
    if (places && rowRef.current) slideFromRecordedPlaces(rowRef.current, PLACE_KEY, places);
  }, [withSource]);

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
      {...{ [PLACE_KEY]: id }}
      className={cn(
        textVariantClasses('secondary'),
        'flex items-start gap-2 py-0.75 text-ink-soft',
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
    <AppCollapsible asChild open={isOpen} onOpenChange={onOpenChange}>
      <li ref={rowRef} className="group/row">
        <div className="flex min-w-0 items-center gap-2.25 px-2.75 py-1.75">
          <ReviewCheckbox
            className="mt-0"
            isOn={isOn}
            isMixed={isMixed}
            onToggle={() => (isMixed ? onKeepAll(within) : onToggle(section.id))}
            label={isMixed ? `Keep everything in ${section.label}` : `Import ${section.label}`}
          />
          <AppCollapsibleTrigger asChild>
            <AppButton variant="plain" className="h-5.5 min-w-0 gap-1.5 px-0">
              <RowCaret />
              <span className={cn('truncate', !isOn && 'text-ink-faint')}>{section.label}</span>
            </AppButton>
          </AppCollapsibleTrigger>
          {placedCount > 0 && (
            <Text
              variant="meta"
              className="rounded-[0.3125rem] border border-add-line bg-add-soft px-1.5 font-control text-add"
            >
              +{placedCount}
            </Text>
          )}
          <Text
            variant="secondary"
            className={cn('ml-auto shrink-0 text-right', !isOn && 'text-ink-faint')}
          >
            {describeKept(section, dropped)}
            {isMixed && <span className="text-ink-faint"> of {total}</span>}
          </Text>
          {isOpen && hasSource && (
            <AppButton
              variant="ghost"
              size="xs"
              aria-pressed={isShowingSource}
              title="The lines in your file this section came from"
              onClick={toggleSource}
              className="-ml-0.5 text-ink-muted aria-pressed:bg-line aria-pressed:text-foreground"
            >
              Source
            </AppButton>
          )}
        </div>
        {read?.doubts.map((doubt) => (
          <Text
            as="p"
            key={doubt}
            variant="secondary"
            className="-mt-0.75 flex items-start gap-1.5 pr-2.75 pb-1.75 pl-10.25 text-pretty text-amber"
          >
            <AlertTriangle className="mt-0.5 size-3 shrink-0" />
            {doubt}
          </Text>
        ))}
        {section.kind === 'custom' && (
          <Text as="p" variant="secondary" className="-mt-0.75 pr-2.75 pb-1.75 pl-10.25">
            Comes in as a custom {section.layout === 'lines' ? 'list' : 'section'}.
          </Text>
        )}
        <ReviewFold>
          <div className="mt-0.5 border-t border-dashed border-line bg-pane pt-0.5 pr-2.75 pb-2.25 pl-6.5">
            {withSource && (
              <div
                className={cn(
                  textVariantClasses('caption'),
                  'grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-4 border-b border-line pt-1.25 pb-0.75',
                  ARRIVES
                )}
              >
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
                            <b className="font-strong text-foreground">{title}</b>
                            <span className="ml-2 text-ink-muted">{entryMeta(entry)}</span>
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
    </AppCollapsible>
  );
}
