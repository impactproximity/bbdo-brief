// One-off: verify DB connectivity and create the users table.
// Run with: node --env-file=.env.local scripts/db-setup.mjs
import sql from 'mssql';
import { readFileSync } from 'node:fs';

function buildConfig() {
  const cs = process.env.DATABASE_URL;
  if (!cs) throw new Error('DATABASE_URL is not set');
  const parts = {};
  for (const seg of cs.split(';')) {
    if (!seg.trim()) continue;
    const i = seg.indexOf('=');
    if (i === -1) continue;
    parts[seg.slice(0, i).trim().toLowerCase()] = seg.slice(i + 1).trim();
  }
  const serverRaw = (parts['server'] || parts['data source'] || '').replace(/^tcp:/i, '');
  const [host, port] = serverRaw.split(',');
  const truthy = (v) => /^(true|yes|1)$/i.test((v || '').trim());
  return {
    server: host,
    port: port ? parseInt(port, 10) : 1433,
    database: parts['database'] || parts['initial catalog'],
    user: parts['user id'] || parts['uid'] || parts['user'],
    password: parts['password'] || parts['pwd'],
    options: {
      encrypt: parts['encrypt'] ? truthy(parts['encrypt']) : true,
      trustServerCertificate: truthy(parts['trustservercertificate']),
    },
  };
}

const config = buildConfig();
console.log(`Connecting to ${config.server}:${config.port}/${config.database} as ${config.user}...`);

const pool = await new sql.ConnectionPool(config).connect();
console.log('✓ Connected.');

const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
await pool.request().batch(schema);
console.log('✓ Schema applied (users table ensured).');

const r = await pool.request().query('SELECT COUNT(*) AS n FROM bbdo_users');
console.log(`✓ bbdo_users table reachable — ${r.recordset[0].n} row(s).`);

await pool.close();
console.log('Done.');
