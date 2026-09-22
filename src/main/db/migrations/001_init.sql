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

-- Snapshots of a template's document. The head (highest seq) is the version the
-- draft was last in sync with: the draft is clean iff templates.rev = head.rev.
create table versions (
  id          text primary key,
  template_id text not null references templates(id) on delete cascade,
  seq         integer not null,             -- order within the template; head = max(seq)
  parent_id   text references versions(id) on delete set null,
  kind        text not null check (kind in ('auto', 'named')),
  source      text not null,                -- create | duplicate | name | import | restore | edit | switched | closed
  summary     text not null,                -- the user's name, or "Before restoring …"
  section     text,                         -- label of the one section an edit touched
  rev         integer not null,             -- template rev at snapshot
  created_at  integer not null,
  doc_hash    text not null references docs(hash),
  unique (template_id, seq)
) strict;
-- Deleting a version nulls its children's parent_id; without this, that scans the table.
create index versions_by_parent on versions (parent_id);
create index versions_by_doc on versions (doc_hash);

-- Blob-shaped app state: zustand persist keys (mosaic-ui, mosaic-ai) and app keys
-- (app.activeTemplateId). Never document content.
create table settings (
  key   text primary key,
  value text not null
) strict;
