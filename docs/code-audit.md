# Code audit — 2026-09-28

Read-only implementation audit against commit `7933add` (`Merge pull request #45
from Anoop-Chandra-19/fix/history-page-dancing`). This report is the only retained
file change. Findings are open; no fixes have been applied.

## Summary

The feature/process organization is sound. The main problems found are failed-operation
semantics, disagreement between validation and downstream assumptions, and edge cases
in document interpretation and rendering—not a need to reorganize the codebase.

This is a broad, targeted audit, not a claim that every line or every platform has been
verified. It covers renderer stores and editing/history workflows, import readers,
preview/export, main-process persistence and backups, preload/IPC, secrets, erase,
and Ollama address handling.

### The three findings carried forward from the architecture review

| Original concern                                         | Current status                                                        | Tracking |
| -------------------------------------------------------- | --------------------------------------------------------------------- | -------- |
| `flushDraft()` resolves after a failed save              | Confirmed data loss on switching; a later flush does not retry        | A01      |
| Preview and export duplicate printable-content selection | Confirmed duplication; no separate selection mismatch demonstrated    | R01      |
| Equal revision numbers are treated as equal documents    | Confirmed history loss through accepted API writes and edited bundles | A02      |

### Priority definitions

- **P1 / High:** prioritize before relying on the affected durability or export behavior. Not necessarily frequent, and not a claim of remote compromise.
- **P2 / Medium:** reproducible functional, privacy, or input-handling defect with a more limited trigger or impact.
- **P3 / Low:** limited-impact inconsistency or future-compatibility hardening.
- **Risk:** maintenance concern without a demonstrated functional failure.

### Findings index

| ID  | Priority | Finding                                                              | Trigger category                   |
| --- | -------- | -------------------------------------------------------------------- | ---------------------------------- |
| A01 | P1       | Failed draft writes are not retried and switching can discard edits  | Storage failure                    |
| A02 | P1       | Equal-revision/different-content drafts can disappear from history   | Accepted API input / edited bundle |
| A03 | P1       | Failed overwrites destroy existing backups and exports               | File-write failure                 |
| A04 | P1       | PDF output corrupts unsupported Unicode characters                   | Ordinary content                   |
| A05 | P2       | Generated full-history backups can exceed the restore limit          | Large history                      |
| A06 | P2       | Destructive restore accepts IDs that the API cannot operate on       | Malformed bundle                   |
| A07 | P2       | Nonfinite section order survives validation but corrupts round trips | Malformed bundle                   |
| A08 | P3       | Manual backup succeeds with no templates, but restore rejects it     | Empty workspace                    |
| A09 | P3       | Stored reads silently relabel newer resume schemas as version 1      | Future-schema/API input            |
| A10 | P3       | Contact-detection regexes block parsing on a synthetic long word     | Adversarial text                   |
| A11 | P2       | JSON Resume metadata hides newly added supported sections            | Cross-tool editing                 |
| A12 | P2       | Header separators inside links corrupt text and destinations         | Ordinary linked text               |
| A13 | P2       | Markdown links with balanced URL parentheses are truncated           | Ordinary Markdown                  |
| A14 | P2       | DOCX numbering-reference chains overflow the stack                   | Adversarial DOCX                   |
| A15 | P2       | Long PDF headings overlap dates and exceed the margin                | Ordinary long headings             |
| A16 | P2       | Dropping a header-only first page causes preview overflow            | Large opening block/header         |
| A17 | P2       | A key save queued during erase survives “Delete everything”          | Concurrent erase/key operation     |
| A18 | P2       | Erase can silently retain an unindexed key                           | Index-write and deletion failures  |
| A19 | P2       | Explicit Ollama ports 80/443 become 11434 on renormalization         | Reverse-proxy configuration        |
| A20 | P2       | Starting a merge while editing leaves the bullet editor stuck        | Editor shortcut                    |
| A21 | P2       | Multiline paste ignores the cursor and selected text                 | Normal paste                       |
| A22 | P2       | Order-only changes appear identical and disable history-pane restore | Normal reordering                  |
| R01 | Risk     | Preview/export independently implement printable-content policy      | Future maintenance                 |

## Validation and evidence

Baseline validation on this revision:

- `bun run test`: **600 tests passed across 56 files**.
- `bun run lint`: **passed**.
- `bun run build`: **passed**, including TypeScript checking and all process builds.
- `bunx playwright test --global-timeout=180000`: **103 tests passed**, no failures or skips, in **47.7 seconds** using four workers.
- Three additional temporary Electron probe tests reproduced A20–A22 in **7.0 seconds**. They asserted the reported faulty behavior; their passing is evidence of reproduction, not regression protection. The temporary spec was removed.

The build reported a nonfatal Node `module.register()` deprecation and a Vite warning:
`breakLinesLikeWord.ts` is imported both statically and dynamically, so that dynamic
import does not create a separate chunk. Neither is classified here as a correctness bug.

Additional bounded probes used current source through Vite's SSR loader, synthetic
resumes, in-memory SQLite, in-memory documents, fake keychains, and disposable files.
Faults were injected; no actual disk exhaustion or real-keychain changes were performed.
Except for the three Electron UI probes, reproduction evidence below is at the
module/handler boundary, not a claim of complete UI reproduction.

Electron tests used the existing fixtures: throwaway profiles, per-worker Xvfb,
Chromium sandbox enabled, and no desktop D-Bus session. The existing sandbox,
preload-isolation, and CSP tests passed. Native Wayland, macOS, and Windows were not tested.
No external provider calls, agent evaluations, dependency-vulnerability service, or
LibreOffice page-break sweep were run. Generated probe fixtures were not retained.

## Persistence, backups, and validation

### A01 — P1: Failed draft writes can be discarded after an apparently successful flush

**Locations:** [`resumeStore.ts:631–674`](../src/renderer/src/stores/resumeStore.ts#L631),
[`templateStore.ts:137–143,212–227`](../src/renderer/src/stores/templateStore.ts#L137).

`flushDraft()` clears the pending-save marker before writing. `save()` catches a real
storage error, sets `saveFailed`, and resolves. The operation waiting on the flush
therefore continues. Subsequent flushes do not retry unless another edit schedules a save.

**Reproduced:** create two templates; edit the first; inject an `internal` write failure;
flush; restore write availability; flush again. The second flush made no save attempt.
Switch to the other template and back: the edited name was gone and `saveFailed` was
false. This exercised the real stores, handlers, and in-memory SQLite through a fake bridge.

**Impact:** switching, replacing the draft, closing, or making a backup can proceed despite
unsaved edits. The status-bar warning does not make these operations safe.

**Fix/test direction:** retain dirty state after a failure; distinguish successful
persistence from completion of an attempt; make destructive callers stop or explicitly
obtain user consent. Test retry without another edit and failed-save switch/import/close.
Background save failures must still be handled without unhandled promise rejections.

### A02 — P1: Equal revisions can suppress the only snapshot of different content

**Locations:** [`drafts.ts:48–62`](../src/main/db/drafts.ts#L48),
[`versions.ts:145–154,268–284`](../src/main/db/versions.ts#L145),
[`parseBundle.ts:129–138`](../src/shared/vault/parseBundle.ts#L129).

Saving rejects only revisions less than the stored revision. History treats equal
head/draft revisions as identical content without checking their hashes. Bundle parsing
also allows an equal-revision draft and head with different documents.

**Reproduced:** create A at revision 0; save B at revision 0; name the draft; import C.
The named version contained A, and the resulting history was `[C, A]`; B was nowhere.
Independently, export A, change just the bundle's draft to B, restore, then import C:
the accepted file produced the same loss.

**Qualification:** ordinary editor mutations increment revisions; these probes establish
accepted API/file-input failures, not that routine typing currently generates them.

**Fix/test direction:** make same-revision saves idempotent only for identical content;
validate or normalize bundle revision/content consistency; do not let history's fast
path silently bypass preservation when the invariant is not guaranteed.

### A03 — P1: Direct overwrites can destroy the previous good backup/export

**Locations:** [`registerBackupHandlers.ts:72–82`](../src/main/ipc/registerBackupHandlers.ts#L72),
[`registerFileHandlers.ts:61–67`](../src/main/ipc/registerFileHandlers.ts#L61),
[`backupSchedule.ts:163–173,196–209`](../src/main/backup/backupSchedule.ts#L163).

Manual backup and generic export write directly to the selected destination. Opening an
existing file for this write truncates it before the replacement completes.

**Reproduced:** the actual manual-backup handler, with a mocked dialog and injected
partial `ENOSPC`, changed a valid 1,148-byte backup into 24 bytes of invalid JSON. The
generic file handler was also exercised against an anonymous RAM-backed file under a
4 KiB file-size limit: an 8 KiB overwrite failed with `EFBIG` after replacing all original
content with 4,096 bytes of the replacement.

A scheduled-backup failure left a corrupt final-named file; retry created `-2.json` and
cleared the error while retaining the corrupt file. That path did not overwrite an older
backup, but publishes an incomplete file as if it were a finished backup.

**Fix/test direction:** write a temporary sibling, finish/close it successfully, then
replace the destination atomically with platform-appropriate handling. Clean up failed
temporaries and test preservation of the original after partial-write failures.

### A05 — P2: The app can generate a backup it refuses to restore

**Locations:** [`bundle.ts:28–40`](../src/main/db/bundle.ts#L28),
[`backupSchedule.ts:120–130`](../src/main/backup/backupSchedule.ts#L120),
[`dbHandlers.ts:110–119`](../src/main/ipc/dbHandlers.ts#L110),
[`registerFileHandlers.ts:81–84`](../src/main/ipc/registerFileHandlers.ts#L81).

Full-history backups repeat each version's complete document even when SQLite deduplicates
it. Backup generation does not enforce the 128 MiB input limit used for restore.

**Reproduced:** alternate two synthetic documents containing 4 MiB of text through normal
import operations to create 32 versions. SQLite held two distinct version documents, but
`writeBackupText()` returned 138,446,315 bytes. Restore rejected that generated payload as
over 128 MB. The payload was generated in memory, not left on disk.

**Fix/test direction:** define a compatible read/write size policy. At minimum, refuse to
advertise an unusable backup as successful; a long-term solution must preserve complete
history while ensuring the app can read what it writes. Add a boundary-size round trip.

### A06 — P2: Restore admits identifiers that normal operations reject

**Locations:** [`parseBundle.ts:47–50,123–138`](../src/shared/vault/parseBundle.ts#L47),
[`bundle.ts:55–69,96–103`](../src/main/db/bundle.ts#L55),
[`dbHandlers.ts:46–50,134–142`](../src/main/ipc/dbHandlers.ts#L46).

Bundle IDs need only be strings, whereas IPC IDs must be nonblank and at most 200 characters.
`restore-all` preserves supplied IDs after deleting the old templates.

**Reproduced:** restore an otherwise valid bundle with `template.id: ""`. Restore committed
and returned `templateIds: [""]`; the old templates were replaced. Saving and removing the
replacement both failed with `invalid-argument`.

**Fix/test direction:** share identifier constraints at all admission points and reject
before destructive restore begins. Include empty, whitespace-only, and oversized template
and version IDs in refusal/rollback tests.

### A07 — P2: Nonfinite ordering values break persisted round trips

**Locations:** [`validateResume.ts:46–60`](../src/shared/resume/validateResume.ts#L46),
[`parseBundle.ts:67–73`](../src/shared/vault/parseBundle.ts#L67),
[`storedResume.ts:6–11`](../src/main/db/storedResume.ts#L6).

The validator checks section order with `typeof === 'number'`. JSON's numeric token
`1e999` parses to JavaScript `Infinity`; serializing it later yields `null`.

**Reproduced:** an edited bundle with `order: 1e999` was accepted and restored. Reading it
back returned `order: null`; exporting and reparsing the new bundle failed `invalid-resume`.

**Fix/test direction:** require finite values, plus any intended integral/range constraints,
before admitting the document. Assert every accepted document survives serialization and
revalidation.

### A08 — P3: Empty manual backups are written successfully but cannot be restored

**Locations:** [`registerBackupHandlers.ts:79–82`](../src/main/ipc/registerBackupHandlers.ts#L79),
[`parseBundle.ts:160–162`](../src/shared/vault/parseBundle.ts#L160),
[`ImportExportSection.tsx:144–146`](../src/renderer/src/features/settings/sections/ImportExportSection.tsx#L144).

**Reproduced:** invoke manual backup with no templates. It reported success and recorded
zero templates/versions in an 87-byte file; parsing that file returned
`invalid-templates: no templates`. The UI does not disable the action for an empty workspace.
Scheduled backups already skip this case.

**Fix/test direction:** either support empty-workspace bundles consistently or decline an
empty backup with an explanation before writing and recording success.

### A09 — P3: Stored reads silently downgrade a future schema marker

**Locations:** [`validateResume.ts:108–112`](../src/shared/resume/validateResume.ts#L108),
[`storedResume.ts:19–20`](../src/main/db/storedResume.ts#L19),
[`migrateResume.ts:9–15`](../src/shared/resume/migrateResume.ts#L9).

**Reproduced:** pass a current-shaped resume marked `schemaVersion: 2` to the creation
handler. Storage accepted it, then draft reads and bundle exports relabelled it as version

1. Direct bundle input with version 2 is correctly refused, so the two boundaries disagree.

**Qualification:** this is compatibility hardening before the first release. No actual
released-v2 document or field loss was demonstrated. Do not introduce a schema-version
bump to fix it; keep the current pre-v1 version at 1.

**Fix/test direction:** refuse future versions consistently and migrate only explicitly
supported older versions. Test admission and stored reads separately.

## Import and parsing

### A10 — P3: Synthetic long-word input can block contact detection

**Locations:** [`parseResume.ts:63–66,134–142,227–239`](../src/renderer/src/features/import/parsing/parseResume.ts#L63),
[`ImportResumeDialog.tsx:85`](../src/renderer/src/features/import/ImportResumeDialog.tsx#L85).

Unanchored contact regexes repeatedly scan overlapping suffixes of a long word without
`@` or `.`. Pasted text reaches the parser synchronously.

**Reproduced input:** `parseResumeText('a'.repeat(64_000) + '\n\nSkills\nTypeScript')`.
Measured Node/V8 parsing time grew from approximately 27 ms at 4k characters to 366 ms at
16k, 1,518 ms at 32k, and 6,018 ms at 64k. A zero-delay timer was blocked for the same six
seconds. The input was accepted without warnings.

**Practical priority:** optional hardening, not a demonstrated problem with normal resumes.
The probe contains 64,000 consecutive `a` characters in one word; it is not representative
of a 64 KB resume with ordinary words and lines, nor does it establish a 64 KB file-size
threshold. Prioritize reliable saving, faithful exports, and normal editor interactions
before this deliberately adversarial case.

**Qualification:** timings are machine-specific Node measurements; the UI impact follows
from the synchronous renderer call path, not an Electron timing capture.

**Fix/test direction:** avoid overlapping regex scans, bound candidates/work, and add
adversarial scaling tests. A worker can protect UI responsiveness but does not itself
correct the unbounded work.

### A11 — P2: Mosaic metadata can silently hide added JSON Resume content

**Locations:** [`readJsonResume.ts:255–270,495–508`](../src/renderer/src/features/import/readers/readJsonResume.ts#L255).

Accepted `meta.mosaic.sections` reconstruction replaces standard-field reading. Its
consistency checks cover only six source queues, omitting some other supported sections.

**Reproduced:** a JSON Resume with work, volunteer, and languages plus valid Mosaic
metadata describing the work section imported only Experience. Removing the metadata
imported Experience, Volunteering, and Languages. Both results had empty warnings and
`leftOut` lists.

**Impact:** another tool can add supported content to an exported JSON Resume and Mosaic
will silently omit it before review.

**Fix/test direction:** account for every supported source collection before trusting
metadata as complete, or append standard sections unrepresented by metadata. Test
cross-tool additions to a Mosaic-generated file.

### A12 — P2: Header delimiters inside hyperlinks leak parser markers and lose URLs

**Locations:** [`parseResume.ts:134–138,176–179,196–200`](../src/renderer/src/features/import/parsing/parseResume.ts#L134),
[`importLines.ts:123–138`](../src/renderer/src/features/import/parsing/importLines.ts#L123).

Header fields are split before encoded link spans are decoded; the split does not respect
link boundaries.

**Reproduced:** import a header link
`[Design | Engineering](https://example.test/portfolio)` through Markdown, and independently
through a synthetic DOCX real hyperlink. Both split it into two items, lost the URL fields,
and retained internal `\uFDD0`/`\uFDD1`/`\uFDD2` markers and destination text in printable text.
No warning or left-out entry was emitted.

**Fix/test direction:** split only outside links, or carry structured link spans through
contact parsing. Test each supported separator inside linked display text.

### A13 — P2: Balanced parentheses in Markdown destinations break imported links

**Location:** [`readMarkdown.ts:30–37`](../src/renderer/src/features/import/readers/readMarkdown.ts#L30).

**Reproduced:** `[Portfolio](https://example.test/project_(v2))` imported as visible text
`Portfolio)` with URL `https://example.test/project_(v2`, without warnings. The regex ends
the link at the first closing parenthesis.

**Fix/test direction:** parse balanced destination parentheses and escapes rather than
using a first-closing-parenthesis match. Add import and export/import tests for these URLs.

### A14 — P2: DOCX reference chains bypass structural depth limits

**Locations:** [`readDocx.ts:332–342,720–723`](../src/renderer/src/features/import/readers/docx/readDocx.ts#L332),
[`parseXml.ts:38–47`](../src/renderer/src/features/import/readers/docx/parseXml.ts#L38).

`levelsThrough()` recursively follows numbering-style references. XML tree limits and a
cycle guard do not bound the depth of a long acyclic reference chain; repeated resolutions
also amplify work.

**Reproduced:** synthetic shallow DOCX files with 500, 1,500, and 3,000 linked numbering
definitions took roughly 37, 205, and 984 ms. A 6,000-link file, compressed to 104,580 bytes,
raised `RangeError: Maximum call stack size exceeded`, even though the body did not use
these lists.

**Qualification:** this demonstrated failed import and excessive interpretation work, not
an Electron process crash or a ZIP/XML limit bypass during decompression/parsing itself.

**Fix/test direction:** resolve iteratively with caching and an explicit traversal budget;
return the controlled complexity-limit error. Test long acyclic chains as well as cycles.

## PDF and preview

### A04 — P1: PDF export corrupts characters beyond the built-in font encoding

**Location:** [`PdfResumeDocument.tsx:24–28`](../src/renderer/src/features/export/pdf/PdfResumeDocument.tsx#L24).

The document uses only built-in Helvetica fonts, without embedded Unicode coverage or
fallback handling. Unsupported content is not rejected before a successful export.

**Reproduced:** render the actual component to PDF and extract with PDF.js:

| Synthetic input    | Extracted PDF text       |
| ------------------ | ------------------------ |
| `Fictional Łukasz` | `Fictional Aukasz`       |
| `Fictional 李明`   | `Fictional N\u000e`      |
| `Fictional Пример` | `Fictional \u001f @8<5@` |

**Impact:** names and resume text can be corrupted in the saved artifact and ATS-readable
content. This is not a documented representation loss and does not require malformed input.

**Fix/test direction:** embed suitable fonts with defined fallback/coverage behavior and
keep measurement consistent with those fonts. Until supported, explicitly warn/refuse rather
than silently corrupt. Add Unicode extraction and visual coverage checks.

### A15 — P2: Long PDF entry headings overlap their dates

**Locations:** [`PdfResumeDocument.tsx:110–133,281–282`](../src/renderer/src/features/export/pdf/PdfResumeDocument.tsx#L110).

The heading and dates are unconstrained text children in a flex row; the heading does not
wrap inside space reserved for the dates.

**Reproduced:** Letter-size PDF with heading `Senior Software Engineer, Fictional Institute
for Distributed Systems and Infrastructure, Example City` and dates `January 2020 to
September 2026`. PDF.js geometry put the heading at x=72–539.439 pt and dates at
x=426.485–582.326 pt on the same baseline: approximately 112.95 pt overlap, with the dates
42.33 pt beyond the intended 540 pt right margin. These heading nodes do not use the
optional body measurer, so the probe covers production heading layout.

**Fix/test direction:** reserve date width and gap, constrain/wrap the heading, and test
both content preservation and geometry for long headings on A4 and Letter.

### A16 — P2: Removing a header-only first page invalidates preview layout

**Locations:** [`pagination.ts:412–418`](../src/renderer/src/features/preview/pagination.ts#L412),
[`ResumePreview.tsx:250–261`](../src/renderer/src/features/preview/ResumePreview.tsx#L250).

If the opening section block fits a fresh page but not below the header, pagination moves
it to page two. Final filtering drops page one because it has no sections. Rendering then
reattaches the header to the new first page without repaginating its content.

**Reproduced:** 688.05 pt usable height, 87.1 pt header, 18 pt section title, 22 pt entry
heading/gap, and a 630 pt indivisible opening bullet. The paginator returned one page,
although reattaching the header requires approximately 775.1 pt. This undercounts pages
and exceeds the fixed-height clipped preview sheet. The existing pagination test explicitly
expects removal of the header-only page, without checking header placement afterwards.

**Fix/test direction:** retain a first page that carries the header, or otherwise make
header allocation and final page normalization agree. Test the paginator with the actual
first-page rendering contract, not just section arrays.

## Secrets and network configuration

### A17 — P2: A queued key save can survive erase

**Locations:** [`eraseAll.ts:23–27`](../src/main/eraseAll.ts#L23),
[`apiKeys.ts:79–83,127–143`](../src/main/secrets/apiKeys.ts#L79),
[`PrivacySection.tsx:90,104`](../src/renderer/src/features/settings/sections/PrivacySection.tsx#L90).

Key operations are serialized, but the entire erase lifecycle is not exclusive. A key save
queued while key deletion is pending can run after `forgetAll()` and repopulate the newly
opened settings database while Chromium storage clearing is still pending. The erase
confirmation remains dismissible while the operation runs.

**Reproduced:** pause fake-keychain deletion, queue a save, then resume deletion. The real
erase operation resolved successfully, but the fake keychain and new settings index both
contained the new provider key.

**Qualification:** offline concurrency probe, not a real-keychain or full-UI timing test.

**Fix/test direction:** enforce an erase lifecycle barrier in main, rejecting or invalidating
intervening mutations until reset completes; prevent dismissing/reentering sensitive UI
while erasing. Test an in-flight and queued save against erase.

### A18 — P2: Erase can report success while an unindexed credential remains

**Locations:** [`apiKeys.ts:131–133,183–195`](../src/main/secrets/apiKeys.ts#L131),
[`eraseAll.ts:23–27`](../src/main/eraseAll.ts#L23).

A keychain write precedes the settings-index write. If the latter fails, the key remains
without an index entry. `forgetAll()` explicitly swallows deletion errors for unindexed keys.

**Reproduced:** a fake-keychain save succeeded, the subsequent index write threw, and later
key deletion was made to reject. Erase still completed database deletion/reopening and
storage clearing; the key remained while status reported `saved: {}`.

**Fix/test direction:** handle the key-write/index-write failure window and distinguish
confirmed absence from inability to delete. Do not blindly require a working keychain on
machines that have never stored keys; test no-keychain startup separately from orphaned
credential cleanup and surface uncertainty instead of claiming complete deletion.

### A19 — P2: Ollama default-port normalization changes the endpoint on a second pass

**Locations:** [`ollamaAddress.ts:27–30`](../src/shared/ai/ollamaAddress.ts#L27),
[`ollamaModels.ts:60–66`](../src/main/ai/ollamaModels.ts#L60),
[`OllamaRows.tsx:63–66,133`](../src/renderer/src/features/settings/sections/OllamaRows.tsx#L63).

The renderer preserves an explicitly specified scheme-default port semantically, but
`URL.origin` removes its text. Main normalizes that canonical result again and adds 11434
because it now appears to have no explicit port.

**Reproduced with recording mock fetch:**

- `http://ollama.example:80` becomes `http://ollama.example:11434/api/tags`.
- `https://ollama.example:443` becomes `https://ollama.example:11434/api/tags`.

No network calls were made. This affects reverse-proxy configurations and can query a
different endpoint from the one displayed in Settings.

**Fix/test direction:** make canonical normalization idempotent, or separate user-input
defaulting from canonical-address validation. Test two normalizations and the actual
renderer-to-main path.

## Editor and history UI

A20–A22 were reproduced in the built Electron app using a temporary spec and the existing
isolated launch fixtures. The spec was removed after the audit.

### A20 — P2: Merge started from an active editor gets stuck

**Locations:** [`BulletItem.tsx:130–169`](../src/renderer/src/features/editor/bullets/BulletItem.tsx#L130),
[`BulletEditor.tsx:97–115,198–202`](../src/renderer/src/features/editor/bullets/BulletEditor.tsx#L97).

Editing and merging render the same unkeyed `BulletEditor` type. React preserves its local
`draft`, `mode`, and `isDone` state when the parent switches to merge props.

**Observed in Electron:** edit the first of two bullets, change its text, then press
Ctrl+Shift+J. The lower bullet disappears into the pending merge, but the editor contains
only the first bullet and still offers Save. Save does nothing; Escape restores both
original bullets and discards the pending edit.

**Fix/test direction:** explicitly initialize a new editing session when entering merge
mode, without losing the pending first-bullet text. Test both starting merge from the
read view and starting it from an active editor.

### A21 — P2: Multiline paste appends instead of replacing the selection

**Location:** [`BulletEditor.tsx:231–239`](../src/renderer/src/features/editor/bullets/BulletEditor.tsx#L231).

The multiline handler prevents native paste and appends flattened text to the entire draft,
ignoring `selectionStart` and `selectionEnd`.

**Observed in Electron:** select the whole bullet `Built the fictional dispatch simulator.`
and paste `Replacement\nachievement.` through the actual clipboard. The editor becomes
`Built the fictional dispatch simulator.Replacement achievement.`; Enter commits it.

**Fix/test direction:** splice normalized clipboard text into the selected range and
restore the caret. Cover beginning, middle, end, partial selection, and full selection.

### A22 — P2: Order-only changes disable the full-history pane's Restore button

**Locations:** [`versionDiff.ts:26–49`](../src/renderer/src/features/history/versionDiff.ts#L26),
[`HistoryReadPane.tsx:114–116,151–164`](../src/renderer/src/features/history/full-history/HistoryReadPane.tsx#L114).

`countChangedLines()` compares text by stable IDs, not ordering. The pane interprets a
zero changed-line count as document equality.

**Observed in Electron:** name a version with two distinct bullets, reverse them through
the editor, name the new version, and open the older version in full history. Its original
order is visibly different, but the pane says “identical to your draft” and disables Restore.
The separate history-row Restore action remains available.

**Fix/test direction:** separate the changed-line metric from the equality predicate;
compare ordered printable content for restoration decisions. Add order-only bullet,
entry, and section tests. This finding is independent of A02's revision invariant.

## Retained architectural risk

### R01 — Preview/export duplicate printable-content selection

**Locations:** [`pagination.ts:59–99`](../src/renderer/src/features/preview/pagination.ts#L59),
[`normalizeResumeExport.ts:72–123`](../src/renderer/src/features/export/normalizeResumeExport.ts#L72).

Both paths independently select visible sections/entries/bullets, sort sections, trim
content, and remove empty entries. Their output shapes legitimately differ, but a future
policy change can update one without updating the other.

**Status:** duplication confirmed; no additional selection-policy mismatch demonstrated
in this audit. A15/A16 are separate rendering/layout defects, not proof of this risk.

**Proportionate follow-up:** add a shared-fixture contract test comparing their printable
content. Extract common selection policy into renderer domain logic if/when that reduces
real maintenance work; do not couple preview directly to the export feature or build a
generic rendering framework solely for this.

## Positive checks and limits

- All existing unit and Electron tests passed; the listed bugs expose coverage gaps rather
  than a generally failing test baseline.
- Fault injection confirmed atomic rollback for draft writes, replacement imports, and SQL
  migrations. Existing destructive-restore rollback coverage also passed.
- ZIP reading enforces inflation limits/checksums and aggregate unpacking budgets; XML
  parsing rejects DTDs and bounds tree structure. No decompression-budget bypass or external
  entity issue was reproduced. A14 concerns interpretation after those checks.
- No renderer sandbox escape, arbitrary filesystem-access path, or credential exfiltration
  was demonstrated. Passing current security tests is not proof that none exists.
- The already-documented ten-page preview cap and intentional cross-format representation
  losses were not counted as bugs.

## Suggested fix sequence

1. **Durability:** A01, A02, A03, then the backup/readability checks A05–A08.
2. **Everyday document correctness:** A04, A15, A20–A22, and A12–A13.
3. **Input robustness and consistency:** A06–A07 if not already addressed, A11, A14, A16.
4. **Privacy/configuration:** A17–A19; preserve no-keychain fallback behavior while fixing erase.
5. **Compatibility/maintenance:** A09 and R01, without broad structural refactoring.
6. **Optional adversarial-input hardening:** A10; no normal-resume slowdown was demonstrated.

Promote reproductions to permanent regression tests alongside each fix. Existing green
suites should remain a baseline, not be treated as evidence that these paths are covered.
