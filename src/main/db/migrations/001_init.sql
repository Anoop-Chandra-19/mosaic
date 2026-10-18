-- Pre-v1: edit this file in place. From the first release users install, migrations
-- are append-only (002_*.sql, …) and this file never changes again.
--
-- A resume document is one JSON blob per row (ResumeData, schemaVersion inside); SQL
-- indexes the history around it. Timestamps are epoch milliseconds set by app code.

create table templates (
  id          text primary key,
  name        text not null,
  seq         integer not null unique,      -- list order; new templates go last. Timestamps
                                            -- tie within a millisecond, and implicit rowids
                                            -- may be renumbered by VACUUM.
  rev         integer not null default 0,   -- bumped by every draft edit; anchors check it
  created_at  integer not null,
  updated_at  integer not null
) strict;

-- One overwritten row per template: what is in the editor.
create table drafts (
  template_id text primary key references templates(id) on delete cascade,
  doc         text not null check (json_valid(doc)),
  updated_at  integer not null
) strict;

-- Version documents, each stored once, keyed by the sha-256 of its key-sorted JSON.
create table docs (
  hash text primary key,
  doc  text not null check (json_valid(doc))
) strict;

-- Snapshots of a template's document. The head (highest seq, then highest revision) is
-- the version the draft was last in sync with: the draft is clean iff templates.rev =
-- head.rev. A number (seq, shown as v7) names one piece of work; adding to it while it is
-- the head writes a new row with the next revision (v7.1), so no row is ever rewritten.
create table versions (
  id          text primary key,
  template_id text not null references templates(id) on delete cascade,
  seq         integer not null,             -- the version number
  revision    integer not null default 0,   -- additions to that number; 0 is the first
  parent_id   text references versions(id) on delete set null,
  kind        text not null check (kind in ('auto', 'named')),
  source      text not null check (source in ('create', 'duplicate', 'name', 'import',
                'before-import', 'restore', 'before-restore', 'edit', 'switched', 'closed',
                'assistant', 'before-apply')),
  summary     text not null,                -- the user's name, or "Before restoring …"
  section     text,                         -- label of the one section an edit touched
  rev         integer not null,             -- template rev at snapshot
  created_at  integer not null,
  doc_hash    text not null references docs(hash),
  unique (template_id, seq, revision)
) strict;
-- Deleting a version nulls its children's parent_id; without this, that scans the table.
create index versions_by_parent on versions (parent_id);
create index versions_by_doc on versions (doc_hash);

-- The assistant. A conversation isn't bound to a template; each run records the one it
-- worked on. Deleting a conversation cascades to everything below it.
create table conversations (
  id          integer primary key,
  title       text,
  provider    text not null,                -- last used; each run records its own
  model       text not null,
  created_at  integer not null,
  updated_at  integer not null
) strict;
create index conversations_by_use on conversations (updated_at desc);

-- One ask and everything the assistant did for it.
create table runs (
  id              integer primary key,
  conversation_id integer not null references conversations(id) on delete cascade,
  seq             integer not null,         -- the run's number in its conversation
  status          text not null check (status in
                    ('running', 'awaiting_user', 'done', 'step_limit', 'failed', 'cancelled')),
  template_id     text references templates(id) on delete set null,  -- null: none open
  rev             integer,                  -- the template's rev when the run started
  provider        text not null,
  model           text not null,
  input_tokens    integer,
  output_tokens   integer,
  error           text,
  started_at      integer not null,
  finished_at     integer,
  unique (conversation_id, seq)
) strict;

-- An append-only log, read in seq order. body is a MessageBody (agentConversation.ts),
-- checked before it is written and never changed after.
create table messages (
  id              integer primary key,
  conversation_id integer not null references conversations(id) on delete cascade,
  run_id          integer references runs(id) on delete set null,
  seq             integer not null,
  type            text not null,            -- body.type, for reads that skip some
  body            text not null check (json_valid(body)),
  model           text,                     -- assistant messages: the model that wrote it
  input_tokens    integer,
  output_tokens   integer,
  created_at      integer not null,
  unique (conversation_id, seq)
) strict;

-- Each tool call's lifecycle, for the trace. The call and its result are in messages.
create table tool_calls (
  id                 integer primary key,
  run_id             integer not null references runs(id) on delete cascade,
  request_message_id integer not null references messages(id) on delete cascade,
  result_message_id  integer references messages(id) on delete set null,
  call_id            text not null,         -- the toolCall part's callId
  name               text not null,
  status             text not null check (status in ('pending', 'ok', 'error', 'cancelled')),
  check_name         text,                  -- why it failed: anchor, shape, interrupted, …
  rev                integer,               -- the rev it read or wrote against; null: no template
  started_at         integer not null,
  finished_at        integer,
  unique (run_id, call_id)
) strict;
create index tool_calls_pending on tool_calls (run_id) where status = 'pending';

-- Messages typed while a run works, delivered at its next step.
create table message_queue (
  id              text primary key,
  conversation_id integer not null references conversations(id) on delete cascade,
  position        integer not null,         -- order typed; delivered together, in order
  body            text not null check (json_valid(body)),  -- a user MessageBody
  delivery        text not null check (delivery in ('step', 'now')),
  state           text not null check (state in ('waiting', 'editing')),
  created_at      integer not null,
  unique (conversation_id, position)
) strict;

-- Blob-shaped app state: zustand persist keys (mosaic-ui, mosaic-ai) and app keys
-- (app.activeTemplateId). Never document content.
create table settings (
  key   text primary key,
  value text not null
) strict;
