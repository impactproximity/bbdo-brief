// Revoke an API key immediately.
//
//   node --env-file=.env.local scripts/api-key-revoke.mjs --id <uuid>
//   node --env-file=.env.local scripts/api-key-revoke.mjs --prefix bbdo_sk_ab12
//
// Unlike revoking a human's access — where an existing session cookie keeps working for up
// to 7 days — this takes effect on the very next request: lib/api/auth.ts re-reads the key
// row every time and there is no cached token to outlive it.

import { admin, flagValue } from './_api-lib.mjs';

const id = flagValue('--id');
const prefix = flagValue('--prefix');

if (!id && !prefix) {
  console.error('Usage: node --env-file=.env.local scripts/api-key-revoke.mjs (--id <uuid> | --prefix bbdo_sk_xxxx)');
  process.exit(1);
}

const db = admin();
const query = db.from('api_keys').select('id, name, key_prefix, is_active, revoked_at');
const { data: matches, error: findError } = id ? await query.eq('id', id) : await query.eq('key_prefix', prefix);

if (findError) {
  console.error(`Lookup failed: ${findError.message}`);
  process.exit(1);
}
if (!matches?.length) {
  console.error(`No API key found for ${id ? `id ${id}` : `prefix ${prefix}`}.`);
  process.exit(1);
}
if (matches.length > 1) {
  console.error(`${matches.length} keys share that prefix — re-run with --id to be unambiguous:`);
  for (const m of matches) console.error(`  ${m.id}  ${m.name}`);
  process.exit(1);
}

const key = matches[0];
if (key.revoked_at) {
  console.log(`"${key.name}" (${key.key_prefix}…) was already revoked at ${key.revoked_at}. Nothing to do.`);
  process.exit(0);
}

const { error } = await db
  .from('api_keys')
  .update({ is_active: false, revoked_at: new Date().toISOString() })
  .eq('id', key.id);

if (error) {
  console.error(`Failed to revoke: ${error.message}`);
  process.exit(1);
}

console.log(`Revoked "${key.name}" (${key.key_prefix}…). It will be rejected on its next request.`);
