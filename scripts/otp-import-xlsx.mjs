// Bulk-register people from a spreadsheet and let them sign in.
//
//   node --env-file=.env.local scripts/otp-import-xlsx.mjs "OMC email ID.xlsx" --dry-run
//   node --env-file=.env.local scripts/otp-import-xlsx.mjs "OMC email ID.xlsx"
//   node --env-file=.env.local scripts/otp-import-xlsx.mjs "file.xlsx" --column 2 --inactive
//
// INSERT-ONLY, and that is the whole safety model of this script.
//
// It skips any address that already has a bbdo_users row and never issues an update, so it
// is structurally incapable of changing someone's is_active or is_admin. That is what
// guarantees a bulk import cannot quietly revoke an admin, reactivate someone who was
// deliberately blocked, or deactivate a person who simply is not on the latest spreadsheet.
// `setActive` and `setAdmin` are deliberately NOT imported — the guarantee is enforced by
// what this file can reach, not by remembering to be careful.
//
// Anyone who needs their access CHANGED rather than created goes through the explicit,
// one-person-at-a-time scripts instead: db-activate.mjs and db-admin.mjs.
//
// Supabase Auth FIRST, then the bbdo_users row — same order and same reason as
// otp-create-user.mjs: if GoTrue fails we want to have created nothing, rather than a user
// who looks fine in the database but can never receive a code. An orphan GoTrue row is inert.

import ExcelJS from 'exceljs';
import { ensureAuthUser, createUser, listUsers, hasFlag, flagValue } from './_otp-lib.mjs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const dryRun = hasFlag('--dry-run');
const isActive = !hasFlag('--inactive');
const forcedColumn = Number(flagValue('--column')) || null;

// First non-flag argument is the file. (process.argv[2] would break on `--dry-run file.xlsx`.)
const file = process.argv.slice(2).find((a) => !a.startsWith('--') && !/^\d+$/.test(a));

if (!file) {
  console.error('Usage: node --env-file=.env.local scripts/otp-import-xlsx.mjs <file.xlsx> [--dry-run] [--inactive] [--column N]');
  process.exit(1);
}

/** Cell values can be plain, rich text, a hyperlink, or a formula result. Flatten them all. */
function cellText(cell) {
  const v = cell?.value;
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v.text) return String(v.text);
    if (v.hyperlink) return String(v.hyperlink);
    if (v.result !== undefined) return String(v.result);
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text).join('');
    return '';
  }
  return String(v);
}

/** Normalise one cell into an email, or '' if it is not one. */
function toEmail(cell) {
  const raw = cellText(cell).trim().replace(/^mailto:/i, '').toLowerCase();
  return EMAIL_RE.test(raw) ? raw : '';
}

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(file);
const ws = wb.worksheets[0];
if (!ws) {
  console.error(`No worksheets found in ${file}.`);
  process.exit(1);
}

/**
 * Find the email column by looking for the one with the most valid addresses, rather than
 * assuming a position. A header row contributes nothing because it is not a valid email,
 * which is also why a header can never be turned into a user.
 */
function detectColumn() {
  if (forcedColumn) return forcedColumn;
  const hits = new Map();
  ws.eachRow({ includeEmpty: false }, (row) => {
    for (let c = 1; c <= Math.max(ws.columnCount, 1); c++) {
      if (toEmail(row.getCell(c))) hits.set(c, (hits.get(c) ?? 0) + 1);
    }
  });
  if (hits.size === 0) return null;
  return [...hits.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

const column = detectColumn();
if (!column) {
  console.error(`No column in ${file} contains email addresses. Pass --column N to force one.`);
  process.exit(1);
}

// Collect, de-duplicate, and keep the first row number for reporting.
const found = new Map();
let skippedCells = 0;
ws.eachRow({ includeEmpty: false }, (row, i) => {
  const email = toEmail(row.getCell(column));
  if (!email) {
    if (cellText(row.getCell(column)).trim()) skippedCells++;
    return;
  }
  if (!found.has(email)) found.set(email, i);
});

console.log(`File       : ${file}`);
console.log(`Sheet      : "${ws.name}", email column ${column}${forcedColumn ? ' (forced)' : ' (detected)'}`);
console.log(`Addresses  : ${found.size} unique${skippedCells ? `, ${skippedCells} non-email cell(s) ignored` : ''}`);

if (found.size === 0) process.exit(1);

// Existing rows decide what is new. Compared lowercased, matching the unique index on
// lower(email) in 0003 — Postgres text is case-sensitive where SQL Server's NVARCHAR was not.
const existing = new Set((await listUsers()).map((u) => String(u.email).toLowerCase()));
const toCreate = [...found.keys()].filter((e) => !existing.has(e));
const skipped = [...found.keys()].filter((e) => existing.has(e));

console.log(`Already in : ${skipped.length} (untouched)`);
console.log(`To create  : ${toCreate.length}${isActive ? ' (active)' : ' (INACTIVE)'}`);

if (dryRun) {
  for (const e of toCreate) console.log(`  would create  ${e}`);
  console.log('\nDry run — nothing changed.');
  process.exit(0);
}

if (toCreate.length === 0) {
  console.log('\nNothing to do — every address is already registered.');
  process.exit(0);
}

console.log('');
const failed = [];
let created = 0;

for (const email of toCreate) {
  try {
    // GoTrue first. Without this row the address can never receive a code, because the
    // request route calls signInWithOtp with shouldCreateUser: false.
    await ensureAuthUser(email);
    const row = await createUser(email, isActive);
    created++;
    console.log(`  created  id=${String(row.id).padStart(3)}  ${email}`);
  } catch (err) {
    // Keep going: one bad address must not abandon the rest half-done.
    console.error(`  FAILED   ${email}: ${err.message}`);
    failed.push(email);
  }
}

console.log(`\nCreated ${created}, skipped ${skipped.length} already registered, ${failed.length} failed.`);

if (failed.length) {
  console.error('\nFailed:');
  for (const e of failed) console.error(`  ${e}`);
  console.error('\nRe-run to retry — the script is idempotent and will skip whatever succeeded.');
  process.exitCode = 1;
} else {
  console.log('Verify everyone can receive a code: node --env-file=.env.local scripts/otp-sync-users.mjs --dry-run');
}
