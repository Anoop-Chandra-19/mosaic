import { redoShortcutLabel, shortcutLabel } from '@/lib/keyboardShortcuts';

interface Shortcut {
  keys: string;
  action: string;
}

/** Every shortcut Mosaic has, in the labels this platform expects. */
function listKeyboardShortcuts(): { group: string; shortcuts: Shortcut[] }[] {
  return [
    {
      group: 'Editing',
      shortcuts: [
        { keys: shortcutLabel('Z'), action: 'Undo' },
        { keys: redoShortcutLabel(), action: 'Redo' },
        { keys: shortcutLabel('S'), action: 'Name a version' },
        { keys: 'Enter', action: 'Keep an edit' },
        { keys: 'Esc', action: 'Drop an edit' },
      ],
    },
    {
      group: 'Window',
      shortcuts: [
        { keys: shortcutLabel('B'), action: 'Show or hide the sidebar' },
        { keys: shortcutLabel('\\'), action: 'Show or hide the assistant, while AI is on' },
        { keys: shortcutLabel(','), action: 'Open Settings' },
        { keys: shortcutLabel('N'), action: 'Blank resume, on the Start panel' },
      ],
    },
    {
      group: 'Preview',
      shortcuts: [
        { keys: shortcutLabel('scroll'), action: 'Zoom toward the pointer' },
        { keys: 'Space+drag', action: 'Move the page' },
      ],
    },
  ];
}

export function KeyboardShortcutList() {
  return (
    <div className="flex flex-col gap-3 pb-3">
      {listKeyboardShortcuts().map(({ group, shortcuts }) => (
        <section key={group} aria-label={group}>
          <p className="pb-1 text-[0.65rem] font-bold tracking-wider text-zinc-500 uppercase">
            {group}
          </p>
          <dl className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {shortcuts.map(({ keys, action }) => (
              <div key={action} className="flex items-center justify-between gap-4 py-1.5">
                <dt className="text-xs text-zinc-700 dark:text-zinc-300">{action}</dt>
                <dd>
                  <kbd className="rounded border border-zinc-300 px-1.5 py-0.5 font-mono text-[0.6875rem] text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                    {keys}
                  </kbd>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
