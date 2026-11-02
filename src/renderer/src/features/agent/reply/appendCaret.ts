/** The few parts of a rendered markdown tree this plugin walks. */
interface TreeNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: TreeNode[];
  value?: string;
}

/** Ignores whitespace-only text nodes, including line breaks between blocks. */
const isWritten = (node: TreeNode) =>
  node.type === 'element' || (node.type === 'text' && node.value?.trim() !== '');

/** Marks the caret's element, which `ReplyMarkdown` draws as the caret. */
export const CARET_CLASS = 'reply-caret';

/**
 * A rehype plugin that appends a caret inside the deepest trailing element, such as the
 * last list item or bold span. This keeps it beside the text instead of on a separate line.
 * Stops before code blocks so the caret does not alter their line layout.
 */
export function appendCaret() {
  return (tree: TreeNode) => {
    let parent = tree;
    for (;;) {
      const last = parent.children?.findLast(isWritten);
      if (last?.type !== 'element' || last.tagName === 'pre' || !last.children) break;
      parent = last;
    }
    parent.children?.push({
      type: 'element',
      tagName: 'span',
      properties: { className: [CARET_CLASS] },
      children: [],
    });
  };
}
