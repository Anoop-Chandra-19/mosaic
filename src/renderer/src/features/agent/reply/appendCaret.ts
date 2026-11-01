/** The few parts of a rendered markdown tree this plugin walks. */
interface TreeNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: TreeNode[];
  value?: string;
}

/** An element, or text that shows: blocks are kept apart by text nodes of line breaks. */
const isWritten = (node: TreeNode) =>
  node.type === 'element' || (node.type === 'text' && node.value?.trim() !== '');

/** Marks the caret's element, which `ReplyMarkdown` draws as the caret. */
export const CARET_CLASS = 'reply-caret';

/**
 * A rehype plugin: puts a caret element at the end of the last thing written, inside the
 * deepest last element (the last list item, the bold run being typed), so it follows the
 * text rather than sitting on a line of its own. Never inside a code block, whose text
 * keeps its own lines.
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
