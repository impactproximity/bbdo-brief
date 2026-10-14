// Mint an API key for a consuming platform.
//
//   node --env-file=.env.local scripts/api-key-create.mjs --name "Planning Portal"
//   node --env-file=.env.local scripts/api-key-create.mjs --name "Acme" --clients mcvities,google-gemini
//   node --env-file=.env.local scripts/api-key-create.mjs --name "Acme" --tiers big-idea --rate 120
//
// Omit --clients or --tiers to leave that dimension unrestricted (every client / tier the
// registries allow). The plaintext key is printed ONCE and never stored — only its hash.

import { admin, mintKey, parseList, flagValue } from './_api-lib.mjs';

const name = String(flagValue('--name') || '').trim();
const clients = parseList(flagValue('--clients'));
const tiers = parseList(flagValue('--tiers'));
const rate = Number(flagValue('--rate') ?? 60);

if (!name) {
  console.error('Usage: node --env-file=.env.local scripts/api-key-create.mjs --name "Platform name" [--clients a,b] [--tiers big-idea] [--rate 60]');
  process.exit(1);
}
if (!Number.isInteger(rate) || rate <= 0) {
  console.error(`--rate must be a positive integer (got ${flagValue('--rate')})`);
  process.exit(1);
}

const { plaintext, hash, prefix } = mintKey();

const { data, error } = await admin()
  .from('api_keys')
  .insert({
    name,
    key_hash: hash,
    key_prefix: prefix,
    allowed_clients: clients,
    allowed_tiers: tiers,
    rate_limit_per_hour: rate,
  })
  .select('id, name, key_prefix, allowed_clients, allowed_tiers, rate_limit_per_hour, created_at')
  .single();

if (error) {
  console.error(`Failed to create key: ${error.message}`);
  process.exit(1);
}

console.log(`\nAPI key created\n`);
console.log(`  name        : ${data.name}`);
console.log(`  id          : ${data.id}`);
console.log(`  prefix      : ${data.key_prefix}`);
console.log(`  clients     : ${data.allowed_clients ? data.allowed_clients.join(', ') : '(all)'}`);
console.log(`  brief types : ${data.allowed_tiers ? data.allowed_tiers.join(', ') : '(all)'}`);
console.log(`  rate limit  : ${data.rate_limit_per_hour}/hour`);

console.log(`\n  ${plaintext}\n`);
console.log('  ^ Copy this now. Only its SHA-256 hash is stored, so it cannot be shown again.');
console.log('    Send it over a secure channel. If it leaks, revoke it with api-key-revoke.mjs.\n');
