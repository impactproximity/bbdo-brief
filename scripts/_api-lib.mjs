// Shared helpers for the API-key management scripts.
// Run them with: node --env-file=.env.local scripts/<name>.mjs
//
// These talk to the LIVE database, like every other script in this directory. There is no
// separate dev instance.

import { createClient } from '@supabase/supabase-js';
import { createHash, randomBytes } from 'node:crypto';

export const API_KEY_PREFIX = 'bbdo_sk_';

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set. Run \`vercel env pull\` first.`);
  return v;
}

export function admin() {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/**
 * Mint a key. 32 random bytes, base64url, behind a recognisable prefix.
 *
 * Must stay in step with lib/api/auth.ts: the route hashes the presented key with SHA-256
 * and looks it up by hash, so only the hash is ever stored. The plaintext below is the
 * only time it exists anywhere — if it is lost, mint a new key and revoke this one.
 */
export function mintKey() {
  const plaintext = API_KEY_PREFIX + randomBytes(32).toString('base64url');
  return {
    plaintext,
    hash: createHash('sha256').update(plaintext).digest('hex'),
    prefix: plaintext.slice(0, 12),
  };
}

/** Comma-separated CLI value to a Postgres text[] — undefined/empty means unrestricted. */
export function parseList(value) {
  if (value === undefined || value === null) return null;
  const items = String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length ? items : null;
}

export function hasFlag(name) {
  return process.argv.includes(name);
}

export function flagValue(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
