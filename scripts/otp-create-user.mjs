// Add one person and let them sign in.
//
//   node --env-file=.env.local scripts/otp-create-user.mjs --email jane@omc.com
//   node --env-file=.env.local scripts/otp-create-user.mjs --email jane@omc.com --inactive
//
// Supabase Auth FIRST, then the bbdo_users row. That order is deliberate: if GoTrue fails
// we want to have created nothing, rather than a user who looks fine in the database but
// can never receive a code. The reverse (an orphan GoTrue row) is inert.

import { ensureAuthUser, getUserByEmail, createUser, setActive, flagValue, hasFlag } from './_otp-lib.mjs';

const email = String(flagValue('--email') || '').trim().toLowerCase();
const isActive = !hasFlag('--inactive');

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Usage: node --env-file=.env.local scripts/otp-create-user.mjs --email name@omc.com [--inactive]');
  process.exit(1);
}

const { created } = await ensureAuthUser(email);
console.log(`Supabase Auth : ${created ? 'created' : 'already existed'}`);

const existing = await getUserByEmail(email);
if (existing) {
  const row = await setActive(email, isActive);
  console.log(`bbdo_users    : existed (id=${existing.id}), is_active set to ${row.is_active}`);
} else {
  const row = await createUser(email, isActive);
  console.log(`bbdo_users    : created (id=${row.id}), is_active = ${row.is_active}`);
}

console.log(isActive
  ? `\n${email} can now request a sign-in code.`
  : `\n${email} created but INACTIVE — they cannot sign in yet.`);
