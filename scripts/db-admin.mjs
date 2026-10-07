// Grant or revoke access to the usage report at /agency/admin.
//
//   node --env-file=.env.local scripts/db-admin.mjs jane@impactbbdo.ae true
//   node --env-file=.env.local scripts/db-admin.mjs jane@impactbbdo.ae false
//   node --env-file=.env.local scripts/db-admin.mjs            # list current admins
//
// is_admin controls ONE thing: whether /agency/admin and /api/admin/* will answer. It is not
// a login gate — `is_active` remains the complete definition of "may sign in" (db-activate.mjs).
// Granting admin to an inactive user does nothing until they are also activated.
//
// Takes effect on the next request: requireAdmin() re-reads the row every time, so unlike
// deactivation there is no session-expiry delay.

import { getUserByEmail, listUsers, setAdmin } from './_otp-lib.mjs';

const email = String(process.argv[2] || '').trim().toLowerCase();

if (!email) {
  const users = await listUsers();
  const admins = users.filter((u) => u.is_admin);
  if (admins.length === 0) {
    console.log('No admins yet. Nobody can open /agency/admin.\n');
    console.log('Grant access with:');
    console.log('  node --env-file=.env.local scripts/db-admin.mjs <email> true');
  } else {
    console.log(`${admins.length} admin${admins.length === 1 ? '' : 's'}:\n`);
    for (const u of admins) {
      console.log(`  ${u.email}${u.is_active ? '' : '   (INACTIVE - cannot sign in)'}`);
    }
  }
  process.exit(0);
}

const raw = String(process.argv[3] ?? 'true').toLowerCase();
const isAdmin = raw === 'true' || raw === '1' || raw === 'yes';

const user = await getUserByEmail(email);
if (!user) {
  console.error(`No bbdo_users row for ${email}. Create one with otp-create-user.mjs.`);
  process.exit(1);
}

const row = await setAdmin(email, isAdmin);
console.log(`bbdo_users : id=${row.id} is_admin = ${row.is_admin}`);

if (isAdmin && !row.is_active) {
  console.warn(`\nWARNING: ${email} is not active, so they cannot sign in and therefore`);
  console.warn('cannot reach the report. Activate them with db-activate.mjs.');
} else {
  console.log(isAdmin
    ? `\n${email} can open /agency/admin.`
    : `\n${email} can no longer open /agency/admin (takes effect on their next request).`);
}
