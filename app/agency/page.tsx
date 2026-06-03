'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { LogoutButton } from '@/components/LogoutButton';
import { AGENCY_BRIEF_TYPES } from '@/lib/questions/agency';
import { CLIENTS } from '@/lib/clients';
import { Lightbulb, Zap, Share2, Clapperboard, ArrowLeft, ArrowRight, Coffee, Beef, Building2 } from 'lucide-react';

const iconMap: Record<string, React.ReactNode> = {
  Lightbulb: <Lightbulb className="h-8 w-8" />,
  Zap: <Zap className="h-8 w-8" />,
  Share2: <Share2 className="h-8 w-8" />,
  Clapperboard: <Clapperboard className="h-8 w-8" />,
  Coffee: <Coffee className="h-8 w-8" />,
  Beef: <Beef className="h-8 w-8" />,
  Building2: <Building2 className="h-8 w-8" />,
};

const colorMap: Record<string, { bg: string; border: string; icon: string; hover: string }> = {
  purple: { bg: 'bg-purple-50', border: 'border-purple-200 hover:border-purple-400', icon: 'text-purple-600 bg-purple-100', hover: 'hover:shadow-purple-200/50' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-200 hover:border-orange-400', icon: 'text-orange-600 bg-orange-100', hover: 'hover:shadow-orange-200/50' },
  pink: { bg: 'bg-pink-50', border: 'border-pink-200 hover:border-pink-400', icon: 'text-pink-600 bg-pink-100', hover: 'hover:shadow-pink-200/50' },
  teal: { bg: 'bg-teal-50', border: 'border-teal-200 hover:border-teal-400', icon: 'text-teal-600 bg-teal-100', hover: 'hover:shadow-teal-200/50' },
  yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200 hover:border-yellow-400', icon: 'text-yellow-600 bg-yellow-100', hover: 'hover:shadow-yellow-200/50' },
  red: { bg: 'bg-red-50', border: 'border-red-200 hover:border-red-400', icon: 'text-red-600 bg-red-100', hover: 'hover:shadow-red-200/50' },
};

// Brand accent used only on the client picker cards (top bar + hover glow/text).
const accentMap: Record<string, { bar: string; glow: string; text: string }> = {
  purple: { bar: 'from-purple-400 to-purple-600', glow: 'hover:shadow-purple-200/60', text: 'group-hover:text-purple-600' },
  orange: { bar: 'from-orange-400 to-orange-600', glow: 'hover:shadow-orange-200/60', text: 'group-hover:text-orange-600' },
  pink: { bar: 'from-pink-400 to-pink-600', glow: 'hover:shadow-pink-200/60', text: 'group-hover:text-pink-600' },
  teal: { bar: 'from-teal-400 to-teal-600', glow: 'hover:shadow-teal-200/60', text: 'group-hover:text-teal-600' },
  yellow: { bar: 'from-yellow-300 to-yellow-500', glow: 'hover:shadow-yellow-200/60', text: 'group-hover:text-yellow-600' },
  red: { bar: 'from-red-400 to-red-600', glow: 'hover:shadow-red-200/60', text: 'group-hover:text-red-600' },
};

export default function AgencyDashboard() {
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const client = selectedClient ? CLIENTS.find((c) => c.id === selectedClient) : null;

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center p-4 md:p-8 lg:p-24" style={{ backgroundColor: '#d9d8d8' }}>
      <div className="absolute right-3 top-3 md:right-6 md:top-6 z-20">
        <LogoutButton />
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3 md:gap-6 mb-6 md:mb-8 z-10">
        <Image src="/impact-bbdo-logo.png" alt="IMPACT BBDO" width={464} height={67} priority className="h-[22px] md:h-[34px] w-auto" />
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
          {client && (
            <button
              onClick={() => setSelectedClient(null)}
              className="absolute left-3 md:left-5 top-3 md:top-5 inline-flex items-center gap-1 rounded-full border-2 border-slate-300 hover:border-slate-500 hover:bg-slate-100 text-xs md:text-sm font-medium text-slate-700 px-3 py-1.5 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5 md:h-4 md:w-4" />
              Change client
            </button>
          )}
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
          {!client ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
              {CLIENTS.map((c) => {
                const accent = accentMap[c.color] || accentMap.purple;
                return (
                  <button key={c.id} onClick={() => setSelectedClient(c.id)} className="group h-full text-left focus:outline-none">
                    <div className={`relative flex h-full flex-col overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-slate-300 hover:shadow-xl ${accent.glow} cursor-pointer`}>
                      {/* Brand accent bar */}
                      <div className={`h-1.5 w-full bg-gradient-to-r ${accent.bar}`} />

                      {/* Logo well — large, no colored tile */}
                      <div className="flex h-28 md:h-32 items-center justify-center px-6 pt-6">
                        {c.logo ? (
                          <Image
                            src={`/${c.logo}`}
                            alt={`${c.label} logo`}
                            width={220}
                            height={110}
                            className="max-h-16 md:max-h-20 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <span className="text-slate-300 [&>svg]:h-14 [&>svg]:w-14">{iconMap[c.icon] || iconMap.Building2}</span>
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
              {AGENCY_BRIEF_TYPES.map((tier) => {
                const colors = colorMap[tier.color] || colorMap.purple;
                return (
                  <Link key={tier.id} href={`/agency/brief/${tier.id}?client=${client.id}`}>
                    <div className={`group relative h-full p-4 md:p-5 rounded-xl md:rounded-2xl border-2 ${colors.border} ${colors.bg} transition-all duration-300 hover:shadow-lg ${colors.hover} hover:-translate-y-0.5 cursor-pointer`}>
                      <div className="flex items-start gap-3 md:gap-4">
                        <div className={`flex-shrink-0 p-2 md:p-2.5 rounded-lg md:rounded-xl ${colors.icon} transition-transform duration-300 group-hover:scale-105`}>
                          {iconMap[tier.icon]}
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
