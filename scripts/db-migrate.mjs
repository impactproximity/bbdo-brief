// One-off: create bbdo_users in the current DATABASE_URL db (BBDOChat) and
// copy any existing rows over from the old FMFJan2026 db. Idempotent.
// Run: node --env-file=.env.local scripts/db-migrate.mjs
import sql from 'mssql';
import { readFileSync } from 'node:fs';

function parse(cs) {
  const p = {};
  for (const s of cs.split(';')) {
    if (!s.trim()) continue;
    const i = s.indexOf('=');
    if (i === -1) continue;
    p[s.slice(0, i).trim().toLowerCase()] = s.slice(i + 1).trim();
  }
  const [host, port] = (p['server'] || '').replace(/^tcp:/i, '').split(',');
  const truthy = (v) => /^(true|yes|1)$/i.test((v || '').trim());
  return {
    server: host, port: port ? parseInt(port, 10) : 1433,
    database: p['database'], user: p['user id'] || p['uid'], password: p['password'] || p['pwd'],
    options: { encrypt: p['encrypt'] ? truthy(p['encrypt']) : true, trustServerCertificate: truthy(p['trustservercertificate']) },
  };
}

const newCfg = parse(process.env.DATABASE_URL);          // BBDOChat (target)
const oldCfg = { ...newCfg, database: 'FMFJan2026' };     // source

console.log(`Target: ${newCfg.database} | Source: ${oldCfg.database}`);

const newPool = await new sql.ConnectionPool(newCfg).connect();
const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
await newPool.request().batch(schema);
console.log(`✓ bbdo_users ensured in ${newCfg.database}`);

let sourceRows = [];
try {
  const oldPool = await new sql.ConnectionPool(oldCfg).connect();
  const r = await oldPool.request().query('SELECT email, password_hash, is_active FROM bbdo_users');
  sourceRows = r.recordset;
  await oldPool.close();
  console.log(`Found ${sourceRows.length} row(s) in ${oldCfg.database}.bbdo_users`);
} catch (e) {
  console.log(`No source rows to migrate (${e.message.slice(0, 60)})`);
}

let copied = 0;
for (const row of sourceRows) {
  const res = await newPool.request()
    .input('email', row.email)
    .input('hash', row.password_hash)
    .input('active', row.is_active ? 1 : 0)
    .query(`IF NOT EXISTS (SELECT 1 FROM bbdo_users WHERE email=@email)
            INSERT INTO bbdo_users (email, password_hash, is_active) VALUES (@email,@hash,@active)`);
  if (res.rowsAffected[0] > 0) copied++;
}
console.log(`✓ Migrated ${copied} new row(s) into ${newCfg.database}.bbdo_users`);

const c = await newPool.request().query('SELECT id, email, is_active FROM bbdo_users');
console.log('Now in BBDOChat.bbdo_users:', JSON.stringify(c.recordset));
await newPool.close();
