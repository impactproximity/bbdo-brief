'use client';

import React, { Suspense, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, LogIn } from 'lucide-react';

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectParam = params.get('redirect');
  const safeRedirect =
    redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('//')
      ? redirectParam
      : '/agency';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Login failed.');
        return;
      }
      router.push(safeRedirect);
      router.refresh();
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
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 text-center mb-1">Sign in</h1>
          <p className="text-sm text-slate-500 text-center mb-6">Access the Brief Creator platform.</p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Email</label>
              <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="h-11 border-2 border-slate-200 focus-visible:border-orange-400" disabled={loading} />
            </div>
            <div>
              <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Password</label>
              <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="h-11 border-2 border-slate-200 focus-visible:border-orange-400" disabled={loading} />
            </div>

            {error && (
              <p className="text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}

            <Button type="submit" size="lg" disabled={loading} className="w-full bg-gradient-to-br from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 text-white font-bold rounded-xl py-5 border-2 border-slate-800 disabled:opacity-50">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LogIn className="h-4 w-4 mr-2" />}
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            No account?{' '}
            <Link href="/signup" className="font-bold text-orange-600 hover:text-orange-700 underline underline-offset-2">Create one</Link>
          </p>
          <p className="text-center text-sm text-slate-500 mt-2">
            <Link href="/change-password" className="font-medium text-slate-600 hover:text-slate-800 underline underline-offset-2">Change password</Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
