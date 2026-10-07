'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AgencyToolbar, TOOLBAR_PILL } from '@/components/agency/AgencyToolbar';
import { ArrowLeft, BarChart3, Loader2, AlertTriangle } from 'lucide-react';

/**
 * The usage report UI. Rendered only by app/agency/admin/page.tsx, which has already
 * verified admin rights server-side; this component does no gating of its own.
 *
 * Mirrors the shell and four-state render of app/agency/briefs/page.tsx so the two report
 * pages look like siblings.
 *
 * No chart library is used, and none is installed. A table answers the three questions this
 * page exists for; a dependency added for decoration is a dependency to maintain.
 */

interface UserRow {
  userId: number | null;
  email: string;
  isActive: boolean;
  isAdmin: boolean;
  createdAt: string | null;
  lastLoginAt: string | null;
  briefsInRange: number;
  briefsInProgress: number;
  briefsSaved: number;
  briefsSubmitted: number;
  briefsLifetime: number;
  aiCalls: number;
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  costUsd: number;
  unpricedEvents: number;
}

interface GroupRow {
  key: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  costUsd: number;
  unpricedEvents: number;
}

interface Report {
  from: string;
  to: string;
  users: UserRow[];
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
  ratesLastVerified: string | null;
  ratesVersion: string;
}

const PRESETS: { label: string; days: number | null }[] = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: 'All time', days: null },
];

/** 'All time' needs a floor; the project has no data before this. */
const EPOCH = '2025-01-01';

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  return ymd(new Date(Date.now() - n * 24 * 60 * 60 * 1000));
}

function num(n: number): string {
  return n.toLocaleString();
}

/** Compact token counts — a report full of 7-digit numbers is unreadable. */
function tokens(n: number): string {
  if (n === 0) return '—';
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

function money(n: number): string {
  if (n === 0) return '—';
  // Sub-cent figures are normal here; rounding them to $0.00 would read as free.
  return n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;
}

function when(iso: string | null): string {
  if (!iso) return 'never';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function UsageReportView() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(ymd(new Date()));

  const load = useCallback(async (fromDate: string, toDate: string) => {
    setLoading(true);
    setError(null);
    try {
      // `to` is inclusive of the whole day, so push it to the end of that date.
      const res = await fetch(`/api/admin/usage?from=${fromDate}&to=${toDate}T23:59:59.999Z`);
      if (res.status === 403) throw new Error('You do not have access to this report.');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || body.error || `Failed to load the report (${res.status})`);
      }
      const data = await res.json();
      setConfigured(data.configured !== false);
      setReport(data.report ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(from, to);
    // Intentionally only on mount — later loads are driven by the preset buttons and Apply.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyPreset = (days: number | null) => {
    const nextFrom = days === null ? EPOCH : daysAgo(days);
    const nextTo = ymd(new Date());
    setFrom(nextFrom);
    setTo(nextTo);
    void load(nextFrom, nextTo);
  };

  const t = report?.totals;

  return (
    <main className="relative flex min-h-screen flex-col items-center p-4 md:p-8 lg:p-12" style={{ backgroundColor: '#d9d8d8' }}>
      <div className="flex flex-wrap items-center justify-center gap-3 md:gap-6 mb-6 md:mb-8 z-10">
        <Image src="/impact-bbdo-logo.png" alt="IMPACT BBDO" width={315} height={131} priority className="h-[34px] md:h-[52px] w-auto" />
        <div className="flex items-center gap-2 md:gap-3">
          <div className="h-8 md:h-10 w-px bg-slate-400"></div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <p className="text-xs md:text-sm text-slate-700 font-bold tracking-wide">Powered by</p>
            <Image src="/impact-logo.svg" alt="ImpactProximity Logo" width={100} height={24} priority className="drop-shadow-sm w-[70px] md:w-[100px] h-auto" />
          </div>
        </div>
      </div>

      <Card className="w-full max-w-7xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] border-2 md:border-3 border-slate-300 overflow-hidden rounded-2xl md:rounded-3xl">
        <div className="text-center border-b-2 md:border-b-3 border-slate-300 bg-white pb-4 md:pb-6 pt-6 md:pt-8 px-4 relative">
          {/* No "Usage" — this IS that page. */}
          <AgencyToolbar
            showUsage={false}
            left={
              <Link href="/agency" title="Back" className={TOOLBAR_PILL}>
                <ArrowLeft className="h-3.5 w-3.5 md:h-4 md:w-4" />
                <span className="hidden sm:inline">Back</span>
              </Link>
            }
          />
          <h1 className="text-2xl md:text-4xl font-bold text-slate-800 mb-2 md:mb-3">Platform usage</h1>
          <p className="text-sm md:text-lg text-slate-600 max-w-2xl mx-auto font-medium">
            Who is using the Brief Creator, how many briefs they have created, and what the AI spend is.
          </p>
        </div>

        <CardContent className="p-4 md:p-8 bg-white">
          {/* Range picker */}
          <div className="flex flex-wrap items-end gap-2 md:gap-3 mb-5 pb-5 border-b-2 border-slate-200">
            <div className="flex gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => applyPreset(p.days)}
                  className="rounded-full border-2 border-slate-300 hover:border-slate-500 hover:bg-slate-100 text-xs font-medium text-slate-700 px-3 py-1.5 transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-end gap-2 ml-auto">
              <label className="text-xs font-bold text-slate-600">
                From
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="block mt-1 rounded-lg border-2 border-slate-300 px-2 py-1 text-xs text-slate-800"
                />
              </label>
              <label className="text-xs font-bold text-slate-600">
                To
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="block mt-1 rounded-lg border-2 border-slate-300 px-2 py-1 text-xs text-slate-800"
                />
              </label>
              <Button onClick={() => void load(from, to)} size="sm" className="rounded-lg font-bold text-xs">
                Apply
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="font-medium">Building the report…</span>
            </div>
          ) : !configured ? (
            <div className="py-12 text-center">
              <BarChart3 className="h-10 w-10 mx-auto text-slate-300 mb-3" />
              <p className="font-bold text-slate-700 mb-1">Reporting isn&rsquo;t switched on yet</p>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Storage hasn&rsquo;t been configured for this environment, so nothing is being recorded.
              </p>
            </div>
          ) : error ? (
            <div className="py-12 text-center">
              <p className="font-bold text-red-700 mb-1">Couldn&rsquo;t load the report</p>
              <p className="text-sm text-slate-500">{error}</p>
            </div>
          ) : !report || !t ? (
            <div className="py-12 text-center text-slate-500">No data.</div>
          ) : (
            <div className="space-y-6">
              {/* Rates warning. Shown until a human has checked lib/usage/rates.ts. */}
              {report.ratesLastVerified === null && (
                <div className="flex gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-3 md:p-4">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                  <div className="text-xs md:text-sm">
                    <p className="font-bold text-amber-900 mb-0.5">Cost figures are unverified estimates</p>
                    <p className="text-amber-800">
                      The rates in <code className="font-mono">lib/usage/rates.ts</code> have not been checked against
                      Anthropic&rsquo;s and OpenAI&rsquo;s pricing pages. Token counts below are measured and accurate;
                      the dollar figures are derived from those unverified rates. Verify them, then set
                      <code className="font-mono"> RATES_LAST_VERIFIED</code> to remove this notice.
                    </p>
                  </div>
                </div>
              )}

              {/* Totals */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Stat label="Users with access" value={num(t.activeUsers)} sub={`${num(t.users)} total`} />
                <Stat label="Have used it" value={num(t.usersWithActivity)} sub="ever" />
                <Stat label="Briefs in range" value={num(t.briefsInRange)} sub={`${num(t.briefsLifetime)} all time`} />
                <Stat label="AI calls" value={num(t.aiCalls)} sub="in range" />
                <Stat
                  label="Est. AI spend"
                  value={money(t.costUsd)}
                  sub={t.unpricedEvents > 0 ? `${num(t.unpricedEvents)} unpriced` : 'in range'}
                  warn={t.unpricedEvents > 0}
                />
              </div>

              {t.aiCalls === 0 && (
                <p className="text-xs md:text-sm text-slate-500 bg-slate-50 border-2 border-slate-200 rounded-xl p-3">
                  No AI usage recorded in this range. Usage tracking only began when this feature was deployed —
                  it cannot be backfilled, so earlier activity does not appear. Brief counts are complete and historical.
                </p>
              )}

              {/* Per user */}
              <Section title="By user">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs md:text-sm border-collapse">
                    <thead>
                      <tr className="text-left text-slate-600 border-b-2 border-slate-300">
                        <Th>User</Th>
                        <Th>Last login</Th>
                        <Th right>Briefs</Th>
                        <Th right>In prog.</Th>
                        <Th right>Saved</Th>
                        <Th right>Subm.</Th>
                        <Th right>Calls</Th>
                        <Th right>In</Th>
                        <Th right>Out</Th>
                        <Th right title="Tokens written to the prompt cache — billed at a premium">Cache w</Th>
                        <Th right title="Tokens read from the prompt cache — billed at a discount">Cache r</Th>
                        <Th right>Est. cost</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.users.map((u) => (
                        <tr key={u.userId ?? u.email} className="border-b border-slate-200 hover:bg-slate-50">
                          <td className="py-2 pr-3">
                            <span className={u.isActive ? 'font-medium text-slate-800' : 'text-slate-400'}>{u.email}</span>
                            {u.isAdmin && (
                              <span className="ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold bg-slate-200 text-slate-700">
                                ADMIN
                              </span>
                            )}
                            {!u.isActive && (
                              <span className="ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-500">
                                INACTIVE
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-slate-600 whitespace-nowrap">{when(u.lastLoginAt)}</td>
                          <Td>{u.briefsLifetime || '—'}</Td>
                          <Td>{u.briefsInProgress || '—'}</Td>
                          <Td>{u.briefsSaved || '—'}</Td>
                          <Td>{u.briefsSubmitted || '—'}</Td>
                          <Td>{u.aiCalls || '—'}</Td>
                          <Td>{tokens(u.inputTokens)}</Td>
                          <Td>{tokens(u.outputTokens)}</Td>
                          <Td>{tokens(u.cacheWriteTokens)}</Td>
                          <Td>{tokens(u.cacheReadTokens)}</Td>
                          <Td bold>
                            {money(u.costUsd)}
                            {u.unpricedEvents > 0 && <span className="text-amber-600" title="Some events could not be priced"> *</span>}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                  Briefs is the all-time count; the status columns count only briefs created inside the selected range.
                </p>
              </Section>

              {/* By route */}
              {report.byRoute.length > 0 && (
                <Section title="By route">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs md:text-sm border-collapse">
                      <thead>
                        <tr className="text-left text-slate-600 border-b-2 border-slate-300">
                          <Th>Route</Th>
                          <Th right>Calls</Th>
                          <Th right>In</Th>
                          <Th right>Out</Th>
                          <Th right>Cache w</Th>
                          <Th right>Cache r</Th>
                          <Th right>Est. cost</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.byRoute.map((r) => (
                          <tr key={r.key} className="border-b border-slate-200 hover:bg-slate-50">
                            <td className="py-2 pr-3 font-mono text-slate-700">{r.key}</td>
                            <Td>{num(r.calls)}</Td>
                            <Td>{tokens(r.inputTokens)}</Td>
                            <Td>{tokens(r.outputTokens)}</Td>
                            <Td>{tokens(r.cacheWriteTokens)}</Td>
                            <Td>{tokens(r.cacheReadTokens)}</Td>
                            <Td bold>{money(r.costUsd)}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">
                    Cache writes and reads are shown separately because they are priced differently. Prefill mostly
                    writes to the cache and rarely reads it back within the 5-minute window, so its cache column is a
                    surcharge; question chat is where reads accumulate and the cache pays for itself.
                    <br />
                    <span className="text-slate-400">
                      Transcription is counted but not costed — whisper bills per minute of audio and the API returns no
                      duration, so its spend is missing from the totals above.
                    </span>
                  </p>
                </Section>
              )}

              {/* By model */}
              {report.byModel.length > 0 && (
                <Section title="By model">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs md:text-sm border-collapse">
                      <thead>
                        <tr className="text-left text-slate-600 border-b-2 border-slate-300">
                          <Th>Model</Th>
                          <Th right>Calls</Th>
                          <Th right>Est. cost</Th>
                          <Th right>Unpriced</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.byModel.map((m) => (
                          <tr key={m.key} className="border-b border-slate-200 hover:bg-slate-50">
                            <td className="py-2 pr-3 font-mono text-slate-700">{m.key}</td>
                            <Td>{num(m.calls)}</Td>
                            <Td bold>{money(m.costUsd)}</Td>
                            <Td>
                              {m.unpricedEvents > 0 ? (
                                <span className="text-amber-700 font-bold" title="No rate for this model in lib/usage/rates.ts">
                                  {num(m.unpricedEvents)}
                                </span>
                              ) : (
                                '—'
                              )}
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Section>
              )}

              <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-200">
                Rates version <code className="font-mono">{report.ratesVersion}</code>
                {report.ratesLastVerified ? ` · verified ${report.ratesLastVerified}` : ' · never verified'}.
                Costs are estimates from a hand-maintained rate table and will not reconcile exactly with a provider
                invoice. Infrastructure (Supabase, Vercel) is excluded.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function Stat({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className={`rounded-xl border-2 p-3 ${warn ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-lg md:text-2xl font-bold text-slate-800 leading-tight mt-0.5">{value}</p>
      {sub && <p className="text-[11px] text-slate-500">{sub}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm md:text-base font-bold text-slate-800 mb-2">{title}</h2>
      {children}
    </div>
  );
}

function Th({ children, right, title }: { children: React.ReactNode; right?: boolean; title?: string }) {
  return (
    <th title={title} className={`py-2 pr-3 font-bold whitespace-nowrap ${right ? 'text-right' : ''}`}>
      {children}
    </th>
  );
}

function Td({ children, bold }: { children: React.ReactNode; bold?: boolean }) {
  return <td className={`py-2 pr-3 text-right whitespace-nowrap ${bold ? 'font-bold text-slate-800' : 'text-slate-600'}`}>{children}</td>;
}
