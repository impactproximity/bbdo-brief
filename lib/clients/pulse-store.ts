import { getAdminClient, isSupabaseConfigured } from '@/lib/supabase/admin';
import type { PulseBrandContext } from '@/lib/pulse/types';

/**
 * Reads and writes for `pulse_clients` — brands onboarded from Impact BBDO Pulse.
 *
 * SERVER ONLY. Uses the service-role key, which bypasses RLS.
 *
 * HOW THIS DIFFERS FROM lib/briefs/store.ts, deliberately. That file's contract is that
 * every exported function takes `userId` first and filters on it, because a brief belongs
 * to one person. These rows belong to nobody: a client brand is visible to every signed-in
 * user by design, exactly as the compile-time clients in lib/clients/ are. So there is no
 * userId here and adding one would be wrong.
 *
 * The scoping that does matter is WRITE scoping, and it lives in the routes: every mutation
 * below is reachable only from app/api/admin/pulse-brands/*, behind requireAdmin(). Do not
 * call the write functions from anywhere else.
 *
 * COLUMN DISCIPLINE. `logo_base64` is a base64 image and `pulse_payload` is the whole
 * context bundle; together they are the overwhelming bulk of a row. SUMMARY_COLUMNS omits
 * both, so the picker and the admin dashboard never pull them. Only readPulseClientLogo()
 * touches the bytes. This is the same reasoning behind SUMMARY_COLUMNS in lib/briefs/store.ts.
 */

const TABLE = 'pulse_clients';
const getClient = getAdminClient;

/**
 * Everything except the two heavy columns. `logo_content_type` is included and doubles as
 * the has-a-logo flag — it is written if and only if `logo_base64` is, so a non-null value
 * means bytes exist without reading them.
 */
const SUMMARY_COLUMNS =
  'id, pulse_brand_id, label, description, icon, color, aliases, brief_types, ' +
  'proposition, proposition_source, brand_guidelines, prompt_guidance, logo_content_type, ' +
  'local_brand_notes, local_prompt_notes, local_notes_updated_at, local_notes_updated_by_email, ' +
  'guideline_version, guideline_created_at, synced_at, synced_by_email, is_active, created_at, updated_at';

export type PropositionSource = 'pulse' | 'local';

export interface PulseClientRow {
  id: string;
  pulse_brand_id: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  aliases: string[] | null;
  brief_types: string[] | null;
  proposition: string;
  proposition_source: PropositionSource;
  brand_guidelines: string;
  prompt_guidance: string;
  /** Non-null exactly when the row has logo bytes. */
  logo_content_type: string | null;
  /** Admin-typed additions, appended to Pulse's text. A Refresh never overwrites these. */
  local_brand_notes: string;
  local_prompt_notes: string;
  local_notes_updated_at: string | null;
  local_notes_updated_by_email: string | null;
  guideline_version: number | null;
  guideline_created_at: string | null;
  synced_at: string;
  synced_by_email: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * The admin-owned fields the upsert SETS.
 *
 * `local_brand_notes` / `local_prompt_notes` are admin-owned too but deliberately NOT here:
 * they are left out of the upsert payload entirely, so `ON CONFLICT DO UPDATE` never names
 * them and a Refresh cannot touch them. On first insert they take the column default ''.
 * They are written only by updateLocalNotes() below. See db/supabase/0008.
 */
export interface PulseClientLocalFields {
  label: string;
  description: string;
  icon: string;
  color: string;
  aliases: string[] | null;
  brief_types: string[] | null;
}

/** The fields a pull owns. Every Refresh replaces all of them. */
export interface PulseClientSyncedFields {
  brand_guidelines: string;
  prompt_guidance: string;
  guideline_version: number | null;
  guideline_created_at: string | null;
  pulse_payload: PulseBrandContext;
  logo_base64: string | null;
  logo_content_type: string | null;
}

export function isPulseStoreConfigured(): boolean {
  return isSupabaseConfigured();
}

/**
 * Every onboarded brand. Inactive rows are excluded unless asked for — the picker and the
 * public catalog want active only, the admin dashboard wants all of them so it can offer a
 * re-activate.
 */
export async function listPulseClients(options?: { includeInactive?: boolean }): Promise<PulseClientRow[]> {
  let query = getClient().from(TABLE).select(SUMMARY_COLUMNS).order('label', { ascending: true });
  if (!options?.includeInactive) query = query.eq('is_active', true);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list Pulse clients: ${error.message}`);
  return (data ?? []) as unknown as PulseClientRow[];
}

export async function getPulseClient(id: string): Promise<PulseClientRow | null> {
  const { data, error } = await getClient().from(TABLE).select(SUMMARY_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw new Error(`Failed to read Pulse client: ${error.message}`);
  return (data as unknown as PulseClientRow | null) ?? null;
}

/**
 * Lookup by their brand id rather than ours — the direction the admin dashboard needs, since
 * it starts from Pulse's roster and asks "have we onboarded this one?".
 */
export async function getPulseClientByBrandId(pulseBrandId: string): Promise<PulseClientRow | null> {
  const { data, error } = await getClient()
    .from(TABLE)
    .select(SUMMARY_COLUMNS)
    .eq('pulse_brand_id', pulseBrandId)
    .maybeSingle();
  if (error) throw new Error(`Failed to read Pulse client by brand id: ${error.message}`);
  return (data as unknown as PulseClientRow | null) ?? null;
}

/**
 * The bytes, for the logo route and the .docx header. The only read that touches
 * `logo_base64`.
 */
export async function readPulseClientLogo(id: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  const { data, error } = await getClient()
    .from(TABLE)
    .select('logo_base64, logo_content_type')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`Failed to read Pulse client logo: ${error.message}`);

  const row = data as { logo_base64: string | null; logo_content_type: string | null } | null;
  if (!row?.logo_base64 || !row.logo_content_type) return null;
  return { buffer: Buffer.from(row.logo_base64, 'base64'), contentType: row.logo_content_type };
}

/**
 * Create or replace a row.
 *
 * ADMIN ONLY — call from app/api/admin/pulse-brands/* after requireAdmin().
 *
 * A single upsert rather than insert-or-update because onboarding and refreshing are the
 * same operation from the database's point of view; which fields the caller supplies is
 * what makes them different. The route composes the full row so that the local/synced split
 * documented in 0007_pulse_clients.sql is decided in one visible place, not smeared across
 * two code paths here.
 */
export async function upsertPulseClient(
  row: PulseClientLocalFields &
    PulseClientSyncedFields & {
      id: string;
      pulse_brand_id: string;
      proposition: string;
      proposition_source: PropositionSource;
      synced_by_email: string | null;
    },
): Promise<PulseClientRow> {
  const now = new Date().toISOString();
  const { data, error } = await getClient()
    .from(TABLE)
    .upsert({ ...row, synced_at: now, updated_at: now }, { onConflict: 'id' })
    .select(SUMMARY_COLUMNS)
    .single();

  if (error) throw new Error(`Failed to save Pulse client: ${error.message}`);
  return data as unknown as PulseClientRow;
}

/**
 * ADMIN ONLY. Hides or restores a brand everywhere without destroying the row — existing
 * briefs keep their client_id and stay attributable, the same reason bbdo_users rows are
 * deactivated rather than deleted.
 */
export async function setPulseClientActive(id: string, isActive: boolean): Promise<PulseClientRow | null> {
  const { data, error } = await getClient()
    .from(TABLE)
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(SUMMARY_COLUMNS)
    .maybeSingle();

  if (error) throw new Error(`Failed to update Pulse client: ${error.message}`);
  return (data as unknown as PulseClientRow | null) ?? null;
}

/**
 * ADMIN ONLY. Replace the admin-typed notes that are appended to Pulse's text.
 *
 * Separate from upsertPulseClient on purpose, and the separation is the feature: these columns
 * are never named in the upsert payload, so a Refresh physically cannot overwrite them. The
 * only writer is this function. See db/supabase/0008_brand_context_local.sql.
 */
export async function updateLocalNotes(
  id: string,
  notes: { local_brand_notes: string; local_prompt_notes: string },
  editedByEmail: string | null,
): Promise<PulseClientRow | null> {
  const now = new Date().toISOString();
  const { data, error } = await getClient()
    .from(TABLE)
    .update({
      ...notes,
      local_notes_updated_at: now,
      local_notes_updated_by_email: editedByEmail,
      updated_at: now,
    })
    .eq('id', id)
    .select(SUMMARY_COLUMNS)
    .maybeSingle();

  if (error) throw new Error(`Failed to save local notes: ${error.message}`);
  return (data as unknown as PulseClientRow | null) ?? null;
}

/**
 * ADMIN ONLY. The proposition and its ownership flag, without touching anything else.
 *
 * The onboard route already decides this during a pull; this is the editor's path, where the
 * admin is changing only the proposition and no Pulse call is involved at all — so it works
 * even when Pulse is unreachable.
 */
export async function updateProposition(
  id: string,
  proposition: string,
  source: PropositionSource,
): Promise<PulseClientRow | null> {
  const { data, error } = await getClient()
    .from(TABLE)
    .update({ proposition, proposition_source: source, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(SUMMARY_COLUMNS)
    .maybeSingle();

  if (error) throw new Error(`Failed to save proposition: ${error.message}`);
  return (data as unknown as PulseClientRow | null) ?? null;
}

// --- Uploaded brand documents ----------------------------------------------------------

const DOCUMENTS_TABLE = 'pulse_client_documents';

/**
 * Everything except `extracted_text`, which is the raw parse of an entire document — up to
 * 150 KB per row — and is needed only when re-distilling. Same discipline that keeps
 * `logo_base64` and `pulse_payload` out of SUMMARY_COLUMNS above: a list view that pulls a
 * document's full text once per row turns the editor into a multi-megabyte response.
 */
const DOCUMENT_SUMMARY_COLUMNS =
  'id, client_id, filename, kind, byte_size, extracted_chars, distilled_text, distilled_model, ' +
  'distilled_at, distill_truncated, is_included, uploaded_at, uploaded_by_email';

export interface PulseClientDocumentRow {
  id: string;
  client_id: string;
  filename: string;
  kind: string;
  byte_size: number;
  extracted_chars: number;
  distilled_text: string;
  distilled_model: string | null;
  distilled_at: string | null;
  distill_truncated: boolean;
  /** False until an admin has read the distillation and ticked it. See 0008. */
  is_included: boolean;
  uploaded_at: string;
  uploaded_by_email: string | null;
}

/** One brand's documents, newest first. Carries no `extracted_text`. */
export async function listClientDocuments(clientId: string): Promise<PulseClientDocumentRow[]> {
  const { data, error } = await getClient()
    .from(DOCUMENTS_TABLE)
    .select(DOCUMENT_SUMMARY_COLUMNS)
    .eq('client_id', clientId)
    .order('uploaded_at', { ascending: false });

  if (error) throw new Error(`Failed to list brand documents: ${error.message}`);
  return (data ?? []) as unknown as PulseClientDocumentRow[];
}

/**
 * The included documents for MANY clients at once, as a Map keyed by client id.
 *
 * One query, not one per client. This feeds getAllClientConfigs(), which runs on
 * /api/v1/catalog and the client picker — a query per client inside that map is exactly the
 * N+1 that would make the catalog slow as brands are onboarded.
 *
 * Selects only what the prompt needs. `is_included = false` rows are excluded here rather
 * than filtered later, so an un-reviewed distillation cannot reach a prompt through a caller
 * that forgot to check the flag.
 */
export async function listIncludedDocumentsFor(
  clientIds: string[],
): Promise<Map<string, { filename: string; distilled_text: string }[]>> {
  const grouped = new Map<string, { filename: string; distilled_text: string }[]>();
  if (clientIds.length === 0) return grouped;

  const { data, error } = await getClient()
    .from(DOCUMENTS_TABLE)
    .select('client_id, filename, distilled_text')
    .in('client_id', clientIds)
    .eq('is_included', true)
    .order('uploaded_at', { ascending: true });

  if (error) throw new Error(`Failed to read brand documents: ${error.message}`);

  for (const row of (data ?? []) as { client_id: string; filename: string; distilled_text: string }[]) {
    // An included document with an empty distillation contributes nothing and is dropped
    // here, so compose does not have to emit a heading with no body under it.
    if (!row.distilled_text?.trim()) continue;
    const list = grouped.get(row.client_id) ?? [];
    list.push({ filename: row.filename, distilled_text: row.distilled_text });
    grouped.set(row.client_id, list);
  }
  return grouped;
}

/** One document WITH its raw extracted text — the re-distil path, and nothing else. */
export async function getClientDocumentWithText(
  id: string,
): Promise<(PulseClientDocumentRow & { extracted_text: string }) | null> {
  const { data, error } = await getClient()
    .from(DOCUMENTS_TABLE)
    .select(`${DOCUMENT_SUMMARY_COLUMNS}, extracted_text`)
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`Failed to read brand document: ${error.message}`);
  return (data as unknown as (PulseClientDocumentRow & { extracted_text: string }) | null) ?? null;
}

export interface NewClientDocument {
  client_id: string;
  filename: string;
  kind: string;
  byte_size: number;
  extracted_text: string;
  extracted_chars: number;
  distilled_text: string;
  distilled_model: string | null;
  distilled_at: string | null;
  distill_truncated: boolean;
  uploaded_by_email: string | null;
}

/**
 * ADMIN ONLY. Store an uploaded document and its distillation.
 *
 * `is_included` is deliberately not a parameter: a new document is always excluded, and the
 * only way it starts contributing to prompts is an admin ticking it through
 * updateClientDocument. Letting a caller pass `is_included: true` here would make it one
 * forgotten argument away from shipping un-reviewed model output into live briefs.
 */
export async function insertClientDocument(doc: NewClientDocument): Promise<PulseClientDocumentRow> {
  const { data, error } = await getClient()
    .from(DOCUMENTS_TABLE)
    .insert({ ...doc, is_included: false })
    .select(DOCUMENT_SUMMARY_COLUMNS)
    .single();

  if (error) throw new Error(`Failed to save brand document: ${error.message}`);
  return data as unknown as PulseClientDocumentRow;
}

/** ADMIN ONLY. Edit a distillation, or include/exclude the document. */
export async function updateClientDocument(
  id: string,
  patch: Partial<{
    distilled_text: string;
    distilled_model: string | null;
    distilled_at: string | null;
    distill_truncated: boolean;
    is_included: boolean;
  }>,
): Promise<PulseClientDocumentRow | null> {
  const { data, error } = await getClient()
    .from(DOCUMENTS_TABLE)
    .update(patch)
    .eq('id', id)
    .select(DOCUMENT_SUMMARY_COLUMNS)
    .maybeSingle();

  if (error) throw new Error(`Failed to update brand document: ${error.message}`);
  return (data as unknown as PulseClientDocumentRow | null) ?? null;
}

/**
 * ADMIN ONLY. Permanent.
 *
 * A hard delete, unlike a client row — which is deactivated rather than removed so historical
 * briefs keep their attribution. A document has no such history to protect: nothing references
 * it, and its only effect is on prompts built from now on.
 */
export async function deleteClientDocument(id: string): Promise<boolean> {
  const { data, error } = await getClient()
    .from(DOCUMENTS_TABLE)
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) throw new Error(`Failed to delete brand document: ${error.message}`);
  return Boolean(data);
}

/**
 * How many documents each client has, and how many are actually included.
 *
 * Both numbers, because the gap between them is the useful signal: "3 documents, 0 included"
 * means somebody uploaded and never came back to review, which is invisible if you only count
 * one of them. One query for every client, for the same N+1 reason as
 * listIncludedDocumentsFor.
 */
export async function countDocumentsByClient(
  clientIds: string[],
): Promise<Map<string, { total: number; included: number }>> {
  const counts = new Map<string, { total: number; included: number }>();
  if (clientIds.length === 0) return counts;

  const { data, error } = await getClient()
    .from(DOCUMENTS_TABLE)
    .select('client_id, is_included')
    .in('client_id', clientIds);

  if (error) throw new Error(`Failed to count brand documents: ${error.message}`);

  for (const row of (data ?? []) as { client_id: string; is_included: boolean }[]) {
    const entry = counts.get(row.client_id) ?? { total: 0, included: 0 };
    entry.total += 1;
    if (row.is_included) entry.included += 1;
    counts.set(row.client_id, entry);
  }
  return counts;
}
