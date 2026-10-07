'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Loader2 } from 'lucide-react';
import { TOOLBAR_PILL } from '@/components/agency/AgencyToolbar';

export function LogoutButton({ className = '' }: { className?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={logout}
      disabled={loading}
      title="Log out"
      // Shares the header pill definition rather than its own copy, so this can never drift
      // out of sync with the buttons sitting beside it.
      className={`${TOOLBAR_PILL} disabled:opacity-50 ${className}`}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
      <span className="hidden sm:inline">Log out</span>
    </button>
  );
}
