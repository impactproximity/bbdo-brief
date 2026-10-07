'use client';

import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Loader2, LogIn, Mail } from 'lucide-react';

const RESEND_COOLDOWN_SECONDS = 10; // matches the server + Supabase interval
const CODE_LENGTH = 6;      // what users are emailed
const CODE_MAX_LENGTH = 8;  // break-glass codes are 8 — accept them in the same box

type Step = 'email' | 'code';

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectParam = params.get('redirect');
  // Open-redirect guard: only same-origin absolute paths, never protocol-relative.
  const safeRedirect =
    redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('//')
      ? redirectParam
      : '/agency';

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const codeInputRef = useRef<HTMLInputElement>(null);

  // Resend countdown.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (step === 'code') codeInputRef.current?.focus();
  }, [step]);

  const requestCode = useCallback(
    async (advance: boolean) => {
      setError('');
      setLoading(true);
      try {
        const res = await fetch('/api/auth/otp/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await res.json().catch(() => ({}));

        if (res.status === 429) {
          // Seed the countdown from the server's own value rather than guessing.
          const wait = Number(data.retryAfter) > 0 ? Number(data.retryAfter) : RESEND_COOLDOWN_SECONDS;
          setCooldown(wait);
          // A cooldown is not a dead end: a code was sent moments ago and is valid for
          // ten minutes, so send the user to the code field instead of an error. Logging
          // out and straight back in otherwise blocks you from your own valid code.
          // Safe for enumeration: registered and unregistered addresses both 429 here.
          if (advance && wait <= RESEND_COOLDOWN_SECONDS) {
            setNotice('A code was sent to this address moments ago. If you still have it, enter it below — otherwise you can request a new one shortly.');
            setError('');
            setStep('code');
            return true;
          }
          setError(data.error || 'Too many requests. Try again shortly.');
          return false;
        }
        if (!res.ok) {
          // Stay on step 1 so a mistyped address can be corrected in place.
          setError(data.error || "We couldn't send the code. Please try again.");
          return false;
        }

        setCooldown(RESEND_COOLDOWN_SECONDS);
        setNotice('');
        if (advance) setStep('code');
        return true;
      } catch {
        setError('Something went wrong. Please try again.');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [email],
  );

  async function onSubmitEmail(e: React.FormEvent) {
    e.preventDefault();
    await requestCode(true);
  }

  async function onSubmitCode(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "That code isn't valid or has expired. Request a new one.");
        setCode('');
        codeInputRef.current?.focus();
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

  function backToEmail() {
    setStep('email');
    setCode('');
    setError('');
    setNotice('');
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center p-4" style={{ backgroundColor: '#d9d8d8' }}>
      {/* Product name, then the same horizontal lockup used in the post-login header
          (app/agency/page.tsx). */}
      <div className="flex flex-col items-center gap-2 md:gap-3 mb-6 md:mb-8">
        <p className="text-sm md:text-base font-bold uppercase tracking-[0.35em] text-slate-700 pl-[0.35em]">
          Brief Creator
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 md:gap-6">
          <Image
            src="/impact-bbdo-logo.png"
            alt="IMPACT BBDO"
            width={315}
            height={131}
            priority
            className="h-[34px] md:h-[52px] w-auto"
          />
          <div className="flex items-center gap-2 md:gap-3">
            <div className="h-8 md:h-10 w-px bg-slate-400"></div>
            <div className="flex items-center gap-1.5 md:gap-2">
              <p className="text-xs md:text-sm text-slate-700 font-bold tracking-wide">Powered by</p>
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

      </div>

      <Card className="w-full max-w-md shadow-[0_20px_60px_rgba(0,0,0,0.15)] border-2 border-slate-300 rounded-2xl md:rounded-3xl">
        <CardContent className="p-6 md:p-8 bg-white rounded-2xl md:rounded-3xl">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 text-center mb-1">Sign in</h1>

          {step === 'email' ? (
            <>
              <p className="text-sm text-slate-500 text-center mb-6">
                Enter your work email and we&rsquo;ll send you a {CODE_LENGTH}-digit sign-in code.
              </p>

              <form onSubmit={onSubmitEmail} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Email</label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      // The server cooldown is per-address, so changing it clears ours —
                      // otherwise a typo locks you out of correcting it for a full minute.
                      setCooldown(0);
                      setError('');
                      setNotice('');
                    }}
                    placeholder="name@omc.com"
                    className="h-11 border-2 border-slate-200 focus-visible:border-orange-400"
                    disabled={loading}
                  />
                </div>

                {error && (
                  <p className="text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
                )}

                <Button
                  type="submit"
                  size="lg"
                  disabled={loading || cooldown > 0}
                  className="w-full bg-gradient-to-br from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 text-white font-bold rounded-xl py-5 border-2 border-slate-800 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
                  {loading ? 'Sending code…' : cooldown > 0 ? `Try again in ${cooldown}s` : 'Send sign-in code'}
                </Button>
              </form>

              <div className="text-center mt-6 space-y-2">
                <p className="text-xs text-slate-500">
                  Access is limited to approved accounts. You&rsquo;ll stay signed in on this device for 7 days.
                </p>
                {/*
                  Reaching the code field without requesting a new code matters in two real
                  cases: you already have an unexpired code (requesting another invalidates
                  it), and break-glass — where an admin hands you a code out of band and no
                  email is ever sent. Without this the escape hatch cannot be used at all.
                */}
                <button
                  type="button"
                  onClick={() => {
                    if (!email.trim()) {
                      setError('Enter your email address first.');
                      return;
                    }
                    setError('');
                    setStep('code');
                  }}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-800 underline underline-offset-2"
                >
                  I already have a code
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-500 text-center mb-6">
                Enter the {CODE_LENGTH}-digit code for <span className="font-bold text-slate-700">{email}</span>.
                Codes expire 10 minutes after they&rsquo;re sent.
              </p>

              {notice && (
                <p className="text-sm font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                  {notice}
                </p>
              )}

              <form onSubmit={onSubmitCode} className="space-y-4">
                <div>
                  <label htmlFor="code" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Sign-in code
                  </label>
                  {/* One input, not six boxes: six break OS autofill and buy nothing. */}
                  <Input
                    id="code"
                    ref={codeInputRef}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={CODE_MAX_LENGTH}
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_MAX_LENGTH))}
                    placeholder="000000"
                    className="h-12 border-2 border-slate-200 focus-visible:border-orange-400 text-center text-xl font-bold tracking-[0.4em]"
                    disabled={loading}
                  />
                </div>

                {error && (
                  <p className="text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
                )}

                <Button
                  type="submit"
                  size="lg"
                  disabled={loading || code.length < CODE_LENGTH}
                  className="w-full bg-gradient-to-br from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 text-white font-bold rounded-xl py-5 border-2 border-slate-800 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LogIn className="h-4 w-4 mr-2" />}
                  {loading ? 'Signing in…' : 'Sign in'}
                </Button>
              </form>

              <div className="flex items-center justify-between mt-6 gap-2">
                <button
                  type="button"
                  onClick={backToEmail}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-800 underline underline-offset-2"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Use a different email
                </button>

                <button
                  type="button"
                  onClick={() => void requestCode(false)}
                  disabled={loading || cooldown > 0}
                  className="text-xs font-semibold text-orange-600 hover:text-orange-700 underline underline-offset-2 disabled:text-slate-400 disabled:no-underline disabled:cursor-not-allowed"
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                </button>
              </div>

              <p className="text-center text-xs text-slate-500 mt-4">
                Didn&rsquo;t get it? Check spam, or confirm the address is right &mdash; access is limited to approved accounts.
              </p>
            </>
          )}
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
