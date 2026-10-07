// Shared helpers for the OTP provisioning scripts.
// Run them with: node --env-file=.env.local scripts/<name>.mjs
//
// Everything is Supabase now: `bbdo_users` moved out of SQL Server, so there is no
// connection-string parsing and no mssql anywhere in this project.

import { createClient } from '@supabase/supabase-js';

// --- Supabase Auth (GoTrue: the credential store) -------------------------------------

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set. Run \`vercel env pull\` first.`);
  return v;
}

function admin() {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/**
 * Give an address a GoTrue credential row so it can receive codes. Idempotent.
 *
 * `email_confirm: true` is load-bearing: without it the user is unconfirmed and GoTrue
 * sends the "Confirm signup" template instead of the Magic Link one, so they get a link
 * and never a code — login silently fails for exactly the users you just created.
 */
export async function ensureAuthUser(email) {
  const { error } = await admin().auth.admin.createUser({ email, email_confirm: true });
  if (!error) return { created: true };
  const msg = (error.message || '').toLowerCase();
  if (error.status === 422 || msg.includes('already been registered') || msg.includes('email_exists')) {
    return { created: false };
  }
  throw new Error(`Supabase Auth rejected ${email}: ${error.message}`);
}

/** Every email known to GoTrue — supabase-js v2 has no getUserByEmail. */
export async function listAuthUserEmails() {
  const a = admin();
  const out = new Set();
  for (let page = 1; ; page++) {
    const { data, error } = await a.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Failed to list Supabase Auth users: ${error.message}`);
    const users = data?.users ?? [];
    for (const u of users) if (u.email) out.add(u.email.toLowerCase());
    if (users.length < 1000) break;
  }
  return out;
}

/** Break-glass code, generated without sending email. */
export async function generateLoginCode(email) {
  const { data, error } = await admin().auth.admin.generateLink({ type: 'magiclink', email });
  if (error) throw new Error(`Failed to generate a code for ${email}: ${error.message}`);
  const otp = data?.properties?.email_otp;
  if (!otp) throw new Error(`Supabase returned no email_otp for ${email}.`);
  return otp;
}

// --- bbdo_users (the allowlist and the identity) -------------------------------------
//
// Uses the service-role key, which bypasses RLS — the table has RLS on with no policies,
// so this is the only way to reach it.

/** Returns undefined when there is no such user. Matches on lowercased email. */
export async function getUserByEmail(email) {
  const { data, error } = await admin()
    .from('bbdo_users')
    .select('id, email, is_active, is_admin')
    .eq('email', String(email).trim().toLowerCase())
    .maybeSingle();
  if (error) throw new Error(`Failed to look up ${email}: ${error.message}`);
  return data ?? undefined;
}

/** Every user, ordered by id. */
export async function listUsers() {
  const { data, error } = await admin()
    .from('bbdo_users')
    .select('id, email, is_active, is_admin')
    .order('id');
  if (error) throw new Error(`Failed to list users: ${error.message}`);
  return data ?? [];
}

/** Insert a user. The id comes from the sequence attached in 0004. */
export async function createUser(email, isActive) {
  const { data, error } = await admin()
    .from('bbdo_users')
    .insert({ email: String(email).trim().toLowerCase(), is_active: Boolean(isActive) })
    .select('id, email, is_active, is_admin')
    .single();
  if (error) throw new Error(`Failed to create ${email}: ${error.message}`);
  return data;
}

/** Flip is_active. With OTP login this is the complete definition of access. */
export async function setActive(email, isActive) {
  const { data, error } = await admin()
    .from('bbdo_users')
    .update({ is_active: Boolean(isActive) })
    .eq('email', String(email).trim().toLowerCase())
    .select('id, email, is_active, is_admin')
    .maybeSingle();
  if (error) throw new Error(`Failed to update ${email}: ${error.message}`);
  return data ?? undefined;
}

/**
 * Flip is_admin — access to the usage report at /agency/admin, nothing else.
 *
 * Deliberately separate from setActive: is_active decides whether someone may sign in at
 * all, and the two must never be conflated. Granting admin does not grant access, and
 * revoking admin does not revoke it.
 *
 * Not instant: requireAdmin() re-reads the row on every request, so this takes effect on the
 * admin's next page load — unlike is_active, which an existing session outlives.
 */
export async function setAdmin(email, isAdmin) {
  const { data, error } = await admin()
    .from('bbdo_users')
    .update({ is_admin: Boolean(isAdmin) })
    .eq('email', String(email).trim().toLowerCase())
    .select('id, email, is_active, is_admin')
    .maybeSingle();
  if (error) throw new Error(`Failed to update ${email}: ${error.message}`);
  return data ?? undefined;
}

export function hasFlag(name) {
  return process.argv.includes(name);
}

export function flagValue(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
