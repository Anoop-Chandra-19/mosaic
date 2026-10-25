/**
 * The tools the add eval offers, in two shapes:
 *
 * - `one-call`: the app's propose tools as they ship, plus `propose_add` and a
 *   `propose_section` that brings its contents (lines, or the first entry) in the one call.
 *   The baseline.
 * - `builder`: the manifest under test, what B2b would ship. `propose_section` makes an
 *   empty section with a handle, filled with `propose_entry` or `propose_add`;
 *   `propose_move` moves one thing, and `propose_reorder` is its whole-list version, as
 *   replace everywhere is rewrite's, taking only the new order. Every handle argument says
 *   which kinds it takes, with an example and a pattern, every placing argument is the one
 *   `after`, and `kind` is an enum. Arguments are checked against this schema before a
 *   tool runs (`checkEvalToolArgs.ts`), as `checkAgentToolArgs` would. `propose_add` also
 *   puts an item into a line that lists things, after an item named as the line writes it.
 *
 * The eval measures the manifest: what models get right and wrong is feedback on these
 * definitions and on the refusals' wording, never on single cases (see the held-out set).
 * The builder's definitions move into `src/shared/agent-tools/` with B2b, and this file
 * goes. Until then they repeat that folder's shared wording, which it keeps to itself.
 */
import { stringArg, stringListArg } from '../../src/shared/agent-tools/defineAgentTool.ts';
import { PROPOSE_TOOLS } from '../../src/shared/agent-tools/proposeTools.ts';
import { BUILT_IN_KINDS } from '../../src/shared/resume/sectionPresets.ts';
import type { ModelTool } from '../../src/shared/types/modelTool.ts';
import type { EvalTool } from './evalModelProviders.ts';

export type AddEvalShape = 'one-call' | 'builder';

export interface AddEvalToolSet {
  /** Whether the builder's manifest is offered, rather than the shipped tools. */
  isBuilder: boolean;
}

export const ADD_EVAL_TOOL_SETS: Record<AddEvalShape, AddEvalToolSet> = {
  'one-call': { isBuilder: false },
  builder: { isBuilder: true },
};

export const ADD_EVAL_SHAPES = Object.keys(ADD_EVAL_TOOL_SETS) as AddEvalShape[];

export const SECTION_KINDS = [...BUILT_IN_KINDS, 'custom'];

const REASON_ARG = stringArg('One short line for the user on why. Shown with the suggestion.');

const NO_NEW_FACTS_RULE =
  'Never add a number, name, tool or claim the user has not given you, and never make their role sound bigger than they wrote it.';

const toEvalTool = ({ name, description, inputSchema }: ModelTool): EvalTool => ({
  name,
  description,
  parameters: inputSchema,
});

const ONE_CALL_ADD_TOOL: EvalTool = {
  name: 'propose_add',
  description: `Suggest a new bullet in an entry (e1), or a new line in a section that holds lines, such as Summary or Skills (s1). It never changes existing text: to change a bullet or line, use propose_rewrite. To add an item to a line that lists things, such as "Go, Python, Postgres", rewrite that line instead. For a new entry use propose_entry, and for a new section propose_section. ${NO_NEW_FACTS_RULE} When it needs a number only the user knows, write {{?}} where it goes and give withoutNumber, a version that needs no number.`,
  parameters: {
    type: 'object',
    properties: {
      into: stringArg(
        'The entry for a new bullet, or the section for a new line, such as e1 or s1.'
      ),
      after: stringArg(
        'The bullet or line it goes after, or "start" to put it first. Leave out to put it last.'
      ),
      text: stringArg('The whole new bullet or line.'),
      withoutNumber: stringArg('Only with {{?}} in text: the same text written to need no number.'),
      reason: REASON_ARG,
    },
    required: ['into', 'text'],
  },
};

const ONE_CALL_SECTION_TOOL: EvalTool = {
  name: 'propose_section',
  description: `Suggest a new section with its first contents; a section never arrives empty. Summary, skills, languages and interests hold lines: give lines. The other kinds hold entries: give the first entry's title, organization, location, dates and bullets, only what the user told you, since they confirm each one. A custom section takes a label, and lines or an entry. To add to a section that exists, use propose_add or propose_entry. ${NO_NEW_FACTS_RULE}`,
  parameters: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: SECTION_KINDS, description: 'A preset, or custom.' },
      label: stringArg("The heading. Needed for custom; a preset's is its own name."),
      after: stringArg(
        'The section it goes after, or "start" to put it first. Leave out to put it last.'
      ),
      lines: stringListArg('For a section that holds lines: its lines.'),
      title: stringArg(),
      organization: stringArg(),
      location: stringArg(),
      dates: stringArg('As the user wrote them, such as "2021 to 2024".'),
      bullets: stringListArg("The first entry's bullets, each a whole sentence."),
      reason: REASON_ARG,
    },
    required: ['kind'],
  },
};

type HandleKind = 'section' | 'entry' | 'bullet' | 'line';

const HANDLE_LETTER: Record<HandleKind, string> = {
  section: 's',
  entry: 'e',
  bullet: 'b',
  line: 'l',
};

const ALL_KINDS: HandleKind[] = ['section', 'entry', 'bullet', 'line'];

/** "a or b", "a, b or c". */
const listEither = (words: readonly string[]) =>
  words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} or ${words.at(-1)}`;

const handlePattern = (kinds: HandleKind[]) =>
  `^[${kinds.map((kind) => HANDLE_LETTER[kind]).join('')}][0-9]+$`;

/** "a bullet or line handle from the resume, such as b1 or l1". */
function describeHandles(kinds: HandleKind[]) {
  const article = kinds[0] === 'entry' ? 'an' : 'a';
  const examples = listEither(kinds.map((kind) => `${HANDLE_LETTER[kind]}1`));
  return `${article} ${listEither(kinds)} handle from the resume, such as ${examples}`;
}

const sentence = (text: string) => `${text[0].toUpperCase()}${text.slice(1)}.`;

/** A handle of one of `kinds`: what it is for, which kinds, an example, and its pattern. */
function handleArg(kinds: HandleKind[], role?: string) {
  const description = [role, sentence(describeHandles(kinds))].filter(Boolean).join(' ');
  return { type: 'string', pattern: handlePattern(kinds), description };
}

/** Where something new or moved goes, written once for every tool that places. */
function afterArg(kinds: HandleKind[]) {
  return {
    type: 'string',
    pattern: `^(start|[${kinds.map((kind) => HANDLE_LETTER[kind]).join('')}][0-9]+)$`,
    description: `The one it goes right after, in the same list: ${describeHandles(kinds)}, or "start" to put it first. Leave out to put it last.`,
  };
}

/**
 * `propose_add`'s `after`, which names an item two ways: a bullet's or line's handle, or
 * in a list line an item as the line writes it. So it has no pattern.
 */
const LIST_AFTER_ARG = {
  type: 'string',
  description:
    'The one it goes right after: a bullet or line handle in the same list, such as b1 or l1, or in a line that lists things the item as the line writes it, such as "Go"; or "start" to put it first. Leave out to put it last.',
};

const BUILDER_TOOLS: EvalTool[] = [
  {
    name: 'propose_rewrite',
    description: PROPOSE_TOOLS.propose_rewrite.description,
    parameters: {
      type: 'object',
      properties: {
        id: handleArg(['bullet', 'line'], 'The bullet or line to rewrite.'),
        text: stringArg('The whole new bullet or line.'),
        withoutNumber: stringArg(
          'Only with {{?}} in text: the same text written to need no number.'
        ),
        reason: REASON_ARG,
      },
      required: ['id', 'text'],
    },
  },
  {
    name: 'propose_rename',
    description: PROPOSE_TOOLS.propose_rename.description,
    parameters: {
      type: 'object',
      properties: {
        sectionId: handleArg(['section'], 'The section to rename.'),
        label: stringArg('The new heading.'),
        reason: REASON_ARG,
      },
      required: ['sectionId', 'label'],
    },
  },
  toEvalTool(PROPOSE_TOOLS.propose_replace_everywhere),
  {
    name: 'propose_split',
    description: PROPOSE_TOOLS.propose_split.description,
    parameters: {
      type: 'object',
      properties: {
        bulletId: handleArg(['bullet'], 'The bullet to split.'),
        secondStartsWith: stringArg('The first few words of the second bullet, copied exactly.'),
        reason: REASON_ARG,
      },
      required: ['bulletId', 'secondStartsWith'],
    },
  },
  {
    name: 'propose_merge',
    description: PROPOSE_TOOLS.propose_merge.description,
    parameters: {
      type: 'object',
      properties: {
        firstBulletId: handleArg(['bullet'], 'The first of the two.'),
        secondBulletId: handleArg(['bullet'], 'The bullet right after the first.'),
        text: stringArg('The joined bullet.'),
        reason: REASON_ARG,
      },
      required: ['firstBulletId', 'secondBulletId', 'text'],
    },
  },
  {
    name: 'propose_select',
    description: PROPOSE_TOOLS.propose_select.description,
    parameters: {
      type: 'object',
      properties: {
        id: handleArg(ALL_KINDS, 'What leaves the page or comes back.'),
        show: {
          type: 'boolean',
          description: 'false to leave it off the page, true to put it back.',
        },
        reason: REASON_ARG,
      },
      required: ['id', 'show'],
    },
  },
  {
    name: 'propose_add',
    description: `Suggest a new bullet in an entry, a new line in a section that holds lines, such as Summary or Skills, or a new item in a line that lists things, such as "Go, Python, Postgres". It never rewrites existing text: for that, use propose_rewrite. For a new entry use propose_entry, and for a new section propose_section. ${NO_NEW_FACTS_RULE} When it needs a number only the user knows, write {{?}} where it goes and give withoutNumber, a version that needs no number.`,
    parameters: {
      type: 'object',
      properties: {
        into: handleArg(
          ['entry', 'section', 'line'],
          'The entry a new bullet goes into, the section a new line goes into, or the line that lists things a new item goes into.'
        ),
        after: LIST_AFTER_ARG,
        text: stringArg('The whole new bullet or line, or for a list, just the new item.'),
        withoutNumber: stringArg(
          'Only with {{?}} in text: the same text written to need no number.'
        ),
        reason: REASON_ARG,
      },
      required: ['into', 'text'],
    },
  },
  {
    name: 'propose_entry',
    description: `Suggest a new entry in a section that holds entries, such as a job the user describes. The user confirms its title, organization, location and dates one by one, so give only what they told you. Its bullets are reviewed like rewrites. ${NO_NEW_FACTS_RULE}`,
    parameters: {
      type: 'object',
      properties: {
        sectionId: handleArg(['section'], 'The section it goes into.'),
        after: afterArg(['entry']),
        title: stringArg('What the user was: a role, a degree, a project.'),
        organization: stringArg('Where or for whom.'),
        location: stringArg(),
        dates: stringArg('As the user wrote them, such as "2021 to 2024".'),
        bullets: stringListArg('Its bullets, each a whole sentence.'),
        reason: REASON_ARG,
      },
      required: ['sectionId'],
    },
  },
  {
    name: 'propose_section',
    description:
      'Suggest a new, empty section. The answer gives its handle: fill it before you finish, its first entry with propose_entry or its lines with propose_add, since a section never reaches the user empty. Summary, skills, languages and interests hold lines; the other presets hold entries; a custom section holds whichever you put in it first. To add to a section that exists, use propose_add or propose_entry.',
    parameters: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          enum: SECTION_KINDS,
          description: 'A preset, or custom for any other section.',
        },
        label: stringArg("The heading. Needed for custom; a preset's is its own name."),
        after: afterArg(['section']),
        reason: REASON_ARG,
      },
      required: ['kind'],
    },
  },
  {
    name: 'propose_move',
    description:
      'Suggest moving one section, entry, bullet or line to another place in the list it is in: give before or after, one handle of the same list. For a whole new order of a list, use propose_reorder.',
    parameters: {
      type: 'object',
      properties: {
        id: handleArg(ALL_KINDS, 'What moves.'),
        before: handleArg(ALL_KINDS, 'The one it goes right before, in the same list.'),
        after: afterArg(ALL_KINDS),
        reason: REASON_ARG,
      },
      required: ['id'],
    },
  },
  {
    name: 'propose_reorder',
    description:
      "Suggest a whole new order for one list: the sections, a section's entries or lines, or an entry's bullets. To move one thing, use propose_move.",
    parameters: {
      type: 'object',
      properties: {
        order: {
          type: 'array',
          items: { type: 'string', pattern: handlePattern(ALL_KINDS) },
          description:
            'Every handle of one list, each once, in the new order, such as ["b3", "b1", "b2"]. The handles say which list it is.',
        },
        reason: REASON_ARG,
      },
      required: ['order'],
    },
  },
];

/** The tools a shape offers. */
export function describeAddEvalTools(shape: AddEvalShape): EvalTool[] {
  if (ADD_EVAL_TOOL_SETS[shape].isBuilder) return BUILDER_TOOLS;
  return [
    ...Object.values(PROPOSE_TOOLS).map(toEvalTool),
    ONE_CALL_ADD_TOOL,
    ONE_CALL_SECTION_TOOL,
  ];
}
