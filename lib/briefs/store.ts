import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { PrefillResult } from '@/lib/questions/agency';

/**
 * Brief history store (Supabase / Postgres).
 *
 * SECURITY — read before changing anything here.
 * This uses the SERVICE-ROLE key, which bypasses row-level security completely. The
 * database will happily return any user's row if asked. Scoping is therefore enforced
 * here in app code: every exported function takes `userId` FIRST and filters on it.
 * Never add a function that looks a brief up by id alone, and never let `userId` come
 * from anywhere but a verified session (see getSession in lib/auth.ts).
 *
 * `userId` is bbdo_users.id from the Azure SQL database — an integer, not a uuid. There
 * is no foreign key; the users table lives in a different database until that migration.
 */

export type BriefStatus = 'in_progress' | 'saved' | 'submitted';

/** Row shape as stored. `answers` round-trips as PrefillResult with no transformation. */
export interface BriefRow {
  id: string;
  user_id: number;
  user_email: string;
  client_id: string;
  tier: string;
  title: string;
  status: BriefStatus;
  answers: PrefillResult;
  corpus: string;
  voice_transcript: string;
  text_notes: string;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
}

/** The columns the history list needs — deliberately excludes corpus and answers, which are large. */
export type BriefSummary = Pick<
  BriefRow,
  'id' | 'client_id' | 'tier' | 'title' | 'status' | 'created_at' | 'updated_at' | 'submitted_at'
>;

const SUMMARY_COLUMNS = 'id, client_id, tier, title, status, created_at, updated_at, submitted_at';

const TABLE = 'briefs';

// Cached on globalThis so the client survives hot reload and warm serverless instances,
// mirroring the mssql pool in lib/db.ts. supabase-js is fetch-based, so there is no
// connection pool to exhaust and no serverExternalPackages entry needed.
declare global {
  var _supabaseAdmin: SupabaseClient | undefined;
}

function getClient(): SupabaseClient {
  if (globalThis._supabaseAdmin) return globalThis._supabaseAdmin;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY ' +
        '(add the Supabase integration via the Vercel Marketplace, then `vercel env pull`).',
    );
  }

  const client = createClient(url, key, {
    // Server-only client: there is no browser session to persist or refresh.
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  globalThis._supabaseAdmin = client;
  return client;
}

/** True when the Supabase env vars are present, so callers can degrade instead of throwing. */
export function isBriefStoreConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export interface CreateBriefInput {
  clientId: string;
  tier: string;
  title?: string;
  answers?: PrefillResult;
  corpus?: string;
  voiceTranscript?: string;
  textNotes?: string;
}

/** Fields a caller may patch. Status transitions go through setStatus so submitted_at stays correct. */
export interface UpdateBriefInput {
  title?: string;
  answers?: PrefillResult;
  corpus?: string;
  voiceTranscript?: string;
  textNotes?: string;
}

export async function listBriefs(userId: number): Promise<BriefSummary[]> {
  const { data, error } = await getClient()
    .from(TABLE)
    .select(SUMMARY_COLUMNS)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw new Error(`Failed to list briefs: ${error.message}`);
  return (data ?? []) as unknown as BriefSummary[];
}

/** Returns null when the brief does not exist OR belongs to someone else — the caller cannot tell them apart. */
export async function getBrief(userId: number, briefId: string): Promise<BriefRow | null> {
  const { data, error } = await getClient()
    .from(TABLE)
    .select('*')
    .eq('id', briefId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load brief: ${error.message}`);
  return (data as BriefRow | null) ?? null;
}

export async function createBrief(
  userId: number,
  userEmail: string,
  input: CreateBriefInput,
): Promise<BriefRow> {
  const { data, error } = await getClient()
    .from(TABLE)
    .insert({
      user_id: userId,
      user_email: userEmail,
      client_id: input.clientId,
      tier: input.tier,
      title: input.title?.trim() || 'Untitled brief',
      status: 'in_progress' satisfies BriefStatus,
      answers: input.answers ?? {},
      corpus: input.corpus ?? '',
      voice_transcript: input.voiceTranscript ?? '',
      text_notes: input.textNotes ?? '',
    })
    .select('*')
    .single();

  if (error) throw new Error(`Failed to create brief: ${error.message}`);
  return data as BriefRow;
}

export async function updateBrief(
  userId: number,
  briefId: string,
  patch: UpdateBriefInput,
): Promise<BriefRow | null> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) row.title = patch.title.trim() || 'Untitled brief';
  if (patch.answers !== undefined) row.answers = patch.answers;
  if (patch.corpus !== undefined) row.corpus = patch.corpus;
  if (patch.voiceTranscript !== undefined) row.voice_transcript = patch.voiceTranscript;
  if (patch.textNotes !== undefined) row.text_notes = patch.textNotes;

  const { data, error } = await getClient()
    .from(TABLE)
    .update(row)
    .eq('id', briefId)
    .eq('user_id', userId)
    .select('*')
    .maybeSingle();

  if (error) throw new Error(`Failed to update brief: ${error.message}`);
  return (data as BriefRow | null) ?? null;
}

/** Moving to 'submitted' stamps submitted_at; moving away from it clears the stamp. */
export async function setStatus(
  userId: number,
  briefId: string,
  status: BriefStatus,
): Promise<BriefRow | null> {
  const { data, error } = await getClient()
    .from(TABLE)
    .update({
      status,
      updated_at: new Date().toISOString(),
      submitted_at: status === 'submitted' ? new Date().toISOString() : null,
    })
    .eq('id', briefId)
    .eq('user_id', userId)
    .select('*')
    .maybeSingle();

  if (error) throw new Error(`Failed to update brief status: ${error.message}`);
  return (data as BriefRow | null) ?? null;
}

/** Returns false when nothing was deleted (missing, or another user's brief). */
export async function deleteBrief(userId: number, briefId: string): Promise<boolean> {
  const { data, error } = await getClient()
    .from(TABLE)
    .delete()
    .eq('id', briefId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle();

  if (error) throw new Error(`Failed to delete brief: ${error.message}`);
  return Boolean(data);
}
