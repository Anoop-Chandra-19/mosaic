import type { ModelTool } from '../types/modelTool';
import {
  afterArg,
  booleanArg,
  defineAgentTool,
  handleArg,
  handleListArg,
  stringArg,
  stringListArg,
} from './defineAgentTool.ts';
import { HANDLE_KINDS } from './handleKinds.ts';

/*
 * The tools that suggest changes. Nothing changes until the user reviews a suggestion. The
 * descriptions share their rules, so tuning one means reading them side by side.
 *
 * One bullet's words always change through propose_rewrite, the whole bullet, and never a
 * find and replace: offered both, models chose replace and did worse, since swapping a verb
 * inside a sentence breaks the words around it ("Reduced reduce costs"). Replace is only for
 * one term across the whole resume, where a noun swaps for a noun.
 *
 * A tool that takes several kinds of handle calls it `id`; one that takes a single kind
 * names it (`bulletId`, `sectionId`). Every handle argument says which kinds it takes,
 * with an example and a pattern, and every tool that places takes the one `after`. A
 * heading has its own tool, propose_rename, so a rewrite of a section's lines can't
 * rename the section by mistake. propose_reorder takes only the new order: its handles
 * say which list it is.
 */

/** The propose tools, and their arguments once checked. */
export interface ProposeToolArgs {
  propose_rewrite: { id: string; text: string; withoutNumber?: string; reason?: string };
  propose_rename: { sectionId: string; label: string; reason?: string };
  propose_replace_everywhere: { find: string; replace: string; reason?: string };
  propose_split: { bulletId: string; secondStartsWith: string; reason?: string };
  propose_merge: {
    firstBulletId: string;
    secondBulletId: string;
    text: string;
    reason?: string;
  };
  propose_reorder: { order: string[]; reason?: string };
  propose_select: { id: string; show: boolean; reason?: string };
  propose_entry: {
    sectionId: string;
    after?: string;
    title?: string;
    organization?: string;
    location?: string;
    dates?: string;
    bullets?: string[];
    reason?: string;
  };
}

export type ProposeToolName = keyof ProposeToolArgs;

const REASON_ARG = stringArg('One short line for the user on why. Shown with the suggestion.');

const WHOLE_SENTENCE_RULE =
  'Change only what the request needs, but the result must still read as a correct sentence: when a swapped word needs its neighbours to change (swapping "Assisted" for "Led" in "Assisted in the planning" gives "Led the planning"), change them too.';

const NO_NEW_FACTS_RULE =
  'Never add a number, name, tool or claim the user has not given you, and never make their role sound bigger than they wrote it.';

export const PROPOSE_TOOLS: Record<ProposeToolName, ModelTool> = {
  propose_rewrite: defineAgentTool(
    'propose_rewrite',
    `Suggest a new text for one bullet or line, for any change to it: rewording, or swapping the words the user names. The user reviews it before anything changes. ${WHOLE_SENTENCE_RULE} ${NO_NEW_FACTS_RULE} When it needs a number only the user knows, write {{?}} where it goes and give withoutNumber, a version that needs no number. For a section's heading, use propose_rename.`,
    {
      id: handleArg(
        ['bullet', 'line'],
        "The bullet or line to rewrite; for a section's heading, use propose_rename."
      ),
      text: stringArg('The whole new bullet or line.'),
      withoutNumber: stringArg('Only with {{?}} in text: the same text written to need no number.'),
      reason: REASON_ARG,
    },
    ['id', 'text']
  ),
  propose_rename: defineAgentTool(
    'propose_rename',
    'Suggest a new heading for a section, such as "Experience" to "Work history". Only when the user asks for a new heading: to change what a section says, rewrite its bullets or lines.',
    {
      sectionId: handleArg(['section'], 'The section to rename.'),
      label: stringArg('The new heading.'),
      reason: REASON_ARG,
    },
    ['sectionId', 'label']
  ),
  propose_replace_everywhere: defineAgentTool(
    'propose_replace_everywhere',
    `Rename one term wherever the bullets and lines use it, one suggestion each: "Postgres" to "PostgreSQL", "JS" to "JavaScript". \`find\` is copied exactly as the resume writes it, and matches whole words only, so "Go" leaves "Google" alone. Headings are left alone. For a change to one bullet or line, use propose_rewrite. ${NO_NEW_FACTS_RULE}`,
    { find: stringArg(), replace: stringArg(), reason: REASON_ARG },
    ['find', 'replace']
  ),
  propose_split: defineAgentTool(
    'propose_split',
    'Suggest splitting one bullet in two, keeping its words as they are. secondStartsWith is where the second bullet begins: its first few words, copied exactly from the bullet.',
    {
      bulletId: handleArg(['bullet'], 'The bullet to split.'),
      secondStartsWith: stringArg('The first few words of the second bullet, copied exactly.'),
      reason: REASON_ARG,
    },
    ['bulletId', 'secondStartsWith']
  ),
  propose_merge: defineAgentTool(
    'propose_merge',
    `Suggest joining two bullets that sit next to each other in one entry. text is the joined bullet: one correct sentence that keeps the facts of both. ${NO_NEW_FACTS_RULE}`,
    {
      firstBulletId: handleArg(['bullet'], 'The first of the two.'),
      secondBulletId: handleArg(['bullet'], 'The bullet right after the first.'),
      text: stringArg('The joined bullet.'),
      reason: REASON_ARG,
    },
    ['firstBulletId', 'secondBulletId', 'text']
  ),
  propose_reorder: defineAgentTool(
    'propose_reorder',
    "Suggest a whole new order for one list: the sections, a section's entries or lines, or an entry's bullets.",
    {
      order: handleListArg(
        HANDLE_KINDS,
        'Every handle of one list, each once, in the new order, such as ["b3", "b1", "b2"]. The handles say which list it is.'
      ),
      reason: REASON_ARG,
    },
    ['order']
  ),
  propose_select: defineAgentTool(
    'propose_select',
    'Suggest leaving a bullet, line, entry or section off the page (show false), or putting it back (show true). An entry or section goes with everything in it. It stays in the resume either way, so this is how to fit the page: nothing is ever deleted.',
    {
      id: handleArg(HANDLE_KINDS, 'What leaves the page or comes back.'),
      show: booleanArg('false to leave it off the page, true to put it back.'),
      reason: REASON_ARG,
    },
    ['id', 'show']
  ),
  propose_entry: defineAgentTool(
    'propose_entry',
    `Suggest a new entry in a section that holds entries, such as a job the user describes. The user confirms its title, organization, location and dates one by one, so give only what they told you. Its bullets are reviewed like rewrites. ${NO_NEW_FACTS_RULE}`,
    {
      sectionId: handleArg(['section'], 'The section it goes into.'),
      after: afterArg(['entry']),
      title: stringArg('What the user was: a role, a degree, a project.'),
      organization: stringArg('Where or for whom.'),
      location: stringArg(),
      dates: stringArg('As the user wrote them, such as "2021 to 2024".'),
      bullets: stringListArg('Its bullets, each a whole sentence.'),
      reason: REASON_ARG,
    },
    ['sectionId']
  ),
};
