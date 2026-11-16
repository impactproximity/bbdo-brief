-- 0008_brand_context_local.sql
--
-- Two ways to give a Pulse-synced brand context that Pulse does not hold:
--   1. local notes an admin types, which a Refresh must never overwrite
--   2. brand documents an admin uploads, distilled into brand context
--
-- RUN THIS BEFORE deploying the code that reads it. Purely additive — new columns with
-- defaults and one new table — so applying it early changes nothing about the running app.
--
-- WHY NOT JUST MAKE THE PULLED TEXT EDITABLE. 0007 makes brand_guidelines and prompt_guidance
-- Pulse-owned: every Refresh replaces them wholesale, which is what keeps a brand's context in
-- step with the guidelines someone maintains upstream. An editable column there would be
-- silently discarded the next time an admin clicked Refresh — the worst kind of bug, because
-- the edit appears to work and the loss happens later, to someone else.
--
-- So the local material lives in its OWN columns and is APPENDED to Pulse's text at compose
-- time. Pulse keeps updating; our additions always survive. The accepted cost is that an admin
-- can add to Pulse's guidelines but cannot delete a line of them — if that becomes a real
-- problem the answer is a per-field ownership flag like proposition_source, not making these
-- columns the primary copy.

-- --- Local notes on pulse_clients -------------------------------------------------------

-- Appended inside <brand_guidelines>, under a "## Our additions" heading, so the model reads
-- them as part of the guidelines rather than as a competing instruction set.
alter table pulse_clients add column if not exists local_brand_notes text not null default '';

-- Appended inside <prompt_guidance> the same way. Two columns rather than one because the
-- admin is editing two named things, and a single box would leave it ambiguous which prompt
-- block the text ends up in.
alter table pulse_clients add column if not exists local_prompt_notes text not null default '';

-- Provenance, matching synced_by_email. Nullable: a brand that has never had local notes has
-- no editor, and '' is not a person.
alter table pulse_clients add column if not exists local_notes_updated_at timestamptz;
alter table pulse_clients add column if not exists local_notes_updated_by_email text;


-- --- Uploaded brand documents ----------------------------------------------------------

create table if not exists pulse_client_documents (
  id uuid primary key default gen_random_uuid(),

  -- A REAL foreign key, unlike briefs.client_id. That column is free-form text because it has
  -- to tolerate a client id from either registry, and a value that has left the registry
  -- entirely, forever. This one only ever points at a synced row we own, so the database can
  -- enforce it — and the cascade means deactivating is still reversible while deleting a
  -- client cannot leave orphaned documents feeding a prompt for a brand that no longer exists.
  client_id text not null references pulse_clients (id) on delete cascade,

  -- --- The upload as it arrived ---
  filename text not null,
  -- One of lib/uploads/supported-files.ts's SupportedKind: 'pdf' | 'docx' | 'xlsx' | 'csv'.
  -- Text, not an enum: that union is a code-level contract that changes when a parser is
  -- added, and a stale enum value in the database would be a migration rather than a no-op.
  kind text not null,
  byte_size integer not null,

  -- --- The raw parse ---
  -- Kept deliberately, not just the distillation. The distilling prompt is the part of this
  -- feature most likely to be improved once someone reads a few of its outputs, and keeping
  -- the extracted text means every already-uploaded document can be re-distilled without
  -- asking anyone to find the original file again. Same reasoning as pulse_payload in 0007.
  extracted_text text not null,
  extracted_chars integer not null,

  -- --- What actually reaches the prompt ---
  -- The model's distillation, after the admin's edits. Empty until the distillation returns.
  distilled_text text not null default '',
  distilled_model text,
  distilled_at timestamptz,
  -- True when the extracted text was longer than the distiller's input cap and was truncated.
  -- Recorded rather than inferred, so an admin is told they are looking at a partial read of
  -- their document instead of quietly receiving one.
  distill_truncated boolean not null default false,

  -- THE REVIEW GATE, and the reason this column defaults to false.
  --
  -- A distillation is model-written text about to become the always-on brand context for every
  -- brief this client ever raises — the first AI-authored content of its kind in this product;
  -- everything in lib/clients/ was written by a person reading a client document. False means
  -- the document contributes nothing to any prompt. An admin reads it, edits it, and ticks it.
  -- Writing the row immediately on upload means a paid distillation is never lost, while the
  -- flag means un-reviewed model output cannot reach a brief.
  is_included boolean not null default false,

  uploaded_at timestamptz not null default now(),
  uploaded_by_email text
);

-- The editor lists one brand's documents newest first, and the compose path reads the included
-- ones for many brands at once. Both are covered by this.
create index if not exists pulse_client_documents_client_idx
  on pulse_client_documents (client_id, uploaded_at desc);

-- RLS enabled with no policies, as on every other table here: a leaked anon key reaches
-- nothing, and all access goes through the service-role key from our own routes. Writes are
-- additionally gated by requireAdmin() in app/api/admin/pulse-brands/*.
alter table pulse_client_documents enable row level security;
