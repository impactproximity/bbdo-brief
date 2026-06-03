'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, KeyRound, CheckCircle2 } from 'lucide-react';

export default function ChangePasswordPage() {
  const [email, setEmail] = useState('');
  const [emailLocked, setEmailLocked] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  // Prefill + lock the email when the user is already signed in.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.email) {
            setEmail(data.email);
            setEmailLocked(true);
            setLoggedIn(true);
          }
        }
      } catch {
        /* not logged in — leave email editable */
      }
    })();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirm) {
      setError('New passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not change password.');
        return;
      }
      setDone(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center p-4" style={{ backgroundColor: '#d9d8d8' }}>
      <div className="mb-6 md:mb-8">
        <Image src="/impact-bbdo-logo.png" alt="IMPACT BBDO" width={464} height={67} priority className="h-[26px] md:h-[34px] w-auto" />
      </div>

      <Card className="w-full max-w-md shadow-[0_20px_60px_rgba(0,0,0,0.15)] border-2 border-slate-300 rounded-2xl md:rounded-3xl">
        <CardContent className="p-6 md:p-8 bg-white rounded-2xl md:rounded-3xl">
          {done ? (
            <div className="text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <h1 className="text-2xl font-bold text-slate-800 mb-2">Password updated</h1>
              <p className="text-sm text-slate-600 mb-6">You can now sign in with your new password.</p>
              <Link href={loggedIn ? '/agency' : '/login'}>
                <Button size="lg" className="w-full bg-gradient-to-br from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 text-white font-bold rounded-xl py-5 border-2 border-slate-800">
                  {loggedIn ? 'Back to dashboard' : 'Go to sign in'}
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-800 text-center mb-1">Change password</h1>
              <p className="text-sm text-slate-500 text-center mb-6">Enter your current password to set a new one.</p>

              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Email</label>
                  <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} readOnly={emailLocked} placeholder="you@company.com" className={`h-11 border-2 border-slate-200 focus-visible:border-orange-400 ${emailLocked ? 'bg-slate-100 text-slate-500' : ''}`} disabled={loading} />
                </div>
                <div>
                  <label htmlFor="current" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Current password</label>
                  <Input id="current" type="password" autoComplete="current-password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••" className="h-11 border-2 border-slate-200 focus-visible:border-orange-400" disabled={loading} />
                </div>
                <div>
                  <label htmlFor="new" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">New password</label>
                  <Input id="new" type="password" autoComplete="new-password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 8 characters" className="h-11 border-2 border-slate-200 focus-visible:border-orange-400" disabled={loading} />
                </div>
                <div>
                  <label htmlFor="confirm" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Confirm new password</label>
                  <Input id="confirm" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter new password" className="h-11 border-2 border-slate-200 focus-visible:border-orange-400" disabled={loading} />
                </div>

                {error && (
                  <p className="text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
                )}

                <Button type="submit" size="lg" disabled={loading} className="w-full bg-gradient-to-br from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white font-bold rounded-xl py-5 border-2 border-orange-700 disabled:opacity-50">
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <KeyRound className="h-4 w-4 mr-2" />}
                  {loading ? 'Updating…' : 'Update password'}
                </Button>
              </form>

              <p className="text-center text-sm text-slate-500 mt-6">
                <Link href={loggedIn ? '/agency' : '/login'} className="font-bold text-orange-600 hover:text-orange-700 underline underline-offset-2">
                  {loggedIn ? 'Back to dashboard' : 'Back to sign in'}
                </Link>
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
