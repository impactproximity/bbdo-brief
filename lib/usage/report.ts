import { getAdminClient } from '@/lib/supabase/admin';
import { RATES_LAST_VERIFIED, RATES_VERSION } from './rates';
import type { BriefStatus } from '@/lib/briefs/store';

/**
 * Cross-user reporting aggregates. ADMIN-GATED CALLERS ONLY.
 *
 * WHY THIS IS NOT IN lib/briefs/store.ts — read before moving anything here.
 * That file's security contract is that every exported function takes `userId` first and
 * filters on it, and that nothing may look a brief up by id alone. Reporting is unscoped
 * by definition: it reads every user's rows. Putting these queries there would break the
 * invariant that makes that file safe to reason about. They live here instead, reachable
 * only from routes that have called requireAdmin() (lib/auth.ts).
 *
 * Aggregation runs here in the route, not in the browser: the page receives only rolled-up
 * numbers, never raw events.
 *
 * SCALE NOTE: aggregation is done in JS over paged reads rather than in SQL. At the current
 * volume (27 users) that is correct and keeps everything in one place. If usage_events ever
 * reaches the high hundreds of thousands, move the rollup into a Postgres view or RPC.
 */

const PAGE = 1000;

/** Page through a table so a result is never silently truncated at Supabase's row cap. */
async function selectAll<T>(
  table: string,
  columns: string,
  apply: (q: ReturnType<ReturnType<typeof getAdminClient>['from']>) => unknown,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = getAdminClient().from(table).select(columns);
    q = apply(q) ?? q;
    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error) throw new Error(`Failed to read ${table}: ${error.message}`);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

export interface UserUsageRow {
  userId: number | null;
  email: string;
  isActive: boolean;
  isAdmin: boolean;
  createdAt: string | null;
  lastLoginAt: string | null;

  /** Briefs created inside the selected range, by status. */
  briefsInRange: number;
  briefsInProgress: number;
  briefsSaved: number;
  briefsSubmitted: number;
  /** Lifetime count, ignoring the range — the "has this person ever used it" answer. */
  briefsLifetime: number;

  aiCalls: number;
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;

  costUsd: number;
  /** Events whose model had no rate, so their cost is missing from costUsd. */
  unpricedEvents: number;
}

export interface GroupRow {
  key: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  costUsd: number;
  unpricedEvents: number;
}

export interface UsageReport {
  from: string;
  to: string;
  users: UserUsageRow[];
  byRoute: GroupRow[];
  byModel: GroupRow[];
  totals: {
    users: number;
    activeUsers: number;
    usersWithActivity: number;
    briefsInRange: number;
    briefsLifetime: number;
    aiCalls: number;
    inputTokens: number;
    outputTokens: number;
    cacheWriteTokens: number;
    cacheReadTokens: number;
    costUsd: number;
    unpricedEvents: number;
  };
  /** Null until a human has checked lib/usage/rates.ts against the providers' pricing pages. */
  ratesLastVerified: string | null;
  ratesVersion: string;
}

interface UserRecord {
  id: number;
  email: string;
  is_active: boolean;
  is_admin: boolean;
  created_at: string | null;
  last_login_at: string | null;
}

interface BriefRecord {
  user_id: number;
  status: BriefStatus;
  created_at: string;
}

interface EventRecord {
  user_id: number | null;
  user_email: string | null;
  route: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_write_tokens: number;
  cache_read_tokens: number;
  cost_usd: string | number | null;
}

function emptyGroup(key: string): GroupRow {
  return {
    key,
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
    costUsd: 0,
    unpricedEvents: 0,
  };
}

function addEvent(g: GroupRow, e: EventRecord): void {
  g.calls += 1;
  g.inputTokens += e.input_tokens ?? 0;
  g.outputTokens += e.output_tokens ?? 0;
  g.cacheWriteTokens += e.cache_write_tokens ?? 0;
  g.cacheReadTokens += e.cache_read_tokens ?? 0;
  // numeric comes back as a string from postgrest; null means unpriced, NOT free.
  if (e.cost_usd == null) g.unpricedEvents += 1;
  else g.costUsd += Number(e.cost_usd);
}

/**
 * Build the whole report for a date range.
 *
 * Starts from `bbdo_users`, not from the event log, so people with NO activity still appear.
 * "Which users are using the platform" is partly answered by who is not.
 */
export async function buildUsageReport(fromIso: string, toIso: string): Promise<UsageReport> {
  const [users, briefsAll, events] = await Promise.all([
    selectAll<UserRecord>('bbdo_users', 'id, email, is_active, is_admin, created_at, last_login_at', (q) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (q as any).order('email'),
    ),
    // Lifetime briefs: we need both the in-range and the all-time count, and at this volume
    // one read is cheaper than two. Note `corpus` is deliberately NOT selected — it can be
    // multiple MB per row.
    selectAll<BriefRecord>('briefs', 'user_id, status, created_at', (q) => q),
    selectAll<EventRecord>(
      'usage_events',
      'user_id, user_email, route, model, input_tokens, output_tokens, cache_write_tokens, cache_read_tokens, cost_usd',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (q) => (q as any).gte('created_at', fromIso).lte('created_at', toIso),
    ),
  ]);

  const rows = new Map<string, UserUsageRow>();
  const keyFor = (id: number | null, email: string | null) =>
    id != null ? `id:${id}` : `email:${(email ?? 'unattributed').toLowerCase()}`;

  for (const u of users) {
    rows.set(keyFor(u.id, u.email), {
      userId: u.id,
      email: u.email,
      isActive: u.is_active,
      isAdmin: u.is_admin,
      createdAt: u.created_at,
      lastLoginAt: u.last_login_at,
      briefsInRange: 0,
      briefsInProgress: 0,
      briefsSaved: 0,
      briefsSubmitted: 0,
      briefsLifetime: 0,
      aiCalls: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheWriteTokens: 0,
      cacheReadTokens: 0,
      costUsd: 0,
      unpricedEvents: 0,
    });
  }

  /**
   * Rows for activity we cannot tie to a current user — an unattributed event, or a brief
   * whose user row somehow vanished. Surfaced rather than dropped, so totals always add up.
   */
  function orphan(key: string, email: string): UserUsageRow {
    const existing = rows.get(key);
    if (existing) return existing;
    const made: UserUsageRow = {
      userId: null,
      email,
      isActive: false,
      isAdmin: false,
      createdAt: null,
      lastLoginAt: null,
      briefsInRange: 0,
      briefsInProgress: 0,
      briefsSaved: 0,
      briefsSubmitted: 0,
      briefsLifetime: 0,
      aiCalls: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheWriteTokens: 0,
      cacheReadTokens: 0,
      costUsd: 0,
      unpricedEvents: 0,
    };
    rows.set(key, made);
    return made;
  }

  for (const b of briefsAll) {
    const row = rows.get(keyFor(b.user_id, null)) ?? orphan(keyFor(b.user_id, null), `user #${b.user_id}`);
    row.briefsLifetime += 1;
    if (b.created_at >= fromIso && b.created_at <= toIso) {
      row.briefsInRange += 1;
      if (b.status === 'in_progress') row.briefsInProgress += 1;
      else if (b.status === 'saved') row.briefsSaved += 1;
      else if (b.status === 'submitted') row.briefsSubmitted += 1;
    }
  }

  const byRoute = new Map<string, GroupRow>();
  const byModel = new Map<string, GroupRow>();

  for (const e of events) {
    const key = keyFor(e.user_id, e.user_email);
    const row = rows.get(key) ?? orphan(key, e.user_email ?? 'unattributed');

    row.aiCalls += 1;
    row.inputTokens += e.input_tokens ?? 0;
    row.outputTokens += e.output_tokens ?? 0;
    row.cacheWriteTokens += e.cache_write_tokens ?? 0;
    row.cacheReadTokens += e.cache_read_tokens ?? 0;
    if (e.cost_usd == null) row.unpricedEvents += 1;
    else row.costUsd += Number(e.cost_usd);

    const r = byRoute.get(e.route) ?? emptyGroup(e.route);
    addEvent(r, e);
    byRoute.set(e.route, r);

    const m = byModel.get(e.model) ?? emptyGroup(e.model);
    addEvent(m, e);
    byModel.set(e.model, m);
  }

  const all = [...rows.values()];

  return {
    from: fromIso,
    to: toIso,
    // Busiest first, then by briefs, so the interesting rows are at the top.
    users: all.sort((a, b) => b.costUsd - a.costUsd || b.briefsLifetime - a.briefsLifetime || a.email.localeCompare(b.email)),
    byRoute: [...byRoute.values()].sort((a, b) => b.costUsd - a.costUsd),
    byModel: [...byModel.values()].sort((a, b) => b.costUsd - a.costUsd),
    totals: {
      users: users.length,
      activeUsers: users.filter((u) => u.is_active).length,
      usersWithActivity: all.filter((r) => r.aiCalls > 0 || r.briefsLifetime > 0).length,
      briefsInRange: all.reduce((n, r) => n + r.briefsInRange, 0),
      briefsLifetime: all.reduce((n, r) => n + r.briefsLifetime, 0),
      aiCalls: all.reduce((n, r) => n + r.aiCalls, 0),
      inputTokens: all.reduce((n, r) => n + r.inputTokens, 0),
      outputTokens: all.reduce((n, r) => n + r.outputTokens, 0),
      cacheWriteTokens: all.reduce((n, r) => n + r.cacheWriteTokens, 0),
      cacheReadTokens: all.reduce((n, r) => n + r.cacheReadTokens, 0),
      costUsd: all.reduce((n, r) => n + r.costUsd, 0),
      unpricedEvents: all.reduce((n, r) => n + r.unpricedEvents, 0),
    },
    ratesLastVerified: RATES_LAST_VERIFIED,
    ratesVersion: RATES_VERSION,
  };
}
