// List API keys and their scopes. Never shows a secret — only the prefix.
//
//   node --env-file=.env.local scripts/api-key-list.mjs
//   node --env-file=.env.local scripts/api-key-list.mjs --all   (include revoked/inactive)

import { admin, hasFlag } from './_api-lib.mjs';

const includeAll = hasFlag('--all');

const { data, error } = await admin()
  .from('api_keys')
  .select('id, name, key_prefix, allowed_clients, allowed_tiers, is_active, rate_limit_per_hour, created_at, last_used_at, revoked_at')
  .order('created_at', { ascending: true });

if (error) {
  console.error(`Failed to list keys: ${error.message}`);
  process.exit(1);
}

const rows = includeAll ? data : data.filter((k) => k.is_active && !k.revoked_at);

if (!rows.length) {
  console.log(includeAll ? 'No API keys.' : 'No active API keys. Use --all to include revoked ones.');
  process.exit(0);
}

console.log(`\n${rows.length} API key${rows.length === 1 ? '' : 's'}${includeAll ? '' : ' (active)'}:\n`);

for (const k of rows) {
  const state = k.revoked_at ? 'REVOKED' : k.is_active ? 'active' : 'inactive';
  console.log(`  ${k.name}  [${state}]`);
  console.log(`    id          : ${k.id}`);
  console.log(`    prefix      : ${k.key_prefix}…`);
  console.log(`    clients     : ${k.allowed_clients ? k.allowed_clients.join(', ') : '(all)'}`);
  console.log(`    brief types : ${k.allowed_tiers ? k.allowed_tiers.join(', ') : '(all)'}`);
  console.log(`    rate limit  : ${k.rate_limit_per_hour}/hour`);
  console.log(`    created     : ${k.created_at}`);
  console.log(`    last used   : ${k.last_used_at ?? 'never'}`);
  console.log('');
}
