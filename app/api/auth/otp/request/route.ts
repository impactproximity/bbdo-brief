import { NextResponse } from 'next/server';
import { findUserByEmail } from '@/lib/auth';
import { isOtpConfigured, sendLoginCode } from '@/lib/auth/supabaseOtp';
import {
  beginAttempt,
  checkRequestAllowed,
  hashIp,
  markAttemptSucceeded,
  maybeSweep,
} from '@/lib/auth/otpRateLimit';

export const runtime = 'nodejs'; // hashIp uses node crypto
export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Step 1 of login: email a 6-digit code.
 *
 * THIS ROUTE DELIBERATELY REVEALS WHETHER AN ADDRESS HAS ACCESS. Read this before
 * "fixing" it back.
 *
 * It used to be anti-enumeration hardened: unknown, deactivated and successful all returned
 * an identical 200 body, padded to a fixed 2s so even the response time gave nothing away.
 * That was removed on purpose. The cost was paid by real people — someone without an
 * account was sent to the code screen to wait for an email that would never arrive, with no
 * way to tell that from a typo or a slow inbox.
 *
 * The trade was accepted knowingly: every user is firstname.lastname@omc.com, so the
 * addresses are guessable without this page at all, and confirming that an address is
 * registered still grants no way in — the OTP itself is unchanged.
 *
 * What this means in practice: the rate limiter is now the ONLY thing limiting bulk
 * probing. Every attempt, including unknown addresses, is still recorded in otp_attempts
 * with a hashed IP, so harvesting is visible after the fact even though nothing blocks it
 * in the moment. If that ever matters, add a per-IP cap on unknown-address attempts in
 * lib/auth/otpRateLimit.ts.
 *
 * This route is unauthenticated by design (proxy.ts ALWAYS_ALLOW covers /api/auth/),
 * so the rate limiter below is also the only thing standing between it and an email relay.
 */

/** Sent only when a code genuinely went out — the "if that address is registered" hedge
 * is gone, because an address without access now gets an explicit 403 instead. */
const SENT_OK = { ok: true, message: "We've sent a code." };

/**
 * Shown to an address that is unknown OR deactivated. One message for both: the required
 * action is the same either way, and it avoids needlessly distinguishing a former employee
 * from an address that never existed.
 */
const NO_ACCESS = 'Email not registered. Please contact your administrator for access.';

export async function POST(req: Request) {
  if (!isOtpConfigured()) {
    return NextResponse.json({ error: 'Login is not configured.' }, { status: 503 });
  }

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const email = (body.email ?? '').trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    // A malformed address is a client mistake, not an account disclosure.
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  const ipHash = hashIp(req);

  const verdict = await checkRequestAllowed(email, ipHash);
  if (!verdict.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Try again shortly.', retryAfter: verdict.retryAfter },
      { status: 429, headers: { 'Retry-After': String(verdict.retryAfter) } },
    );
  }

  maybeSweep();

  // Recorded as failed first; promoted only if a code genuinely goes out.
  const attemptId = await beginAttempt('request', email, ipHash);

  try {
    const user = await findUserByEmail(email);

    // Unknown or deactivated: stop here and say so, rather than sending them to the code
    // screen to wait for an email that is never coming. 403 rather than 400 — the request
    // was well formed, the address simply has no access.
    if (!user || !user.is_active) {
      return NextResponse.json({ error: NO_ACCESS }, { status: 403 });
    }

    const result = await sendLoginCode(email);

    if (!result.ok && result.reason === 'throttled') {
      // GoTrue's own throttle. Surfacing this is safe: the caller already proved they
      // can reach this address's cooldown, so it reveals nothing new.
      return NextResponse.json(
        { error: 'Too many requests. Try again shortly.', retryAfter: result.retryAfter },
        { status: 429, headers: { 'Retry-After': String(result.retryAfter) } },
      );
    }

    if (!result.ok) {
      // Genuine delivery failure. Tell the user something went wrong on our side —
      // this is an outage, not a statement about the account.
      return NextResponse.json(
        { error: "We couldn't send the code right now. Please try again." },
        { status: 502 },
      );
    }

    await markAttemptSucceeded(attemptId);
    return NextResponse.json(SENT_OK);
  } catch (err) {
    // Never return error.message — it can carry database and connection details.
    console.error('[otp/request] failed:', err);
    return NextResponse.json(
      { error: "We couldn't send the code right now. Please try again." },
      { status: 500 },
    );
  }
}
