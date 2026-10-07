'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { LogoutButton } from '@/components/LogoutButton';
import { BarChart3, History } from 'lucide-react';

/**
 * The navigation pills in the agency card headers.
 *
 * These used to sit in an absolutely-positioned strip OUTSIDE the card, on the #d9d8d8 grey
 * page background. A transparent fill with a slate-300 outline is almost indistinguishable
 * from that grey, so in practice nobody could see them. They now live inside the white card
 * header, where the same outline reads clearly.
 */

/**
 * The single definition of a header pill. Previously this class string was copy-pasted 13
 * times across 7 files, which is exactly why the buttons drifted out of sync — import this
 * rather than adding a fourteenth copy.
 *
 * Labels inside a pill belong in <span className="hidden sm:inline">, so the pill collapses
 * to its icon on a phone. Padding is unchanged by that, so tap targets stay full size.
 */
export const TOOLBAR_PILL =
  'inline-flex items-center gap-1.5 rounded-full border-2 border-slate-400 bg-white ' +
  'text-slate-800 shadow-sm hover:border-slate-600 hover:bg-slate-100 ' +
  'text-xs md:text-sm font-medium px-3 py-1.5 transition-colors';

interface AgencyToolbarProps {
  /** The page's Back / Change-client control, rendered at the left of the same row. */
  left?: React.ReactNode;
  /** Hide the link to the page you are already on. */
  showBriefs?: boolean;
  showUsage?: boolean;
}

/**
 * Drop this in as the first child of a card header.
 *
 * A real flex ROW, not absolutely positioned. The first attempt mirrored the Back button at
 * `right-3 top-3`, which looked tidier but was fragile: the card titles are centred and
 * grow with their content, so a long one ("Internal — Impact BBDO") slid straight underneath
 * the pills — at full desktop width, not just on mobile. No amount of padding fixes that
 * reliably, because the title length is data, not layout.
 *
 * As a row, the title simply cannot collide with the buttons at any width or any length.
 * `left` takes the page's Back / Change-client control so both sides share one row.
 */
export function AgencyToolbar({ left, showBriefs = true, showUsage = true }: AgencyToolbarProps) {
  // Whether to offer the usage report.
  //
  // PRESENTATION ONLY. The real gate is requireAdmin() inside /agency/admin and
  // /api/admin/usage, so a non-admin who guesses the URL still gets nothing. Failing closed
  // (no link) is the right default, which is why a failed lookup is swallowed.
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!showUsage) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setIsAdmin(Boolean(data.isAdmin));
      } catch {
        /* no link, no harm */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showUsage]);

  return (
    <div className="flex items-center justify-between gap-2 mb-3 md:mb-4">
      {/* Always rendered, even when empty, so justify-between keeps the pills hard right. */}
      <div className="flex items-center">{left}</div>
      <div className="flex items-center gap-1.5 md:gap-2">
        {showBriefs && (
          <Link href="/agency/briefs" className={TOOLBAR_PILL} title="My briefs">
            <History className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">My briefs</span>
          </Link>
        )}
        {showUsage && isAdmin && (
          <Link href="/agency/admin" className={TOOLBAR_PILL} title="Usage">
            <BarChart3 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Usage</span>
          </Link>
        )}
        <LogoutButton />
      </div>
    </div>
  );
}
