'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AGENCY_BRIEF_TYPES } from '@/lib/questions/agency';
import { Lightbulb, Zap, Share2, Clapperboard, ArrowLeft } from 'lucide-react';

const iconMap: Record<string, React.ReactNode> = {
  Lightbulb: <Lightbulb className="h-8 w-8" />,
  Zap: <Zap className="h-8 w-8" />,
  Share2: <Share2 className="h-8 w-8" />,
  Clapperboard: <Clapperboard className="h-8 w-8" />,
};

const colorMap: Record<string, { bg: string; border: string; icon: string; hover: string }> = {
  purple: { bg: 'bg-purple-50', border: 'border-purple-200 hover:border-purple-400', icon: 'text-purple-600 bg-purple-100', hover: 'hover:shadow-purple-200/50' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-200 hover:border-orange-400', icon: 'text-orange-600 bg-orange-100', hover: 'hover:shadow-orange-200/50' },
  pink: { bg: 'bg-pink-50', border: 'border-pink-200 hover:border-pink-400', icon: 'text-pink-600 bg-pink-100', hover: 'hover:shadow-pink-200/50' },
  teal: { bg: 'bg-teal-50', border: 'border-teal-200 hover:border-teal-400', icon: 'text-teal-600 bg-teal-100', hover: 'hover:shadow-teal-200/50' },
};

export default function AgencyDashboard() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center p-4 md:p-8 lg:p-24" style={{ backgroundColor: '#d9d8d8' }}>
      <div className="flex flex-wrap items-center justify-center gap-3 md:gap-6 mb-6 md:mb-8 z-10">
        <span className="drop-shadow-md text-[22px] md:text-[34px] leading-none tracking-tight font-bold text-black">
          IMPACT <span className="text-orange-600">BBDO</span>
        </span>
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
          <Link href="/" className="absolute left-3 md:left-5 top-3 md:top-5">
            <Button variant="ghost" size="sm" className="rounded-full border-2 border-slate-300 hover:border-slate-500 hover:bg-slate-100 text-xs md:text-sm">
              <ArrowLeft className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1" />
              Back
            </Button>
          </Link>
          <h1 className="text-2xl md:text-4xl font-bold text-slate-800 mb-2 md:mb-3">Agency Brief Creator</h1>
          <p className="text-sm md:text-lg text-slate-600 max-w-2xl mx-auto font-medium">
            Upload your materials. We&apos;ll pre-fill the brief. You review, refine and ship.
          </p>
        </div>

        <CardContent className="p-4 md:p-10 bg-white">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            {AGENCY_BRIEF_TYPES.map((tier) => {
              const colors = colorMap[tier.color] || colorMap.purple;
              return (
                <Link key={tier.id} href={`/agency/brief/${tier.id}`}>
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
        </CardContent>
      </Card>
    </main>
  );
}
