'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { BRIEF_TYPES } from '@/lib/questions';
import { Target, Megaphone, Share2, PenTool, Gem, Settings, Zap, Newspaper, Globe } from 'lucide-react';

const iconMap: Record<string, React.ReactNode> = {
  Target: <Target className="h-8 w-8" />,
  Megaphone: <Megaphone className="h-8 w-8" />,
  Share2: <Share2 className="h-8 w-8" />,
  PenTool: <PenTool className="h-8 w-8" />,
  Gem: <Gem className="h-8 w-8" />,
  Settings: <Settings className="h-8 w-8" />,
  Zap: <Zap className="h-8 w-8" />,
  Newspaper: <Newspaper className="h-8 w-8" />,
  Globe: <Globe className="h-8 w-8" />,
};

const colorMap: Record<string, { bg: string; border: string; icon: string; hover: string }> = {
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-200 hover:border-blue-400',
    icon: 'text-blue-600 bg-blue-100',
    hover: 'hover:shadow-blue-200/50',
  },
  purple: {
    bg: 'bg-purple-50',
    border: 'border-purple-200 hover:border-purple-400',
    icon: 'text-purple-600 bg-purple-100',
    hover: 'hover:shadow-purple-200/50',
  },
  green: {
    bg: 'bg-green-50',
    border: 'border-green-200 hover:border-green-400',
    icon: 'text-green-600 bg-green-100',
    hover: 'hover:shadow-green-200/50',
  },
  orange: {
    bg: 'bg-orange-50',
    border: 'border-orange-200 hover:border-orange-400',
    icon: 'text-orange-600 bg-orange-100',
    hover: 'hover:shadow-orange-200/50',
  },
  red: {
    bg: 'bg-red-50',
    border: 'border-red-200 hover:border-red-400',
    icon: 'text-red-600 bg-red-100',
    hover: 'hover:shadow-red-200/50',
  },
  pink: {
    bg: 'bg-pink-50',
    border: 'border-pink-200 hover:border-pink-400',
    icon: 'text-pink-600 bg-pink-100',
    hover: 'hover:shadow-pink-200/50',
  },
  cyan: {
    bg: 'bg-cyan-50',
    border: 'border-cyan-200 hover:border-cyan-400',
    icon: 'text-cyan-600 bg-cyan-100',
    hover: 'hover:shadow-cyan-200/50',
  },
  indigo: {
    bg: 'bg-indigo-50',
    border: 'border-indigo-200 hover:border-indigo-400',
    icon: 'text-indigo-600 bg-indigo-100',
    hover: 'hover:shadow-indigo-200/50',
  },
  teal: {
    bg: 'bg-teal-50',
    border: 'border-teal-200 hover:border-teal-400',
    icon: 'text-teal-600 bg-teal-100',
    hover: 'hover:shadow-teal-200/50',
  },
};

export default function LandingPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center p-4 md:p-8 lg:p-24" style={{ backgroundColor: '#d9d8d8' }}>
      {/* Logos */}
      <div className="flex flex-wrap items-center justify-center gap-3 md:gap-6 mb-6 md:mb-8 z-10">
        <div className="flex items-center gap-3 md:gap-6">
          <Image
            src="/shamal-logo.svg"
            alt="Shamal Logo"
            width={160}
            height={44}
            priority
            className="drop-shadow-md w-[100px] md:w-[160px] h-auto"
          />
          <span className="drop-shadow-md text-[22px] md:text-[34px] leading-none tracking-tight" style={{ fontFamily: 'sans-serif' }}>
            <span className="font-bold text-black">Omnicom</span><span className="font-normal text-black">Group</span>
          </span>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <div className="h-8 md:h-10 w-px bg-slate-400"></div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <p className="text-xs md:text-sm text-slate-700 font-bold tracking-wide">
              Powered by
            </p>
            <Image
              src="/impact-logo.svg"
              alt="ImpactProximity Logo"
              width={100}
              height={24}
              priority
              className="drop-shadow-sm w-[70px] md:w-[100px] h-auto"
            />
          </div>
        </div>
      </div>

      {/* Main Card */}
      <Card className="w-full max-w-5xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] border-2 md:border-3 border-slate-300 overflow-hidden rounded-2xl md:rounded-3xl">
        <div className="text-center border-b-2 md:border-b-3 border-slate-300 bg-white pb-4 md:pb-6 pt-6 md:pt-8 px-4">
          <h1 className="text-2xl md:text-4xl font-bold text-slate-800 mb-2 md:mb-3">
            Project Brief Creator
          </h1>
          <p className="text-sm md:text-lg text-slate-600 max-w-2xl mx-auto font-medium">
            Select the type of brief you want to create
          </p>
        </div>

        <CardContent className="p-4 md:p-10 bg-white">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            {BRIEF_TYPES.map((briefType, index) => {
              const colors = colorMap[briefType.color] || colorMap.blue;
              const isLastOdd = index === BRIEF_TYPES.length - 1 && BRIEF_TYPES.length % 2 !== 0;
              return (
                <Link key={briefType.id} href={`/brief/${briefType.id}`} className={isLastOdd ? 'md:col-span-2' : ''}>
                  <div
                    className={`group relative h-full p-4 md:p-5 rounded-xl md:rounded-2xl border-2 ${colors.border} ${colors.bg} transition-all duration-300 hover:shadow-lg ${colors.hover} hover:-translate-y-0.5 cursor-pointer`}
                  >
                    <div className="flex items-start gap-3 md:gap-4">
                      <div className={`flex-shrink-0 p-2 md:p-2.5 rounded-lg md:rounded-xl ${colors.icon} transition-transform duration-300 group-hover:scale-105`}>
                        {iconMap[briefType.icon]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base md:text-lg font-bold text-slate-800 mb-0.5 md:mb-1">
                          {briefType.label}
                        </h3>
                        <p className="text-xs md:text-sm text-slate-500 leading-relaxed">
                          {briefType.description}
                        </p>
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
