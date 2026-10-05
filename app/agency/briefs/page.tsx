'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogoutButton } from '@/components/LogoutButton';
import { ArrowLeft, ArrowRight, FileText, Trash2, Loader2, KeyRound } from 'lucide-react';
import { getAgencyBriefConfig } from '@/lib/questions/agency';
import { getClientConfig } from '@/lib/clients';
import type { BriefStatus } from '@/lib/briefs/store';

interface BriefSummary {
  id: string;
  client_id: string;
  tier: string;
  title: string;
  status: BriefStatus;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
}

const STATUS_STYLES: Record<BriefStatus, { label: string; className: string }> = {
  in_progress: { label: 'In Progress', className: 'bg-amber-100 text-amber-800 border-amber-300' },
  saved: { label: 'Saved', className: 'bg-blue-100 text-blue-800 border-blue-300' },
  submitted: { label: 'Submitted', className: 'bg-green-100 text-green-800 border-green-300' },
};

function formatWhen(iso: string): string {
  const then = new Date(iso).getTime();
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString();
}

export default function BriefHistoryPage() {
  const [briefs, setBriefs] = useState<BriefSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/briefs');
        if (!res.ok) throw new Error(`Failed to load history (${res.status})`);
        const data = await res.json();
        if (cancelled) return;
        setBriefs(data.briefs ?? []);
        setConfigured(data.configured !== false);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load history');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/briefs/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      setBriefs((prev) => prev.filter((b) => b.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete brief');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <main
      className="relative flex min-h-screen flex-col items-center justify-start p-4 md:p-8 lg:p-16"
      style={{ backgroundColor: '#d9d8d8' }}
    >
      <div className="absolute right-3 top-3 md:right-6 md:top-6 z-20 flex items-center gap-2">
        <Link
          href="/change-password"
          className="inline-flex items-center gap-1.5 rounded-full border-2 border-slate-300 hover:border-slate-500 hover:bg-slate-100 text-xs md:text-sm font-medium text-slate-700 px-3 py-1.5 transition-colors"
        >
          <KeyRound className="h-3.5 w-3.5" />
          Change password
        </Link>
        <LogoutButton />
      </div>

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

      <Card className="w-full max-w-5xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] border-2 md:border-3 border-slate-300 overflow-hidden rounded-2xl md:rounded-3xl">
        <div className="text-center border-b-2 md:border-b-3 border-slate-300 bg-white pb-4 md:pb-6 pt-6 md:pt-8 px-4 relative">
          <Link href="/agency">
            <Button
              variant="ghost"
              size="sm"
              className="absolute left-3 md:left-5 top-3 md:top-5 rounded-full border-2 border-slate-300 hover:border-slate-500 hover:bg-slate-100 text-xs md:text-sm"
            >
              <ArrowLeft className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1" />
              Back
            </Button>
          </Link>
          <h1 className="text-2xl md:text-4xl font-bold text-slate-800 mb-2 md:mb-3">Your briefs</h1>
          <p className="text-sm md:text-lg text-slate-600 max-w-2xl mx-auto font-medium">
            Everything you&rsquo;ve started, saved or submitted. Pick one up where you left off.
          </p>
        </div>

        <CardContent className="p-4 md:p-10 bg-white">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="font-medium">Loading your briefs…</span>
            </div>
          ) : !configured ? (
            <div className="py-12 text-center">
              <FileText className="h-10 w-10 mx-auto text-slate-300 mb-3" />
              <p className="font-bold text-slate-700 mb-1">Brief history isn&rsquo;t switched on yet</p>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Storage hasn&rsquo;t been configured for this environment, so briefs aren&rsquo;t being kept. Everything
                else works as normal.
              </p>
            </div>
          ) : error ? (
            <div className="py-12 text-center">
              <p className="font-bold text-red-700 mb-1">Couldn&rsquo;t load your briefs</p>
              <p className="text-sm text-slate-500">{error}</p>
            </div>
          ) : briefs.length === 0 ? (
            <div className="py-12 text-center">
              <FileText className="h-10 w-10 mx-auto text-slate-300 mb-3" />
              <p className="font-bold text-slate-700 mb-1">No briefs yet</p>
              <p className="text-sm text-slate-500 mb-5">Start one and it&rsquo;ll be saved here automatically.</p>
              <Link href="/agency">
                <Button className="rounded-xl font-bold">
                  Start a brief
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {briefs.map((b) => {
                const client = getClientConfig(b.client_id);
                const tierConfig = getAgencyBriefConfig(b.tier);
                const badge = STATUS_STYLES[b.status] ?? STATUS_STYLES.in_progress;
                return (
                  <div
                    key={b.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${badge.className}`}>
                          {badge.label}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                          {client?.label ?? b.client_id} · {tierConfig?.type.label ?? b.tier}
                        </span>
                      </div>
                      <p className="font-bold text-slate-800 truncate">{b.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Updated {formatWhen(b.updated_at)}
                        {b.submitted_at ? ` · submitted ${formatWhen(b.submitted_at)}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Link href={`/agency/brief/${b.tier}?client=${b.client_id}&brief=${b.id}`}>
                        <Button size="sm" className="rounded-xl font-bold">
                          {b.status === 'submitted' ? 'Open' : 'Resume'}
                          <ArrowRight className="h-3.5 w-3.5 ml-1" />
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(b.id)}
                        disabled={deletingId === b.id}
                        aria-label={`Delete ${b.title}`}
                        className="rounded-xl border-2 border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-300 hover:bg-red-50"
                      >
                        {deletingId === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
