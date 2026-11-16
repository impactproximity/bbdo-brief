'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AgencyToolbar, TOOLBAR_PILL } from '@/components/agency/AgencyToolbar';
import { ArrowLeft, Activity, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';

/**
 * The Pulse brand-sync dashboard.
 *
 * Does NO gating of its own — /agency/admin/pulse redirects a non-admin before this renders,
 * and every route it calls re-checks requireAdmin(). Same split as UsageReportView.
 *
 * The four-state render (loading / not configured / error / empty) is the house convention
 * from UsageReportView and the brief-history page. The not-configured state is not a corner
 * case here: Pulse's partner endpoints have to be deployed and PULSE_PARTNER_TOKEN set before
 * this page can show anything, so it is the state the feature ships in.
 */

type OnboardStatus = 'not_onboarded' | 'onboarded' | 'stale' | 'deactivated' | 'onboarded_static';

interface SuggestedCard {
  id: string;
  label: string;
  description: string;
  icon: string;
  color: string;
}

interface BrandRow {
  pulseBrandId: string;
  name: string;
  clientName: string;
  industries: string[];
  regions: string[];
  hasLogo: boolean;
  guidelineVersion: number | null;
  guidelineCreatedAt: string | null;
  status: OnboardStatus;
  clientId: string | null;
  syncedGuidelineVersion: number | null;
  syncedAt: string | null;
  syncedByEmail: string | null;
  propositionSource: 'pulse' | 'local' | null;
  hasSyncedLogo: boolean;
  hasLocalNotes: boolean;
  documentCount: number;
  includedDocumentCount: number;
  suggested: SuggestedCard;
}

interface Vocabulary {
  icons: string[];
  colors: string[];
  briefTypes: { id: string; label: string }[];
}

interface PreviewPayload {
  brand: { id: string; name: string; clientName: string; industries: string[]; regions: string[] };
  composed: { proposition: string; brandGuidelines: string; promptGuidance: string };
  guideline: { version: number; createdAt: string } | null;
  sections: {
    guideline: boolean;
    competitors: number;
    conversationThemes: number;
    opportunityThemes: number;
    trackingTerms: number;
  };
  suggested: SuggestedCard;
  suggestedIdTaken: boolean;
  existing: {
    id: string;
    label: string;
    description: string;
    icon: string;
    color: string;
    aliases: string[] | null;
    briefTypes: string[] | null;
    proposition: string;
    propositionSource: 'pulse' | 'local';
    guidelineVersion: number | null;
    isActive: boolean;
    syncedAt: string;
  } | null;
  staticClientId: string | null;
}

const STATUS_STYLES: Record<OnboardStatus, { label: string; className: string; hint: string }> = {
  not_onboarded: {
    label: 'Not onboarded',
    className: 'bg-slate-100 text-slate-700 border-slate-300',
    hint: 'Live on Pulse, not briefable here yet. Pulse shows no Create Brief button for it.',
  },
  onboarded: {
    label: 'Onboarded',
    className: 'bg-green-100 text-green-800 border-green-300',
    hint: 'Briefable here, and in step with Pulse\'s current guideline version.',
  },
  stale: {
    label: 'Guidelines changed',
    className: 'bg-amber-100 text-amber-800 border-amber-300',
    hint: 'Pulse has a newer guideline version than the one we pulled. Refresh to take it.',
  },
  deactivated: {
    label: 'Deactivated',
    className: 'bg-red-100 text-red-800 border-red-300',
    hint: 'Onboarded, then hidden here. Existing briefs keep their history.',
  },
  onboarded_static: {
    label: 'Hand-authored',
    className: 'bg-blue-100 text-blue-800 border-blue-300',
    hint: 'Already a compile-time client in lib/clients. Not onboardable — it would appear twice.',
  },
};

function when(iso: string | null): string {
  if (!iso) return '—';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function chars(n: number): string {
  return n === 0 ? 'empty' : n < 1000 ? `${n} chars` : `${(n / 1000).toFixed(1)}k chars`;
}

const SELECT_CLASS =
  'h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-800 ' +
  'focus:outline-none focus:ring-2 focus:ring-slate-400';

export function PulseBrandsView() {
  const [brands, setBrands] = useState<BrandRow[] | null>(null);
  const [vocabulary, setVocabulary] = useState<Vocabulary | null>(null);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [missing, setMissing] = useState<{ pulseApi: boolean; syncedStore: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Which brand has an action in flight, so only its own button spins.
  const [busyBrandId, setBusyBrandId] = useState<string | null>(null);

  const [dialogBrand, setDialogBrand] = useState<BrandRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/pulse-brands');
      if (res.status === 403) throw new Error('You do not have access to this page.');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || body.error || `Failed to load Pulse brands (${res.status})`);
      }
      const data = await res.json();
      setConfigured(data.configured !== false);
      setMissing(data.missing ?? null);
      setBrands(data.brands ?? []);
      setVocabulary(data.vocabulary ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setActive = async (brand: BrandRow, isActive: boolean) => {
    setBusyBrandId(brand.pulseBrandId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/pulse-brands/${brand.pulseBrandId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || body.error || `Failed (${res.status})`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyBrandId(null);
    }
  };

  const counts = brands
    ? {
        total: brands.length,
        onboardable: brands.filter((b) => b.status === 'not_onboarded').length,
        stale: brands.filter((b) => b.status === 'stale').length,
      }
    : null;

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
          {/* No "Pulse brands" pill — this IS that page. */}
          <AgencyToolbar
            showPulse={false}
            left={
              <Link href="/agency" title="Back" className={TOOLBAR_PILL}>
                <ArrowLeft className="h-3.5 w-3.5 md:h-4 md:w-4" />
                <span className="hidden sm:inline">Back</span>
              </Link>
            }
          />
          <h1 className="text-2xl md:text-4xl font-bold text-slate-800 mb-2 md:mb-3">Pulse brands</h1>
          <p className="text-sm md:text-lg text-slate-600 max-w-2xl mx-auto font-medium">
            Every brand live on Impact BBDO Pulse. Onboard one and it becomes briefable here —
            and gets its Create Brief button on Pulse — without a deploy.
          </p>
        </div>

        <CardContent className="p-4 md:p-8 bg-white">
          {loading ? (
            <div className="py-12 flex flex-col items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              <p className="text-sm text-slate-500">Reading Pulse&rsquo;s brand roster&hellip;</p>
            </div>
          ) : !configured ? (
            <div className="py-10 text-center max-w-xl mx-auto">
              <Activity className="h-10 w-10 mx-auto text-slate-300 mb-3" />
              <p className="font-bold text-slate-700 mb-1">Brand sync isn&rsquo;t switched on yet</p>
              <p className="text-sm text-slate-500">
                {missing?.pulseApi
                  ? 'Set PULSE_API_BASE_URL and PULSE_PARTNER_TOKEN, and make sure Pulse has deployed its /api/partner routes.'
                  : null}
                {missing?.pulseApi && missing?.syncedStore ? ' ' : null}
                {missing?.syncedStore
                  ? 'The synced-client store is unavailable — check the Supabase connection and that migration 0007 has been applied.'
                  : null}
              </p>
            </div>
          ) : error ? (
            <div className="py-10 text-center">
              <p className="font-bold text-red-700 mb-1">Could not load Pulse brands</p>
              <p className="text-sm text-slate-500 max-w-xl mx-auto">{error}</p>
              <Button onClick={() => void load()} className="mt-4 rounded-xl font-bold">
                Try again
              </Button>
            </div>
          ) : !brands || brands.length === 0 ? (
            <div className="py-10 text-center">
              <p className="font-bold text-slate-700 mb-1">No brands on Pulse</p>
              <p className="text-sm text-slate-500">Pulse returned an empty roster.</p>
            </div>
          ) : (
            <>
              {/* An error from an action, shown without discarding the table. */}
              {error && (
                <div className="mb-4 rounded-xl border-2 border-red-300 bg-red-50 p-3 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-700 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <p className="text-xs md:text-sm text-slate-600">
                  <span className="font-bold text-slate-800">{counts?.total}</span> live on Pulse ·{' '}
                  <span className="font-bold text-slate-800">{counts?.onboardable}</span> not onboarded ·{' '}
                  <span className="font-bold text-slate-800">{counts?.stale}</span> with changed guidelines
                </p>
                <Button variant="outline" onClick={() => void load()} className="rounded-xl font-bold" size="sm">
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Reload
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs md:text-sm border-collapse">
                  <thead className="text-left text-slate-500 border-b-2 border-slate-200">
                    <tr>
                      <Th>Brand</Th>
                      <Th>Agency client</Th>
                      <Th>Category</Th>
                      <Th>Markets</Th>
                      <Th title="Pulse's current guideline version, and the one we hold">Guideline</Th>
                      <Th>Logo</Th>
                      <Th>Status</Th>
                      <Th>Our id</Th>
                      <Th title="Context we added locally. None of it is overwritten by a Refresh.">Ours</Th>
                      <Th right>Action</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {brands.map((b) => {
                      const badge = STATUS_STYLES[b.status];
                      const busy = busyBrandId === b.pulseBrandId;
                      return (
                        <tr key={b.pulseBrandId} className="border-b border-slate-200 hover:bg-slate-50">
                          <td className="py-2 pr-3 font-bold text-slate-800">{b.name}</td>
                          <td className="py-2 pr-3 text-slate-600">{b.clientName}</td>
                          <td className="py-2 pr-3 text-slate-600">{b.industries.join(', ') || '—'}</td>
                          <td className="py-2 pr-3 text-slate-600">{b.regions.join(', ') || '—'}</td>
                          <td className="py-2 pr-3 text-slate-600 whitespace-nowrap">
                            {b.guidelineVersion === null ? (
                              <span className="text-slate-400" title="Pulse has no guideline authored for this brand">
                                none
                              </span>
                            ) : (
                              <>
                                v{b.guidelineVersion}
                                {b.syncedGuidelineVersion !== null && b.syncedGuidelineVersion !== b.guidelineVersion && (
                                  <span className="text-amber-700 font-bold" title="The version we hold">
                                    {' '}
                                    (we have v{b.syncedGuidelineVersion})
                                  </span>
                                )}
                              </>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-slate-600">
                            {b.hasLogo ? (b.hasSyncedLogo || b.status === 'not_onboarded' ? 'yes' : 'not pulled') : 'none'}
                          </td>
                          <td className="py-2 pr-3">
                            <span
                              title={
                                b.syncedAt
                                  ? `${badge.hint} Last pulled ${when(b.syncedAt)}${b.syncedByEmail ? ` by ${b.syncedByEmail}` : ''}.`
                                  : badge.hint
                              }
                              className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border whitespace-nowrap ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-slate-600 font-mono text-[11px]">
                            {b.clientId ?? '—'}
                          </td>
                          <td className="py-2 pr-3 text-slate-600 text-[11px] whitespace-nowrap">
                            <LocalMaterial brand={b} />
                          </td>
                          <td className="py-2 pr-0 text-right whitespace-nowrap">
                            <RowActions
                              brand={b}
                              busy={busy}
                              onOpenDialog={() => setDialogBrand(b)}
                              onSetActive={(isActive) => void setActive(b, isActive)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <p className="mt-5 pt-4 border-t-2 border-slate-200 text-[11px] text-slate-500 leading-relaxed">
                Onboarding pulls the brand&rsquo;s guidelines, competitive set, conversation and
                opportunity themes and tracked vocabulary from Pulse, and makes them the brand
                context injected into every brief for that client. Deliberately manual: nothing is
                pushed and nothing polls, so an admin decides when a brand is ready and decides
                again when its guidelines have changed. The &ldquo;Ours&rdquo; column lists what we
                hold beyond the pull &mdash; a locally authored proposition, typed additions, and
                uploaded documents shown as in-the-prompt over uploaded. None of it is overwritten
                by a Refresh.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {dialogBrand && vocabulary && (
        <OnboardDialog
          brand={dialogBrand}
          vocabulary={vocabulary}
          onClose={() => setDialogBrand(null)}
          onDone={() => {
            setDialogBrand(null);
            void load();
          }}
        />
      )}
    </main>
  );
}

function RowActions({
  brand,
  busy,
  onOpenDialog,
  onSetActive,
}: {
  brand: BrandRow;
  busy: boolean;
  onOpenDialog: () => void;
  onSetActive: (isActive: boolean) => void;
}) {
  if (busy) return <Loader2 className="h-4 w-4 animate-spin text-slate-400 inline" />;

  switch (brand.status) {
    case 'onboarded_static':
      return <span className="text-[11px] text-slate-400">in code</span>;

    case 'not_onboarded':
      return (
        <Button size="sm" className="rounded-xl font-bold" onClick={onOpenDialog}>
          Onboard
        </Button>
      );

    case 'deactivated':
      return (
        <Button size="sm" variant="outline" className="rounded-xl font-bold" onClick={() => onSetActive(true)}>
          Re-activate
        </Button>
      );

    case 'stale':
    case 'onboarded':
    default:
      return (
        <div className="inline-flex items-center gap-1.5">
          <Button
            size="sm"
            variant={brand.status === 'stale' ? 'default' : 'outline'}
            className="rounded-xl font-bold"
            onClick={onOpenDialog}
          >
            {brand.status === 'stale' ? 'Refresh' : 'Re-pull'}
          </Button>
          <Button size="sm" variant="ghost" className="rounded-xl text-slate-500" onClick={() => onSetActive(false)}>
            Hide
          </Button>
        </div>
      );
  }
}

/**
 * What we hold for this brand beyond the pull.
 *
 * Shows uploaded AND included document counts separately, because the gap is the thing worth
 * seeing: "2 docs, 0 used" means somebody uploaded and never came back to review them, and
 * that state is indistinguishable from having no documents at all if only one number is shown.
 */
function LocalMaterial({ brand }: { brand: BrandRow }) {
  if (!brand.clientId) return <span className="text-slate-300">&mdash;</span>;

  const bits: React.ReactNode[] = [];
  if (brand.propositionSource === 'local') {
    bits.push(
      <span key="prop" title="Its proposition is locally authored; a Refresh will not overwrite it">
        proposition
      </span>,
    );
  }
  if (brand.hasLocalNotes) {
    bits.push(
      <span key="notes" title="Admin-typed additions, appended to Pulse's text">
        notes
      </span>,
    );
  }
  if (brand.documentCount > 0) {
    const unreviewed = brand.documentCount - brand.includedDocumentCount;
    bits.push(
      <span
        key="docs"
        className={unreviewed > 0 ? 'text-amber-700 font-medium' : undefined}
        title={
          unreviewed > 0
            ? `${unreviewed} uploaded document(s) have not been reviewed, so they are not in the prompt`
            : 'every uploaded document is in the prompt'
        }
      >
        {brand.includedDocumentCount}/{brand.documentCount} docs
      </span>,
    );
  }

  if (bits.length === 0) return <span className="text-slate-300">&mdash;</span>;
  return (
    <span className="inline-flex flex-wrap gap-x-1.5">
      {bits.map((bit, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-slate-300">&middot;</span>}
          {bit}
        </React.Fragment>
      ))}
    </span>
  );
}

/**
 * Onboard or refresh one brand.
 *
 * Shows the composed brand context BEFORE it is stored. That is the point of the preview
 * step: this text becomes the always-on brand context for every brief that client ever
 * raises, and reading it here is the only chance to notice that a guideline is a stub or that
 * a section came back empty — the alternative is finding out from a brief days later.
 */
function OnboardDialog({
  brand,
  vocabulary,
  onClose,
  onDone,
}: {
  brand: BrandRow;
  vocabulary: Vocabulary;
  onClose: () => void;
  onDone: () => void;
}) {
  const isRefresh = brand.status !== 'not_onboarded';

  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state, filled from the preview once it arrives.
  const [id, setId] = useState('');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('Building2');
  const [color, setColor] = useState('purple');
  const [aliases, setAliases] = useState('');
  const [tierIds, setTierIds] = useState<string[]>([]);
  const [propositionSource, setPropositionSource] = useState<'pulse' | 'local'>('pulse');
  const [localProposition, setLocalProposition] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/pulse-brands/${brand.pulseBrandId}/preview`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail || body.error || `Preview failed (${res.status})`);
        }
        const data = (await res.json()) as PreviewPayload;
        if (cancelled) return;
        setPreview(data);

        const existing = data.existing;
        setId(existing?.id ?? data.suggested.id);
        setLabel(existing?.label ?? data.suggested.label);
        setDescription(existing?.description ?? data.suggested.description);
        setIcon(existing?.icon ?? data.suggested.icon);
        setColor(existing?.color ?? data.suggested.color);
        setAliases((existing?.aliases ?? []).join(', '));
        // All tiers checked represents "no allow-list", which is what null means. An existing
        // explicit list is shown as exactly that list.
        setTierIds(existing?.briefTypes ?? vocabulary.briefTypes.map((t) => t.id));
        setPropositionSource(existing?.propositionSource ?? 'pulse');
        setLocalProposition(
          existing?.propositionSource === 'local' ? existing.proposition : data.composed.proposition,
        );
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [brand.pulseBrandId, vocabulary.briefTypes]);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const allTiersChecked = tierIds.length === vocabulary.briefTypes.length;
      const res = await fetch(`/api/admin/pulse-brands/${brand.pulseBrandId}/onboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: isRefresh ? 'refresh' : 'onboard',
          id,
          label,
          description,
          icon,
          color,
          aliases: aliases
            .split(',')
            .map((a) => a.trim())
            .filter(Boolean),
          // null, not the full list: it means "the default tiers", so the client keeps
          // tracking that default if it ever changes rather than freezing today's four.
          briefTypes: allTiersChecked ? null : tierIds,
          propositionSource,
          proposition: propositionSource === 'local' ? localProposition : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || body.error || `Failed (${res.status})`);
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const blocked = Boolean(preview?.staticClientId);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {isRefresh ? `Refresh ${brand.name}` : `Onboard ${brand.name}`}
          </DialogTitle>
          <DialogDescription>
            {isRefresh
              ? 'Re-pulls brand context from Pulse. Card fields below are ours and are never overwritten by a pull.'
              : 'Pulls brand context from Pulse and makes this brand briefable here and on Pulse.'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-10 flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            <p className="text-sm text-slate-500">Pulling this brand&rsquo;s context from Pulse&hellip;</p>
          </div>
        ) : error && !preview ? (
          <div className="py-8 text-center">
            <p className="font-bold text-red-700 mb-1">Could not read this brand</p>
            <p className="text-sm text-slate-500">{error}</p>
          </div>
        ) : preview ? (
          <div className="space-y-5">
            {blocked && (
              <div className="rounded-xl border-2 border-blue-300 bg-blue-50 p-3 text-sm text-blue-900">
                <span className="font-bold">Already a hand-authored client</span> (
                <code className="font-mono">{preview.staticClientId}</code>). Onboarding it again would
                put the same brand on the picker twice, with two different sets of brand context.
              </div>
            )}

            {/* What the pull actually found. A zero here is information, not a failure. */}
            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-2">What Pulse returned</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <Fact
                  label="Guideline"
                  value={preview.guideline ? `v${preview.guideline.version}` : 'none'}
                  warn={!preview.guideline}
                />
                <Fact label="Competitors" value={String(preview.sections.competitors)} />
                <Fact label="Conversation themes" value={String(preview.sections.conversationThemes)} />
                <Fact label="Opportunity themes" value={String(preview.sections.opportunityThemes)} />
                <Fact label="Tracked terms" value={String(preview.sections.trackingTerms)} />
                <Fact label="Logo" value={brand.hasLogo ? 'yes' : 'none'} />
              </div>
              {!preview.guideline && (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-800">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  This brand has no guideline on Pulse, so it will onboard with little or no brand
                  context. That is a real state upstream, not an error — but a brief for it will be
                  no better tailored than one with no client selected.
                </p>
              )}
            </div>

            {/* The text that becomes the prompt. */}
            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-2">
                Brand context that will be stored{' '}
                <span className="font-normal text-slate-500">
                  ({chars(preview.composed.brandGuidelines.length)} +{' '}
                  {chars(preview.composed.promptGuidance.length)})
                </span>
              </h3>
              <ComposedBlock title="Brand guidelines" body={preview.composed.brandGuidelines} />
              <ComposedBlock title="Prompt guidance" body={preview.composed.promptGuidance} />
            </div>

            {/* Proposition — the one field with two possible owners. */}
            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-2">Proposition</h3>
              <div className="flex flex-wrap gap-3 mb-2 text-xs">
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="radio"
                    checked={propositionSource === 'pulse'}
                    onChange={() => setPropositionSource('pulse')}
                  />
                  Use Pulse&rsquo;s {preview.composed.proposition ? '' : '(empty)'}
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="radio"
                    checked={propositionSource === 'local'}
                    onChange={() => setPropositionSource('local')}
                  />
                  Write our own (survives every refresh)
                </label>
              </div>
              {propositionSource === 'pulse' ? (
                <pre className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-[11px] text-slate-700 whitespace-pre-wrap max-h-32 overflow-y-auto">
                  {preview.composed.proposition || '(Pulse has no proposition for this brand)'}
                </pre>
              ) : (
                <Textarea
                  value={localProposition}
                  onChange={(e) => setLocalProposition(e.target.value)}
                  rows={4}
                  placeholder="The brand's positioning, in a few sentences."
                />
              )}
            </div>

            {/* Card fields — ours, never overwritten by a pull. */}
            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-2">
                How it appears here{' '}
                <span className="font-normal text-slate-500">— ours, a refresh never changes these</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Client id" hint={isRefresh ? 'Fixed — changing it would orphan existing briefs.' : 'Used in URLs. Lowercase, hyphens.'}>
                  <Input value={id} onChange={(e) => setId(e.target.value)} disabled={isRefresh} className="font-mono" />
                  {preview.suggestedIdTaken && !isRefresh && (
                    <p className="text-[11px] text-amber-800 mt-1">That id is already taken — pick another.</p>
                  )}
                </Field>
                <Field label="Label" hint="Shown on the card and in the .docx header.">
                  <Input value={label} onChange={(e) => setLabel(e.target.value)} />
                </Field>
                <Field label="Description" hint="The line under the card title.">
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} />
                </Field>
                <Field label="Other names the API should accept" hint="Comma-separated, e.g. how Pulse spells it.">
                  <Input value={aliases} onChange={(e) => setAliases(e.target.value)} />
                </Field>
                <Field label="Icon" hint="Used only when there is no logo.">
                  <select value={icon} onChange={(e) => setIcon(e.target.value)} className={SELECT_CLASS}>
                    {vocabulary.icons.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Accent colour" hint="A closed set — brand hex cannot be used, see the code comment.">
                  <select value={color} onChange={(e) => setColor(e.target.value)} className={SELECT_CLASS}>
                    {vocabulary.colors.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-2">Brief types</h3>
              <div className="flex flex-wrap gap-3 text-xs">
                {vocabulary.briefTypes.map((t) => (
                  <label key={t.id} className="inline-flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={tierIds.includes(t.id)}
                      onChange={(e) =>
                        setTierIds((prev) => (e.target.checked ? [...prev, t.id] : prev.filter((x) => x !== t.id)))
                      }
                    />
                    {t.label}
                  </label>
                ))}
              </div>
              {tierIds.length === 0 && (
                <p className="text-[11px] text-amber-800 mt-1.5">
                  Pick at least one, or this client will have nothing to raise.
                </p>
              )}
            </div>

            {error && (
              <div className="rounded-xl border-2 border-red-300 bg-red-50 p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-700 shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter className="gap-2">
          <Button variant="outline" className="rounded-xl font-bold" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            className="rounded-xl font-bold"
            onClick={() => void submit()}
            disabled={loading || saving || blocked || !preview || tierIds.length === 0 || !id || !label}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            {isRefresh ? 'Refresh brand context' : 'Onboard this brand'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Fact({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`rounded-lg border p-2 ${warn ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-sm font-bold text-slate-800">{value}</p>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-slate-400 leading-snug">{hint}</p>}
    </div>
  );
}

function ComposedBlock({ title, body }: { title: string; body: string }) {
  return (
    <details className="mb-2 rounded-lg border border-slate-200 bg-slate-50">
      <summary className="cursor-pointer px-2.5 py-2 text-xs font-bold text-slate-700">
        {title} <span className="font-normal text-slate-500">· {chars(body.length)}</span>
      </summary>
      <pre className="px-2.5 pb-2.5 text-[11px] text-slate-700 whitespace-pre-wrap max-h-64 overflow-y-auto">
        {body || '(nothing — this section would be omitted from the prompt entirely)'}
      </pre>
    </details>
  );
}

function Th({ children, right, title }: { children: React.ReactNode; right?: boolean; title?: string }) {
  return (
    <th title={title} className={`py-2 pr-3 font-bold whitespace-nowrap ${right ? 'text-right' : ''}`}>
      {children}
    </th>
  );
}
