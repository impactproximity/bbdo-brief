// Print a valid sign-in code without sending email, for when SMTP is down.
//
//   node --env-file=.env.local scripts/otp-breakglass.mjs --email jane@omc.com
//
// Operator-only, so unlike the login route this reports plainly whether the account
// exists — there is nobody to enumerate for here.
//
// NOTE: the token is 8 characters (generateLink produces a longer code than the 6-digit
// one GoTrue emails). /api/auth/verify accepts 6-8 digits for exactly this reason, and
// the login page has an "I already have a code" link so it can be entered without first
// requesting a fresh one. Both were verified against this project.

import { getUserByEmail, generateLoginCode, flagValue } from './_otp-lib.mjs';

const email = String(flagValue('--email') || '').trim().toLowerCase();
if (!email) {
  console.error('Usage: node --env-file=.env.local scripts/otp-breakglass.mjs --email name@omc.com');
  process.exit(1);
}

const user = await getUserByEmail(email);
if (!user) {
  console.error(`No bbdo_users row for ${email}. Create one first with otp-create-user.mjs.`);
  process.exit(1);
}
if (!user.is_active) {
  console.error(`${email} exists but is_active = false. Activate with db-activate.mjs first.`);
  process.exit(1);
}

const code = await generateLoginCode(email);
console.log(`\nSign-in code for ${email}:  ${code}`);
console.log('Single-use, expires normally. No email was sent.\n');
