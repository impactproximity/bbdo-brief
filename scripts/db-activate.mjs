// Grant or revoke access.
//
//   node --env-file=.env.local scripts/db-activate.mjs jane@omc.com true
//   node --env-file=.env.local scripts/db-activate.mjs jane@omc.com false
//
// With OTP login there is no password, so `is_active` is the COMPLETE definition of
// "may sign in" — this script is the whole of access control.
//
// Reactivating also re-runs ensureAuthUser: someone who predates the Supabase Auth
// backfill would otherwise look active here but never receive a code.
//
// NOTE: revocation is not instant. verifySession never touches the database, so an
// existing session cookie keeps working until it expires (7 days).

import { getUserByEmail, setActive, ensureAuthUser } from './_otp-lib.mjs';

const email = String(process.argv[2] || '').trim().toLowerCase();
const raw = String(process.argv[3] ?? 'true').toLowerCase();
const isActive = raw === 'true' || raw === '1' || raw === 'yes';

if (!email) {
  console.error('Usage: node --env-file=.env.local scripts/db-activate.mjs <email> [true|false]');
  process.exit(1);
}

const user = await getUserByEmail(email);
if (!user) {
  console.error(`No bbdo_users row for ${email}. Create one with otp-create-user.mjs.`);
  process.exit(1);
}

if (isActive) {
  const { created } = await ensureAuthUser(email);
  console.log(`Supabase Auth : ${created ? 'created' : 'already existed'}`);
}

const row = await setActive(email, isActive);
console.log(`bbdo_users    : id=${row.id} is_active = ${row.is_active}`);
console.log(isActive
  ? `\n${email} can sign in.`
  : `\n${email} is blocked from new sign-ins (any existing session lasts until it expires).`);
