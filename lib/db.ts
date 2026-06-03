import sql from 'mssql';

// Reuse a single connection pool across hot-reloads / warm function instances.
const globalForDb = globalThis as unknown as { _mssqlPool?: Promise<sql.ConnectionPool> };

/** Parse a .NET / ADO-style connection string into an mssql config. */
function buildConfig(): sql.config {
  const cs = process.env.DATABASE_URL;
  if (!cs) {
    throw new Error('DATABASE_URL is not set. Add the SQL Server connection string to .env.local.');
  }

  const parts: Record<string, string> = {};
  for (const segment of cs.split(';')) {
    if (!segment.trim()) continue;
    const idx = segment.indexOf('=');
    if (idx === -1) continue;
    parts[segment.slice(0, idx).trim().toLowerCase()] = segment.slice(idx + 1).trim();
  }

  const serverRaw = (parts['server'] || parts['data source'] || '').replace(/^tcp:/i, '');
  const [host, portStr] = serverRaw.split(',');
  const truthy = (v?: string) => /^(true|yes|1)$/i.test((v || '').trim());

  return {
    server: host,
    port: portStr ? parseInt(portStr, 10) : 1433,
    database: parts['database'] || parts['initial catalog'],
    user: parts['user id'] || parts['uid'] || parts['user'],
    password: parts['password'] || parts['pwd'],
    options: {
      // Default to encrypted; honour an explicit Encrypt=false.
      encrypt: parts['encrypt'] ? truthy(parts['encrypt']) : true,
      trustServerCertificate: truthy(parts['trustservercertificate']),
    },
  };
}

export function getPool(): Promise<sql.ConnectionPool> {
  if (!globalForDb._mssqlPool) {
    globalForDb._mssqlPool = new sql.ConnectionPool(buildConfig()).connect();
  }
  return globalForDb._mssqlPool!;
}

type SqlParam = string | number | boolean | null;

/**
 * Run a parameterised query and return the rows.
 * Use @name placeholders in `text` and pass values in `params`, e.g.
 *   query('SELECT * FROM users WHERE email = @email', { email })
 */
export async function query<T = Record<string, unknown>>(
  text: string,
  params: Record<string, SqlParam> = {},
): Promise<T[]> {
  const pool = await getPool();
  const request = pool.request();
  for (const [key, value] of Object.entries(params)) {
    request.input(key, value);
  }
  const result = await request.query(text);
  return result.recordset as T[];
}
