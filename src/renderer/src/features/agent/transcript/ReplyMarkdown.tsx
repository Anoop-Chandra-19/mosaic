import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remend from 'remend';
import { Square, SquareCheck } from 'lucide-react';
import { Text, textVariantClasses } from '@/components/ui-kit';
import { cn } from '@/lib/utils';
import { appendCaret, CARET_CLASS } from './appendCaret';
import { splitFinishedBlocks } from './splitFinishedBlocks';
import { TracingDots } from './TracingDots';

/*
 * The assistant's text as the markdown it writes, drawn in the pane's own type: no HTML
 * ever reaches the page (react-markdown builds elements, and raw HTML in the text stays
 * text). While a run is still writing, markers it hasn't closed yet are closed for the
 * moment (`remend`), so a bold run shows bold as it is typed, and a link shows as its words
 * until its address arrives. The stored text is never changed.
 */

/** The end of a reply still being written. */
function Caret() {
  return (
    <i
      aria-hidden
      className="ml-0.5 inline-block h-3 w-1.5 animate-caret-blink bg-amber align-[-0.125rem] motion-reduce:animate-none"
    />
  );
}

const heading: Components['h1'] = ({ children }) => (
  <Text as="p" variant="strong">
    {children}
  </Text>
);

const ELEMENTS: Components = {
  p: ({ children }) => (
    <Text as="p" variant="body" className="text-pretty">
      {children}
    </Text>
  ),
  strong: ({ children }) => <strong className="font-strong text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  del: ({ children }) => <del className="line-through">{children}</del>,
  // A reply's headings are emphasis inside one message, not the page's outline.
  h1: heading,
  h2: heading,
  h3: heading,
  h4: heading,
  h5: heading,
  h6: heading,
  ul: ({ children }) => (
    <ul className="list-disc space-y-1 pl-4 marker:text-ink-faint">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal space-y-1 pl-5 tabular-nums marker:text-ink-faint">{children}</ol>
  ),
  li: ({ children }) => <li className="pl-0.5 text-pretty">{children}</li>,
  // Task list items, which GFM writes as checkboxes: shown, never something to tick.
  input: ({ checked }) => {
    const Icon = checked ? SquareCheck : Square;
    return <Icon aria-hidden className="mr-1.5 inline size-3 align-[-0.125rem] text-ink-faint" />;
  },
  code: ({ children }) => (
    <code className={cn(textVariantClasses('key'), 'rounded-[0.25rem] bg-line px-1 py-px')}>
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="overflow-x-auto rounded-sm border border-line bg-pane-sunken px-2.5 py-2 [&>code]:bg-transparent [&>code]:p-0">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-line-strong pl-2.5 text-ink-muted">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-line" />,
  table: ({ children }) => (
    <div className="overflow-x-auto">
      <table
        className={cn(textVariantClasses('secondary'), 'w-full border-collapse text-ink-soft')}
      >
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-line-strong px-2 py-1 text-left font-strong text-foreground">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="border-b border-line px-2 py-1 align-top">{children}</td>,
  // Opened in the browser by main, which allows only web and mail addresses. One whose
  // address isn't safe to follow comes through without one, and stays words.
  a: ({ href, children }) =>
    href ? (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-foreground underline decoration-line-heavy underline-offset-2 hover:decoration-ink-faint"
      >
        {children}
      </a>
    ) : (
      children
    ),
  img: () => null,
  span: ({ className, children }) =>
    className === CARET_CLASS ? <Caret /> : <span className={className}>{children}</span>,
};

/**
 * A last line of markers alone (`**` before the words it will make bold, a lone `-`) waits
 * for its words: closed as it stands, `**` would become `****`, which draws a rule.
 */
const BARE_MARKERS_LINE = /\n[ \t]*[*_~`#>+-]+[ \t]*$/;

const closeForNow = (text: string) =>
  remend(text.replace(BARE_MARKERS_LINE, ''), { linkMode: 'text-only', katex: false });

const PLUGINS = [remarkGfm];
const WRITING_PLUGINS = [appendCaret];

interface ReplyMarkdownProps {
  text: string;
  /** Still being written: unclosed markers are closed for now, and the caret follows the text. */
  isWriting?: boolean;
}

/** One run of markdown. It draws no element of its own, so its blocks share the reply's spacing. */
function MarkdownBlock({ text, isWriting }: { text: string; isWriting: boolean }) {
  return (
    <Markdown
      remarkPlugins={PLUGINS}
      rehypePlugins={isWriting ? WRITING_PLUGINS : undefined}
      components={ELEMENTS}
    >
      {isWriting ? closeForNow(text) : text}
    </Markdown>
  );
}

/**
 * While writing, a block at a time, so a finished block is never parsed again however long the
 * reply grows. Once written, the text is parsed whole, since a link's address can be defined
 * in another block.
 */
export function ReplyMarkdown({ text, isWriting = false }: ReplyMarkdownProps) {
  if (isWriting && text.trim() === '') {
    return (
      <p>
        <TracingDots />
      </p>
    );
  }
  const blocks = isWriting ? splitFinishedBlocks(text) : [text];
  return (
    <div
      className={cn(textVariantClasses('body'), 'wrap-break-word [&>*+*]:mt-2.25 [&>p+p]:mt-1.5')}
    >
      {blocks.map((block, index) => (
        <MarkdownBlock
          key={index}
          text={block}
          isWriting={isWriting && index === blocks.length - 1}
        />
      ))}
    </div>
  );
}
