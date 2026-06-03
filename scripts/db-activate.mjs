// Activate (or deactivate) a user. Usage:
//   node --env-file=.env.local scripts/db-activate.mjs <email> [0|1]
import sql from 'mssql';

function buildConfig() {
  const cs = process.env.DATABASE_URL;
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
    server: host, port: port ? parseInt(port, 10) : 1433,
    database: parts['database'], user: parts['user id'] || parts['uid'], password: parts['password'] || parts['pwd'],
    options: { encrypt: parts['encrypt'] ? truthy(parts['encrypt']) : true, trustServerCertificate: truthy(parts['trustservercertificate']) },
  };
}

const email = process.argv[2];
const active = process.argv[3] === '0' ? 0 : 1;
if (!email) { console.error('Usage: db-activate.mjs <email> [0|1]'); process.exit(1); }

const pool = await new sql.ConnectionPool(buildConfig()).connect();
const r = await pool.request().input('email', email).input('active', active)
  .query('UPDATE bbdo_users SET is_active = @active WHERE email = @email');
console.log(`is_active=${active} for ${email} — rows affected: ${r.rowsAffected[0]}`);
await pool.close();
