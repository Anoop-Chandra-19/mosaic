import { current } from 'immer';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { DbError, getDb } from '@/lib/storage/mosaicDb';
import { createEmptyResume } from '@shared/resume/defaultResume';
import { createHeaderItem, createHeaderLine } from '@shared/resume/resumeHeader';
import type { Draft } from '@shared/types/db';
import type {
  HeaderItem,
  HeaderItemKind,
  HeaderLine,
  LinkColor,
  LinkStyle,
  ResumeData,
  ResumeEntry,
  ResumeHeader,
  ResumeSection,
} from '@shared/types/resume';

/*
 * The draft in the editor: one template's document. Every edit bumps `rev` and schedules a
 * save; main stores the draft and the rev together. Documents from outside the editor
 * (opening a template, an import, a restore) arrive through `loadDraft` and are not saved
 * back — main just wrote them.
 */

/** A save goes out once typing pauses this long… */
const SAVE_DELAY_MS = 1000;
/** …or after this long of non-stop edits, so a crash loses seconds, not a session. */
const SAVE_MAX_WAIT_MS = 5000;

/** How many steps back the editor remembers, within one open draft. */
const UNDO_HISTORY_LIMIT = 100;

/** A step that can be taken back: the document before it, and what the step did. */
interface HistoryStep {
  doc: ResumeData;
  /** Reads after "Undo": "delete bullet". */
  label: string;
}

/*
 * The two stacks sit outside the store: they are whole documents, nothing renders them,
 * and immer has no business drafting them. What the buttons and the status bar need is in
 * the store instead, as `undoLabel`, `redoLabel`, and the count against the baseline.
 * Both stacks belong to the draft in the editor and are dropped when another one loads.
 */
let past: HistoryStep[] = [];
let future: HistoryStep[] = [];

interface ResumeState extends ResumeData {
  /** The template whose draft this is; null while no template is open. */
  templateId: string | null;
  /** Bumped by every edit — the counter the agent's anchors check. */
  rev: number;
  /** The last save failed for a reason other than being superseded. */
  saveFailed: boolean;
  /**
   * When this session last saved the draft; null until it has. Before that, the template's
   * `updatedAt` says when main last wrote it.
   */
  savedAt: number | null;

  /** What Ctrl/⌘+Z would take back ("delete bullet"), or null when there is nothing. */
  undoLabel: string | null;
  /** What redo would put back, or null. */
  redoLabel: string | null;
  /**
   * Steps between the draft and `baselineRev`: negative once the draft has been undone
   * past it. The status bar counts with it ("3 changes since v2").
   */
  changesSinceBaseline: number;
  /** The rev the count runs from: the draft as it loaded, or as the newest version named it. */
  baselineRev: number;
  /** False once an edit on top of an undo dropped the states between here and the baseline. */
  baselineReachable: boolean;

  /**
   * Put a document from main in the editor. `asStep` names it as one step that can be
   * taken back ("import", "restore") when it replaces the same template's draft; without
   * it the history starts again, because the steps belong to the document that just left.
   */
  loadDraft: (draft: Draft | null, options?: { asStep?: string }) => void;
  /** Takes back the newest step, and saves the result like any other change. */
  undo: () => void;
  redo: () => void;
  /** A version was just named at `rev`: the draft matches it, so counting starts again. */
  markVersionSaved: (rev: number) => void;

  setName: (name: string) => void;
  setLinkStyle: (linkStyle: LinkStyle) => void;
  setLinkColor: (linkColor: LinkColor) => void;
  /** Adds an empty line at the end of the header; returns its id. */
  addHeaderLine: () => string;
  updateHeaderLine: (
    lineId: string,
    patch: Partial<Pick<HeaderLine, 'separator' | 'align'>>
  ) => void;
  moveHeaderLine: (lineId: string, offset: -1 | 1) => void;
  removeHeaderLine: (lineId: string) => void;
  /** Adds an empty item at the end of a line; returns its id. */
  addHeaderItem: (lineId: string, kind: HeaderItemKind) => string;
  updateHeaderItem: (
    itemId: string,
    patch: Partial<Pick<HeaderItem, 'text' | 'url' | 'shown'>>
  ) => void;
  /** Within its line. */
  moveHeaderItem: (itemId: string, offset: -1 | 1) => void;
  /** To the end of another line. */
  moveHeaderItemToLine: (itemId: string, lineId: string) => void;
  duplicateHeaderItem: (itemId: string) => void;
  removeHeaderItem: (itemId: string) => void;

  /** Adds an empty section at the end; returns its id. */
  addSection: (section: Pick<ResumeSection, 'kind' | 'layout' | 'label'>) => string;
  removeSection: (sectionId: string) => void;
  reorderSections: (orderedIds: string[]) => void;
  updateSectionLabel: (sectionId: string, label: string) => void;
  /** Leaves the whole section off the resume, or puts it back. */
  toggleSection: (sectionId: string) => void;

  addEntry: (sectionId: string, entry: Omit<ResumeEntry, 'id'>) => void;
  updateEntry: (
    sectionId: string,
    entryId: string,
    patch: Partial<Omit<ResumeEntry, 'id' | 'bullets'>>
  ) => void;
  removeEntry: (sectionId: string, entryId: string) => void;
  toggleEntry: (sectionId: string, entryId: string) => void;
  reorderEntries: (sectionId: string, orderedIds: string[]) => void;
  /** A copy right below it, bullets included, all with new ids. */
  duplicateEntry: (sectionId: string, entryId: string) => void;

  addBullet: (sectionId: string, entryId: string, text: string) => void;
  updateBullet: (sectionId: string, entryId: string, bulletId: string, text: string) => void;
  removeBullet: (sectionId: string, entryId: string, bulletId: string) => void;
  toggleBullet: (sectionId: string, entryId: string, bulletId: string) => void;
  /** A copy right below it. */
  duplicateBullet: (sectionId: string, entryId: string, bulletId: string) => void;
  moveBullet: (sectionId: string, entryId: string, bulletId: string, offset: -1 | 1) => void;
}

/** Moves `list[index]` one place up or down; nothing past either end. */
function moveBy<T>(list: T[], index: number, offset: -1 | 1) {
  const to = index + offset;
  if (index < 0 || to < 0 || to >= list.length) return;
  [list[index], list[to]] = [list[to], list[index]];
}

/** The section as it stands, for a label that depends on it. */
function findSection(sectionId: string) {
  return useResumeStore.getState().sections.find((s) => s.id === sectionId);
}

/** The entry as it stands, for a label that depends on it. */
function findEntry(sectionId: string, entryId: string) {
  return findSection(sectionId)?.items.find((e) => e.id === entryId);
}

/** Puts a whole document in the editor, leaving everything around it alone. */
function putDocument(state: ResumeState, doc: ResumeData) {
  state.schemaVersion = doc.schemaVersion;
  state.contact = doc.contact;
  state.sections = doc.sections;
}

function findHeaderItemPosition(header: ResumeHeader, itemId: string) {
  for (const line of header.lines) {
    const index = line.items.findIndex((item) => item.id === itemId);
    if (index >= 0) return { line, index };
  }
  return null;
}

/* Store */

export const useResumeStore = create<ResumeState>()(
  immer((set) => {
    /**
     * An edit: change the document, bump the rev, queue a save, and remember the document
     * as it was so `label` can be taken back.
     */
    const edit = (label: string, recipe: (state: ResumeState) => void) => {
      const before = getResumeSnapshot();
      // A step taken after an undo drops what had been undone. The baseline goes with it
      // when it was among those states, and then the count no longer means anything.
      const lostBaseline = future.length > 0 && useResumeStore.getState().changesSinceBaseline < 0;
      past.push({ doc: before, label });
      if (past.length > UNDO_HISTORY_LIMIT) past.shift();
      future = [];
      set((state) => {
        recipe(state);
        state.rev += 1;
        state.changesSinceBaseline += 1;
        if (lostBaseline) state.baselineReachable = false;
        state.undoLabel = label;
        state.redoLabel = null;
      });
      scheduleSave();
    };

    return {
      ...createEmptyResume(),
      templateId: null,
      rev: 0,
      saveFailed: false,
      savedAt: null,
      undoLabel: null,
      redoLabel: null,
      changesSinceBaseline: 0,
      baselineRev: 0,
      baselineReachable: true,

      /*
       * Another document takes the editor. An import or a restore replaces the draft that
       * is open, and reads as one step of it, so Ctrl/⌘+Z puts the old document back — in
       * the draft only. Main keeps both of its version rows either way: undo moves the
       * draft, it never rewrites the history of what happened. A different template is a
       * different document, and its steps are not this one's, so those start again.
       */
      loadDraft: (draft, options) => {
        cancelPendingSave();
        const doc = draft?.doc ?? createEmptyResume();
        const step = options?.asStep;
        if (step) {
          past.push({ doc: getResumeSnapshot(), label: step });
          if (past.length > UNDO_HISTORY_LIMIT) past.shift();
        } else {
          past = [];
        }
        future = [];
        set((state) => {
          putDocument(state, doc);
          state.templateId = draft?.templateId ?? null;
          state.rev = draft?.rev ?? 0;
          state.saveFailed = false;
          state.savedAt = null;
          state.undoLabel = step ?? null;
          state.redoLabel = null;
          // Main wrote a version holding exactly this document, so the count starts here.
          state.changesSinceBaseline = 0;
          state.baselineRev = draft?.rev ?? 0;
          state.baselineReachable = true;
        });
      },

      undo: () => {
        const step = past.pop();
        if (!step) return;
        future.push({ doc: getResumeSnapshot(), label: step.label });
        set((state) => {
          putDocument(state, structuredClone(step.doc));
          state.rev += 1;
          state.changesSinceBaseline -= 1;
          state.undoLabel = past.at(-1)?.label ?? null;
          state.redoLabel = step.label;
        });
        scheduleSave();
      },

      redo: () => {
        const step = future.pop();
        if (!step) return;
        past.push({ doc: getResumeSnapshot(), label: step.label });
        set((state) => {
          putDocument(state, structuredClone(step.doc));
          state.rev += 1;
          state.changesSinceBaseline += 1;
          state.undoLabel = step.label;
          state.redoLabel = future.at(-1)?.label ?? null;
        });
        scheduleSave();
      },

      markVersionSaved: (rev) =>
        set((state) => {
          state.changesSinceBaseline = 0;
          state.baselineRev = rev;
          state.baselineReachable = true;
        }),

      // Name and header

      setName: (name) =>
        edit('edit the name', (state) => {
          state.contact.name = name;
        }),

      setLinkStyle: (linkStyle) =>
        edit('change the link style', (state) => {
          state.contact.header.linkStyle = linkStyle;
        }),

      setLinkColor: (linkColor) =>
        edit('change the link color', (state) => {
          // Black is the default, so it is written by leaving the colour out.
          if (linkColor === 'ink') delete state.contact.header.linkColor;
          else state.contact.header.linkColor = linkColor;
        }),

      addHeaderLine: () => {
        const line = createHeaderLine();
        edit('add a header line', (state) => {
          state.contact.header.lines.push(line);
        });
        return line.id;
      },

      updateHeaderLine: (lineId, patch) =>
        edit('change a header line', (state) => {
          const line = state.contact.header.lines.find((l) => l.id === lineId);
          if (line) Object.assign(line, patch);
        }),

      moveHeaderLine: (lineId, offset) =>
        edit('move a header line', (state) => {
          const { lines } = state.contact.header;
          moveBy(
            lines,
            lines.findIndex((l) => l.id === lineId),
            offset
          );
        }),

      removeHeaderLine: (lineId) =>
        edit('delete a header line', (state) => {
          const { header } = state.contact;
          header.lines = header.lines.filter((l) => l.id !== lineId);
        }),

      addHeaderItem: (lineId, kind) => {
        const item = createHeaderItem(kind);
        edit('add to the header', (state) => {
          state.contact.header.lines.find((l) => l.id === lineId)?.items.push(item);
        });
        return item.id;
      },

      updateHeaderItem: (itemId, patch) =>
        edit('edit the header', (state) => {
          const found = findHeaderItemPosition(state.contact.header, itemId);
          if (found) Object.assign(found.line.items[found.index], patch);
        }),

      moveHeaderItem: (itemId, offset) =>
        edit('move a header item', (state) => {
          const found = findHeaderItemPosition(state.contact.header, itemId);
          if (found) moveBy(found.line.items, found.index, offset);
        }),

      moveHeaderItemToLine: (itemId, lineId) =>
        edit('move a header item', (state) => {
          const { header } = state.contact;
          const found = findHeaderItemPosition(header, itemId);
          const target = header.lines.find((l) => l.id === lineId);
          if (!found || !target || target === found.line) return;
          const [item] = found.line.items.splice(found.index, 1);
          target.items.push(item);
        }),

      duplicateHeaderItem: (itemId) =>
        edit('duplicate a header item', (state) => {
          const found = findHeaderItemPosition(state.contact.header, itemId);
          if (!found) return;
          const copy = { ...found.line.items[found.index], id: crypto.randomUUID() };
          found.line.items.splice(found.index + 1, 0, copy);
        }),

      removeHeaderItem: (itemId) =>
        edit('delete from the header', (state) => {
          const found = findHeaderItemPosition(state.contact.header, itemId);
          if (found) found.line.items.splice(found.index, 1);
        }),

      // Section CRUD

      addSection: ({ kind, layout, label }) => {
        const id = crypto.randomUUID();
        edit('add a section', (state) => {
          state.sections.push({ id, kind, layout, label, items: [], order: state.sections.length });
        });
        return id;
      },

      removeSection: (sectionId) =>
        edit('delete a section', (state) => {
          state.sections = state.sections.filter((s) => s.id !== sectionId);
        }),

      reorderSections: (orderedIds) =>
        edit('reorder sections', (state) => {
          const byId = new Map(state.sections.map((s) => [s.id, s]));
          state.sections = orderedIds
            .map((id, i) => {
              const s = byId.get(id);
              if (s) s.order = i;
              return s;
            })
            .filter((s): s is (typeof state.sections)[number] => s != null);
        }),

      updateSectionLabel: (sectionId, label) =>
        edit('rename a section', (state) => {
          const section = state.sections.find((s) => s.id === sectionId);
          if (section) section.label = label;
        }),

      toggleSection: (sectionId) => {
        const wasHidden = findSection(sectionId)?.hidden ?? false;
        edit(wasHidden ? 'put a section back' : 'leave a section off', (state) => {
          const section = state.sections.find((s) => s.id === sectionId);
          if (!section) return;
          if (section.hidden) delete section.hidden;
          else section.hidden = true;
        });
      },

      // Entry CRUD

      addEntry: (sectionId, entry) =>
        edit('add an entry', (state) => {
          const section = state.sections.find((s) => s.id === sectionId);
          if (section) section.items.push({ ...entry, id: crypto.randomUUID() });
        }),

      updateEntry: (sectionId, entryId, patch) =>
        edit('edit an entry', (state) => {
          const section = state.sections.find((s) => s.id === sectionId);
          if (!section) return;
          const entry = section.items.find((e) => e.id === entryId);
          if (entry) Object.assign(entry, patch);
        }),

      removeEntry: (sectionId, entryId) =>
        edit('delete an entry', (state) => {
          const section = state.sections.find((s) => s.id === sectionId);
          if (section) section.items = section.items.filter((e) => e.id !== entryId);
        }),

      toggleEntry: (sectionId, entryId) => {
        const wasOn = findEntry(sectionId, entryId)?.selected ?? false;
        edit(wasOn ? 'leave an entry off' : 'put an entry back', (state) => {
          const section = state.sections.find((s) => s.id === sectionId);
          if (!section) return;
          const entry = section.items.find((e) => e.id === entryId);
          if (!entry) return;
          const next = !entry.selected;
          entry.selected = next;
          for (const b of entry.bullets) b.selected = next;
        });
      },

      reorderEntries: (sectionId, orderedIds) =>
        edit('reorder entries', (state) => {
          const section = state.sections.find((s) => s.id === sectionId);
          if (!section) return;
          const byId = new Map(section.items.map((e) => [e.id, e]));
          section.items = orderedIds
            .map((id) => byId.get(id))
            .filter((e): e is (typeof section.items)[number] => e !== undefined);
        }),

      duplicateEntry: (sectionId, entryId) =>
        edit('duplicate an entry', (state) => {
          const section = state.sections.find((s) => s.id === sectionId);
          if (!section) return;
          const index = section.items.findIndex((e) => e.id === entryId);
          if (index < 0) return;
          // A draft is a proxy; clone the plain entry it stands for.
          const copy = structuredClone(current(section.items[index]));
          copy.id = crypto.randomUUID();
          for (const b of copy.bullets) b.id = crypto.randomUUID();
          section.items.splice(index + 1, 0, copy);
        }),

      // Bullet CRUD

      addBullet: (sectionId, entryId, text) =>
        edit('add a bullet', (state) => {
          const section = state.sections.find((s) => s.id === sectionId);
          if (!section) return;
          const entry = section.items.find((e) => e.id === entryId);
          if (entry) entry.bullets.push({ id: crypto.randomUUID(), text, selected: true });
        }),

      updateBullet: (sectionId, entryId, bulletId, text) =>
        edit('edit a bullet', (state) => {
          const section = state.sections.find((s) => s.id === sectionId);
          if (!section) return;
          const entry = section.items.find((e) => e.id === entryId);
          if (!entry) return;
          const bullet = entry.bullets.find((b) => b.id === bulletId);
          if (bullet) bullet.text = text;
        }),

      removeBullet: (sectionId, entryId, bulletId) =>
        edit('delete a bullet', (state) => {
          const section = state.sections.find((s) => s.id === sectionId);
          if (!section) return;
          const entry = section.items.find((e) => e.id === entryId);
          if (entry) entry.bullets = entry.bullets.filter((b) => b.id !== bulletId);
        }),

      toggleBullet: (sectionId, entryId, bulletId) => {
        const wasOn =
          findEntry(sectionId, entryId)?.bullets.find((b) => b.id === bulletId)?.selected ?? false;
        edit(wasOn ? 'leave a bullet off' : 'put a bullet back', (state) => {
          const section = state.sections.find((s) => s.id === sectionId);
          if (!section) return;
          const entry = section.items.find((e) => e.id === entryId);
          if (!entry) return;
          const bullet = entry.bullets.find((b) => b.id === bulletId);
          if (bullet) bullet.selected = !bullet.selected;
        });
      },

      duplicateBullet: (sectionId, entryId, bulletId) =>
        edit('duplicate a bullet', (state) => {
          const entry = state.sections
            .find((s) => s.id === sectionId)
            ?.items.find((e) => e.id === entryId);
          if (!entry) return;
          const index = entry.bullets.findIndex((b) => b.id === bulletId);
          if (index < 0) return;
          entry.bullets.splice(index + 1, 0, { ...entry.bullets[index], id: crypto.randomUUID() });
        }),

      moveBullet: (sectionId, entryId, bulletId, offset) =>
        edit('move a bullet', (state) => {
          const entry = state.sections
            .find((s) => s.id === sectionId)
            ?.items.find((e) => e.id === entryId);
          if (!entry) return;
          moveBy(
            entry.bullets,
            entry.bullets.findIndex((b) => b.id === bulletId),
            offset
          );
        }),
    };
  })
);

export function getResumeSnapshot(): ResumeData {
  const { schemaVersion, contact, sections } = useResumeStore.getState();
  return structuredClone({ schemaVersion, contact, sections });
}

/* Saving */

let timer: ReturnType<typeof setTimeout> | undefined;
/** When the oldest unsaved edit was made; null when nothing is waiting. */
let pendingSince: number | null = null;
/** Saves run one after another, so `flushDraft` can wait for all of them. */
let saving: Promise<void> = Promise.resolve();

function scheduleSave() {
  const now = Date.now();
  pendingSince ??= now;
  clearTimeout(timer);
  const wait = Math.min(SAVE_DELAY_MS, pendingSince + SAVE_MAX_WAIT_MS - now);
  timer = setTimeout(() => void flushDraft(), Math.max(0, wait));
}

function cancelPendingSave() {
  clearTimeout(timer);
  timer = undefined;
  pendingSince = null;
}

async function save(templateId: string, doc: ResumeData, rev: number) {
  try {
    await getDb().drafts.save(templateId, doc, rev);
    useResumeStore.setState({ saveFailed: false, savedAt: Date.now() });
  } catch (error) {
    // A newer draft already came from main (an import or restore landed after this edit
    // was queued), or the template was deleted: either way this save has nothing to keep.
    if (error instanceof DbError && (error.code === 'stale-rev' || error.code === 'not-found')) {
      return;
    }
    console.error('Could not save the draft', error);
    useResumeStore.setState({ saveFailed: true });
  }
}

/**
 * Save now whatever is waiting, and resolve once every save so far has landed. Called
 * before anything that reads the draft from main (switching or duplicating a template,
 * an import) and when the window closes.
 */
export function flushDraft(): Promise<void> {
  if (pendingSince !== null) {
    cancelPendingSave();
    const { templateId, rev } = useResumeStore.getState();
    if (templateId !== null) {
      const doc = getResumeSnapshot();
      saving = saving.then(() => save(templateId, doc, rev));
    }
  }
  return saving;
}
