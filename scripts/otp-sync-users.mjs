// Make sure every active user has a Supabase Auth credential.
//
//   node --env-file=.env.local scripts/otp-sync-users.mjs --dry-run
//   node --env-file=.env.local scripts/otp-sync-users.mjs
//
// Without a GoTrue row an address cannot receive a code, because the request route calls
// signInWithOtp with shouldCreateUser: false. Run this after bulk-adding users.
//
// Idempotent, never deletes. Orphans (GoTrue users with no bbdo_users row) are reported,
// not removed — deleting a credential is not a decision a sync script should make alone.

import { listUsers, ensureAuthUser, listAuthUserEmails, hasFlag } from './_otp-lib.mjs';

const dryRun = hasFlag('--dry-run');

const users = await listUsers();
const active = users.filter((u) => u.is_active).map((u) => String(u.email).toLowerCase());
const inactive = users.length - active.length;

const existing = await listAuthUserEmails();
const missing = active.filter((e) => !existing.has(e));
const orphans = [...existing].filter((e) => !active.includes(e));

console.log(`bbdo_users      : ${users.length} (${active.length} active, ${inactive} inactive)`);
console.log(`already in Auth : ${active.length - missing.length}`);
console.log(`to create       : ${missing.length}`);
if (orphans.length) console.log(`orphans in Auth : ${orphans.length} (reported only, not deleted)`);

if (dryRun) {
  for (const e of missing) console.log(`  would create  ${e}`);
  for (const e of orphans) console.log(`  orphan        ${e}`);
  console.log('\nDry run — nothing changed.');
  process.exit(0);
}

const failed = [];
for (const email of missing) {
  try {
    const { created } = await ensureAuthUser(email);
    console.log(`  ${created ? 'created' : 'existed'}  ${email}`);
  } catch (err) {
    console.error(`  FAILED   ${email}: ${err.message}`);
    failed.push(email);
  }
}

if (failed.length) {
  console.error(`\n${failed.length} failed:`);
  for (const e of failed) console.error(`  ${e}`);
  process.exitCode = 1;
} else {
  console.log(`\nDone. ${missing.length} created, ${active.length} active users can receive codes.`);
}
