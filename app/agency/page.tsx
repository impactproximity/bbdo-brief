'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { AgencyToolbar, TOOLBAR_PILL } from '@/components/agency/AgencyToolbar';
import { getBriefTypesForClient } from '@/lib/questions/agency';
import type { ClientIconKey, ClientColorKey } from '@/lib/clients/card-vocabulary';
import type { ClientCard } from '@/lib/clients/card';
import { Lightbulb, Zap, Share2, Clapperboard, ArrowLeft, ArrowRight, Coffee, Beef, Building2, Repeat, Megaphone, Radio, Ship, Sparkles, Cookie, Loader2 } from 'lucide-react';

/**
 * `satisfies`, not an annotation. It checks this literal carries an entry for EVERY key in
 * CLIENT_ICON_KEYS and no others, so adding a key to that list without adding it here fails
 * the build — which matters because the lookup below falls back silently, and a missing entry
 * would otherwise render Building2 on a brand forever with nothing to notice.
 */
const iconMap = {
  Lightbulb: <Lightbulb className="h-8 w-8" />,
  Zap: <Zap className="h-8 w-8" />,
  Share2: <Share2 className="h-8 w-8" />,
  Clapperboard: <Clapperboard className="h-8 w-8" />,
  Coffee: <Coffee className="h-8 w-8" />,
  Beef: <Beef className="h-8 w-8" />,
  Building2: <Building2 className="h-8 w-8" />,
  Repeat: <Repeat className="h-8 w-8" />,
  Megaphone: <Megaphone className="h-8 w-8" />,
  Radio: <Radio className="h-8 w-8" />,
  Ship: <Ship className="h-8 w-8" />,
  Sparkles: <Sparkles className="h-8 w-8" />,
  Cookie: <Cookie className="h-8 w-8" />,
} satisfies Record<ClientIconKey, React.ReactNode>;

/** The silent fallback, in one place. `key` is data — a client config or a tier config. */
function iconFor(key: string): React.ReactNode {
  return (iconMap as Record<string, React.ReactNode>)[key] ?? iconMap.Building2;
}

const colorMap: Record<string, { bg: string; border: string; icon: string; hover: string }> = {
  purple: { bg: 'bg-purple-50', border: 'border-purple-200 hover:border-purple-400', icon: 'text-purple-600 bg-purple-100', hover: 'hover:shadow-purple-200/50' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-200 hover:border-orange-400', icon: 'text-orange-600 bg-orange-100', hover: 'hover:shadow-orange-200/50' },
  pink: { bg: 'bg-pink-50', border: 'border-pink-200 hover:border-pink-400', icon: 'text-pink-600 bg-pink-100', hover: 'hover:shadow-pink-200/50' },
  teal: { bg: 'bg-teal-50', border: 'border-teal-200 hover:border-teal-400', icon: 'text-teal-600 bg-teal-100', hover: 'hover:shadow-teal-200/50' },
  yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200 hover:border-yellow-400', icon: 'text-yellow-600 bg-yellow-100', hover: 'hover:shadow-yellow-200/50' },
  red: { bg: 'bg-red-50', border: 'border-red-200 hover:border-red-400', icon: 'text-red-600 bg-red-100', hover: 'hover:shadow-red-200/50' },
  blue: { bg: 'bg-blue-50', border: 'border-blue-200 hover:border-blue-400', icon: 'text-blue-600 bg-blue-100', hover: 'hover:shadow-blue-200/50' },
  navy: { bg: 'bg-blue-50', border: 'border-blue-300 hover:border-blue-500', icon: 'text-blue-800 bg-blue-100', hover: 'hover:shadow-blue-300/50' },
};

// Brand accent used only on the client picker cards (top bar + hover glow/text).
//
// These are literal Tailwind class strings, scanned at build time — which is exactly why a
// brand's own colour cannot come from Pulse at runtime and why onboarding picks from this
// closed set instead. See lib/clients/card-vocabulary.ts.
const accentMap = {
  purple: { bar: 'from-purple-400 to-purple-600', glow: 'hover:shadow-purple-200/60', text: 'group-hover:text-purple-600' },
  orange: { bar: 'from-orange-400 to-orange-600', glow: 'hover:shadow-orange-200/60', text: 'group-hover:text-orange-600' },
  pink: { bar: 'from-pink-400 to-pink-600', glow: 'hover:shadow-pink-200/60', text: 'group-hover:text-pink-600' },
  teal: { bar: 'from-teal-400 to-teal-600', glow: 'hover:shadow-teal-200/60', text: 'group-hover:text-teal-600' },
  yellow: { bar: 'from-yellow-300 to-yellow-500', glow: 'hover:shadow-yellow-200/60', text: 'group-hover:text-yellow-600' },
  red: { bar: 'from-red-400 to-red-600', glow: 'hover:shadow-red-200/60', text: 'group-hover:text-red-600' },
  // Google Gemini — the blue-to-violet gradient of the Gemini mark.
  blue: { bar: 'from-blue-400 to-indigo-500', glow: 'hover:shadow-blue-200/60', text: 'group-hover:text-blue-600' },
  // McVitie's Blue, PANTONE 2748 C / RGB 0-23-119 — deliberately deeper than 'blue' above.
  navy: { bar: 'from-blue-700 to-blue-900', glow: 'hover:shadow-blue-300/60', text: 'group-hover:text-blue-800' },
} satisfies Record<ClientColorKey, { bar: string; glow: string; text: string }>;

function accentFor(key: string): (typeof accentMap)['purple'] {
  return (accentMap as Record<string, (typeof accentMap)['purple']>)[key] ?? accentMap.purple;
}

export default function AgencyDashboard() {
  const [selectedClient, setSelectedClient] = useState<string | null>(null);

  // Clients come from GET /api/clients rather than a static import.
  //
  // TWO REASONS. Brands onboarded from Pulse are database rows and cannot be imported at
  // all. And importing lib/clients here used to pull every config module into the browser
  // bundle — including proposition, brandGuidelines and promptGuidance, which is client-
  // confidential brand strategy (~11 KB for P&O alone) shipped to anyone who loaded this
  // page. The route returns card fields only.
  const [clients, setClients] = useState<ClientCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/clients');
        if (!res.ok) throw new Error(`Failed to load clients (${res.status})`);
        const data = await res.json();
        if (cancelled) return;
        setClients(data.clients ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const client = selectedClient && clients ? clients.find((c) => c.id === selectedClient) : null;

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center p-4 md:p-8 lg:p-24" style={{ backgroundColor: '#d9d8d8' }}>
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
          <AgencyToolbar
            left={
              client && (
                <button onClick={() => setSelectedClient(null)} title="Change client" className={TOOLBAR_PILL}>
                  <ArrowLeft className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  <span className="hidden sm:inline">Change client</span>
                </button>
              )
            }
          />
          <h1 className="text-2xl md:text-4xl font-bold text-slate-800 mb-2 md:mb-3">
            {client ? client.label : 'Choose a client'}
          </h1>
          <p className="text-sm md:text-lg text-slate-600 max-w-2xl mx-auto font-medium">
            {client
              ? 'Pick a brief type. Upload your materials and we’ll pre-fill it for this client.'
              : 'Select the client this brief is for. Each client tailors the AI to its brand.'}
          </p>
        </div>

        <CardContent className="p-4 md:p-10 bg-white">
          {error ? (
            <div className="py-10 text-center">
              <p className="font-bold text-red-700 mb-1">Could not load clients</p>
              <p className="text-sm text-slate-500">{error}</p>
            </div>
          ) : !clients ? (
            <div className="py-12 flex flex-col items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              <p className="text-sm text-slate-500">Loading clients&hellip;</p>
            </div>
          ) : !client ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
              {clients.map((c) => {
                const accent = accentFor(c.color);
                return (
                  <button key={c.id} onClick={() => setSelectedClient(c.id)} className="group h-full text-left focus:outline-none">
                    <div className={`relative flex h-full flex-col overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-slate-300 hover:shadow-xl ${accent.glow} cursor-pointer`}>
                      {/* Brand accent bar */}
                      <div className={`h-1.5 w-full bg-gradient-to-r ${accent.bar}`} />

                      {/* Logo well — large, no colored tile */}
                      <div className="flex h-28 md:h-32 items-center justify-center px-6 pt-6">
                        {c.logoSrc ? (
                          <Image
                            src={c.logoSrc}
                            alt={`${c.label} logo`}
                            width={220}
                            height={110}
                            /*
                             * A synced brand's logo MUST be unoptimized.
                             *
                             * Its bytes come from /api/clients/<id>/logo, which proxy.ts
                             * session-gates like everything under /api. next/image optimizes by
                             * fetching the URL server-side WITHOUT the browser's cookies, so the
                             * optimizer gets a 401 and the card renders nothing — "The requested
                             * resource isn't a valid image … received null". Unoptimized makes the
                             * browser fetch it directly, carrying the session cookie.
                             *
                             * A compile-time client's logo is a public file under public/, so it
                             * optimizes normally and keeps doing so.
                             */
                            unoptimized={c.source === 'pulse'}
                            className="max-h-16 md:max-h-20 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <span className="text-slate-300 [&>svg]:h-14 [&>svg]:w-14">{iconFor(c.icon)}</span>
                        )}
                      </div>

                      {/* Text */}
                      <div className="flex flex-1 flex-col items-center px-5 pb-5 pt-3 text-center">
                        <h3 className="text-lg md:text-xl font-bold text-slate-800">{c.label}</h3>
                        <p className="mt-1 text-xs md:text-sm text-slate-500 leading-relaxed">{c.description}</p>
                        <span className={`mt-auto pt-4 inline-flex items-center gap-1 text-[11px] md:text-xs font-bold uppercase tracking-widest text-slate-400 transition-colors ${accent.text}`}>
                          Select
                          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              {/* The card carries its resolved tier ids, so no registry lookup is needed —
                  and a synced brand gets the four defaults expanded by the route. */}
              {getBriefTypesForClient({ briefTypes: client.briefTypes }).map((tier) => {
                const colors = colorMap[tier.color] || colorMap.purple;
                return (
                  <Link key={tier.id} href={`/agency/brief/${tier.id}?client=${client.id}`}>
                    <div className={`group relative h-full p-4 md:p-5 rounded-xl md:rounded-2xl border-2 ${colors.border} ${colors.bg} transition-all duration-300 hover:shadow-lg ${colors.hover} hover:-translate-y-0.5 cursor-pointer`}>
                      <div className="flex items-start gap-3 md:gap-4">
                        <div className={`flex-shrink-0 p-2 md:p-2.5 rounded-lg md:rounded-xl ${colors.icon} transition-transform duration-300 group-hover:scale-105`}>
                          {iconFor(tier.icon)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base md:text-lg font-bold text-slate-800 mb-0.5 md:mb-1">{tier.label}</h3>
                          <p className="text-xs md:text-sm text-slate-500 leading-relaxed">{tier.description}</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
